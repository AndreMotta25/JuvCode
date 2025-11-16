import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";

export function TerminalDemoPage() {
  const [output, setOutput] = useState<string[]>([
    "🚀 Bem-vindo ao Dyad Terminal!",
    "💡 Digite 'help' para ver comandos disponíveis",
    "",
    "💻 Use Ctrl+↑/↓ para navegar no histórico"
  ]);
  const [input, setInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  // Comandos disponíveis
  const availableCommands = {
    help: [
      "📋 Comandos disponíveis:",
      "  help          - Mostra esta lista",
      "  pwd           - Mostra diretório atual",
      "  clear         - Limpa o terminal",
      "  whoami        - Mostra usuário atual",
      "  ls            - Lista arquivos (simulado)",
      "  date          - Mostra data e hora",
      "  echo <text>   - Ecolá um texto",
      "",
      "💡 Dica: Você pode usar as teclas ↑↓ para navegar no histórico"
    ],
    pwd: ["📁 /home/user/projects/dyad"],
    whoami: ["👤 user@dyad"],
    clear: ["🧹 Terminal limpo!"],
    date: [`⏰ ${new Date().toLocaleString()}`],
    echo: (args: string[]) => [`🔊 ${args.join(" ")}`],
    ls: [
      "📂 src/",
      "📂 public/",
      "📂 node_modules/",
      "📄 package.json",
      "📄 README.md"
    ]
  };

  // Processar comando
  const executeCommand = (command: string) => {
    setIsExecuting(true);
    
    // Simular delay de execução
    setTimeout(() => {
      const cmd = command.trim().toLowerCase();
      const parts = cmd.split(" ");
      const baseCmd = parts[0];
      const args = parts.slice(1);

      let newOutput: string[] = [];

      // Adicionar o comando executado
      newOutput.push(`$ ${command}`);

      // Processar comando
      if (baseCmd === "") {
        // Comando vazio - apenas adicionar linha
      } else if (baseCmd === "help") {
        newOutput = newOutput.concat(availableCommands.help);
      } else if (baseCmd === "clear") {
        setOutput(newOutput);
        setIsExecuting(false);
        return;
      } else if (baseCmd === "pwd") {
        newOutput = newOutput.concat(availableCommands.pwd);
      } else if (baseCmd === "whoami") {
        newOutput = newOutput.concat(availableCommands.whoami);
      } else if (baseCmd === "date") {
        newOutput = newOutput.concat(availableCommands.date);
      } else if (baseCmd === "echo") {
        newOutput = newOutput.concat(availableCommands.echo(args));
      } else if (baseCmd === "ls") {
        newOutput = newOutput.concat(availableCommands.ls);
      } else {
        newOutput.push(`❌ Comando não encontrado: ${baseCmd}`);
        newOutput.push(`💡 Digite 'help' para ver comandos disponíveis`);
      }

      setOutput(prev => {
        const newArray = [...prev, ...newOutput];
        // Manter apenas as últimas 100 linhas
        return newArray.slice(-100);
      });

      setIsExecuting(false);
    }, 300);
  };

  // Capturar Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        executeCommand(input);
        setInput("");
      }
    }
  };

  return (
    <div className="terminal-demo h-screen bg-black text-green-400 font-mono flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              🚀 Terminal Integrado - Dyad
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Terminal completo integrado ao Dyad IDE
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>💡 Digite "help" para ver comandos</span>
            <span>⌨️ Use ↑↓ para navegar no histórico</span>
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 p-4 overflow-y-auto">
        {output.map((line, index) => (
          <div key={index} className="mb-1 whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
        
        {isExecuting && (
          <div className="flex items-center gap-2 text-yellow-400">
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span>Executando comando...</span>
          </div>
        )}
      </div>

      {/* Terminal Input */}
      <div className="border-t border-gray-700 bg-gray-900 p-4">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-sm">📁 /home/user/projects/dyad</span>
          <span className="text-blue-400">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white outline-none"
            placeholder="Digite um comando..."
            disabled={isExecuting}
            autoFocus
          />
          <Button
            onClick={() => {
              if (input.trim()) {
                executeCommand(input);
                setInput("");
              }
            }}
            disabled={!input.trim() || isExecuting}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            Executar
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>✨ Terminal integrado funcionando</span>
            <span>🛡️ Execução segura</span>
            <span>📊 {output.length} linhas</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TerminalDemoPage;