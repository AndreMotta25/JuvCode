import { spawn, ChildProcess, execSync, exec } from "child_process";
import { createLoggedHandler } from "./safe_handle";
import log from "electron-log";
import { PassThrough } from "stream";
import path from "path";
import { promises as fs } from "fs";
import os from "os";

const logger = log.scope("terminal_handlers");

// Store active terminal sessions with persistent state
const activeSessions = new Map<string, {
  process?: ChildProcess;
  outputStream: PassThrough;
  inputStream: PassThrough;
  cwd: string;              // Current working directory
  env: Record<string, string | undefined>; // Environment variables
  history: string[];         // Command history
  historyIndex: number;      // Current history position
}>();

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: number;
  error?: string;
}

interface ListFileItem {
  name: string;
  type: 'directory' | 'file';
  size: number;
  modified: Date;
}

interface EnvironmentInfo {
  PATH?: string;
  USER?: string;
  HOME?: string;
  NODE_VERSION?: string;
  PLATFORM?: string;
  npm?: string;
  node?: string;
}

interface GitStatusResult {
  hasChanges: boolean;
  output: string;
  error: string | null;
}

export function registerTerminalHandlers() {
  const handle = createLoggedHandler(logger);
  
  // Helper function to get or create session
  const getOrCreateSession = (sessionId: string) => {
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, {
        outputStream: new PassThrough(),
        inputStream: new PassThrough(),
        cwd: process.cwd(),
        env: { ...process.env },
        history: [],
        historyIndex: -1
      });
    }
    return activeSessions.get(sessionId)!;
  };
  
  // Helper function to execute Windows internal commands
  const executeWindowsCommand = async (command: string, args: string[], session: any): Promise<CommandResult | null> => {
    const cmd = command.toLowerCase();
    
    try {
      if (cmd === 'cd' || cmd === 'chdir') {
        if (args.length === 0) {
          return {
            stdout: session.cwd,
            stderr: '',
            exitCode: 0,
            timestamp: Date.now()
          };
        }
        const newDir = path.resolve(session.cwd, args[0]);
        await fs.access(newDir);
        session.cwd = newDir;
        return {
          stdout: newDir,
          stderr: '',
          exitCode: 0,
          timestamp: Date.now()
        };
      }
      
      if (cmd === 'dir') {
        const dirPath = args.length > 0 ? path.resolve(session.cwd, args[0]) : session.cwd;
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        let output = ` Directory of ${dirPath}\n\n`;
        
        for (const item of items) {
          const stats = await fs.stat(path.join(dirPath, item.name));
          const date = stats.mtime.toLocaleString();
          const size = stats.isDirectory() ? '<DIR>' : stats.size.toString().padStart(10);
          output += `${date}  ${size} ${item.name}\n`;
        }
        
        return {
          stdout: output,
          stderr: '',
          exitCode: 0,
          timestamp: Date.now()
        };
      }
      
      if (cmd === 'mkdir' || cmd === 'md') {
        if (args.length === 0) {
          return {
            stdout: '',
            stderr: 'Syntax: mkdir [directory]',
            exitCode: 1,
            timestamp: Date.now()
          };
        }
        for (const arg of args) {
          const newDir = path.resolve(session.cwd, arg);
          await fs.mkdir(newDir, { recursive: true });
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0,
          timestamp: Date.now()
        };
      }
      
      if (cmd === 'del' || cmd === 'erase' || cmd === 'rm') {
        if (args.length === 0) {
          return {
            stdout: '',
            stderr: 'Syntax: del [file]',
            exitCode: 1,
            timestamp: Date.now()
          };
        }
        for (const arg of args) {
          const filePath = path.resolve(session.cwd, arg);
          await fs.unlink(filePath);
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0,
          timestamp: Date.now()
        };
      }
      
      if (cmd === 'cls' || cmd === 'clear') {
        return {
          stdout: '\x1B[2J\x1B[0f',
          stderr: '',
          exitCode: 0,
          timestamp: Date.now()
        };
      }
      
      if (cmd === 'echo') {
        return {
          stdout: args.join(' '),
          stderr: '',
          exitCode: 0,
          timestamp: Date.now()
        };
      }
      
      // Not an internal command, execute externally
      return null;
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        timestamp: Date.now()
      };
    }
  };
  
  // Execute a single command
  handle("terminal:execute-command", async (_: unknown, { command, sessionId }: {
    command: string;
    sessionId: string;
  }): Promise<CommandResult> => {
    const session = getOrCreateSession(sessionId);
    
    // Add to history
    session.history.unshift(command);
    if (session.history.length > 100) {
      session.history = session.history.slice(0, 100);
    }
    session.historyIndex = -1;
    
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // Parse command
          const [cmd, ...args] = command.trim().split(/\s+/);
          
          // Try to execute as Windows internal command first
          const internalResult = await executeWindowsCommand(cmd, args, session);
          if (internalResult) {
            // Send output to renderer for internal commands too
            if ((global as any).mainWindow && internalResult.stdout) {
              (global as any).mainWindow.webContents.send(`terminal:output`, {
                type: 'stdout',
                data: internalResult.stdout,
                sessionId,
                timestamp: Date.now()
              });
            }
            if ((global as any).mainWindow && internalResult.stderr) {
              (global as any).mainWindow.webContents.send(`terminal:output`, {
                type: 'stderr',
                data: internalResult.stderr,
                sessionId,
                timestamp: Date.now()
              });
            }
            // Emit cwd change if command altered the working directory
            if ((cmd.toLowerCase() === 'cd' || cmd.toLowerCase() === 'chdir') && (global as any).mainWindow) {
              (global as any).mainWindow.webContents.send(`terminal:cwd-changed`, {
                cwd: session.cwd,
                sessionId,
                timestamp: Date.now()
              });
            }
            resolve(internalResult);
            return;
          }
          
          // Execute external command
          const childProcess = spawn(cmd, args, {
            shell: true,
            cwd: session.cwd,
            env: session.env,
            stdio: ['pipe', 'pipe', 'pipe']
          });

          let output = "";
          let errorOutput = "";

          // Handle stdout with streaming
          childProcess.stdout?.on('data', (data: Buffer) => {
            const chunk = data.toString();
            output += chunk;
            // Send streaming output to renderer
            if ((global as any).mainWindow) {
              (global as any).mainWindow.webContents.send(`terminal:output`, {
                type: 'stdout',
                data: chunk,
                sessionId,
                timestamp: Date.now()
              });
            }
          });

          // Handle stderr with streaming
          childProcess.stderr?.on('data', (data: Buffer) => {
            const chunk = data.toString();
            errorOutput += chunk;
            // Send streaming error to renderer
            if ((global as any).mainWindow) {
              (global as any).mainWindow.webContents.send(`terminal:output`, {
                type: 'stderr',
                data: chunk,
                sessionId,
                timestamp: Date.now()
              });
            }
          });

          // Handle process completion
          childProcess.on('close', (code: number | null) => {
            const result = {
              stdout: output,
              stderr: errorOutput,
              exitCode: code ?? -1,
              timestamp: Date.now()
            };
            resolve(result);
          });

          // Handle process errors
          childProcess.on('error', (err: Error) => {
            const errorResult = {
              error: err.message,
              stdout: output,
              stderr: errorOutput,
              exitCode: -1,
              timestamp: Date.now()
            };
            reject(errorResult);
          });

          // Update session with active process
          session.process = childProcess;

        } catch (error) {
          reject({
            error: error instanceof Error ? error.message : String(error),
            exitCode: -1,
            timestamp: Date.now()
          });
        }
      })();
    });
  });

  // Get current working directory
  handle("terminal:get-cwd", async (_: unknown, { sessionId }: { sessionId?: string }): Promise<string> => {
    if (sessionId && activeSessions.has(sessionId)) {
      return activeSessions.get(sessionId)!.cwd;
    }
    return process.cwd();
  });

  // Get environment variables
  handle("terminal:get-env", async (): Promise<EnvironmentInfo> => {
    return {
      PATH: process.env.PATH,
      USER: process.env.USER || process.env.USERNAME,
      HOME: process.env.HOME,
      NODE_VERSION: process.version,
      PLATFORM: process.platform,
      npm: process.env.npm_version || 'not available'
    };
  });

  // List directory contents (alternative to 'ls' command)
  handle("terminal:list-files", async (_: unknown, { path: dirPath }: { path?: string }): Promise<ListFileItem[]> => {
    const pathToList = dirPath || process.cwd();
    
    try {
      const items = await fs.readdir(pathToList, { withFileTypes: true });
      const result: ListFileItem[] = [];
      
      for (const item of items) {
        try {
          const fullPath = path.join(pathToList, item.name);
          const stats = await fs.stat(fullPath);
          
          result.push({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime
          });
        } catch (err) {
          // Skip files we can't access
        }
      }
      
      return result;
    } catch (error) {
      throw new Error(`Cannot list directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Check if command exists
  handle("terminal:command-exists", async (_: unknown, { command }: { command: string }): Promise<boolean> => {
    try {
      // Try to run 'which' command (Unix/Linux/Mac) or 'where' command (Windows)
      if (process.platform === 'win32') {
        execSync(`where ${command}`, { stdio: 'ignore' });
      } else {
        execSync(`which ${command}`, { stdio: 'ignore' });
      }
      return true;
    } catch {
      return false;
    }
  });

  // Get available Node.js packages (if npm is available)
  handle("terminal:get-node-version", async (): Promise<EnvironmentInfo> => {
    return {
      node: process.version,
      npm: process.env.npm_version || 'not available'
    };
  });

  // Execute git command if available
  handle("terminal:git-status", async (): Promise<GitStatusResult> => {
    try {
      const result = execSync('git status --porcelain', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      return {
        hasChanges: result.trim().length > 0,
        output: result,
        error: null
      };
    } catch (error) {
      return {
        hasChanges: false,
        output: '',
        error: error instanceof Error ? error.message : 'Git not available or not in a git repository'
      };
    }
  });

  // Clear terminal for a session
  handle("terminal:clear", async (_: unknown, { sessionId }: { sessionId: string }) => {
    // Send clear event to renderer
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send(`terminal:clear`, {
        sessionId,
        timestamp: Date.now()
      });
    }
    return { success: true };
  });

  // Cancel command for a session
  handle("terminal:cancel-command", async (_: unknown, { sessionId }: { sessionId: string; commandId?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = activeSessions.get(sessionId);
      if (!session || !session.process) {
        return { success: false, error: 'No active process for session' };
      }
      const pid = session.process.pid;
      if (!pid) {
        // Attempt graceful kill
        session.process.kill('SIGINT');
      } else if (process.platform === 'win32') {
        // Kill process tree on Windows
        await new Promise<void>((resolve, reject) => {
          exec(`taskkill /PID ${pid} /T /F`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        // POSIX kill
        try {
          process.kill(pid, 'SIGINT');
        } catch {
          process.kill(pid, 'SIGTERM');
        }
      }
      session.process = undefined;
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}