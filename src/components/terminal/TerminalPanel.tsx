import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { TerminalOutput } from "../../utils/terminalUtils";
import {
  TerminalIcon,
  Trash2,
  PlayIcon,
  SquareIcon
} from "lucide-react";

interface TerminalPanelProps {
  output: TerminalOutput[];
  isExecuting: boolean;
  onExecute: (command: string) => Promise<void>;
  onClear: () => void;
  onNavigateHistory: (direction: "up" | "down") => string | null;
  currentDirectory: string;
}

export function TerminalPanel({
  output,
  isExecuting,
  onExecute,
  onClear,
  onNavigateHistory,
  currentDirectory
}: TerminalPanelProps) {
  const [input, setInput] = useState("");
  const [currentHistoryCommand, setCurrentHistoryCommand] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll para o final quando novo output chega
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focar no input quando componente monta
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Armazenar comando atual quando navegar no histórico
  useEffect(() => {
    if (currentHistoryCommand !== input) {
      setCurrentHistoryCommand(input);
    }
  }, [input]);

  // Manejar submit do formulário
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (input.trim() && !isExecuting) {
      const command = input.trim();
      setCurrentHistoryCommand(command);
      setInput("");
      await onExecute(command);
    }
  }, [input, isExecuting, onExecute]);

  // Manejar teclas especiais
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const command = onNavigateHistory("up");
      if (command !== null) {
        setInput(command);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const command = onNavigateHistory("down");
      setInput(command || "");
    } else if (e.key === "Tab") {
      // TODO: Implementar auto-complete
      e.preventDefault();
    } else if (e.key === "Escape") {
      // Limpar input
      setInput("");
    }
  }, [handleSubmit, onNavigateHistory]);

  // Colorir comando baseado no tipo
  const getCommandColor = useCallback((command: string) => {
    const cmd = command.toLowerCase().trim();
    
    if (cmd.startsWith('npm') || cmd.startsWith('yarn') || cmd.startsWith('pnpm')) {
      return 'text-yellow-400';
    }
    
    if (cmd.startsWith('git')) {
      return 'text-orange-400';
    }
    
    if (cmd.startsWith('docker')) {
      return 'text-blue-400';
    }
    
    if (cmd.includes('install') || cmd.includes('add') || cmd.includes('remove')) {
      return 'text-purple-400';
    }
    
    if (cmd.includes('build') || cmd.includes('start') || cmd.includes('dev')) {
      return 'text-green-400';
    }
    
    if (cmd.includes('test')) {
      return 'text-cyan-400';
    }
    
    return 'text-gray-300';
  }, []);

  // Colorir output baseado no tipo
  const getOutputClassName = useCallback((type: string) => {
    switch (type) {
      case "command":
        return "text-blue-400";
      case "stdout":
        return "text-green-400";
      case "stderr":
        return "text-red-400";
      case "error":
        return "text-red-400";
      case "system":
        return "text-gray-300";
      default:
        return "text-gray-300";
    }
  }, []);

  return (
    <div className="terminal-panel flex-1 flex flex-col bg-black text-green-400 font-mono text-sm">
      {/* Área de output */}
      <div 
        ref={outputRef}
        className="terminal-output flex-1 p-4 overflow-y-auto overflow-x-auto"
      >
        {output.map((line) => (
          <div 
            key={line.id} 
            className={`terminal-line mb-1 whitespace-pre-wrap break-words ${
              getOutputClassName(line.type)
            }`}
          >
            {line.content}
          </div>
        ))}
        
        {isExecuting && (
          <div className="terminal-loading flex items-center gap-2 text-yellow-400">
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span>Executando comando...</span>
          </div>
        )}
      </div>

      {/* Linha de status e controles */}
      <div className="terminal-controls border-t border-gray-700 bg-gray-900 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={onClear}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-gray-400 hover:text-white"
              title="Limpar terminal"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            
            <span className="text-xs text-gray-500">
              Diretório: {currentDirectory}
            </span>
          </div>
          
          <div className="text-xs text-gray-500">
            Ctrl+↑/↓ para histórico | Tab para auto-complete | Esc para limpar
          </div>
        </div>
      </div>

      {/* Input do terminal */}
      <div className="terminal-input border-t border-gray-700 bg-gray-900">
        <form onSubmit={handleSubmit} className="flex items-center">
          <div className="terminal-prompt flex items-center px-4 text-blue-400 min-w-0">
            <span className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4" />
              <span className="text-xs opacity-75">{currentDirectory}</span>
              <span>$</span>
            </span>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input-field flex-1 bg-transparent text-white outline-none py-3 pr-4 font-mono"
            placeholder="Digite um comando..."
            disabled={isExecuting}
            spellCheck={false}
            autoComplete="off"
          />
          
          {/* Botão de executar */}
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 mr-2 text-gray-400 hover:text-white"
            disabled={!input.trim() || isExecuting}
            title="Executar comando (Enter)"
          >
            {isExecuting ? (
              <SquareIcon className="h-4 w-4 text-red-400" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default TerminalPanel;