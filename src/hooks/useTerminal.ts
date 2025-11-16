import { useState, useCallback, useEffect, useRef } from "react";
import { IpcClient } from "../ipc/ipc_client";
import { 
  TerminalSession, 
  TerminalOutput, 
  generateTerminalId 
} from "../utils/terminalUtils";

export interface UseTerminalReturn {
  // Estado
  sessions: TerminalSession[];
  activeSessionId: string | null;
  terminalOutput: TerminalOutput[];
  isExecuting: boolean;
  commandHistory: string[];
  historyIndex: number;
  
  // Ações
  createSession: (name?: string) => string;
  closeSession: (sessionId: string) => void;
  switchSession: (sessionId: string) => void;
  clearOutput: (sessionId?: string) => void;
  executeCommand: (command: string) => Promise<void>;
  cancelCommand: () => void;
  addToHistory: (command: string) => void;
  navigateHistory: (direction: "up" | "down") => string | null;
}

export function useTerminal(): UseTerminalReturn {
  // Estado das sessões
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [
    {
      id: generateTerminalId(),
      name: "Terminal 1",
      cwd: "/home/user/projects",
      isActive: true,
      createdAt: new Date()
    }
  ]);
  
  // Sessão ativa
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Output do terminal
  const [terminalOutput, setTerminalOutput] = useState<TerminalOutput[]>([]);
  
  // Estado de execução
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Histórico de comandos
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Referência para limpar outputs antigos
  const cleanupTimer = useRef<NodeJS.Timeout | null>(null);

  // Inicializar sessão ativa e output de boas-vindas
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      const firstSession = sessions[0];
      setActiveSessionId(firstSession.id);
      
      const welcomeOutput: TerminalOutput = {
        id: "welcome",
        sessionId: firstSession.id,
        type: "system",
        content: "🚀 Bem-vindo ao Dyad Terminal!\n💡 Digite 'help' para ver comandos disponíveis\n\n💻 Use as abas acima para alternar entre sessões do terminal",
        timestamp: new Date()
      };
      
      setTerminalOutput([welcomeOutput]);
    }
  }, [sessions, activeSessionId]);
  
  // Configurar listeners para outputs em tempo real
  useEffect(() => {
    if (!activeSessionId) return;
    
    // Listener para output do terminal
    const outputListener = (data: any) => {
      if (data.sessionId !== activeSessionId) return;
      const output: TerminalOutput = {
        id: `out-${Date.now()}`,
        sessionId: activeSessionId,
        type: data.type,
        content: data.data,
        timestamp: new Date(data.timestamp),
        commandId: data.commandId
      };
      setTerminalOutput(prev => [...prev, output]);
    };
    
    // Listener para limpeza de terminal
    const clearListener = (data: any) => {
      if (data.sessionId !== activeSessionId) return;
      clearOutput(activeSessionId!);
    };
    
    // Adicionar listeners ao renderer global
    if ((window as any).electron?.ipcRenderer) {
      const renderer = (window as any).electron.ipcRenderer;
      renderer.on("terminal:output", outputListener);
      renderer.on("terminal:clear", clearListener);
    }
    
    // Cleanup
    return () => {
      if ((window as any).electron?.ipcRenderer) {
        const renderer = (window as any).electron.ipcRenderer;
        renderer.removeListener("terminal:output", outputListener);
        renderer.removeListener("terminal:clear", clearListener);
      }
    };
  }, [activeSessionId]);
  
  // Criar nova sessão
  const createSession = useCallback((name?: string) => {
    const newSessionId = generateTerminalId();
    const sessionName = name || `Terminal ${sessions.length + 1}`;
    
    const newSession: TerminalSession = {
      id: newSessionId,
      name: sessionName,
      cwd: "/home/user/projects",
      isActive: false,
      createdAt: new Date()
    };
    
    setSessions(prev => [...prev, newSession]);
    
    // Adicionar output de boas-vindas
    const welcomeOutput: TerminalOutput = {
      id: `welcome-${newSessionId}`,
      sessionId: newSessionId,
      type: "system",
      content: `🚀 Nova sessão criada: ${sessionName}\n💡 Digite 'help' para ver comandos disponíveis`,
      timestamp: new Date()
    };
    
    setTerminalOutput(prev => [...prev, welcomeOutput]);
    
    return newSessionId;
  }, [sessions.length]);
  
  // Fechar sessão
  const closeSession = useCallback((sessionId: string) => {
    if (sessions.length <= 1) return; // Sempre manter pelo menos uma sessão
    
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // Remover output da sessão
    setTerminalOutput(prev => prev.filter(o => o.sessionId !== sessionId));
    
    // Se era a sessão ativa, mudar para outra
    if (activeSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      const newActive = remainingSessions[0]?.id || null;
      setActiveSessionId(newActive);
      
      if (newActive) {
        setSessions(prev => prev.map(s => ({
          ...s,
          isActive: s.id === newActive
        })));
      }
    }
  }, [sessions, activeSessionId]);
  
  // Alternar sessão
  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setSessions(prev => prev.map(s => ({
      ...s,
      isActive: s.id === sessionId
    })));
  }, []);
  
  // Limpar output
  const clearOutput = useCallback((sessionId?: string) => {
    const targetSessionId = sessionId || activeSessionId;
    if (!targetSessionId) return;
    
    setTerminalOutput(prev => 
      prev.filter(o => o.sessionId !== targetSessionId)
    );
  }, [activeSessionId]);
  
  // Executar comando
  const executeCommand = useCallback(async (command: string) => {
    if (!activeSessionId || isExecuting) return;
    
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    
    // Adicionar ao histórico
    addToHistory(trimmedCommand);
    
    setIsExecuting(true);
    
    try {
      // Adicionar comando ao output imediatamente
      const commandOutput: TerminalOutput = {
        id: `cmd-${Date.now()}`,
        sessionId: activeSessionId,
        type: "command",
        content: `$ ${trimmedCommand}`,
        timestamp: new Date()
      };
      
      setTerminalOutput(prev => [...prev, commandOutput]);
      
      // Executar comando via IPC
      const result = await IpcClient.getInstance().executeTerminalCommand({
        command: trimmedCommand,
        cwd: "/home/user/projects", // Por enquanto usar caminho fixo
        sessionId: activeSessionId
      });
      
      // Resultado será processado pelo listener IPC
      console.log("Comando executado:", result);
      
    } catch (error) {
      console.error("Erro ao executar comando:", error);
      
      // Adicionar erro ao output
      const errorOutput: TerminalOutput = {
        id: `error-${Date.now()}`,
        sessionId: activeSessionId,
        type: "stderr",
        content: `❌ Erro ao executar comando: ${error}`,
        timestamp: new Date()
      };
      
      setTerminalOutput(prev => [...prev, errorOutput]);
    } finally {
      setIsExecuting(false);
    }
  }, [activeSessionId, isExecuting]);
  
  // Cancelar comando
  const cancelCommand = useCallback(() => {
    // Implementar cancelamento de comando ativo
    console.log("Cancelando comando ativo...");
  }, []);
  
  // Adicionar ao histórico
  const addToHistory = useCallback((command: string) => {
    setCommandHistory(prev => {
      const newHistory = [command, ...prev.filter(cmd => cmd !== command)];
      return newHistory.slice(0, 100); // Manter apenas 100 comandos
    });
    setHistoryIndex(-1);
  }, []);
  
  // Navegar no histórico
  const navigateHistory = useCallback((direction: "up" | "down") => {
    if (commandHistory.length === 0) return null;
    
    let newIndex;
    if (direction === "up") {
      newIndex = historyIndex === -1 ? 0 : Math.min(historyIndex + 1, commandHistory.length - 1);
    } else {
      newIndex = historyIndex <= 0 ? -1 : historyIndex - 1;
    }
    
    setHistoryIndex(newIndex);
    return newIndex === -1 ? "" : commandHistory[newIndex];
  }, [commandHistory, historyIndex]);
  
  return {
    // Estado
    sessions,
    activeSessionId,
    terminalOutput,
    isExecuting,
    commandHistory,
    historyIndex,
    
    // Ações
    createSession,
    closeSession,
    switchSession,
    clearOutput,
    executeCommand,
    cancelCommand,
    addToHistory,
    navigateHistory
  };
}