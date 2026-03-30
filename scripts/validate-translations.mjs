#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_LOCALE = "en";
const TARGET_LOCALE = "es";

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

function relNoLocale(file, locale) {
  return path.relative(path.join(ROOT, locale), file).replace(/\\/g, "/");
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return null;
  const endIdx = content.indexOf("\n---\n", 4);
  if (endIdx === -1) return null;
  const raw = content.slice(4, endIdx).split("\n");
  const out = {};
  for (const line of raw) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out;
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exitCode = 1;
}

const srcDir = path.join(ROOT, SOURCE_LOCALE);
const dstDir = path.join(ROOT, TARGET_LOCALE);
const srcFiles = walkMdx(srcDir);
const dstFiles = walkMdx(dstDir);

const srcSet = new Set(srcFiles.map((f) => relNoLocale(f, SOURCE_LOCALE)));
const dstSet = new Set(dstFiles.map((f) => relNoLocale(f, TARGET_LOCALE)));

for (const rel of srcSet) {
  if (!dstSet.has(rel)) fail(`Missing translated file: ${TARGET_LOCALE}/${rel}`);
}
for (const rel of dstSet) {
  if (!srcSet.has(rel)) fail(`Missing source file for translation: ${SOURCE_LOCALE}/${rel}`);
}

for (const rel of srcSet) {
  const srcPath = path.join(srcDir, rel);
  const dstPath = path.join(dstDir, rel);
  if (!fs.existsSync(dstPath)) continue;

  const srcContent = fs.readFileSync(srcPath, "utf8");
  const dstContent = fs.readFileSync(dstPath, "utf8");

  const srcFm = parseFrontmatter(srcContent);
  const dstFm = parseFrontmatter(dstContent);

  // Snippet-style MDX files may intentionally omit frontmatter.
  if (!srcFm && !dstFm) continue;
  if (!srcFm) fail(`Invalid source frontmatter: ${SOURCE_LOCALE}/${rel}`);
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

if (process.exitCode) {
  console.error("Translation validation failed.");
  process.exit(process.exitCode);
}

console.log("Translation parity/frontmatter checks passed.");
