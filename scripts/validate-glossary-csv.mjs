#!/usr/bin/env node

import fs from "node:fs";

const path = "lingo/glossary.csv";
const REQUIRED_HEADERS = [
  "source_locale",
  "target_locale",
  "source_text",
  "target_text",
  "type",
  "hint"
];
const ALLOWED_TYPES = new Set(["custom_translation", "non_translatable"]);

if (!fs.existsSync(path)) {
  console.error(`Missing ${path}`);
  process.exit(1);
}

const raw = fs.readFileSync(path, "utf8").trim();
if (!raw) {
  console.error("Glossary CSV is empty.");
  process.exit(1);
}

const lines = raw.split(/\r?\n/);
const headers = lines[0].split(",").map((v) => v.trim());

for (const [idx, header] of REQUIRED_HEADERS.entries()) {
  if (headers[idx] !== header) {
    console.error(`Invalid header at column ${idx + 1}: expected '${header}', got '${headers[idx] || ""}'`);
    process.exit(1);
  }
}

const keySet = new Set();
let rowCount = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  rowCount += 1;

  const parts = line.split(",").map((v) => v.trim());
  if (parts.length < REQUIRED_HEADERS.length) {
    console.error(`Row ${i + 1}: expected ${REQUIRED_HEADERS.length} columns, got ${parts.length}`);
    process.exit(1);
  }

  const [sourceLocale, targetLocale, sourceText, targetText, type] = parts;
  if (!sourceLocale || !targetLocale || !sourceText || !targetText || !type) {
    console.error(`Row ${i + 1}: source_locale,target_locale,source_text,target_text,type are required`);
    process.exit(1);
  }

  if (!ALLOWED_TYPES.has(type)) {
    console.error(`Row ${i + 1}: invalid type '${type}'`);
    process.exit(1);
  }

  const key = `${sourceLocale}|${targetLocale}|${type}|${sourceText}`;
  if (keySet.has(key)) {
    console.error(`Row ${i + 1}: duplicate canonical key '${key}'`);
    process.exit(1);
  }
  keySet.add(key);
}

console.log(`Glossary CSV valid (${rowCount} entries, ${keySet.size} unique canonical keys).`);
