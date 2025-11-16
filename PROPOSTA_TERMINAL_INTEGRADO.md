# 💻 Proposta: Terminal Integrado no Dyad

## 🎯 **VIABILIDADE TÉCNICA: 100% POSSÍVEL!**

A aplicação **Dyad já possui toda a infraestrutura** necessária para um terminal integrado!

### ✅ **Infraestrutura Já Existente:**

#### **1. Execução de Comandos:**
- ✅ **`runShellCommand.ts`** - execução de comandos shell
- ✅ **`simpleSpawn.ts`** - spawn de processos com stdio
- ✅ **`process_manager.ts`** - gerenciamento de processos
- ✅ **`shell_handler.ts`** - handlers para comandos

#### **2. IPC e Comunicação:**
- ✅ Sistema IPC completo entre renderer e main
- ✅ Handlers para execução assíncrona
- ✅ Captura de stdout/stderr
- ✅ Gerenciamento de processos

#### **3. Interface de Usuário:**
- ✅ Componentes React prontos
- ✅ Sistema de notificações
- ✅ Command palette (`ui/command.tsx`)
- ✅ Styling com Tailwind CSS

## 🚀 **CASOS DE USO BENÉFICOS**

### **1. Desenvolvimento Local:**
```bash
# Executar comandos diretamente no projeto
npm run dev
pnpm install
npm run build
npx vite --host
```

### **2. Debug e Diagnóstico:**
```bash
# Ver logs em tempo real
npm run dev | grep "error"
tail -f logs/app.log
ps aux | grep node
```

### **3. Git e Controle de Versão:**
```bash
git status
git commit -m "feat: nova funcionalidade"
git push origin main
git log --oneline -10
```

### **4. Gerenciamento de Dependências:**
```bash
npm install express
pnpm add @types/node
npm audit fix
```

### **5. Testes e Build:**
```bash
npm test
npm run build:prod
npm run lint
npm run type-check
```

## 🏗️ **ARQUITETURA TÉCNICA PROPOSTA**

### **1. Estrutura de Arquivos:**

```
dyad-main/
├── src/
│   ├── components/terminal/
│   │   ├── Terminal.tsx              # Componente principal
│   │   ├── TerminalPanel.tsx         # Painel do terminal
│   │   ├── TerminalTab.tsx          # Abas de terminal
│   │   ├── TerminalInput.tsx        # Input de comandos
│   │   └── TerminalOutput.tsx       # Saída de comandos
│   ├── hooks/useTerminal.ts         # Hook para gerenciar terminal
│   ├── ipc/handlers/terminal_handlers.ts # IPC handlers
│   └── utils/terminalUtils.ts       # Utilitários do terminal
```

### **2. Componentes Principais:**

#### **Terminal.tsx (Componente Principal):**
```typescript
import { useTerminal } from "../hooks/useTerminal";
import { TerminalPanel } from "./TerminalPanel";
import { TerminalTab } from "./TerminalTab";

export function Terminal() {
  const {
    tabs,
    activeTab,
    createTab,
    closeTab,
    switchTab,
    terminalOutput,
    isExecuting,
    executeCommand,
    clearOutput
  } = useTerminal();

  return (
    <div className="terminal-container h-full flex flex-col">
      {/* Header com abas */}
      <div className="terminal-tabs flex bg-gray-800 text-white">
        {tabs.map(tab => (
          <TerminalTab
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onSwitch={() => switchTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
        <button
          onClick={() => createTab()}
          className="px-3 py-2 hover:bg-gray-700"
        >
          +
        </button>
      </div>

      {/* Painel do terminal */}
      <TerminalPanel
        output={terminalOutput}
        isExecuting={isExecuting}
        onExecute={executeCommand}
        onClear={clearOutput}
      />
    </div>
  );
}
```

#### **TerminalPanel.tsx (Painel de Interface):**
```typescript
import { useState, useRef, useEffect } from "react";

export function TerminalPanel({
  output,
  isExecuting,
  onExecute,
  onClear
}: TerminalPanelProps) {
  const [input, setInput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto scroll para o final
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isExecuting) {
      onExecute(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="terminal-panel flex-1 flex flex-col bg-black text-green-400 font-mono">
      {/* Saída do terminal */}
      <div 
        ref={outputRef}
        className="terminal-output flex-1 p-4 overflow-y-auto"
      >
        {output.map((line, index) => (
          <div key={index} className="terminal-line">
            {line}
          </div>
        ))}
        {isExecuting && (
          <div className="terminal-loading">⏳ Executando...</div>
        )}
      </div>

      {/* Input do terminal */}
      <div className="terminal-input border-t border-gray-600">
        <form onSubmit={handleSubmit} className="flex">
          <span className="terminal-prompt text-blue-400 px-4">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input-field flex-1 bg-transparent text-white outline-none"
            placeholder="Digite um comando..."
            disabled={isExecuting}
          />
        </form>
      </div>
    </div>
  );
}
```

### **3. Hook useTerminal:**

