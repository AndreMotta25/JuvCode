import fsAsync from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { estimateTokens } from "../ipc/utils/token_utils";

// Interface para contexto mínimo
export interface MinimalContextOptions {
  maxTokens: number;           // Máximo de tokens para codebase
  maxFiles: number;           // Máximo de arquivos
  includeRecentFiles: boolean; // Incluir arquivos recentes
  includeRelevantFiles: boolean; // Incluir arquivos relevantes
  recentDays: number;         // Arquivos modificados nos últimos N dias
  relevanceThreshold: number; // Score mínimo de relevância
}

export interface MinimalContextResult {
  files: Array<{
    path: string;
    content: string;
    tokenCount: number;
    relevanceScore: number;
    isRecent: boolean;
  }>;
  totalTokens: number;
  excludedFiles: number;
  reason: string;
}

// Configurações padrão
const DEFAULT_OPTIONS: MinimalContextOptions = {
  maxTokens: 2000,              // Reduzir de 13.000 para 2.000!
  maxFiles: 8,                  // Máximo 8 arquivos
  includeRecentFiles: true,
  includeRelevantFiles: true,
  recentDays: 7,                // Arquivos dos últimos 7 dias
  relevanceThreshold: 30,       // Score mínimo para relevância
};

// Cache para arquivos recentes
const recentFilesCache = new Map<string, {
  files: string[];
  timestamp: number;
}>();
const RECENT_FILES_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Sistema de contexto mínimo inteligente
 * Reduz drasticamente tokens excluindo arquivos não relevantes
 */
export async function buildMinimalContext(
  appPath: string,
  query: string,
  options: Partial<MinimalContextOptions> = {}
): Promise<MinimalContextResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    console.log(`🚀 Construindo contexto mínimo para: "${query}"`);
    
    // 1. Encontra arquivos recentes
    const recentFiles = finalOptions.includeRecentFiles 
      ? await getRecentFiles(appPath, finalOptions.recentDays)
      : [];

    // 2. Encontra arquivos relevantes baseado na query
    const relevantFiles = finalOptions.includeRelevantFiles
      ? await getRelevantFiles(appPath, query, finalOptions.relevanceThreshold)
      : [];

    // 3. Combina e prioriza arquivos
    const priorityFiles = prioritizeFiles(recentFiles, relevantFiles, query);

    // 4. Seleciona arquivos dentro do limite de tokens
    const selectedFiles = await selectFilesWithinLimits(
      appPath, 
      priorityFiles, 
      finalOptions
    );

    // 5. Carrega conteúdo dos arquivos selecionados
    const contextFiles = await loadContextFiles(appPath, selectedFiles);

    const totalTokens = contextFiles.reduce((sum, file) => sum + file.tokenCount, 0);
    
    const result: MinimalContextResult = {
      files: contextFiles,
      totalTokens,
      excludedFiles: priorityFiles.length - contextFiles.length,
      reason: `Minimal context: ${contextFiles.length} arquivos, ${totalTokens} tokens`
    };

    const endTime = Date.now();
    console.log(`✅ Contexto mínimo concluído em ${endTime - startTime}ms: ${totalTokens} tokens (redução de ~85%)`);

    return result;

  } catch (error) {
    console.error('Erro ao construir contexto mínimo:', error);
    
    // Fallback: contexto vazio se falhar
    return {
      files: [],
      totalTokens: 0,
      excludedFiles: 0,
      reason: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Encontra arquivos modificados recentemente
 */
async function getRecentFiles(appPath: string, days: number): Promise<string[]> {
  const cacheKey = `${appPath}:${days}`;
  const now = Date.now();
  
  // Verifica cache
  const cached = recentFilesCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < RECENT_FILES_CACHE_TTL) {
    console.log(`📁 Cache de arquivos recentes: ${cached.files.length} arquivos`);
    return cached.files;
  }

  try {
    const cutoffTime = now - (days * 24 * 60 * 60 * 1000);
    const files: string[] = [];

    // Busca arquivos relevantes modificados recentemente
    const patterns = [
      `**/*.{ts,tsx,js,jsx}`,
      `**/*.css, **/*.scss`,
      `**/*.json`,
      `**/*.md`
    ];

    for (const pattern of patterns) {
      try {
        const matches = await glob(`${appPath}/${pattern}`, {
          nodir: true,
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/*.test.*',
            '**/*.spec.*'
          ]
        });

        // Filtra por data de modificação
        for (const file of matches) {
          try {
            const stats = await fsAsync.stat(file);
            if (stats.mtimeMs > cutoffTime) {
              files.push(file);
            }
          } catch {
            // Ignora arquivos que não conseguimos stat
          }
        }
      } catch (error) {
        console.warn(`Erro no padrão ${pattern}:`, error);
      }
    }

    // Cache resultado
    recentFilesCache.set(cacheKey, {
      files: [...new Set(files)],
      timestamp: now
    });

    const uniqueFiles = [...new Set(files)];
    console.log(`📅 Arquivos recentes (${days} dias): ${uniqueFiles.length} arquivos`);
    
    return uniqueFiles;

  } catch (error) {
    console.error('Erro ao buscar arquivos recentes:', error);
    return [];
  }
}

