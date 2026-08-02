#!/usr/bin/env node

/**
 * Set Mintlify MDX `title:` from OpenAPI operation / webhook `summary`
 * (matches what Mintlify infers when title is omitted).
 *
 * - Source locale (repo root): always rewrite title to match the spec.
 * - Target locales: only add `title` when missing or blank (keeps Lingo translations).
 *
 * Expects frontmatter with an explicit local OpenAPI source:
 * - `openapi: "/openapi/application.json GET /path"`
 * - `openapi: "/openapi/application.json webhook <eventKey>"`
 * - `openapi: "/openapi/admin.json METHOD /path"`
 * Short forms still resolve via path heuristics against known specs.
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

const checkOnly = hasFlag("--check");
const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "i18n.json");
const specCache = new Map();
const APP_SPEC = "openapi/application.json";
const ADMIN_SPEC = "openapi/admin.json";
/** @deprecated remote URLs — prefer local APP_SPEC / ADMIN_SPEC */
const APP_SPEC_URL = "https://api.trophy.so/v1/openapi";
const ADMIN_SPEC_URL = "https://admin.trophy.so/v1/openapi";

const OPENAPI_LINE_RE = /^openapi:\s*(.+)$/m;
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

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

function walkRootMdx(root, opts = {}) {
  const excludeDirs = new Set(opts.excludeDirs || []);
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, entry.name);
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name)) continue;
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && rel.endsWith(".mdx")) out.push(abs);
    }
  }
  return out.sort();
}

function splitFrontmatter(content) {
  if (!content.startsWith("---\n")) return null;
  const endIdx = content.indexOf("\n---\n", 4);
  if (endIdx === -1) return null;
  return {
    fmRaw: content.slice(4, endIdx),
    body: content.slice(endIdx + "\n---\n".length),
    fullPrefix: content.slice(0, endIdx + "\n---\n".length),
  };
}

function parseOpenapiRef(fmRaw) {
  const m = fmRaw.match(OPENAPI_LINE_RE);
  if (!m) return null;

  let value = m[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value) return null;

  const firstSpace = value.indexOf(" ");
  if (firstSpace === -1) return null;

  let source = null;
  let remainder = value;
  const firstToken = value.slice(0, firstSpace).trim();
  if (
    /^https?:\/\//i.test(firstToken) ||
    firstToken.startsWith("openapi/") ||
    firstToken.startsWith("/openapi/")
  ) {
    source = firstToken;
    remainder = value.slice(firstSpace + 1).trim();
    if (!remainder) return null;
  }

  let normalizedSource = source ? source.replace(/\\/g, "/") : null;
  // Mintlify frontmatter uses a leading slash; load from repo-relative path.
  if (normalizedSource && normalizedSource.startsWith("/openapi/")) {
    normalizedSource = normalizedSource.slice(1);
  }

  if (remainder.toLowerCase().startsWith("webhook ")) {
    const name = remainder.slice("webhook ".length).trim();
    if (!name) return null;
    return { kind: "webhook", name, source, normalizedSource };
  }

  const remSpace = remainder.indexOf(" ");
  if (remSpace === -1) return null;
  const method = remainder.slice(0, remSpace).toLowerCase();
  const apiPath = remainder.slice(remSpace + 1).trim();
  if (!HTTP_METHODS.has(method) || !apiPath) return null;

  return {
    kind: "http",
    method,
    path: apiPath,
    source,
    normalizedSource,
  };
}

