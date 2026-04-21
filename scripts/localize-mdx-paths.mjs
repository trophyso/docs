#!/usr/bin/env node

/**
 * localize-mdx-paths.mjs — After Lingo, normalize MDX paths per file location and locale:
 * 1) `import ... from ".../<locale>/components/*.jsx|tsx"` → active target locale.
 * 2) `import ... from ".../snippets/..."` relative depth → repo-root `snippets/`.
 * 3) JSX `src=".../assets/..."` relative depth → repo-root `assets/`.
 */

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
const COMPONENT_IMPORT_RE = new RegExp(
  `(from\\s+["'])([^"']*?/)(?:${knownLocalesPattern})(/components/[^"']+\\.(?:jsx|tsx))(["'])`,
  "g"
);

// import ... from "../snippets/foo.mdx" (one or more ../)
const SNIPPET_IMPORT_RE = /(from\s+["'])(?:\.\.\/)+(snippets\/[^"']+)(["'])/g;

// src="../assets/foo.png" or src='...' (closing quote must match opener)
const ASSET_SRC_RE = /(src=)(["'])(?:\.\.\/)+(assets\/[^"']+)\2/g;

function rewriteComponentImports(content, locale) {
  return content.replace(COMPONENT_IMPORT_RE, (_full, p1, p2, p3, p4) => `${p1}${p2}${locale}${p3}${p4}`);
}

function dirDepthFromRepoRoot(fileAbs) {
  const rel = path.relative(process.cwd(), fileAbs).replace(/\\/g, "/");
  const dir = path.dirname(rel);
  if (dir === ".") return 0;
  return dir.split("/").filter(Boolean).length;
}

function snippetImportPrefix(depth) {
  if (depth <= 0) return "./";
  return "../".repeat(depth);
}

function rewriteSnippetImports(content, fileAbs) {
  const prefix = snippetImportPrefix(dirDepthFromRepoRoot(fileAbs));
  return content.replace(SNIPPET_IMPORT_RE, (_full, p1, p2, p3) => `${p1}${prefix}${p2}${p3}`);
}

function rewriteAssetSrc(content, fileAbs) {
  const prefix = snippetImportPrefix(dirDepthFromRepoRoot(fileAbs));
  return content.replace(ASSET_SRC_RE, (_full, p1, q, p3) => `${p1}${q}${prefix}${p3}${q}`);
}

function rewriteFile(content, locale, fileAbs) {
  let next = rewriteComponentImports(content, locale);
  next = rewriteSnippetImports(next, fileAbs);
  next = rewriteAssetSrc(next, fileAbs);
  return next;
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

const excludedTop = new Set([
  sourceLocale,
  ...targetLocales,
  "node_modules",
  ".git",
  ".github",
  "scripts",
  "lingo",
  "styles",
  ".cursor",
  "snippets",
  "assets",
]);

let changedFiles = 0;
const changedFilePaths = [];

for (const locale of locales) {
  const files = locale === sourceLocale
    ? walkRootMdx(".", excludedTop)
    : walkMdx(locale);
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const next = rewriteFile(raw, locale, file);
    if (next !== raw) {
      changedFiles += 1;
      changedFilePaths.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
      if (!checkOnly) fs.writeFileSync(file, next);
    }
  }
}

if (checkOnly) {
  if (changedFiles > 0) {
    console.error(`Found ${changedFiles} file(s) with incorrect localized MDX paths.`);
    for (const filePath of changedFilePaths.sort()) {
      console.error(` - ${filePath}`);
    }
    process.exit(1);
  }
  console.log("Localized MDX paths are correct.");
} else {
  console.log(`Updated localized MDX paths in ${changedFiles} file(s).`);
  if (changedFiles > 0) {
    for (const filePath of changedFilePaths.sort()) {
      console.log(` - ${filePath}`);
    }
  }
}
