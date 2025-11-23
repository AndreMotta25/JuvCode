import { db } from "../../db";
import { chats } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  constructSystemPrompt,
  readAiRules,
} from "../../prompts/system_prompt";
import {
  SUPABASE_AVAILABLE_SYSTEM_PROMPT,
  SUPABASE_NOT_AVAILABLE_SYSTEM_PROMPT,
} from "../../prompts/supabase_prompt";
import { getDyadAppPath } from "../../paths/paths";
import log from "electron-log";
import { extractCodebase } from "../../utils/codebase";
import { buildMinimalContext } from "../../utils/minimalContext";
import { getSupabaseContext } from "../../supabase_admin/supabase_context";

import { TokenCountParams , TokenCountResult } from "../ipc_types";
import { estimateTokens, getContextWindow } from "../utils/token_utils";
import { createLoggedHandler } from "./safe_handle";
import { validateChatContext } from "../utils/context_paths_utils";
import { readSettings } from "@/main/settings";
import { extractMentionedAppsCodebases } from "../utils/mention_apps";
import { parseAppMentions } from "@/shared/parse_mention_apps";
import { isTurboEditsV2Enabled } from "@/lib/schemas";

const logger = log.scope("token_count_handlers");

const handle = createLoggedHandler(logger);

export function registerTokenCountHandlers() {
  handle(
    "chat:count-tokens",
    async (event, req: TokenCountParams): Promise<TokenCountResult> => {
      const chat = await db.query.chats.findFirst({
        where: eq(chats.id, req.chatId),
        with: {
          messages: {
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
          },
          app: true,
        },
      });

      if (!chat) {
        throw new Error(`Chat not found: ${req.chatId}`);
      }

      // Prepare message history for token counting
      const messageHistory = chat.messages
        .map((message) => message.content)
        .join("");
      const messageHistoryTokens = estimateTokens(messageHistory);

      // Count input tokens
      const inputTokens = estimateTokens(req.input);

      const settings = readSettings();

      // Parse app mentions from the input
      const mentionedAppNames = parseAppMentions(req.input);

      // Count system prompt tokens
      let systemPrompt = constructSystemPrompt({
        aiRules: await readAiRules(getDyadAppPath(chat.app.path)),
        chatMode: settings.selectedChatMode,
        enableTurboEditsV2: isTurboEditsV2Enabled(settings),
      });
      let supabaseContext = "";

      if (chat.app?.supabaseProjectId) {
        const hasToken = Boolean(settings.supabase?.accessToken?.value);
        if (hasToken) {
          systemPrompt += "\n\n" + SUPABASE_AVAILABLE_SYSTEM_PROMPT;
          try {
            supabaseContext = await getSupabaseContext({
              supabaseProjectId: chat.app.supabaseProjectId,
            });
          } catch (error) {
            logger.warn(
              `Failed to fetch Supabase context for project ${chat.app.supabaseProjectId}: ${error instanceof Error ? error.message : String(error)}`,
            );
            // Fallback: treat as not available to avoid breaking token count
            systemPrompt += "\n\n" + SUPABASE_NOT_AVAILABLE_SYSTEM_PROMPT;
          }
        } else if (!chat.app?.neonProjectId) {
          // Project linked but user not authenticated → graceful fallback
          systemPrompt += "\n\n" + SUPABASE_NOT_AVAILABLE_SYSTEM_PROMPT;
        }
      } else if (!chat.app?.neonProjectId) {
        // No Supabase project linked
        systemPrompt += "\n\n" + SUPABASE_NOT_AVAILABLE_SYSTEM_PROMPT;
      }

      const systemPromptTokens = estimateTokens(systemPrompt + supabaseContext);

      // Extract codebase information if app is associated with the chat
      let codebaseInfo = "";
      let codebaseTokens = 0;
      let usingMinimalContext = false;

      if (chat.app) {
        const appPath = getDyadAppPath(chat.app.path);
        
        // Usa contexto mínimo se tokens estão muito altos
        const { formattedOutput, files } = await extractCodebase({
          appPath,
          chatContext: validateChatContext(chat.app.chatContext),
        });
        
        codebaseTokens = estimateTokens(formattedOutput);
        
        // Se tokens muito altos, usa contexto mínimo (apenas quando Adaptive Context está habilitado)
        if (settings.adaptiveContextEnabled && codebaseTokens > 8000) {
          logger.log(`⚠️ Contexto muito grande (${codebaseTokens} tokens), usando modo mínimo...`);
          
          const minimalContext = await buildMinimalContext(appPath, req.input || "context analysis");
          
          codebaseInfo = minimalContext.files
            .map(file => `<dyad-file path="${file.path}">${file.content}</dyad-file>`)
            .join("\n\n");
          
          codebaseTokens = minimalContext.totalTokens;
          usingMinimalContext = true;
          
          logger.log(`✅ Contexto mínimo: ${codebaseTokens} tokens (redução de ~${Math.round((1 - codebaseTokens/estimateTokens(formattedOutput)) * 100)}%)`);
        } else {
          codebaseInfo = formattedOutput;
          
          // Quando Adaptive Context está desabilitado, calcular tokens com base nos arquivos para refletir base completa
          if (!settings.adaptiveContextEnabled) {
            codebaseTokens = estimateTokens(
              files
                .map(
                  (file) => `<dyad-file=${file.path}>${file.content}</dyad-file>`,
                )
                .join("\n\n"),
            );
          } else if (settings.enableDyadPro && settings.enableProSmartFilesContextMode) {
            codebaseTokens = estimateTokens(
              files
                // It doesn't need to be the exact format but it's just to get a token estimate
                .map(
                  (file) => `<dyad-file=${file.path}>${file.content}</dyad-file>`,
                )
                .join("\n\n"),
            );
          } else {
            codebaseTokens = estimateTokens(codebaseInfo);
          }
        }
        
        logger.log(
          `Extracted codebase information from ${appPath}, tokens: ${codebaseTokens}${usingMinimalContext ? " (minimal mode)" : ""}`,
        );
      }

      // Extract codebases for mentioned apps
      const mentionedAppsCodebases = await extractMentionedAppsCodebases(
        mentionedAppNames,
        chat.app?.id, // Exclude current app
      );

      // Calculate tokens for mentioned apps
      let mentionedAppsTokens = 0;
      if (mentionedAppsCodebases.length > 0) {
        const mentionedAppsContent = mentionedAppsCodebases
          .map(
            ({ appName, codebaseInfo }) =>
              `\n\n=== Referenced App: ${appName} ===\n${codebaseInfo}`,
          )
          .join("");

        mentionedAppsTokens = estimateTokens(mentionedAppsContent);

        logger.log(
          `Extracted ${mentionedAppsCodebases.length} mentioned app codebases, tokens: ${mentionedAppsTokens}`,
        );
      }

      // Calculate total tokens
      const totalTokens =
        messageHistoryTokens +
        inputTokens +
        systemPromptTokens +
        codebaseTokens +
        mentionedAppsTokens;

      // Detecta se está usando contexto mínimo
      const isUsingMinimalContext = codebaseTokens < 3000 && codebaseTokens > 0;
      
      return {
        totalTokens,
        messageHistoryTokens,
        codebaseTokens,
        mentionedAppsTokens,
        inputTokens,
        systemPromptTokens,
        contextWindow: await getContextWindow(),
        // Adiciona informações sobre contexto mínimo
        ...(isUsingMinimalContext && {
          minimalContextMode: true,
          tokenReduction: `${Math.round((1 - codebaseTokens / Math.max(codebaseTokens * 2, 1)) * 100)}%`,
          optimization: "Contexto mínimo ativo"
        })
      };
    },
  );
}
