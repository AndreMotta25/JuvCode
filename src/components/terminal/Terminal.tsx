import React from "react";
import { useTerminal } from "../../hooks/useTerminal";
import { TerminalPanel } from "./TerminalPanel";
import { TerminalTab } from "./TerminalTab";
import { Button } from "../ui/button";
import { TerminalIcon, PlusIcon } from "lucide-react";

export function Terminal() {
  const {
    sessions,
    activeSessionId,
    terminalOutput,
    isExecuting,
    createSession,
    closeSession,
    switchSession,
    clearOutput,
    executeCommand,
    navigateHistory
  } = useTerminal();

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeOutput = terminalOutput.filter(o => o.sessionId === activeSessionId);

  const handleCreateSession = () => {
    createSession();
  };

  return (
    <div className="terminal-container h-full flex flex-col bg-gray-900">
      {/* Header com abas */}
      <div className="terminal-tabs flex items-center bg-gray-800 border-b border-gray-700">
        <div className="flex-1 flex items-center">
          {sessions.map((session) => (
            <TerminalTab
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSwitch={() => switchSession(session.id)}
              onClose={() => closeSession(session.id)}
            />
          ))}
        </div>
        
        {/* Botão para criar nova aba */}
        <Button
          onClick={handleCreateSession}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-gray-700 text-gray-400 hover:text-white"
          title="Nova aba do terminal"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Status bar */}
      {activeSession && (
        <div className="terminal-status flex items-center justify-between px-4 py-1 text-xs text-gray-400 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <TerminalIcon className="h-3 w-3" />
              {activeSession.name}
            </span>
            <span>~{activeSession.cwd}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isExecuting && (
              <span className="text-yellow-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                Executando...
              </span>
            )}
            <span className="text-gray-500">
              {activeOutput.length} linhas
            </span>
          </div>
        </div>
      )}

      {/* Painel do terminal */}
      <div className="terminal-panel flex-1 min-h-0">
        {activeSession ? (
          <TerminalPanel
            output={activeOutput}
            isExecuting={isExecuting}
            onExecute={executeCommand}
            onClear={() => activeSessionId && clearOutput(activeSessionId)}
            onNavigateHistory={navigateHistory}
            currentDirectory={activeSession.cwd}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <TerminalIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma sessão de terminal ativa</p>
              <p className="text-sm">Clique no + para criar uma nova aba</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Terminal;