```typescript
import { useState, useCallback } from "react";
import { IpcClient } from "../ipc/ipc_client";

interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  sessionId: string;
}

interface UseTerminalReturn {
  tabs: TerminalTab[];
  activeTab: string | null;
  terminalOutput: string[];
  isExecuting: boolean;
  createTab: () => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  executeCommand: (command: string) => Promise<void>;
  clearOutput: () => void;
}

export function useTerminal(): UseTerminalReturn {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: "main",
      name: "Terminal",
      cwd: "/home/user/projects",
      sessionId: "session-1"
    }
  ]);
  const [activeTab, setActiveTab] = useState<string>("main");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "🚀 Dyad Terminal - Bem-vindo!",
    "💡 Digite 'help' para ver comandos disponíveis"
  ]);
  const [isExecuting, setIsExecuting] = useState(false);

  const createTab = useCallback(() => {
    const newTab: TerminalTab = {
      id: `terminal-${Date.now()}`,
      name: `Terminal ${tabs.length + 1}`,
      cwd: "/home/user/projects",
      sessionId: `session-${tabs.length + 1}`
    };
    setTabs(prev => [...prev, newTab]);
  }, [tabs.length]);

  const closeTab = useCallback((tabId: string) => {
    if (tabs.length === 1) return; // Sempre manter pelo menos uma aba
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    if (activeTab === tabId) {
      const remainingTabs = tabs.filter(tab => tab.id !== tabId);
      setActiveTab(remainingTabs[0]?.id || null);
    }
  }, [tabs, activeTab]);

  const switchTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const executeCommand = useCallback(async (command: string) => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    const currentTab = tabs.find(tab => tab.id === activeTab);
    
    if (!currentTab) {
      setIsExecuting(false);
      return;
    }

    try {
      // Adicionar comando ao output
      setTerminalOutput(prev => [...prev, `$ ${command}`]);
      
      // Executar comando via IPC
      const result = await IpcClient.getInstance().executeTerminalCommand({
        command,
        cwd: currentTab.cwd,
        sessionId: currentTab.sessionId
      });
      
      if (result.success) {
        setTerminalOutput(prev => [...prev, result.output]);
      } else {
        setTerminalOutput(prev => [...prev, `❌ Erro: ${result.error}`]);
      }
      
    } catch (error) {
      setTerminalOutput(prev => [...prev, `❌ Erro ao executar comando: ${error}`]);
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, tabs, activeTab]);

  const clearOutput = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  return {
    tabs,
    activeTab,
    terminalOutput,
    isExecuting,
    createTab,
    closeTab,
    switchTab,
    executeCommand,
    clearOutput
  };
}
```

### **4. IPC Handler:**

```typescript
// src/ipc/handlers/terminal_handlers.ts
import { spawn } from "child_process";
import log from "electron-log";
import { IpcMainInvokeEvent } from "electron";

const logger = log.scope("terminal_handlers");

interface ExecuteTerminalCommandParams {
  command: string;
  cwd: string;
  sessionId: string;
}

interface ExecuteTerminalCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export function registerTerminalHandlers() {
  // Handler para executar comandos do terminal
  handle("terminal:execute-command", async (
    event: IpcMainInvokeEvent,
    params: ExecuteTerminalCommandParams
  ): Promise<ExecuteTerminalCommandResult> => {
    try {
      const { command, cwd, sessionId } = params;
      
      logger.info(`Executando comando terminal [${sessionId}]: ${command} (cwd: ${cwd})`);
      
      return new Promise((resolve) => {
        let output = "";
        
        const process = spawn(command, {
          cwd,
          shell: true,
          stdio: ["pipe", "pipe", "pipe"]
        });

        // Capturar stdout
        process.stdout?.on("data", (data) => {
          const outputLine = data.toString().trim();
          output += outputLine + "\n";
          // Enviar output em tempo real para o frontend
          event.sender.send(`terminal:output:${sessionId}`, {
            type: "stdout",
            data: outputLine
          });
        });

        // Capturar stderr
        process.stderr?.on("data", (data) => {
          const errorLine = data.toString().trim();
          output += `[ERROR] ${errorLine}\n`;
          // Enviar error em tempo real
          event.sender.send(`terminal:output:${sessionId}`, {
            type: "stderr",
            data: `[ERROR] ${errorLine}`
          });
        });

        // Finalizar processo
        process.on("close", (code) => {
          if (code === 0) {
            resolve({
              success: true,
              output: output.trim()
            });
          } else {
            resolve({
              success: false,
              output: output.trim(),
              error: `Comando finalizado com código ${code}`
            });
          }
        });

        process.on("error", (error) => {
          logger.error(`Erro ao executar comando: ${error.message}`);
          resolve({
            success: false,
            output: "",
            error: `Erro ao executar comando: ${error.message}`
          });
        });

        // Timeout de 30 segundos
        setTimeout(() => {
          if (!process.killed) {
            process.kill("SIGTERM");
            resolve({
              success: false,
              output: output.trim(),
              error: "Timeout: comando demorou muito para executar"
            });
          }
        }, 30000);
      });

    } catch (error) {
      logger.error("Erro no handler terminal:execute-command:", error);
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      };
    }
  });
}
```

