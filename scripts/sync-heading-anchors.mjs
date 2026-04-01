#!/usr/bin/env node

/**
 * Mintlify custom heading IDs using markdown ATX + `{#slug}` (see Mintlify
 * “Custom heading IDs”). Migrates legacy one-line HTML `<hN id="…">` from older
 * runs back to `## Title {#slug}`.
 *
 * - source root: slugs from English visible title (Mintlify-style + duplicate suffixes).
 * - targets: same `{#slug}` list in document order.
 * Skips lines inside fenced code blocks (```).
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

const checkOnly = hasFlag("--check");
const targetArg = getArg("--target");

const ROOT = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n.json"), "utf8"));
const sourceLocale = config.locale?.source || "en";
const configuredTargets = Array.isArray(config.locale?.targets) ? config.locale.targets : [];

const targets = targetArg
  ? targetArg.split(",").map((s) => s.trim()).filter(Boolean)
  : configuredTargets;

/** Mintlify: lowercase, spaces → hyphens, remove specials, keep letters/digits. */
function mintlifySlugBase(raw) {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "heading";
}

/** Strip `{#id}` from end of heading text (legacy ATX syntax). */
function stripTrailingAnchor(title) {
  return title.replace(/\s*\{#[^#}]*\}\s*$/, "").trim();
}

function stripHtmlTags(s) {
  return s.replace(/<[^>]+>/g, "");
}

/** Undo minimal escapes we emit in HTML headings so slugs stay stable across runs. */
function decodeBasicEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Lightweight markdown strip for slugging (bold/italic/code/link text). */
function plainForSlug(title) {
  let s = stripTrailingAnchor(title);
  s = stripHtmlTags(s);
  s = decodeBasicEntities(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  return s.trim();
}

function uniqueSlugsFromTitles(titles) {
  const seen = new Map();
  const slugs = [];
  for (const title of titles) {
    const base = mintlifySlugBase(plainForSlug(title));
    let count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count}`;
    slugs.push(slug);
  }
  return slugs;
}

const ATX_HEADING_LINE = /^(#{1,6})\s+(.+)$/;
/** Single-line HTML heading with id (output format). */
const HTML_HEADING_LINE = /^<h([1-6])\s+id="([^"]+)"([^>]*)>(.*)<\/h\1>\s*$/;

function extractHeadingTitlesFromSource(content) {
  const titles = [];
  let inFence = false;
  const lines = content.split("\n");
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const html = line.match(HTML_HEADING_LINE);
    if (html) {
      titles.push(html[4]);
      continue;
    }
    const atx = line.match(ATX_HEADING_LINE);
    if (atx) titles.push(atx[2].trim());
  }
  return titles;
}

function rewriteHeadings(content, slugs) {
  let inFence = false;
  let i = 0;
  const lines = content.split("\n");
  const out = lines.map((line) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) return line;

    const html = line.match(HTML_HEADING_LINE);
    if (html) {
      const level = parseInt(html[1], 10);
      const inner = html[4];
      const slug = slugs[i];
      i += 1;
      if (!slug) return line;
      const visible = stripHtmlTags(decodeBasicEntities(inner)).trim();
      return `${"#".repeat(level)} ${visible} {#${slug}}`;
    }

    const atx = line.match(ATX_HEADING_LINE);
    if (atx) {
      const hashes = atx[1];
      const rest = atx[2].trim();
      const visible = stripTrailingAnchor(rest);
      const slug = slugs[i];
      i += 1;
      if (!slug) return line;
      return `${hashes} ${visible} {#${slug}}`;
    }

    return line;
  });
  if (i !== slugs.length) {
    throw new Error(`Heading count mismatch: used ${i} headings but have ${slugs.length} slugs`);
  }
  return out.join("\n");
}

function walkMdx(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile() && e.name.endsWith(".mdx")) out.push(abs);
    }
  }
  return out.sort();
}

function walkRootMdx(root, opts = {}) {
  const excludeDirs = new Set(opts.excludeDirs || []);
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, e.name);
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      if (e.isDirectory()) {
        if (excludeDirs.has(e.name)) continue;
        stack.push(abs);
      } else if (e.isFile() && rel.endsWith(".mdx")) {
        out.push(abs);
      }
    }
  }
  return out.sort();
}

function processSourceFile(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const titles = extractHeadingTitlesFromSource(raw);
  const slugs = uniqueSlugsFromTitles(titles);
  const next = rewriteHeadings(raw, slugs);
  return { next, changed: next !== raw };
}

let errorCount = 0;
let changedFiles = 0;

const excludedSourceDirs = new Set([
  sourceLocale,
  ...configuredTargets,
  ".git",
  ".github",
  "node_modules",
  "scripts",
  "snippets",
  "lingo",
  "styles",
  ".cursor",
]);
const sourceFiles = walkRootMdx(ROOT, { excludeDirs: excludedSourceDirs });

for (const abs of sourceFiles) {
  try {
    const { next, changed } = processSourceFile(abs);
    if (changed) {
      changedFiles += 1;
      if (!checkOnly) fs.writeFileSync(abs, next);
    }
  } catch (e) {
    console.error(String(e.message || e));
    errorCount += 1;
  }
}

for (const locale of targets) {
  if (locale === sourceLocale) continue;
  const localeDir = path.join(ROOT, locale);
  for (const abs of sourceFiles) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    const targetPath = path.join(localeDir, rel);
    if (!fs.existsSync(targetPath)) continue;
    try {
      const raw = fs.readFileSync(targetPath, "utf8");
      const enPath = abs;
      const enRaw = fs.readFileSync(enPath, "utf8");
      const titles = extractHeadingTitlesFromSource(enRaw);
      const slugs = uniqueSlugsFromTitles(titles);
      const targetTitles = extractHeadingTitlesFromSource(raw);
      if (targetTitles.length !== titles.length) {
        throw new Error(
          `Heading count mismatch for ${locale}/${rel}: en ${titles.length} vs ${locale} ${targetTitles.length}`
        );
      }
      const next = rewriteHeadings(raw, slugs);
      const changed = next !== raw;
      if (changed) {
        changedFiles += 1;
        if (!checkOnly) fs.writeFileSync(targetPath, next);
      }
    } catch (e) {
      console.error(String(e.message || e));
      errorCount += 1;
    }
  }
}

if (checkOnly) {
  if (errorCount > 0) {
    console.error(`sync-heading-anchors: ${errorCount} error(s).`);
    process.exit(1);
  }
  if (changedFiles > 0) {
    console.error(
      `sync-heading-anchors: ${changedFiles} file(s) are out of sync. Run: node scripts/sync-heading-anchors.mjs`
    );
    process.exit(1);
  }
  console.log("Heading anchor sync check passed.");
} else {
  if (errorCount > 0) {
    console.error(`sync-heading-anchors: ${errorCount} error(s).`);
    process.exit(1);
  }
  console.log(`sync-heading-anchors: updated ${changedFiles} file(s).`);
}
