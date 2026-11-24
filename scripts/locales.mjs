/**
 * Locales come from `docs.json` `navigation.languages`: the entry marked `default: true`
 * is the source locale (repo-root pages), and every other entry is a target locale
 * with its pages under `<locale>/`.
 */

import fs from "node:fs";
import path from "node:path";

const docs = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs.json"), "utf8"));
const languages = (docs.navigation?.languages ?? []).map((l) => l.language).filter(Boolean);
const defaultLanguage = docs.navigation?.languages?.find((l) => l.default)?.language;

export const sourceLocale = defaultLanguage || "en";
export const targetLocales = languages.filter((l) => l !== sourceLocale);
