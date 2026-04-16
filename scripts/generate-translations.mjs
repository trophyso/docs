#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}
function hasFlag(name) {
  return args.includes(name);
}
function toPosix(p) {
  return p.replace(/\\/g, "/");
}
function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
function escapeRegex(s) {
  return s.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
function globToRegex(glob) {
  return new RegExp(`^${escapeRegex(toPosix(glob)).replace(/\*/g, "[^/]*")}$`);
}
function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function listSourceMdxFiles(root, sourceLocale, targetLocales) {
  const excludedTop = new Set([
    sourceLocale,
    ...targetLocales,
    ".git",
    ".github",
    "node_modules",
    "scripts",
    "snippets",
    "lingo",
    "styles",
    ".cursor",
    ".tmp",
  ]);
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = toPosix(path.relative(root, abs));
      if (entry.isDirectory()) {
        if (current === root && excludedTop.has(entry.name)) continue;
        stack.push(abs);
      } else if (entry.isFile() && rel.endsWith(".mdx")) {
        out.push(rel);
      }
    }
  }
  return out.sort();
}
function extractMdxIncludePatterns(config) {
  const include = Array.isArray(config?.buckets?.mdx?.include) ? config.buckets.mdx.include : [];
  return include
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry.path === "string") return entry.path;
      return null;
    })
    .filter(Boolean)
    .map((p) => toPosix(p));
}
function resolveSourceFiles(config, sourceLocale, targetLocales) {
  const patterns = extractMdxIncludePatterns(config);
  if (patterns.length === 0) return [];
  const allSourceMdx = listSourceMdxFiles(process.cwd(), sourceLocale, targetLocales);
  const matchers = patterns.map(globToRegex);
  return allSourceMdx.filter((rel) => matchers.some((re) => re.test(rel)));
}
function buildSourceHashSnapshot(sourceFiles) {
  const snapshot = new Map();
  for (const rel of sourceFiles) {
    const abs = path.join(process.cwd(), rel);
    snapshot.set(rel, hashFile(abs));
  }
  return snapshot;
}
function assertSourceUnchanged(sourceHashes) {
  const changed = [];
  for (const [rel, before] of sourceHashes.entries()) {
    const abs = path.join(process.cwd(), rel);
    if (!fs.existsSync(abs) || hashFile(abs) !== before) changed.push(rel);
  }
  if (changed.length > 0) {
    throw new Error(
      `Source files were unexpectedly modified during translation: ${changed.slice(0, 10).join(", ")}${changed.length > 10 ? " ..." : ""}`
    );
  }
}
function writeStagedFilesForTarget(stagingRoot, sourceLocale, target, sourceFiles) {
  for (const rel of sourceFiles) {
    const sourcePath = path.join(process.cwd(), rel);
    const stagedSource = path.join(process.cwd(), stagingRoot, sourceLocale, rel);
    ensureDirForFile(stagedSource);
    fs.copyFileSync(sourcePath, stagedSource);

    const existingTargetPath = path.join(process.cwd(), target, rel);
    const stagedTarget = path.join(process.cwd(), stagingRoot, target, rel);
    ensureDirForFile(stagedTarget);
    fs.copyFileSync(fs.existsSync(existingTargetPath) ? existingTargetPath : sourcePath, stagedTarget);
  }
}
function copyStagedTargetToLocale(stagingRoot, target, sourceFiles) {
  for (const rel of sourceFiles) {
    const stagedTarget = path.join(process.cwd(), stagingRoot, target, rel);
    if (!fs.existsSync(stagedTarget)) continue;
    const destination = path.join(process.cwd(), target, rel);
    ensureDirForFile(destination);
    fs.copyFileSync(stagedTarget, destination);
  }
}

/**
 * Purge Lingo translation entries for a target locale.
 * When `scopedFiles` is set (file-scoped --paths + --force), only those bucket paths are purged.
 * Otherwise the entire locale is purged (full --force without --paths).
 */
