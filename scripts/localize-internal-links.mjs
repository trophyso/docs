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

const excludedPrefixes = [
  "assets/",
  "images/",
  "logo/",
  "icons/",
  "favicon/"
];

/** Longest first so `en-US` wins over `en` when both exist. */
const knownLocalesLongestFirst = [...knownLocales].sort(
  (a, b) => b.length - a.length
);

/** If `b` starts with a configured locale segment, return the path after that prefix ("" if exact). */
function stripKnownLocalePrefix(b) {
  for (const l of knownLocalesLongestFirst) {
    if (b === l) return "";
    if (b.startsWith(`${l}/`)) return b.slice(l.length + 1);
  }
  return null;
}

/** Split `/path#hash` so we rewrite the path and keep the fragment. */
function splitHash(pathPart) {
  const hashIdx = pathPart.indexOf("#");
  if (hashIdx === -1) {
    return { base: pathPart, suffix: "" };
  }
  return { base: pathPart.slice(0, hashIdx), suffix: pathPart.slice(hashIdx) };
}

/**
 * Path without leading slash (e.g. `en/platform/metrics` or `platform/metrics`).
 * Returns new path (no leading slash) or null if unchanged / skip.
 */
function rewriteInternalPath(base, locale) {
  const b = base.trim();
  if (!b) return null;
  if (b.startsWith("http://") || b.startsWith("https://") || b.startsWith("mailto:")) {
    return null;
  }
  if (excludedPrefixes.some((prefix) => b.startsWith(prefix))) return null;

  const firstSeg = b.split("/")[0];
  if (firstSeg.includes(".") && !b.includes("/")) return null;

  const isSourceLocale = locale === sourceLocale;
  if (isSourceLocale) {
    const restAfterLocale = stripKnownLocalePrefix(b);
    if (restAfterLocale === null) return null;
    return restAfterLocale;
  }

  // Already matches the locale of the file we're editing.
  if (b === locale || b.startsWith(`${locale}/`)) return null;

  const restAfterLocale = stripKnownLocalePrefix(b);
  if (restAfterLocale !== null) {
    return restAfterLocale === "" ? locale : `${locale}/${restAfterLocale}`;
  }

  // Bare internal path: platform/foo -> {locale}/platform/foo.
  return `${locale}/${b}`;
}

function transformCapturedPath(p1, locale) {
  const trimmed = p1.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const { base, suffix } = splitHash(trimmed);
  const out = rewriteInternalPath(base, locale);
  if (out === null) return null;
  return out + suffix;
}

function rewriteContent(content, locale) {
  let next = content;

  // Markdown links: [label](/path)
  next = next.replace(/\]\(\/([^)]+)\)/g, (full, p1) => {
    const out = transformCapturedPath(p1, locale);
    if (out === null) return full;
    return `](/${out})`;
  });

  // JSX/HTML attrs: href="/path" only (keep relative image/video src unchanged)
  next = next.replace(/\bhref=(["'])\/([^"']+)\1/g, (full, quote, p1) => {
    const out = transformCapturedPath(p1, locale);
    if (out === null) return full;
    return `href=${quote}/${out}${quote}`;
  });

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
    console.error(`Found ${changedFiles} file(s) with non-localized internal links.`);
    process.exit(1);
  }
  console.log("Internal links are locale-localized.");
} else {
  console.log(`Localized internal links in ${changedFiles} file(s).`);
}
