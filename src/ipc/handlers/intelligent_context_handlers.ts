import { z } from "zod";
import { createLoggedHandler } from "./safe_handle";
import log from "electron-log";
import { 
  intelligentFileSearch,
  buildIntelligentContext,
  clearSearchCache,
  getSearchCacheStats
} from "@/utils/intelligentContext";

const logger = log.scope("intelligent_context_handlers");
const handle = createLoggedHandler(logger);

// Schema para busca inteligente
const IntelligentSearchSchema = z.object({
  appId: z.number(),
  query: z.string(),
  maxResults: z.number().optional().default(10),
});

// Schema para construção de contexto
const BuildContextSchema = z.object({
  appId: z.number(),
  query: z.string(),
  maxFiles: z.number().optional().default(15),
});

// Tipos para resposta
export interface IntelligentSearchResult {
  path: string;
  relevanceScore: number;
  fileType: string;
  size: number;
  matchedKeywords: string[];
}

export interface BuildContextResult {
  files: Array<{
    path: string;
    content: string;
    relevanceScore: number;
    matchedKeywords: string[];
  }>;
  searchMethod: 'intelligent' | 'fallback';
  totalFiles: number;
}

export function registerIntelligentContextHandlers() {
  handle(
    "intelligent-search-files",
    async (_, params: z.infer<typeof IntelligentSearchSchema>): Promise<IntelligentSearchResult[]> => {
      const schema = IntelligentSearchSchema;
      schema.parse(params);

      const { appId, query, maxResults } = params;

      try {
        logger.log(`Iniciando busca inteligente para app ${appId}: "${query}"`);
        
        // Simula obtenção do caminho do app (seria substituído pela implementação real)
        const appPath = `/path/to/app/${appId}`;
        
        // Executa busca inteligente
        const searchResults = await intelligentFileSearch(appPath, query, maxResults);

        logger.log(`Busca inteligente encontrou ${searchResults.length} arquivos relevantes`);
        return searchResults;

      } catch (error) {
        logger.error("Erro na busca inteligente:", error);
        throw new Error(`Erro na busca inteligente: ${error}`);
      }
    }
  );

  handle(
    "build-intelligent-context",
    async (_, params: z.infer<typeof BuildContextSchema>): Promise<BuildContextResult> => {
      const schema = BuildContextSchema;
      schema.parse(params);

      const { appId, query, maxFiles } = params;

      try {
        logger.log(`Construindo contexto inteligente para app ${appId} com query: "${query}"`);
        
        // Simula obtenção do caminho do app (seria substituído pela implementação real)
        const appPath = `/path/to/app/${appId}`;
        
        // Constrói contexto inteligente
        const contextResult = await buildIntelligentContext(appPath, query, maxFiles);

        logger.log(`Contexto inteligente construído com ${contextResult.files.length} arquivos usando ${contextResult.searchMethod}`);
        return contextResult;

      } catch (error) {
        logger.error("Erro ao construir contexto inteligente:", error);
        
        // Retorna contexto vazio em caso de erro
        return {
          files: [],
          searchMethod: 'fallback',
          totalFiles: 0
        };
      }
    }
  );

  handle(
    "clear-intelligent-cache",
    async (_): Promise<{ success: boolean }> => {
      try {
        clearSearchCache();
        logger.log("Cache de busca inteligente limpo");
        return { success: true };
      } catch (error) {
        logger.error("Erro ao limpar cache:", error);
        return { success: false };
      }
    }
  );

  handle(
    "get-search-cache-stats",
    async (_): Promise<{ entries: number; totalSize: number }> => {
      try {
        return getSearchCacheStats();
      } catch (error) {
        logger.error("Erro ao obter estatísticas do cache:", error);
        return { entries: 0, totalSize: 0 };
      }
    }
  );
}