function runLingoPurge(target, scopedFiles) {
  const purgeArgs = ["lingo.dev@latest", "purge", "--locale", target];
  if (scopedFiles && scopedFiles.length > 0) {
    purgeArgs.push("--bucket", "mdx");
    for (const rel of scopedFiles) {
      purgeArgs.push("--file", rel);
    }
  }
  purgeArgs.push("--yes-really");
  const result = spawnSync("npx", purgeArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
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
const stagingRoot = toPosix(path.join(".tmp", "lingo"));

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
const sourceLocale = cfg.locale.source;
const configuredTargets = Array.isArray(cfg.locale.targets) ? [...cfg.locale.targets] : [];

const engineIdFromEnv = process.env.LINGO_ENGINE_ID;
if (engineIdFromEnv) {
  cfg.engineId = engineIdFromEnv;
}
if (!cfg.engineId || cfg.engineId === "${LINGO_ENGINE_ID}") {
  console.error("Missing LINGO_ENGINE_ID. Set it in your environment before running.");
  process.exit(1);
}

let sourceFiles = resolveSourceFiles(cfg, sourceLocale, configuredTargets);
if (sourceFiles.length === 0) {
  console.error("No source MDX files resolved from i18n.json buckets.mdx.include.");
  process.exit(1);
}

if (filters.length > 0) {
  sourceFiles = sourceFiles.filter((rel) => filters.some((f) => rel.includes(f)));
  if (sourceFiles.length === 0) {
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
    fs.rmSync(path.join(process.cwd(), stagingRoot), { recursive: true, force: true });
    writeStagedFilesForTarget(stagingRoot, sourceLocale, target, sourceFiles);

    const sourceHashes = buildSourceHashSnapshot(sourceFiles);
    const runCfg = JSON.parse(JSON.stringify(cfg));
    runCfg.locale.targets = [target];
    if (!runCfg.buckets?.mdx) {
      throw new Error("Invalid i18n.json: buckets.mdx is required for staging workflow.");
    }
    runCfg.buckets.mdx.include = sourceFiles.map((rel) => toPosix(path.join(stagingRoot, "[locale]", rel)));
    fs.writeFileSync(configPath, JSON.stringify(runCfg, null, 2) + "\n");

    // Lingo prints "from cache" when per-file work is *skipped* because there is nothing in
    // `processableData` (delta empty vs lock). `run --force` forces every key into that set and
    // passes empty targetData into the localizer for fresh output (see lingo.dev CLI). Purge first
    // clears target strings + lock entries so files and checksums stay consistent.
    // With `--paths`, purge only those files (`lingo purge --file ...`); without `--paths`, purge
    // the whole target locale (legacy full-regeneration behavior).
    if (forceRetranslate) {
      const cacheFile = path.join(process.cwd(), "i18n.cache");
      if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
      const scopedPurgeFiles = filters.length > 0 ? sourceFiles : null;
      runLingoPurge(target, scopedPurgeFiles);
    }
    const runForce = forceRetranslate ? " --force" : "";
    execSync(`npx lingo.dev@latest run --target-locale ${target}${runForce}`, { stdio: "inherit" });
    assertSourceUnchanged(sourceHashes);
    copyStagedTargetToLocale(stagingRoot, target, sourceFiles);

    execSync(`node scripts/translate-docs-json.mjs --target ${target}`, { stdio: "inherit" });
    execSync(`node scripts/localize-internal-links.mjs --target ${target}`, { stdio: "inherit" });
    execSync(`node scripts/localize-mdx-paths.mjs --target ${target}`, { stdio: "inherit" });
    console.log(`Translation generation completed for target locale: ${target}`);
  }
  execSync("node scripts/sync-heading-anchors.mjs", { stdio: "inherit" });
} finally {
  fs.rmSync(path.join(process.cwd(), stagingRoot), { recursive: true, force: true });
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, configPath);
    fs.unlinkSync(backupPath);
  }
}
