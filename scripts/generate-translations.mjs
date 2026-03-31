#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
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

if (filters.length > 0 && cfg.buckets) {
  let matched = 0;
  for (const bucket of Object.values(cfg.buckets)) {
    if (!bucket?.include) continue;
    bucket.include = bucket.include.filter((pattern) => {
      const keep = filters.some((f) => pattern.includes(f));
      if (keep) matched += 1;
      return keep;
    });
  }
  if (matched === 0) {
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
  execSync("node scripts/sync-openapi-titles.mjs", { stdio: "inherit" });
  for (const target of targets) {
    cfg.locale.targets = [target];
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
    // Lingo prints "from cache" when per-file work is *skipped* because there is nothing in
    // `processableData` (delta empty vs lock). `run --force` forces every key into that set and
    // passes empty targetData into the localizer for fresh output (see lingo.dev CLI). Purge first
    // clears target strings + lock entries for the locale so files and checksums stay consistent.
    if (forceRetranslate) {
      const cacheFile = path.join(process.cwd(), "i18n.cache");
      if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
      execSync(`npx lingo.dev@latest purge --locale ${target} --yes-really`, { stdio: "inherit" });
    }
    const runForce = forceRetranslate ? " --force" : "";
    execSync(`npx lingo.dev@latest run --target-locale ${target}${runForce}`, { stdio: "inherit" });
    execSync(`node scripts/translate-docs-json.mjs --target ${target}`, { stdio: "inherit" });
    execSync(`node scripts/localize-internal-links.mjs --target ${target}`, { stdio: "inherit" });
    execSync(`node scripts/localize-component-imports.mjs --target ${target}`, { stdio: "inherit" });
    console.log(`Translation generation completed for target locale: ${target}`);
  }
  execSync("node scripts/sync-heading-anchors.mjs", { stdio: "inherit" });
} finally {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, configPath);
    fs.unlinkSync(backupPath);
  }
}
