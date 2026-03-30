#!/usr/bin/env node

import fs from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}
function hasFlag(name) {
  return args.includes(name);
}

const targetArg = getArg("--target");
const pathFilter = getArg("--paths");
const forceRetranslate = hasFlag("--force");
const filters = pathFilter
  ? pathFilter
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

const configPath = "i18n.json";
const backupPath = "i18n.json.bak";

if (!fs.existsSync(configPath)) {
  console.error("Missing i18n.json");
  process.exit(1);
}

const originalRaw = fs.readFileSync(configPath, "utf8");
const cfg = JSON.parse(originalRaw);

if (!cfg.locale || !cfg.locale.source || !cfg.buckets) {
  console.error("Invalid i18n.json: locale.source and buckets are required.");
  process.exit(1);
}
const configuredTargets = Array.isArray(cfg.locale.targets) ? [...cfg.locale.targets] : [];

const engineIdFromEnv = process.env.LINGO_ENGINE_ID;
if (engineIdFromEnv) {
  cfg.engineId = engineIdFromEnv;
}
if (!cfg.engineId || cfg.engineId === "${LINGO_ENGINE_ID}") {
  console.error("Missing LINGO_ENGINE_ID. Set it in your environment before running.");
  process.exit(1);
}

if (filters.length > 0 && cfg.buckets.mdx?.include) {
  cfg.buckets.mdx.include = cfg.buckets.mdx.include.filter((pattern) =>
    filters.some((f) => pattern.includes(f))
  );
  if (cfg.buckets.mdx.include.length === 0) {
    console.error("No files matched --paths filters.");
    process.exit(1);
  }
}

fs.writeFileSync(backupPath, originalRaw);
const targets = targetArg
  ? targetArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : configuredTargets;

if (targets.length === 0) {
  console.error("No target locales available. Set locale.targets in i18n.json or pass --target.");
  process.exit(1);
}

try {
  for (const target of targets) {
    cfg.locale.targets = [target];
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
    const forceFlag = forceRetranslate ? " --force" : "";
    execSync(`npx lingo.dev@latest run --target-locale ${target}${forceFlag}`, { stdio: "inherit" });
    execSync(`node scripts/translate-docs-json.mjs --target ${target}`, { stdio: "inherit" });
    execSync(`node scripts/localize-internal-links.mjs --target ${target}`, { stdio: "inherit" });
    console.log(`Translation generation completed for target locale: ${target}`);
  }
  execSync("node scripts/sync-heading-anchors.mjs", { stdio: "inherit" });
} finally {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, configPath);
    fs.unlinkSync(backupPath);
  }
}
