#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const targetIdx = args.indexOf("--target");
const target = targetIdx >= 0 ? args[targetIdx + 1] : null;
if (!target) {
  console.error("Missing --target <locale> for docs.json translation.");
  process.exit(1);
}

const engineId = process.env.LINGO_ENGINE_ID;
if (!engineId) {
  console.error("Missing LINGO_ENGINE_ID. Set it before running.");
  process.exit(1);
}

const docsPath = "docs.json";
const i18nPath = "i18n.json";
const i18nBackup = "i18n.json.docsjson.bak";
const tmpDir = path.join(".tmp", "docs-json-i18n");

const docs = JSON.parse(fs.readFileSync(docsPath, "utf8"));
const enLang = docs.navigation?.languages?.find((l) => l.language === "en");
const targetLang = docs.navigation?.languages?.find((l) => l.language === target);

if (!enLang || !targetLang) {
  console.error(`Could not find both en and ${target} language entries in docs.json`);
  process.exit(1);
}

const enPayload = {
  anchors: (enLang.anchors || []).map((a) => a.anchor),
  navbar: {
    dashboard: enLang.navbar?.links?.[0]?.label || "Dashboard",
    cta: enLang.navbar?.primary?.label || "Start for free"
  }
};

const targetPayload = {
  anchors: (targetLang.anchors || []).map((a) => a.anchor),
  navbar: {
    dashboard: targetLang.navbar?.links?.[0]?.label || enPayload.navbar.dashboard,
    cta: targetLang.navbar?.primary?.label || enPayload.navbar.cta
  }
};

fs.mkdirSync(tmpDir, { recursive: true });
const enPayloadPath = path.join(tmpDir, "en.json");
const targetPayloadPath = path.join(tmpDir, `${target}.json`);
fs.writeFileSync(enPayloadPath, JSON.stringify(enPayload, null, 2) + "\n");
fs.writeFileSync(targetPayloadPath, JSON.stringify(targetPayload, null, 2) + "\n");

const originalI18n = fs.readFileSync(i18nPath, "utf8");
const cfg = JSON.parse(originalI18n);
cfg.locale.targets = [target];
cfg.engineId = engineId;
cfg.buckets = {
  json: {
    include: [path.join(tmpDir, "[locale].json").replace(/\\/g, "/")]
  }
};

fs.writeFileSync(i18nBackup, originalI18n);
fs.writeFileSync(i18nPath, JSON.stringify(cfg, null, 2) + "\n");

try {
  execSync(`npx lingo.dev@latest run --target-locale ${target}`, { stdio: "inherit" });

  const translated = JSON.parse(fs.readFileSync(targetPayloadPath, "utf8"));
  const fallbackAnchors = targetLang.anchors || enLang.anchors || [];
  targetLang.anchors = fallbackAnchors.map((a, idx) => ({
    anchor: translated.anchors?.[idx] || a.anchor,
    href: a.href,
    icon: a.icon
  }));

  targetLang.navbar = {
    links: [
      {
        label: translated.navbar?.dashboard || targetLang.navbar?.links?.[0]?.label || enPayload.navbar.dashboard,
        href: "https://app.trophy.so"
      }
    ],
    primary: {
      type: "button",
      label: translated.navbar?.cta || targetLang.navbar?.primary?.label || enPayload.navbar.cta,
      href: "https://app.trophy.so/sign-up?utm_source=docs&utm_medium=navbar-links"
    }
  };

  fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2) + "\n");
  console.log(`Updated docs.json localized navigation for ${target}.`);
} finally {
  if (fs.existsSync(i18nBackup)) {
    fs.copyFileSync(i18nBackup, i18nPath);
    fs.unlinkSync(i18nBackup);
  }
  fs.rmSync(path.join(".tmp"), { recursive: true, force: true });
}
