import React from "react";
import { Button } from "../ui/button";
import { TerminalSession } from "../../utils/terminalUtils";
import { TerminalIcon, XIcon } from "lucide-react";

interface TerminalTabProps {
  session: TerminalSession;
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
}

export function TerminalTab({
  session,
  isActive,
  onSwitch,
  onClose
}: TerminalTabProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Se clicou com botão esquerdo, alternar aba
    if (e.button === 0) {
      onSwitch();
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que o clique no X selecione a aba
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSwitch();
    }
  };

  return (
    <div
      className={`
        terminal-tab group relative flex items-center px-3 py-2 cursor-pointer
        transition-colors duration-200 border-r border-gray-700
        ${
          isActive
            ? "bg-gray-900 text-white border-b-2 border-blue-500"
            : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
        }
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="tab"
      aria-selected={isActive}
      aria-label={`Aba ${session.name} ${isActive ? "(ativa)" : ""}`}
      title={`${session.name} - ${session.cwd}`}
    >
      {/* Ícone da aba */}
      <div className="terminal-tab-icon mr-2 flex-shrink-0">
        <TerminalIcon className="h-4 w-4" />
      </div>

      {/* Nome da aba */}
      <div className="terminal-tab-name flex-1 min-w-0">
        <span className="truncate text-sm font-medium">
          {session.name}
        </span>
      </div>

      {/* Indicador de atividade */}
      {session.isActive && (
        <div className="terminal-tab-indicator ml-2">
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
        </div>
      )}

      {/* Botão de fechar (visível no hover ou sempre ativo) */}
      <Button
        onClick={handleClose}
        variant="ghost"
        size="sm"
        className={`
          ml-2 h-5 w-5 p-0 rounded transition-all duration-200
          ${
            isActive
              ? "opacity-100 hover:bg-gray-700"
              : "opacity-0 group-hover:opacity-100 hover:bg-gray-600"
          }
        `}
        title="Fechar aba"
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default TerminalTab;