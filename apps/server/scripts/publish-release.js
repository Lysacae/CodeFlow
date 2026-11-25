#!/usr/bin/env node
import "./../src/loadEnv.js";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const REPO = process.env.GITHUB_RELEASES_REPO || "Lysacae/CodeFlow";
const [version, fileArg, ...noteParts] = process.argv.slice(2);

if (!version || !fileArg) {
  console.error(
    "Usage: npm run publish-release -- <version> <chemin-setup.exe> [notes...]",
  );
  process.exit(1);
}

const sourceFile = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(sourceFile)) {
  console.error(`Fichier introuvable : ${sourceFile}`);
  process.exit(1);
}

const notes = noteParts.join(" ") || `CodeFlow ${version}`;
const tag = version.startsWith("v") ? version : `v${version}`;

try {
  execFileSync(
    "gh",
    [
      "release",
      "create",
      tag,
      sourceFile,
      "--repo",
      REPO,
      "--title",
      `CodeFlow ${tag}`,
      "--notes",
      notes,
    ],
    { stdio: "inherit" },
  );
} catch (e) {
  // Si le tag existe déjà, uploader l'asset
  console.log("Release peut-être déjà créée — tentative d'upload d'asset…");
  execFileSync(
    "gh",
    ["release", "upload", tag, sourceFile, "--repo", REPO, "--clobber"],
    { stdio: "inherit" },
  );
}

console.log(`Publié sur https://github.com/${REPO}/releases/tag/${tag}`);
