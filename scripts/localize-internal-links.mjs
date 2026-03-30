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

function shouldPrefix(rawPath, locale) {
  if (!rawPath || rawPath.startsWith("#")) return false;
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("mailto:")) {
    return false;
  }
  if (excludedPrefixes.some((prefix) => rawPath.startsWith(prefix))) return false;
  if (knownLocales.some((l) => rawPath === l || rawPath.startsWith(`${l}/`))) return false;

  const first = rawPath.split("/")[0];
  if (first.includes(".") && !rawPath.includes("/")) return false;
  return true;
}

function rewriteContent(content, locale) {
  let next = content;

  // Markdown links: [label](/path)
  next = next.replace(/\]\(\/([^)]+)\)/g, (full, p1) => {
    const p = p1.trim();
    if (!shouldPrefix(p, locale)) return full;
    return `](/${locale}/${p})`;
  });

  // JSX/HTML attrs: href="/path" only (keep relative image/video src unchanged)
  next = next.replace(/\bhref=(["'])\/([^"']+)\1/g, (full, quote, p1) => {
    const p = p1.trim();
    if (!shouldPrefix(p, locale)) return full;
    return `href=${quote}/${locale}/${p}${quote}`;
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

let changedFiles = 0;

for (const locale of locales) {
  const files = walkMdx(locale);
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
