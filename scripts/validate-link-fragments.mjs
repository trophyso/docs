#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDED_TOP_DIRS = new Set([
  ".git",
  ".github",
  ".cursor",
  "node_modules",
  "scripts",
  "styles",
  "lingo",
]);

function walkMdx(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, entry.name);
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (cur === root && EXCLUDED_TOP_DIRS.has(entry.name)) continue;
        stack.push(abs);
      } else if (entry.isFile() && rel.endsWith(".mdx")) {
        out.push(abs);
      }
    }
  }
  return out.sort();
}

const files = walkMdx(ROOT);
let errors = 0;

for (const abs of files) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const content = fs.readFileSync(abs, "utf8");

  if (/#parameter-[a-z0-9-]+/i.test(content)) {
    console.error(
      `Disallowed OpenAPI parameter hash link in ${rel}. Use endpoint link + inline parameter name instead of #parameter-*.`
    );
    errors += 1;
  }

  if (/#aggregation-period\b/.test(content) && !/<Accordion[^>\n]*\bid=["']aggregation-period["']/.test(content)) {
    console.error(
      `Missing explicit Accordion id=\"aggregation-period\" in ${rel} for #aggregation-period anchor usage.`
    );
    errors += 1;
  }
}

if (errors > 0) {
  console.error(`validate-link-fragments: ${errors} issue(s) found.`);
  process.exit(1);
}

console.log("validate-link-fragments: passed.");
