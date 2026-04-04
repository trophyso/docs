#!/usr/bin/env node

/**
 * Set Mintlify MDX `title:` from root `openapi.yml` operation / webhook `summary`
 * (matches what Mintlify infers when title is omitted).
 *
 * - Source locale (repo root): always rewrite title to match the spec.
 * - Target locales: only add `title` when missing or blank (keeps Lingo translations).
 *
 * Expects frontmatter: `openapi: openapi.yml <method> <path>` or
 * `openapi: openapi.yml webhook <eventKey>`.
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
const SPEC_PATH = path.join(ROOT, "openapi.yml");
const CONFIG_PATH = path.join(ROOT, "i18n.json");

const OPENAPI_FM_RE =
  /^openapi:\s+(\S+)\s+(?:webhook\s+(\S+)|(get|post|put|patch|delete)\s+(\S.*))$/m;

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
  const m = fmRaw.match(OPENAPI_FM_RE);
  if (!m) return null;
  const specFile = m[1];
  if (specFile !== "openapi.yml") return null;
  if (m[2]) return { kind: "webhook", name: m[2] };
  return { kind: "http", method: m[3].toLowerCase(), path: m[4].trim() };
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

if (!fs.existsSync(SPEC_PATH)) {
  console.error("Missing openapi.yml at repository root.");
  process.exit(1);
}

const spec = parseYaml(fs.readFileSync(SPEC_PATH, "utf8"));
if (!spec || typeof spec !== "object") {
  console.error("Could not parse openapi.yml");
  process.exit(1);
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
  const want = expectedTitle(spec, ref);
  if (!want) {
    console.error(
      `No summary (or fallback) in openapi.yml for ${path.relative(ROOT, abs)} (${JSON.stringify(ref)})`
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
