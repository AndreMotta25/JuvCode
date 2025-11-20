// startProxy.js – helper to launch proxy.js as a worker

import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import { findAvailablePort } from "./port_utils";
import log from "electron-log";

const logger = log.scope("start_proxy_server");

export async function startProxy(
  targetOrigin: string,
  opts: {
    // host?: string;
    // port?: number;
    // env?: Record<string, string>;
    onStarted?: (proxyUrl: string) => void;
    preferredPort?: number;
  } = {},
) {
  if (!/^https?:\/\//.test(targetOrigin))
    throw new Error("startProxy: targetOrigin must be absolute http/https URL");
  const configuredPort = opts.preferredPort ?? getConfiguredProxyPort();
  let port: number;
  if (configuredPort != null) {
    try {
      port = await findAvailablePort(configuredPort, configuredPort);
    } catch {
      port = await findAvailablePort(50_000, 60_000);
    }
  } else {
    port = await findAvailablePort(50_000, 60_000);
  }
  logger.info("Found available port", port);
  const {
    // host = "localhost",
    // env = {}, // additional env vars to pass to the worker
    onStarted,
  } = opts;

  const worker = new Worker(
    path.resolve(__dirname, "..", "..", "worker", "proxy_server.js"),
    {
      workerData: {
        targetOrigin,
        port,
      },
    },
  );

  worker.on("message", (m) => {
    logger.info("[proxy]", m);
    if (typeof m === "string" && m.startsWith("proxy-server-start url=")) {
      const url = m.substring("proxy-server-start url=".length);
      onStarted?.(url);
    }
  });
  worker.on("error", (e) => logger.error("[proxy] error:", e));
  worker.on("exit", (c) => logger.info("[proxy] exit", c));

  return worker; // let the caller keep a handle if desired
}

function getConfiguredProxyPort(): number | undefined {
  const envVal = process.env.DYAD_PROXY_PORT;
  if (envVal) {
    const n = Number(envVal);
    if (Number.isInteger(n) && n >= 1024 && n <= 65535) return n;
  }
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    const val = pkg?.dyad?.devProxyPort;
    if (val != null) {
      const n = Number(val);
      if (Number.isInteger(n) && n >= 1024 && n <= 65535) return n;
    }
  } catch {}
  return undefined;
}
