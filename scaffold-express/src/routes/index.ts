import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const router = Router();

router.get("/api/hello", (_req, res) => {
  res.json({ ok: true, message: "hello" });
});

router.post("/api/echo", (req, res) => {
  const schema = z.object({ message: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  res.json({ echo: parsed.data.message });
});

router.get("/api/posts", async (_req, res) => {
  const posts = await prisma.post.findMany({ orderBy: { id: "desc" } });
  res.json({ ok: true, data: posts });
});

router.post("/api/posts", async (req, res) => {
  const schema = z.object({ title: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const created = await prisma.post.create({ data: { title: parsed.data.title } });
  res.status(201).json({ ok: true, data: created });
});

export default router;