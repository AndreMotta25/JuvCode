import { useState, useEffect, useRef, useCallback } from "react";
import { useAtom } from "jotai";
import { isTerminalVisibleAtom, terminalHeightAtom } from "../../atoms/terminalAtoms";
import { X, Terminal, Minimize2, Square, AlertCircle, Loader2, StopCircle, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { IpcClient } from "../../ipc/ipc_client";

interface TerminalLine {
  id: string;
  type: "command" | "output" | "error";
  content: string;
  timestamp: number;
}

interface ActiveSession {
  id: string;
  lines: TerminalLine[];
  currentCommand: string;
  isActive: boolean;
  process?: any;
}

export function IntegratedTerminal() {
  const [isTerminalVisible, setIsTerminalVisible] = useAtom(isTerminalVisibleAtom);
  const [terminalHeight, setTerminalHeight] = useAtom(terminalHeightAtom);
  const [sessions, setSessions] = useState<ActiveSession[]>([
    {
      id: "main",
      lines: [
        {
          id: "welcome",
          type: "output",
          content: "🚀 Terminal Integrado Dyad - v1.0\nExecução real de comandos do sistema!\n",
          timestamp: Date.now(),
        },
        {
          id: "ready",
          type: "output",
          content: "💡 Digite um comando para executar (ex: ls, npm install, git status)\n",
          timestamp: Date.now(),
        },
      ],
      currentCommand: "",
      isActive: true,
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("main");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDir, setCurrentDir] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapOutput, setWrapOutput] = useState(true);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (!autoScroll) return;
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeSession?.lines, autoScroll]);

  // Get current working directory on component mount
  useEffect(() => {
    const getCurrentDir = async () => {
      try {
        const cwd = await IpcClient.getInstance().getTerminalCwd("main");
        setCurrentDir(cwd);
      } catch (error) {
        console.error("Failed to get current directory:", error);
        setCurrentDir("");
      }
    };
    getCurrentDir();
  }, []);

  // Setup IPC listeners for real-time output
  useEffect(() => {
    const sessionId = "main";
    
    // Listen for terminal output
    const outputListener = (data: any) => {
      console.log("Terminal output received:", data);
      if (data.sessionId !== sessionId) return;
      if (data.type === 'stdout') {
        addOutput(data.data);
      } else if (data.type === 'stderr') {
        const errorLine: TerminalLine = {
          id: `error-${Date.now()}`,
          type: "error",
          content: data.data,
          timestamp: Date.now()
        };
        setSessions(prev => prev.map(session =>
          session.id === activeSessionId
            ? { ...session, lines: [...session.lines, errorLine] }
            : session
        ));
      }
    };

    // Listen for clear events
    const clearListener = (data: any) => {
      if (data?.sessionId !== sessionId) return;
      setSessions(prev => prev.map(session =>
        session.id === activeSessionId
          ? { ...session, lines: [] }
          : session
      ));
    };

    // Listen for directory changes
    const cwdListener = (data: any) => {
      if (data.sessionId !== sessionId) return;
      if (data.cwd) {
        // Update current directory display
        setSessions(prev => prev.map(session =>
          session.id === activeSessionId
            ? { ...session, cwd: data.cwd }
            : session
        ));
      }
    };

    // Add listeners
    if ((window as any).electron?.ipcRenderer) {
      const renderer = (window as any).electron.ipcRenderer;
      renderer.on("terminal:output", outputListener);
      renderer.on("terminal:clear", clearListener);
      renderer.on("terminal:cwd-changed", cwdListener);
    }

    // Cleanup
    return () => {
      if ((window as any).electron?.ipcRenderer) {
        const renderer = (window as any).electron.ipcRenderer;
        renderer.removeListener("terminal:output", outputListener);
        renderer.removeListener("terminal:clear", clearListener);
        renderer.removeListener("terminal:cwd-changed", cwdListener);
      }
    };
  }, [activeSessionId]);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim() || !activeSession) return;

    const sessionId = "main"; // Usar sessão principal para o terminal integrado
    const timestamp = Date.now();

    // Add command to history
    setCommandHistory(prev => [...prev, command]);

    // Add command line
    const commandLine: TerminalLine = {
      id: `cmd-${timestamp}`,
      type: "command",
      content: `$ ${command}`,
      timestamp,
    };

    setSessions(prev => prev.map(session =>
      session.id === activeSessionId
        ? {
            ...session,
            lines: [...session.lines, commandLine],
            currentCommand: ""
          }
        : session
    ));

    try {
      setIsExecuting(true);
      const startedAt = Date.now();
      // Execute command via IPC
      const result = await IpcClient.getInstance().executeTerminalCommand({
        command: command.trim(),
        cwd: currentDir || "/", // Usar cwd do estado ou diretório raiz
        sessionId
      });

      // Add result to output
      if (result.output) {
        addOutput(result.output);
      }
      
      if (result.error) {
        const errorLine: TerminalLine = {
          id: `error-${timestamp}`,
          type: "error",
          content: `❌ Erro ao executar comando: ${result.error}`,
          timestamp: Date.now()
        };
        setSessions(prev => prev.map(session =>
          session.id === activeSessionId
            ? { ...session, lines: [...session.lines, errorLine] }
            : session
        ));
      }
      setLastExitCode(result.success ? 0 : -1);
      setLastDurationMs(Date.now() - startedAt);
      setIsExecuting(false);

    } catch (error) {
      const errorLine: TerminalLine = {
        id: `error-${timestamp}`,
        type: "error",
        content: `❌ Erro ao executar comando: ${error}`,
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(session =>
        session.id === activeSessionId
          ? { ...session, lines: [...session.lines, errorLine] }
          : session
      ));
      setLastExitCode(-1);
      setLastDurationMs(null);
      setIsExecuting(false);
    }
  }, [activeSession, activeSessionId, currentDir]);

  const addOutput = (content: string) => {
    const timestamp = Date.now();
    const lines = content.split('\n').filter(line => line.trim());
    
    const outputLines = lines.map((line, index) => ({
      id: `output-${timestamp}-${index}`,
      type: "output" as const,
      content: line,
      timestamp: timestamp + index,
    }));

    setSessions(prev => prev.map(session => 
      session.id === activeSessionId 
        ? { ...session, lines: [...session.lines, ...outputLines] }
        : session
    ));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeSession) return;

    if (e.key === "Enter") {
      executeCommand(activeSession.currentCommand);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setSessions(prev => prev.map(session => 
          session.id === activeSessionId 
            ? { ...session, currentCommand: commandHistory[newIndex] }
            : session
        ));
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setSessions(prev => prev.map(session => 
            session.id === activeSessionId 
              ? { ...session, currentCommand: "" }
              : session
          ));
        } else {
          setHistoryIndex(newIndex);
          setSessions(prev => prev.map(session => 
            session.id === activeSessionId 
              ? { ...session, currentCommand: commandHistory[newIndex] }
              : session
          ));
        }
      }
    }
  };

  const updateCurrentCommand = (value: string) => {
    setSessions(prev => prev.map(session => 
      session.id === activeSessionId 
        ? { ...session, currentCommand: value }
        : session
    ));
  };

  const clearTerminal = async () => {
    try {
      await IpcClient.getInstance().clearTerminal("main");
    } catch (error) {
      console.error("Error clearing terminal:", error);
    }
  };

  const cancelCurrent = async () => {
    try {
      await IpcClient.getInstance().cancelTerminalCommand({ commandId: `cmd-${Date.now()}`, sessionId: "main" });
      setIsExecuting(false);
    } catch (error) {
      console.error("Error canceling command:", error);
    }
  };

  const copyAll = async () => {
    const text = (activeSession?.lines || []).map(l => {
      const d = new Date(l.timestamp);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `[${hh}:${mm}:${ss}] ${l.content}`;
    }).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const formatTime = (t: number) => {
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  if (!isTerminalVisible) return null;

  return (
    <div className="border-t border-border bg-(--background-lightest)" 
         style={{ height: `${terminalHeight}px` }}>
       
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-(--background-lighter) border-b border-border">
        <div className="flex items-center space-x-2">
          <Terminal size={16} className="text-green-500" />
          <span className="text-sm font-medium text-muted-foreground">
            Terminal Integrado
          </span>
          {isExecuting ? (
            <span className="flex items-center gap-1 text-green-500 text-xs">
              <Loader2 size={14} className="animate-spin" />
              Executando…
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {lastExitCode !== null ? `Exit ${lastExitCode}${lastDurationMs ? ` • ${Math.round((lastDurationMs || 0)/1000)}s` : ""}` : "Pronto"}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            onClick={copyAll}
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            title="Copiar saída"
          >
            <Copy size={14} />
          </Button>
          <Button
            onClick={() => setAutoScroll(s => !s)}
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            title={autoScroll ? "Desativar autoscroll" : "Ativar autoscroll"}
          >
            {autoScroll ? "Autoscroll" : "Scroll"}
          </Button>
          <Button
            onClick={() => setWrapOutput(w => !w)}
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            title={wrapOutput ? "Desativar quebra de linha" : "Ativar quebra de linha"}
          >
            {wrapOutput ? "Wrap" : "NoWrap"}
          </Button>
          <Button
            onClick={clearTerminal}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Limpar terminal"
          >
            <AlertCircle size={14} />
          </Button>
          {isExecuting && (
            <Button
              onClick={cancelCurrent}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              title="Cancelar comando"
            >
              <StopCircle size={14} />
            </Button>
          )}
          
          <Button
            onClick={() => setIsTerminalVisible(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Fechar terminal"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 bg-(--background-darkest) text-(--foreground) font-mono text-sm"
        style={{ height: `${terminalHeight - 48}px` }}
      >
        {/* Terminal Lines */}
        <div className="space-y-1">
          {activeSession?.lines.map((line) => (
            <div
              key={line.id}
              className={`${wrapOutput ? "whitespace-pre-wrap" : "whitespace-pre"} ${
                line.type === "command" 
                  ? "text-green-400" 
                  : line.type === "error"
                  ? "text-red-400"
                  : "text-(--foreground)"
              }`}
            >
              <span className="text-xs text-gray-500 mr-2">[{formatTime(line.timestamp)}]</span>
              {line.content}
            </div>
          ))}
        </div>

        {/* Current Command Line */}
        <div className="flex items-center mt-2">
          <span className="text-green-400 mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={activeSession?.currentCommand || ""}
            onChange={(e) => updateCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-(--foreground)"
            placeholder="Digite um comando..."
            disabled={isExecuting}
            autoFocus
          />
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="h-2 bg-(--background-lighter) border-t border-border cursor-row-resize hover:bg-(--background-light) transition-colors"
        onMouseDown={(e) => {
          const startY = e.clientY;
          const startHeight = terminalHeight;

          const handleMouseMove = (e: MouseEvent) => {
            const newHeight = Math.max(150, Math.min(500, startHeight + (startY - e.clientY)));
            setTerminalHeight(newHeight);
          };

          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      />
    </div>
  );
}