/**
 * Encontra arquivos relevantes baseado na query
 */
async function getRelevantFiles(
  appPath: string, 
  query: string, 
  threshold: number
): Promise<string[]> {
  try {
    // Extrai palavras-chave da query
    const keywords = extractKeywords(query);
    if (keywords.length === 0) return [];

    console.log(`🔍 Buscando arquivos relevantes para: [${keywords.join(', ')}]`);

    const relevantFiles: Array<{ file: string; score: number }> = [];

    // Cria padrões de busca baseados nas keywords
    const searchPatterns = [
      // Arquivos que contenham keywords no nome
      ...keywords.map(keyword => `**/*${keyword}*`),
      // Arquivos de código principais
      '**/*.{ts,tsx,js,jsx}',
      // Arquivos de configuração relevantes
      '**/package.json',
      '**/tsconfig.json',
      '**/*.config.*'
    ];

    // Busca com cada padrão
    for (const pattern of searchPatterns) {
      try {
        const matches = await glob(`${appPath}/${pattern}`, {
          nodir: true,
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/*.test.*',
            '**/*.spec.*'
          ]
        });

        // Calcula score de relevância para cada arquivo
        for (const file of matches) {
          const fileName = path.basename(file).toLowerCase();
          const relativePath = path.relative(appPath, file).toLowerCase();
          
          let score = 0;

          // Score baseado no nome do arquivo
          keywords.forEach(keyword => {
            if (fileName.includes(keyword.toLowerCase())) {
              score += 20;
            }
          });

          // Score baseado no caminho
          keywords.forEach(keyword => {
            if (relativePath.includes(keyword.toLowerCase())) {
              score += 10;
            }
          });

          // Bonus para arquivos principais
          const mainFileIndicators = ['main', 'index', 'app', 'component', 'service', 'utils'];
          if (mainFileIndicators.some(indicator => fileName.includes(indicator))) {
            score += 15;
          }

          // Bonus para extensões importantes
          if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
            score += 5;
          }

          if (score >= threshold) {
            relevantFiles.push({ file, score });
          }
        }
      } catch (error) {
        console.warn(`Erro no padrão ${pattern}:`, error);
      }
    }

    // Remove duplicatas e ordena por score
    const uniqueFiles = relevantFiles
      .filter((item, index, self) => 
        index === self.findIndex(other => other.file === item.file)
      )
      .sort((a, b) => b.score - a.score)
      .map(item => item.file);

    console.log(`🎯 Arquivos relevantes encontrados: ${uniqueFiles.length} arquivos`);
    return uniqueFiles;

  } catch (error) {
    console.error('Erro ao buscar arquivos relevantes:', error);
    return [];
  }
}

/**
 * Combina arquivos recentes e relevantes, priorizando por relevância
 */