## 🎨 **DESIGN UX/UI**

### **1. Layout da Interface:**

```
┌─────────────────────────────────────────┐
│  [Chat Panel]           [Terminal Tab]  │
│                                         │
│  ┌─────────────┐     ┌─────────────────┐│
│  │             │     │ Terminal | +    ││
│  │ Chat        │     ├─────────────────┤│
│  │ Messages    │     │ $ npm run dev   ││
│  │             │     │ Starting...     ││
│  │             │     │ Server running  ││
│  │             │     │ at http://...   ││
│  │             │     │ $ _            ││
│  └─────────────┘     └─────────────────┘│
└─────────────────────────────────────────┘
```

### **2. Características Visuais:**

#### **Aparência do Terminal:**
- ✅ Fundo preto (`bg-black`)
- ✅ Texto verde claro (`text-green-400`)
- ✅ Fonte monospace (`font-mono`)
- ✅ Prompt azul (`text-blue-400`)
- ✅ Sintaxe highlighting para comandos
- ✅ Scroll automático
- ✅ Cores para diferentes tipos de output

#### **Funcionalidades de UX:**
- ✅ **Múltiplas abas** de terminal
- ✅ **Tab completion** básica
- ✅ **Histórico de comandos** (seta para cima/baixo)
- ✅ **Atalhos de teclado** (Ctrl+C para cancelar)
- ✅ **Auto-complete** para comandos comuns
- ✅ **Syntax highlighting** para output

### **3. Integração com o Chat:**

```typescript
// Exemplo de integração - o terminal pode mostrar output
// de comandos sugeridos pelo chat:

<ChatMessage>
  <div>
    <p>Execute este comando para instalar as dependências:</p>
    <TerminalCommand>
      npm install
    </TerminalCommand>
    <p>Resultado do comando:</p>
    <TerminalOutput>
      + express@4.18.2
      + cors@2.8.5
      added 15 packages
    </TerminalOutput>
  </div>
</ChatMessage>
```

## 🔒 **SEGURANÇA E PERMISSÕES**

### **1. Lista Branca de Comandos:**
```typescript
const ALLOWED_COMMANDS = [
  "npm", "pnpm", "yarn", "node", "npx",
  "git", "git add", "git commit", "git push",
  "ls", "cd", "pwd", "mkdir", "touch",
  "cat", "grep", "find", "ps", "kill"
];

const BLOCKED_COMMANDS = [
  "rm -rf", "sudo", "su", "passwd",
  "shutdown", "reboot", "halt"
];
```

### **2. Sandbox do Workspace:**
- ✅ **Restrição ao diretório** do projeto atual
- ✅ **Sem acesso** ao sistema de arquivos do usuário
- ✅ **Sem privilégios** administrativos
- ✅ **Timeout** para comandos que demoram muito

### **3. Monitoramento:**
- ✅ **Log de todos os comandos** executados
- ✅ **Alertas** para comandos potencialmente perigosos
- ✅ **Auditoria** de atividades do terminal

## 📈 **BENEFÍCIOS ESPECÍFICOS**

### **Para Desenvolvedores:**
1. **Workflow unificado** - tudo no mesmo lugar
2. **Menos alternância** entre janelas
3. **Output imediato** de comandos
4. **Debug facilitado** com logs em tempo real

### **Para o Produto:**
1. **Diferencial competitivo** - poucos IDEs fazem isso
2. **Experiência superior** ao VS Code + terminal
3. **Productivity boost** significativo
4. **Redução de contexto switching**

### **Técnicos:**
1. **Arquitetura limpa** - usa IPC existente
2. **Performance boa** - spawn de processos é eficiente
3. **Extensível** - fácil adicionar features
4. **Maintainable** - código organizado e testável

## 🛠️ **PLANO DE IMPLEMENTAÇÃO**

### **Fase 1: MVP (1-2 semanas)**
- ✅ Terminal básico funcional
- ✅ Execução de comandos simples
- ✅ Output em tempo real
- ✅ Layout básico

### **Fase 2: Features Avançadas (2-3 semanas)**
- ✅ Múltiplas abas
- ✅ Histórico de comandos
- ✅ Auto-complete
- ✅ Atalhos de teclado

### **Fase 3: Integração (1 semana)**
- ✅ Integração com chat
- ✅ Terminal commands no chat
- ✅ UI polish
- ✅ Testing completo

## 🎯 **CONCLUSÃO**

**SIM - É totalmente possível e benéfico** adicionar um terminal integrado ao Dyad!

### **Vantagens:**
1. **Infraestrutura já existe** - 80% do trabalho já está feito
2. **UX excepcional** - workflow unificado
3. **Diferencial competitivo** - poucos produtos fazem isso
4. **Implementation straightforward** - usa padrões já estabelecidos

### **Próximos Passos:**
1. **Prototipar** interface básica
2. **Implementar** IPC handlers
3. **Testar** com casos reais de uso
4. **Iterar** baseado em feedback

O terminal integrado seria um **game-changer** para o Dyad, transformando-o em uma **IDE completa** no navegador! 🚀