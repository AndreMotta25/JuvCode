import { BrowserWindow } from "electron";

declare global {
  let mainWindow: BrowserWindow | null;
}

export {};