function inferSourceFromPath(fileAbsPath) {
  const rel = path.relative(ROOT, fileAbsPath).replace(/\\/g, "/");
  // Strip locale prefix (es/, fr/, …) for target locale pages.
  const unprefixed = rel.replace(/^[a-z]{2}(?:-[A-Za-z]+)?\//, "");
  if (unprefixed.startsWith("api-reference/endpoints/")) return APP_SPEC;
  if (unprefixed.startsWith("admin-api/endpoints/")) return ADMIN_SPEC;
  if (unprefixed.startsWith("webhooks/events/")) return APP_SPEC;
  return null;
}

function normalizeLoadKey(source) {
  let candidate = source.trim().replace(/\\/g, "/");
  if (candidate.startsWith("/openapi/")) candidate = candidate.slice(1);
  try {
    const u = new URL(candidate);
    return { key: u.toString(), isRemote: true };
  } catch {
    return { key: candidate, isRemote: false };
  }
}

async function loadSpec(source) {
  const { key, isRemote } = normalizeLoadKey(source);
  if (specCache.has(key)) return specCache.get(key);
  if (!isRemote) {
    const absPath = path.join(ROOT, key);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Missing local OpenAPI spec: ${key}`);
    }
    const spec = parseYaml(fs.readFileSync(absPath, "utf8"));
    if (!spec || typeof spec !== "object") {
      throw new Error(`Invalid YAML OpenAPI spec: ${key}`);
    }
    specCache.set(key, spec);
    return spec;
  }

  let res;
  try {
    res = await fetch(key, {
      headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
    });
  } catch (err) {
    throw new Error(`Failed to fetch remote OpenAPI spec ${key}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch remote OpenAPI spec ${key}: HTTP ${res.status}`);
  }
  const body = await res.text();
  let spec;
  try {
    spec = parseYaml(body);
  } catch (err) {
    throw new Error(`Failed to parse remote OpenAPI spec ${key}: ${err.message}`);
  }
  if (!spec || typeof spec !== "object") {
    throw new Error(`Invalid remote OpenAPI document: ${key}`);
  }
  specCache.set(key, spec);
  return spec;
}

function getFmValue(fmRaw, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const mm = fmRaw.match(re);
  if (!mm) return null;
  let v = mm[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function titleLineForValue(title) {
  if (/^[\w\s\-'.,!?/&()+]+$/.test(title) && !title.includes(":")) {
    return `title: ${title}`;
  }
  return `title: ${JSON.stringify(title)}`;
}

function setOrInsertTitle(fmRaw, title) {
  const lines = fmRaw.split("\n");
  const newLine = titleLineForValue(title);
  const titleIdx = lines.findIndex((l) => l.startsWith("title:"));
  if (titleIdx >= 0) {
    lines[titleIdx] = newLine;
    return lines.join("\n");
  }
  const openapiIdx = lines.findIndex((l) => l.trimStart().startsWith("openapi:"));
  if (openapiIdx >= 0) {
    lines.splice(openapiIdx, 0, newLine);
    return lines.join("\n");
  }
  return [newLine, ...lines].filter(Boolean).join("\n");
}

function humanizeOperationId(id) {
  if (!id) return null;
  const s = id
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleFromOperation(op) {
  if (!op || typeof op !== "object") return null;
  if (op.summary && String(op.summary).trim()) return String(op.summary).trim();
  if (op.description && String(op.description).trim()) {
    const d = String(op.description).trim();
    const dot = d.indexOf(". ");
    const one = dot === -1 ? d : d.slice(0, dot + 1).trim();
    if (one) return one;
  }
  return humanizeOperationId(op.operationId);
}

function resolveHttpTitle(spec, apiPath, method) {
  const pathItem = spec.paths?.[apiPath];
  if (!pathItem) return null;
  const op = pathItem[method];
  return titleFromOperation(op);
}

function resolveWebhookTitle(spec, name) {
  const wh = spec.webhooks?.[name];
  if (!wh) return null;
  const op = wh.post ?? wh.get ?? wh.put;
  return titleFromOperation(op);
}

function expectedTitle(spec, ref) {
  if (!ref) return null;
  if (ref.kind === "webhook") return resolveWebhookTitle(spec, ref.name);
  return resolveHttpTitle(spec, ref.path, ref.method);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const sourceLocale = config.locale?.source || "en";
const targets = Array.isArray(config.locale?.targets) ? config.locale.targets : [];

const excludedSourceDirs = new Set([
  sourceLocale,
  ...targets,
  ".git",
  ".github",
  "node_modules",
  "scripts",
  "snippets",
  "lingo",
  "styles",
  ".cursor",
]);

const sourceFiles = walkRootMdx(ROOT, { excludeDirs: excludedSourceDirs }).filter((f) => {
  const raw = fs.readFileSync(f, "utf8");
  const sp = splitFrontmatter(raw);
  if (!sp) return false;
  return parseOpenapiRef(sp.fmRaw) !== null;
});

let errors = 0;
let updated = 0;
let checkedOk = 0;

for (const abs of sourceFiles) {
  const raw = fs.readFileSync(abs, "utf8");
  const sp = splitFrontmatter(raw);
  if (!sp) continue;
  const ref = parseOpenapiRef(sp.fmRaw);
  const source = ref.normalizedSource ?? inferSourceFromPath(abs);
  if (!source) {
    console.error(`Cannot infer OpenAPI source for ${path.relative(ROOT, abs)}`);
    errors++;
    continue;
  }
  let spec;
  try {
    spec = await loadSpec(source);
  } catch (err) {
    console.error(`OpenAPI load error for ${path.relative(ROOT, abs)}: ${err.message}`);
    errors++;
    continue;
  }
  const want = expectedTitle(spec, ref);
  if (!want) {
    console.error(
      `No summary (or fallback) in ${source} for ${path.relative(ROOT, abs)} (${JSON.stringify(ref)})`
    );
    errors++;
    continue;
  }
  const cur = getFmValue(sp.fmRaw, "title");
  if (cur === want) {
    checkedOk++;
    continue;
  }
  if (checkOnly) {
    console.error(
      `Title out of sync: ${path.relative(ROOT, abs)}\n  have: ${JSON.stringify(cur)}\n  want: ${JSON.stringify(want)}`
    );
    errors++;
    continue;
  }
  const newFm = setOrInsertTitle(sp.fmRaw, want);
  const out = `---\n${newFm}\n---\n${sp.body}`;
  fs.writeFileSync(abs, out, "utf8");
  updated++;
}

/** Bootstrap target locale `title` when missing (keeps non-empty titles intact). */
if (!checkOnly && targets.length > 0) {
  for (const target of targets) {
    const tDir = path.join(ROOT, target);
    if (!fs.existsSync(tDir)) continue;
    for (const abs of sourceFiles) {
      const rel = path.relative(ROOT, abs);
      const dst = path.join(tDir, rel);
      if (!fs.existsSync(dst)) continue;
      const srcRaw = fs.readFileSync(abs, "utf8");
      const dstRaw = fs.readFileSync(dst, "utf8");
      const srcSp = splitFrontmatter(srcRaw);
      const dstSp = splitFrontmatter(dstRaw);
      if (!srcSp || !dstSp) continue;
      const srcTitle = getFmValue(srcSp.fmRaw, "title");
      if (!srcTitle?.trim()) continue;
      const dstTitle = getFmValue(dstSp.fmRaw, "title");
      if (dstTitle?.trim()) continue;
      const newFm = setOrInsertTitle(dstSp.fmRaw, srcTitle.trim());
      const out = `---\n${newFm}\n---\n${dstSp.body}`;
      fs.writeFileSync(dst, out, "utf8");
      updated++;
    }
  }
}

if (checkOnly) {
  if (errors) {
    console.error(`sync-openapi-titles: ${errors} file(s) need title sync.`);
    process.exit(1);
  }
  console.log(`sync-openapi-titles: ${checkedOk} file(s) already in sync.`);
} else {
  console.log(
    `sync-openapi-titles: updated ${updated} file(s); ${checkedOk} English file(s) already matched spec.`
  );
  if (errors) process.exit(1);
}