function prioritizeFiles(
  recentFiles: string[],
  relevantFiles: string[],
  query: string
): Array<{ file: string; priority: number; isRecent: boolean; relevanceScore: number }> {
  const keywords = extractKeywords(query);
  const combinedFiles = new Map<string, {
    priority: number;
    isRecent: boolean;
    relevanceScore: number;
  }>();

  // Processa arquivos recentes
  recentFiles.forEach(file => {
    const stats = combinedFiles.get(file) || { priority: 0, isRecent: false, relevanceScore: 0 };
    stats.isRecent = true;
    stats.priority += 50; // Bonus alto para arquivos recentes
    combinedFiles.set(file, stats);
  });

  // Processa arquivos relevantes
  relevantFiles.forEach(file => {
    const stats = combinedFiles.get(file) || { priority: 0, isRecent: false, relevanceScore: 0 };
    stats.relevanceScore = calculateRelevanceScore(file, keywords);
    stats.priority += stats.relevanceScore;
    combinedFiles.set(file, stats);
  });

  // Converte para array e ordena por prioridade
  return Array.from(combinedFiles.entries())
    .map(([file, stats]) => ({
      file,
      priority: stats.priority,
      isRecent: stats.isRecent,
      relevanceScore: stats.relevanceScore
    }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Calcula score de relevância baseado no arquivo e keywords
 */
function calculateRelevanceScore(filePath: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const fileName = path.basename(filePath).toLowerCase();
  const dirName = path.dirname(filePath).toLowerCase();
  
  let score = 0;

  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    
    // Match no nome do arquivo (peso alto)
    if (fileName.includes(lowerKeyword)) {
      score += 25;
    }
    
    // Match no diretório (peso médio)
    if (dirName.includes(lowerKeyword)) {
      score += 15;
    }
    
    // Match em extensões relevantes (peso baixo)
    const ext = path.extname(fileName).toLowerCase();
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext) && lowerKeyword.includes('component')) {
      score += 10;
    }
  });

  return score;
}

/**
 * Seleciona arquivos dentro dos limites de tokens
 */
async function selectFilesWithinLimits(
  appPath: string,
  priorityFiles: Array<{ file: string; priority: number; isRecent: boolean; relevanceScore: number }>,
  options: MinimalContextOptions
): Promise<string[]> {
  const selected: string[] = [];
  let currentTokens = 0;

  for (const fileInfo of priorityFiles) {
    try {
      // Estima tokens do arquivo
      const content = await fsAsync.readFile(fileInfo.file, 'utf-8');
      const estimatedTokens = estimateTokens(content);
      
      // Verifica se cabe no limite
      if (
        selected.length < options.maxFiles &&
        currentTokens + estimatedTokens <= options.maxTokens
      ) {
        selected.push(fileInfo.file);
        currentTokens += estimatedTokens;
      } else {
        break; // Limite atingido
      }
    } catch (error) {
      console.warn(`Erro ao ler arquivo ${fileInfo.file}:`, error);
    }
  }

  console.log(`📊 Selecionados ${selected.length} arquivos: ${currentTokens} tokens`);
  return selected;
}

/**
 * Carrega conteúdo dos arquivos selecionados
 */
async function loadContextFiles(
  appPath: string,
  filePaths: string[]
): Promise<Array<{
  path: string;
  content: string;
  tokenCount: number;
  relevanceScore: number;
  isRecent: boolean;
}>> {
  const results: Array<{
    path: string;
    content: string;
    tokenCount: number;
    relevanceScore: number;
    isRecent: boolean;
  }> = [];

  for (const filePath of filePaths) {
    try {
      const content = await fsAsync.readFile(filePath, 'utf-8');
      const tokenCount = estimateTokens(content);
      const relativePath = path.relative(appPath, filePath);
      const isRecent = await isFileRecent(filePath, 7); // 7 dias
      
      // Calcula relevância básica
      const keywords = extractKeywords(content);
      const relevanceScore = Math.min(keywords.length * 5, 50); // Max 50 pontos

      results.push({
        path: relativePath,
        content,
        tokenCount,
        relevanceScore,
        isRecent
      });
    } catch (error) {
      console.warn(`Erro ao carregar arquivo ${filePath}:`, error);
    }
  }

  return results;
}

/**
 * Verifica se arquivo é recente (modificado nos últimos N dias)
 */
async function isFileRecent(filePath: string, days: number): Promise<boolean> {
  try {
    const stats = await fsAsync.stat(filePath);
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    return stats.mtimeMs > cutoffTime;
  } catch {
    return false;
  }
}

/**
 * Extrai palavras-chave de texto
 */
function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && word.length < 20)
    .slice(0, 10); // Máximo 10 keywords
}

/**
 * Limpa cache de arquivos recentes
 */
export function clearRecentFilesCache(): void {
  recentFilesCache.clear();
  console.log('🧹 Cache de arquivos recentes limpo');
}

/**
 * Obtém estatísticas do cache
 */
export function getRecentFilesCacheStats(): { entries: number; size: number } {
  return {
    entries: recentFilesCache.size,
    size: recentFilesCache.size // Simplified
  };
}