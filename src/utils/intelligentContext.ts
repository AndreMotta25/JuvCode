import fsAsync from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

// Interface simplificada para busca inteligente
export interface IntelligentSearchResult {
  path: string;
  relevanceScore: number;
  fileType: string;
  size: number;
  matchedKeywords: string[];
}

// Cache para resultados de busca
const searchCache = new Map<string, {
  results: IntelligentSearchResult[];
  timestamp: number;
}>();
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// Palavras-chave técnicas para análise
const TECHNICAL_KEYWORDS = new Set([
  'api', 'endpoint', 'function', 'class', 'interface', 'component',
  'hook', 'useState', 'useEffect', 'async', 'await', 'promise',
  'router', 'context', 'provider', 'store', 'action', 'reducer',
  'database', 'schema', 'model', 'service', 'controller', 'route',
  'middleware', 'auth', 'login', 'register', 'validation', 'error',
  'http', 'request', 'response', 'json', 'xml', 'websocket'
]);

/**
 * Busca inteligente de arquivos baseada em query do usuário
 */
export async function intelligentFileSearch(
  appPath: string,
  query: string,
  maxResults = 10
): Promise<IntelligentSearchResult[]> {
  const cacheKey = `${appPath}:${query}:${maxResults}`;
  const now = Date.now();
  
  // Verifica cache
  const cached = searchCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < SEARCH_CACHE_TTL) {
    console.log(`Cache hit para busca inteligente: "${query}"`);
    return cached.results;
  }

  try {
    console.log(`Executando busca inteligente para: "${query}"`);
    
    // Extrai palavras-chave da query
    const queryKeywords = extractKeywords(query);
    
    // Coleta arquivos relevantes usando glob
    const files = await collectRelevantFiles(appPath);
    
    // Analisa e pontua cada arquivo
    const scoredFiles = files.map(file => {
      const score = calculateRelevanceScore(file, queryKeywords);
      return { file, score };
    }).filter(item => item.score > 0);
    
    // Ordena por relevância e limita resultados
    const results = scoredFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => ({
        path: item.file.path,
        relevanceScore: item.score,
        fileType: item.file.type,
        size: item.file.size,
        matchedKeywords: item.file.matchedKeywords
      }));
    
    // Cache do resultado
    searchCache.set(cacheKey, {
      results,
      timestamp: now
    });
    
    console.log(`Busca inteligente encontrou ${results.length} arquivos relevantes`);
    return results;
    
  } catch (error) {
    console.error('Erro na busca inteligente:', error);
    return [];
  }
}

/**
 * Extrai palavras-chave de uma query
 */
function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 10); // Máximo 10 palavras
}

/**
 * Coleta arquivos relevantes da base de código
 */
async function collectRelevantFiles(appPath: string): Promise<Array<{
  path: string;
  name: string;
  type: string;
  size: number;
  content: string;
  keywords: string[];
  matchedKeywords: string[];
}>> {
  const files: Array<{
    path: string;
    name: string;
    type: string;
    size: number;
    content: string;
    keywords: string[];
    matchedKeywords: string[];
  }> = [];

  try {
    // Usa glob para encontrar arquivos relevantes
    const allFiles = await glob(`${appPath}/**/*.{ts,tsx,js,jsx,py,java,cs,go,rs,php,rb,kt,swift,css,html,vue,svelte,json,md}`, {
      nodir: true,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/venv/**',
        '**/*.min.js',
        '**/*.min.css',
        'package-lock.json',
        'pnpm-lock.yaml'
      ]
    });

    // Processa arquivos em lotes para performance
    const batchSize = 100;
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (filePath: string) => {
        try {
          const stats = await fsAsync.stat(filePath);
          
          // Pula arquivos muito grandes (> 500KB)
          if (stats.size > 500 * 1024) return;
          
          const content = await fsAsync.readFile(filePath, 'utf-8');
          const relativePath = path.relative(appPath, filePath);
          const fileName = path.basename(filePath);
          
          // Extrai palavras-chave do arquivo
          const fileKeywords = extractKeywordsFromContent(content);
          
          files.push({
            path: relativePath,
            name: fileName,
            type: getFileType(filePath),
            size: stats.size,
            content: content.substring(0, 5000), // Limita conteúdo analisado
            keywords: fileKeywords,
            matchedKeywords: []
          });
        } catch (error) {
          // Ignora arquivos que não conseguimos processar
        }
      });

      await Promise.all(batchPromises);
    }
  } catch (error) {
    console.error('Erro ao coletar arquivos:', error);
  }

  return files;
}

