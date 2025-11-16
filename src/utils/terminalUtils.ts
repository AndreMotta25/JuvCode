import { spawn, ChildProcess } from "child_process";

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  process?: ChildProcess;
  isActive: boolean;
  createdAt: Date;
}

export interface TerminalCommand {
  id: string;
  command: string;
  timestamp: Date;
  status: "running" | "completed" | "failed";
  output: string;
  error?: string;
  cwd: string;
}

export interface TerminalOutput {
  id: string;
  sessionId: string;
  type: "command" | "stdout" | "stderr" | "system";
  content: string;
  timestamp: Date;
  commandId?: string;
}

// Lista de comandos permitidos (whitelist) - TODOS OS COMANDOS SÃO PERMITIDOS
export const ALLOWED_COMMANDS = []; // Vazia para permitir qualquer comando

// Lista de comandos bloqueados (blacklist) - REMOVIDA
export const BLOCKED_COMMANDS = []; // Vazia para permitir qualquer comando

export interface SecurityCheckResult {
  isAllowed: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

/**
 * Verifica se um comando é seguro para executar
 * SEMPRE PERMITE TODOS OS COMANDOS - BLACKLIST REMOVIDA
 */
export function checkCommandSecurity(command: string): SecurityCheckResult {
  const trimmedCommand = command.trim();
  
  // Verificação de blacklist REMOVIDA - todos os comandos são permitidos
  
  // Verificação de whitelist REMOVIDA - todos os comandos são permitidos
  
  // Sanitização REMOVIDA - todos os comandos passam como estão
  
  return {
    isAllowed: true,
    sanitizedCommand: trimmedCommand
  };
}

/**
 * Gera ID único para terminal
 */
export function generateTerminalId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gera ID único para comando
 */
export function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gera ID único para output
 */
export function generateOutputId(): string {
  return `out-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formata timestamp para exibição
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Detecta tipo de comando
 */
export function detectCommandType(command: string): string {
  const cmd = command.toLowerCase().trim();
  
  if (cmd.startsWith('npm') || cmd.startsWith('yarn') || cmd.startsWith('pnpm')) {
    return 'package-manager';
  }
  
  if (cmd.startsWith('git')) {
    return 'git';
  }
  
  if (cmd.startsWith('docker')) {
    return 'docker';
  }
  
  if (cmd.includes('install') || cmd.includes('add') || cmd.includes('remove')) {
    return 'dependency';
  }
  
  if (cmd.includes('build') || cmd.includes('start') || cmd.includes('dev')) {
    return 'dev-server';
  }
  
  if (cmd.includes('test')) {
    return 'testing';
  }
  
  return 'general';
}

/**
 * Colore comando baseado no tipo
 */
export function getCommandColor(command: string): string {
  const type = detectCommandType(command);
  
  switch (type) {
    case 'package-manager':
      return 'text-yellow-400';
    case 'git':
      return 'text-orange-400';
    case 'docker':
      return 'text-blue-400';
    case 'dependency':
      return 'text-purple-400';
    case 'dev-server':
      return 'text-green-400';
    case 'testing':
      return 'text-cyan-400';
    default:
      return 'text-gray-300';
  }
}

/**
 * Simula output para comandos comuns
 */
export function simulateCommandOutput(command: string): string {
  const cmd = command.toLowerCase().trim();
  
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    return `🚀 Dyad Terminal - Comandos Disponíveis:

📦 Package Managers:
  npm run <script>     - Executa script npm
  npm install <pkg>    - Instala pacote
  pnpm add <pkg>       - Instala com pnpm

🔧 Git Operations:
  git status           - Status do repositório
  git add .            - Adiciona arquivos
  git commit -m "<msg>" - Commit mudanças
  git push             - Push para remoto

🛠️ Development:
  npm run dev          - Inicia servidor desenvolvimento
  npm run build        - Build para produção
  npm test             - Executa testes
  npm run lint         - Verifica linting

ℹ️ System:
  pwd                  - Diretório atual
  ls                   - Lista arquivos
  clear                - Limpa terminal
  help                 - Mostra esta ajuda

💡 Dica: Use Ctrl+C para cancelar comando`;
  }
  
  if (cmd === 'pwd') {
    return `/home/user/projects`;
  }
  
  if (cmd === 'clear') {
    return '';
  }
  
  if (cmd === 'ls') {
    return `src/          node_modules/    public/         package.json`;
  }
  
  if (cmd === 'whoami') {
    return `developer`;
  }
  
  return `Comando simulado: ${command}`;
}