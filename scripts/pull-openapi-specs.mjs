#!/usr/bin/env node

/**
 * Pull hosted OpenAPI documents into repo-local files for Mintlify.
 *
 * Sources:
 * - https://api.trophy.so/v1/openapi  → openapi/application.json
 * - https://admin.trophy.so/v1/openapi → openapi/admin.json
 *
 * Usage: node scripts/pull-openapi-specs.mjs
 *        npm run openapi:pull
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "openapi");

const SPECS = [
  {
    name: "Application API (+ webhooks)",
    url: "https://api.trophy.so/v1/openapi",
    file: "application.json",
  },
  {
    name: "Admin API",
    url: "https://admin.trophy.so/v1/openapi",
    file: "admin.json",
  },
];

async function pullOne({ name, url, file }) {
  const res = await fetch(url, {
    headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
  });
  if (!res.ok) {
    throw new Error(`${name}: HTTP ${res.status} from ${url}`);
  }

  const raw = await res.text();
  let document;
  try {
    document = JSON.parse(raw);
  } catch {
    throw new Error(
      `${name}: response from ${url} is not valid JSON (Mintlify local specs are stored as .json)`
    );
  }

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${name}: expected a JSON object OpenAPI document`);
  }
  if (!document.openapi && !document.swagger) {
    throw new Error(`${name}: missing openapi/swagger version field`);
  }

  const outPath = path.join(OUT_DIR, file);
  const body = `${JSON.stringify(document, null, 2)}\n`;
  fs.writeFileSync(outPath, body, "utf8");

  const pathCount = Object.keys(document.paths || {}).length;
  const webhookCount = Object.keys(document.webhooks || {}).length;
  const version = document.info?.version || "?";
  const rel = path.relative(ROOT, outPath);

  console.log(
    `✓ ${name} → ${rel} (openapi ${document.openapi || document.swagger}, info ${version}, ${pathCount} paths, ${webhookCount} webhooks, ${body.length} bytes)`
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const spec of SPECS) {
    await pullOne(spec);
  }
  console.log(
    "\nDone. If operation summaries changed, run: npm run translate:sync-openapi-titles"
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
