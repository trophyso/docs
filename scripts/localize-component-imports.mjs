#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(name) {
  return args.includes(name);
}

const config = JSON.parse(fs.readFileSync("i18n.json", "utf8"));
const sourceLocale = config.locale?.source || "en";
const targetLocales = Array.isArray(config.locale?.targets) ? config.locale.targets : [];
const knownLocales = [sourceLocale, ...targetLocales];

const targetArg = getArg("--target");
const allLocales = hasFlag("--all");
const checkOnly = hasFlag("--check");

const locales = allLocales
  ? knownLocales
  : (targetArg
      ? targetArg.split(",").map((s) => s.trim()).filter(Boolean)
      : targetLocales);

if (locales.length === 0) {
  console.error("No locales to process. Use --target or ensure i18n.json locale.targets exists.");
  process.exit(1);
}

const knownLocalesPattern = knownLocales
  .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

// import ... from ".../en/components/foo.jsx|tsx"
const IMPORT_RE = new RegExp(
  `(from\\s+["'])([^"']*?/)(?:${knownLocalesPattern})(/components/[^"']+\\.(?:jsx|tsx))(["'])`,
  "g"
);

function rewriteContent(content, locale) {
  return content.replace(IMPORT_RE, (_full, p1, p2, p3, p4) => `${p1}${p2}${locale}${p3}${p4}`);
}

function walkMdx(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(abs);
      if (entry.isFile() && abs.endsWith(".mdx")) out.push(abs);
    }
  }
  return out;
}

function walkRootMdx(root, excludedTopDirs) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (current === root && excludedTopDirs.has(entry.name)) continue;
        stack.push(abs);
      }
      if (entry.isFile() && rel.endsWith(".mdx")) out.push(abs);
    }
  }
  return out;
}

let changedFiles = 0;

for (const locale of locales) {
  const files = locale === sourceLocale
    ? walkRootMdx(".", new Set([sourceLocale, ...targetLocales, "node_modules", ".git", ".github", "scripts", "lingo", "styles", ".cursor"]))
    : walkMdx(locale);
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const next = rewriteContent(raw, locale);
    if (next !== raw) {
      changedFiles += 1;
      if (!checkOnly) fs.writeFileSync(file, next);
    }
  }
}

if (checkOnly) {
  if (changedFiles > 0) {
    console.error(`Found ${changedFiles} file(s) with non-localized component imports.`);
    process.exit(1);
  }
  console.log("Component imports are locale-localized.");
} else {
  console.log(`Localized component imports in ${changedFiles} file(s).`);
}
