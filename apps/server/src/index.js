import "./loadEnv.js";
import cors from "cors";
import express from "express";
import { authMiddleware, login, publicUser, register } from "./auth.js";
import { getProgress, putProgress } from "./progress.js";
import { getLatestFromGitHub } from "./updates.js";

const PORT = Number(process.env.PORT || 8787);
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "codeflow-server",
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
    releasesRepo: process.env.GITHUB_RELEASES_REPO || "Lysacae/CodeFlow",
  });
});

app.post("/auth/register", async (req, res) => {
  try {
    const result = await register(req.body || {});
    res.status(201).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Erreur serveur." });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const result = await login(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Erreur serveur." });
  }
});

app.get("/me", authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/progress", authMiddleware, async (req, res) => {
  try {
    res.json(await getProgress(req.user));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Erreur serveur." });
  }
});

app.put("/progress", authMiddleware, async (req, res) => {
  try {
    res.json(await putProgress(req.user, req.body || {}));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Erreur serveur." });
  }
});

app.get("/updates/latest", async (_req, res) => {
  try {
    const latest = await getLatestFromGitHub();
    if (!latest) {
      return res.json({ version: null, notes: "", downloadUrl: null });
    }
    res.json(latest);
  } catch (e) {
    res.status(502).json({ error: e.message || "Impossible de lire GitHub Releases." });
  }
});

app.listen(PORT, () => {
  console.log(`CodeFlow API http://localhost:${PORT}`);
  console.log(`Supabase: ${process.env.SUPABASE_URL || "(non configuré)"}`);
  console.log(`Releases: ${process.env.GITHUB_RELEASES_REPO || "Lysacae/CodeFlow"}`);
});
