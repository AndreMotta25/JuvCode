import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { randomUUID } from "crypto";
import logger from "./lib/logger";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { notFound, errorHandler } from "./middleware/error";
import { getPort, getCorsOrigin } from "./config/env";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use((req, _res, next) => {
  (req as any).id = req.headers["x-request-id"] || randomUUID();
  next();
});
// no comments
morgan.token("id", (req: any) => req.id);
app.use(
  morgan(":id :method :url :status :res[content-length] - :response-time ms", {
    skip: (req) => req.path === "/healthz" || req.path === "/readyz",
  }),
);
app.use(cors({ origin: getCorsOrigin() }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Juvcode Express template" });
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/readyz", (_req, res) => {
  res.json({ status: "ready" });
});

app.get("/logo", (_req, res) => {
  const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Express Logo</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;color:#eee;font-family:system-ui,sans-serif"><img src="https://upload.wikimedia.org/wikipedia/commons/6/64/Expressjs.png" alt="Express" style="max-width:80%;height:auto"/></body></html>`;
  res.type("html").send(html);
});

app.use(router);
app.use(notFound);
app.use(errorHandler);

const port = getPort();
const server = app.listen(port, () => {
  logger.info("Servidor iniciado", {
    url: `http://localhost:${port}`,
    env: process.env.NODE_ENV || "development",
    pid: process.pid,
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

function shutdown(signal: string) {
  logger.info(`Recebido ${signal}, encerrando`);
  server.close(() => {
    logger.info("Servidor encerrado");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
