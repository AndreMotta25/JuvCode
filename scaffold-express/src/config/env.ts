export function getPort(): number {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === "--port");
  if (idx !== -1 && args[idx + 1]) {
    const n = Number(args[idx + 1]);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const env = process.env.PORT;
  const n = env ? Number(env) : NaN;
  return !Number.isNaN(n) && n > 0 ? n : 32100;
}

export function getCorsOrigin(): string | RegExp | (string | RegExp)[] | undefined {
  const origin = process.env.CORS_ORIGIN;
  return origin || undefined;
}