import { IpcMainInvokeEvent } from "electron";
import log from "electron-log";
import { db } from "../../db";
import { mcpServers, mcpToolConsents } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { createLoggedHandler } from "./safe_handle";
import fs from "node:fs";
import path from "node:path";
import { getUserDataPath } from "../../paths/paths";

import { resolveConsent } from "../utils/mcp_consent";
import { getStoredConsent } from "../utils/mcp_consent";
import { mcpManager } from "../utils/mcp_manager";
import { CreateMcpServer, McpServerUpdate, McpTool } from "../ipc_types";

const logger = log.scope("mcp_handlers");
const handle = createLoggedHandler(logger);

type ConsentDecision = "accept-once" | "accept-always" | "decline";

export function registerMcpHandlers() {
  // CRUD for MCP servers
  handle("mcp:list-servers", async () => {
    return await db.select().from(mcpServers);
  });

  handle(
    "mcp:create-server",
    async (_event: IpcMainInvokeEvent, params: CreateMcpServer) => {
      const { name, transport, command, args, envJson, url, enabled } = params;
      const result = await db
        .insert(mcpServers)
        .values({
          name,
          transport,
          command: command || null,
          args: args || null,
          envJson: envJson || null,
          url: url || null,
          enabled: !!enabled,
        })
        .returning();
      return result[0];
    },
  );

  handle(
    "mcp:update-server",
    async (_event: IpcMainInvokeEvent, params: McpServerUpdate) => {
      const update: any = {};
      if (params.name !== undefined) update.name = params.name;
      if (params.transport !== undefined) update.transport = params.transport;
      if (params.command !== undefined) update.command = params.command;
      if (params.args !== undefined) update.args = params.args || null;
      if (params.cwd !== undefined) update.cwd = params.cwd;
      if (params.envJson !== undefined) update.envJson = params.envJson || null;
      if (params.url !== undefined) update.url = params.url;
      if (params.enabled !== undefined) update.enabled = !!params.enabled;

      const result = await db
        .update(mcpServers)
        .set(update)
        .where(eq(mcpServers.id, params.id))
        .returning();
      // If server config changed, dispose cached client to be recreated on next use
      try {
        mcpManager.dispose(params.id);
      } catch {}
      return result[0];
    },
  );

  handle(
    "mcp:delete-server",
    async (_event: IpcMainInvokeEvent, id: number) => {
      try {
        mcpManager.dispose(id);
      } catch {}
      await db.delete(mcpServers).where(eq(mcpServers.id, id));
      return { success: true };
    },
  );

  // Tools listing (dynamic)
  handle(
    "mcp:list-tools",
    async (
      _event: IpcMainInvokeEvent,
      serverId: number,
    ): Promise<McpTool[]> => {
      try {
        const client = await mcpManager.getClient(serverId);
        const remoteTools = await client.tools();
        const tools = await Promise.all(
          Object.entries(remoteTools).map(async ([name, tool]) => ({
            name,
            description: tool.description ?? null,
            consent: await getStoredConsent(serverId, name),
          })),
        );
        return tools;
      } catch (e) {
        logger.error("Failed to list tools", e);
        return [];
      }
    },
  );
  // Consents
  handle("mcp:get-tool-consents", async () => {
    return await db.select().from(mcpToolConsents);
  });

  handle(
    "mcp:set-tool-consent",
    async (
      _event: IpcMainInvokeEvent,
      params: {
        serverId: number;
        toolName: string;
        consent: "ask" | "always" | "denied";
      },
    ) => {
      const existing = await db
        .select()
        .from(mcpToolConsents)
        .where(
          and(
            eq(mcpToolConsents.serverId, params.serverId),
            eq(mcpToolConsents.toolName, params.toolName),
          ),
        );
      if (existing.length > 0) {
        const result = await db
          .update(mcpToolConsents)
          .set({ consent: params.consent })
          .where(
            and(
              eq(mcpToolConsents.serverId, params.serverId),
              eq(mcpToolConsents.toolName, params.toolName),
            ),
          )
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(mcpToolConsents)
          .values({
            serverId: params.serverId,
            toolName: params.toolName,
            consent: params.consent,
          })
          .returning();
        return result[0];
      }
    },
  );

  // Tool consent request/response handshake
  // Receive consent response from renderer
  handle(
    "mcp:tool-consent-response",
    async (_event, data: { requestId: string; decision: ConsentDecision }) => {
      resolveConsent(data.requestId, data.decision);
    },
  );

  handle(
    "mcp:import-json",
    async (_event: IpcMainInvokeEvent, payload: { json: string }) => {
      const raw = payload.json;
      const data = JSON.parse(raw);
      const servers: Record<string, any> = data?.mcpServers || {};
      for (const [name, cfg] of Object.entries(servers)) {
        const transport = cfg.url ? "http" : "stdio";
        const command: string | null = cfg.command ?? null;
        const args: string[] | null = Array.isArray(cfg.args) ? cfg.args : null;
        const envJson: Record<string, string> | null = cfg.env ?? null;
        const url: string | null = cfg.url ?? null;
        const enabled = cfg.enabled !== undefined ? !!cfg.enabled : true;
        const existing = await db.query.mcpServers.findFirst({
          where: eq(mcpServers.name, name),
        });
        let serverId: number;
        if (existing) {
          const result = await db
            .update(mcpServers)
            .set({ name, transport, command, args, envJson, url, enabled })
            .where(eq(mcpServers.id, existing.id))
            .returning();
          serverId = result[0].id as number;
        } else {
          const result = await db
            .insert(mcpServers)
            .values({ name, transport, command, args, envJson, url, enabled })
            .returning();
          serverId = result[0].id as number;
        }
        const alwaysAllow: string[] = Array.isArray(cfg.alwaysAllow)
          ? cfg.alwaysAllow
          : [];
        for (const toolName of alwaysAllow) {
          const existingConsent = await db
            .select()
            .from(mcpToolConsents)
            .where(
              and(
                eq(mcpToolConsents.serverId, serverId),
                eq(mcpToolConsents.toolName, toolName),
              ),
            );
          if (existingConsent.length > 0) {
            await db
              .update(mcpToolConsents)
              .set({ consent: "always" })
              .where(
                and(
                  eq(mcpToolConsents.serverId, serverId),
                  eq(mcpToolConsents.toolName, toolName),
                ),
              );
          } else {
            await db
              .insert(mcpToolConsents)
              .values({ serverId, toolName, consent: "always" });
          }
        }
      }
      const outPath = path.join(getUserDataPath(), "mcp.json");
      const output = JSON.stringify(data, null, 2);
      fs.mkdirSync(getUserDataPath(), { recursive: true });
      fs.writeFileSync(outPath, output, "utf-8");
      return { success: true, path: outPath };
    },
  );

  handle("mcp:export-json", async () => {
    const list = await db.select().from(mcpServers);
    const consents = await db.select().from(mcpToolConsents);
    const byServer: Record<number, string[]> = {};
    for (const c of consents) {
      if (c.consent === "always") {
        byServer[c.serverId] = byServer[c.serverId] || [];
        byServer[c.serverId].push(c.toolName);
      }
    }
    const mcpServersJson: Record<string, any> = {};
    for (const s of list) {
      const entry: any = { enabled: !!s.enabled };
      if (s.transport === "http") {
        if (s.url) entry.url = s.url;
      } else {
        if (s.command) entry.command = s.command;
        if (Array.isArray(s.args)) entry.args = s.args;
        if (s.envJson) entry.env = s.envJson;
      }
      const tools = byServer[s.id] || [];
      if (tools.length > 0) entry.alwaysAllow = tools;
      mcpServersJson[s.name] = entry;
    }
    const result = { mcpServers: mcpServersJson };
    const outPath = path.join(getUserDataPath(), "mcp.json");
    fs.mkdirSync(getUserDataPath(), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
    return { json: result, path: outPath };
  });
}