/**
 * Extrai palavras-chave do conteúdo de um arquivo
 */
function extractKeywordsFromContent(content: string): string[] {
  // Remove comentários e strings para análise mais limpa
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/"[^"]*"/g, ' "STRING" ')
    .replace(/'[^']*'/g, ' "STRING" ')
    .replace(/`[^`]*`/g, ' "STRING" ');

  // Extrai identificadores (funções, classes, variáveis)
  const identifiers = cleanContent.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
  
  const keywordCount = new Map<string, number>();
  identifiers.forEach(identifier => {
    const keyword = identifier.toLowerCase();
    if (keyword.length > 2) {
      keywordCount.set(keyword, (keywordCount.get(keyword) || 0) + 1);
    }
  });

  // Retorna palavras mais frequentes
  return Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);
}

/**
 * Calcula score de relevância de um arquivo para uma query
 */
function calculateRelevanceScore(
  file: {
    path: string;
    name: string;
    keywords: string[];
  },
  queryKeywords: string[]
): number {
  let score = 0;
  const matchedKeywords: string[] = [];

  // Score baseado no nome do arquivo (peso alto)
  const fileNameLower = file.name.toLowerCase();
  queryKeywords.forEach(keyword => {
    if (fileNameLower.includes(keyword)) {
      score += 25;
      matchedKeywords.push(keyword);
    }
  });

  // Score baseado no caminho do arquivo
  const pathLower = file.path.toLowerCase();
  queryKeywords.forEach(keyword => {
    if (pathLower.includes(keyword)) {
      score += 15;
      if (!matchedKeywords.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
  });

  // Score baseado em palavras-chave técnicas (peso médio)
  queryKeywords.forEach(keyword => {
    if (TECHNICAL_KEYWORDS.has(keyword)) {
      score += 20;
      if (!matchedKeywords.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
  });

  // Score baseado em keywords matching no conteúdo
  const contentMatches = queryKeywords.filter(keyword => 
    file.keywords.some(fileKeyword => 
      fileKeyword.includes(keyword) || keyword.includes(fileKeyword)
    )
  );
  score += contentMatches.length * 10;
  contentMatches.forEach(keyword => {
    if (!matchedKeywords.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  });

  // Bonus por múltiplas keywords matching
  if (matchedKeywords.length > 1) {
    score += matchedKeywords.length * 5;
  }

  // Penalty por arquivos muito genéricos
  const genericTerms = ['test', 'spec', 'index', 'main'];
  const hasGenericTerm = genericTerms.some(term => 
    file.name.toLowerCase().includes(term)
  );
  if (hasGenericTerm && matchedKeywords.length === 0) {
    score = 0;
  }

  return score;
}

/**
 * Determina tipo de arquivo pela extensão
 */
function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript-react',
    '.js': 'javascript', '.jsx': 'javascript-react',
    '.py': 'python', '.java': 'java', '.cs': 'csharp',
    '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby',
    '.kt': 'kotlin', '.swift': 'swift',
    '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.html': 'html', '.vue': 'vue', '.svelte': 'svelte',
    '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.md': 'markdown',
  };
  return typeMap[ext] || 'unknown';
}

/**
 * Constrói contexto inteligente baseado em busca
 */
export async function buildIntelligentContext(
  appPath: string,
  query: string,
  maxFiles = 15
): Promise<{
  files: Array<{
    path: string;
    content: string;
    relevanceScore: number;
    matchedKeywords: string[];
  }>;
  searchMethod: 'intelligent' | 'fallback';
  totalFiles: number;
}> {
  try {
    // Tenta busca inteligente
    const searchResults = await intelligentFileSearch(appPath, query, maxFiles);
    
    if (searchResults.length === 0) {
      // Fallback para busca com padrões glob se busca inteligente falhar
      const fallbackResults = await fallbackGlobSearch(appPath, query, maxFiles);
      return {
        files: fallbackResults,
        searchMethod: 'fallback',
        totalFiles: fallbackResults.length
      };
    }

    // Constrói contexto com os arquivos encontrados
    const contextFiles = [];
    
    for (const result of searchResults) {
      try {
        const fullPath = path.join(appPath, result.path);
        const content = await fsAsync.readFile(fullPath, 'utf-8');
        
        contextFiles.push({
          path: result.path,
          content: content,
          relevanceScore: result.relevanceScore,
          matchedKeywords: result.matchedKeywords
        });
      } catch (error) {
        console.warn(`Erro ao ler arquivo ${result.path}:`, error);
      }
    }

    return {
      files: contextFiles,
      searchMethod: 'intelligent',
      totalFiles: searchResults.length
    };

  } catch (error) {
    console.error('Erro ao construir contexto inteligente:', error);
    
    // Fallback final
    const fallbackResults = await fallbackGlobSearch(appPath, query, maxFiles);
    return {
      files: fallbackResults,
      searchMethod: 'fallback',
      totalFiles: fallbackResults.length
    };
  }
}

/**
 * Fallback com busca por padrões glob
 */
async function fallbackGlobSearch(
  appPath: string,
  query: string,
  maxFiles: number
): Promise<Array<{
  path: string;
  content: string;
  relevanceScore: number;
  matchedKeywords: string[];
}>> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const results: Array<{
    path: string;
    content: string;
    relevanceScore: number;
    matchedKeywords: string[];
  }> = [];

  try {
    // Cria padrões de busca baseados nas keywords
    const patterns = [
      `**/*${keywords[0]}*`,
      `**/*.{ts,tsx,js,jsx,py,java,cs}`
    ];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: appPath,
        nodir: true,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**'
        ]
      });

      for (const match of matches.slice(0, 20)) { // Limita matches por padrão
        try {
          const filePath = path.join(appPath, match);
          const content = await fsAsync.readFile(filePath, 'utf-8');
          const relativePath = path.relative(appPath, filePath);
          
          // Calcula score simples baseado em keywords no nome
          let score = 0;
          const matchedKeywords: string[] = [];
          
          keywords.forEach(keyword => {
            if (match.toLowerCase().includes(keyword)) {
              score += 10;
              matchedKeywords.push(keyword);
            }
          });

          if (score > 0) {
            results.push({
              path: relativePath,
              content: content,
              relevanceScore: score,
              matchedKeywords
            });
          }
        } catch (error) {
          // Ignora arquivos que não conseguimos ler
        }
      }
    }
  } catch (error) {
    console.error('Erro no fallback glob search:', error);
  }

  // Remove duplicatas e ordena por score
  const uniqueResults = results.filter((result, index, self) => 
    index === self.findIndex(r => r.path === result.path)
  );

  return uniqueResults
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxFiles);
}

/**
 * Limpa cache de busca
 */
export function clearSearchCache(): void {
  searchCache.clear();
  console.log('Cache de busca inteligente limpo');
}

/**
 * Obtém estatísticas do cache
 */
export function getSearchCacheStats(): { entries: number; totalSize: number } {
  return {
    entries: searchCache.size,
    totalSize: searchCache.size // Simplified for now
  };
}