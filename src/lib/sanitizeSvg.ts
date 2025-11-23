export async function sanitizeSvgFile(file: File): Promise<File> {
  const text = await file.text();
  const cleaned = text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/xlink:href\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/xlink:href\s*=\s*'javascript:[^']*'/gi, "")
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "");
  const blob = new Blob([cleaned], { type: file.type });
  return new File([blob], file.name, { type: file.type });
}
