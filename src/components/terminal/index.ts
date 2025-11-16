// Terminal component exports
export { Terminal } from "./Terminal";
export { TerminalPanel } from "./TerminalPanel";
export { TerminalTab } from "./TerminalTab";
export { TerminalDemoPage } from "./TerminalDemoPage";

// Re-export the main Terminal component as default
export { Terminal as default } from "./Terminal";

// Type exports
export type { TerminalOutput } from "../../utils/terminalUtils";
export type { TerminalSession } from "../../utils/terminalUtils";
export type { UseTerminalReturn } from "../../hooks/useTerminal";