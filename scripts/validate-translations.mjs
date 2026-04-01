#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n.json"), "utf8"));
const SOURCE_LOCALE = CONFIG.locale?.source || "en";
const TARGET_LOCALES = Array.isArray(CONFIG.locale?.targets) ? CONFIG.locale.targets : [];
const EXCLUDED_SOURCE_TOP_DIRS = new Set([
  SOURCE_LOCALE,
  ...TARGET_LOCALES,
  ".git",
  ".github",
  "node_modules",
  "scripts",
  "snippets",
  "styles",
  "lingo",
  ".cursor",
]);

function walkMdx(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walkMdx(abs));
    if (entry.isFile() && abs.endsWith(".mdx")) files.push(abs);
  }
  return files;
}

function walkRootMdx(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_SOURCE_TOP_DIRS.has(entry.name)) continue;
      files = files.concat(walkMdx(abs));
    }
    if (entry.isFile() && abs.endsWith(".mdx")) files.push(abs);
  }
  return files;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return null;
  const endIdx = content.indexOf("\n---\n", 4);
  if (endIdx === -1) return null;
  const raw = content.slice(4, endIdx);
  const parsed = parseYaml(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exitCode = 1;
}

const srcFiles = walkRootMdx(ROOT);
const srcSet = new Set(srcFiles.map((f) => path.relative(ROOT, f).replace(/\\/g, "/")));

for (const TARGET_LOCALE of TARGET_LOCALES) {
  const dstDir = path.join(ROOT, TARGET_LOCALE);
  const dstFiles = walkMdx(dstDir);
  const dstSet = new Set(
    dstFiles.map((f) => path.relative(dstDir, f).replace(/\\/g, "/"))
  );

  for (const rel of srcSet) {
    if (!dstSet.has(rel)) fail(`Missing translated file: ${TARGET_LOCALE}/${rel}`);
  }
  for (const rel of dstSet) {
    if (!srcSet.has(rel)) fail(`Missing source file for translation: ${TARGET_LOCALE}/${rel}`);
  }

  for (const rel of srcSet) {
    const srcPath = path.join(ROOT, rel);
    const dstPath = path.join(dstDir, rel);
    if (!fs.existsSync(dstPath)) continue;

    const srcContent = fs.readFileSync(srcPath, "utf8");
    const dstContent = fs.readFileSync(dstPath, "utf8");

    const srcFm = parseFrontmatter(srcContent);
    const dstFm = parseFrontmatter(dstContent);

  // Snippet-style MDX files may intentionally omit frontmatter.
    if (!srcFm && !dstFm) continue;
    if (!srcFm) fail(`Invalid source frontmatter: ${rel}`);
    if (!dstFm) fail(`Invalid translated frontmatter: ${TARGET_LOCALE}/${rel}`);
    if (!srcFm || !dstFm) continue;

    for (const key of Object.keys(srcFm)) {
      if (!(key in dstFm)) fail(`Missing frontmatter key '${key}' in ${TARGET_LOCALE}/${rel}`);
    }

    if ("title" in srcFm && (!dstFm.title || !dstFm.title.trim())) {
      fail(`Missing translated title in ${TARGET_LOCALE}/${rel}`);
    }
    if ("description" in srcFm && (!dstFm.description || !dstFm.description.trim())) {
      fail(`Missing translated description in ${TARGET_LOCALE}/${rel}`);
    }
  }
}

if (process.exitCode) {
  console.error("Translation validation failed.");
  process.exit(process.exitCode);
}

console.log("Translation parity/frontmatter checks passed.");
