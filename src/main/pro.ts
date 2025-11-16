import { readSettings, writeSettings } from "./settings";

export function handleDyadProReturn({ apiKey }: { apiKey: string }) {
  // Dyad Pro is now free - just enable it
  const settings = readSettings();
  writeSettings({
    enableDyadPro: true,
  });
}
