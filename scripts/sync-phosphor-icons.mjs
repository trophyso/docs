#!/usr/bin/env node
/**
 * Trophy Daylight draws icons from Phosphor (regular weight), but Mintlify's
 * icon libraries are only Font Awesome, Lucide and Tabler. Pages keep using
 * Lucide names (`icon="flame"`), and this script:
 *
 *   1. downloads the Phosphor SVG for each Lucide name in ICONS into
 *      icons/phosphor/, straight from Phosphor's release on GitHub, and
 *   2. writes phosphor-icons.css, which swaps the mask image Mintlify paints
 *      each Lucide icon with for the local Phosphor file.
 *
 * Mintlify paints Lucide icons as a mask filled with the text colour, so the
 * swap keeps light/dark colours working, and every locale gets the same icons
 * with no content changes.
 *
 * To add an icon: add `lucideName: 'phosphor-name'` to ICONS and run
 *   node scripts/sync-phosphor-icons.mjs
 * A Lucide name without an entry still renders, but as the Lucide icon.
 *
 * Feature icons follow the website (web repo, components/icons/feature-icons.ts);
 * the rest follow the Daylight icon glossary and the dashboard's mapping.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Phosphor's core repo at a pinned commit of main (the v2.0.8 tag predates
// icons such as ranking, which the website and dashboard use).
const PHOSPHOR_VERSION = '2b75f3ad12b420c9504ef05df8d2564a28f8500e';
const WEIGHT = 'regular';
const SOURCE = `https://raw.githubusercontent.com/phosphor-icons/core/${PHOSPHOR_VERSION}/assets/${WEIGHT}`;

/** Lucide name used in docs.json and MDX → Phosphor icon name. */
const ICONS = {
  // Features (as the website's Product menu)
  flame: 'fire', // streaks
  trophy: 'seal-check', // achievements
  sparkle: 'sparkle', // points
  star: 'sparkle', // XP points
  'chart-bar': 'ranking', // leaderboards
  gift: 'gift', // rewards
  mail: 'envelope-simple', // emails
  bell: 'bell-simple', // push
  building: 'buildings', // multi-tenancy
  box: 'cube', // metrics
  'radio-tower': 'broadcast', // events, status
  radio: 'broadcast', // events
  users: 'users',
  user: 'user',
  'user-plus': 'user-plus',

  // Navigation
  house: 'house',
  rocket: 'compass', // guides
  globe: 'globe-hemisphere-west', // Application API
  'globe-lock': 'lock-key', // Admin API
  webhook: 'webhooks-logo',
  shapes: 'squares-four', // UI Kit
  'shield-check': 'shield-check',
  bot: 'robot', // llms.txt, AI
  'life-buoy': 'lifebuoy',

  // Platform, account and API
  layers: 'stack', // environments
  'flask-conical': 'flask', // experimentation
  database: 'database',
  palette: 'palette',
  gauge: 'credit-card', // billing
  'circle-gauge': 'gauge', // rate limiting
  key: 'key',
  repeat: 'repeat', // idempotency
  'circle-x': 'x-circle',
  'circle-exclamation': 'warning-circle',
  'code-xml': 'code',
  code: 'code',
  braces: 'brackets-curly',
  activity: 'pulse',
  'rotate-ccw': 'arrow-counter-clockwise',
  'refresh-ccw': 'arrows-counter-clockwise',
  'circle-play': 'play-circle',
  download: 'download-simple',
  wrench: 'wrench',
  cog: 'gear',
  'book-open': 'book-open',
  'circle-check': 'check-circle',
  check: 'check',
  'list-check': 'list-checks',
  shield: 'shield',
  lock: 'lock-simple',
  calculator: 'calculator',
  github: 'github-logo',
  paperclip: 'paperclip',
  split: 'arrows-split',
  tag: 'tag',
  zap: 'lightning', // smart blocks, as in the dashboard
  'square-slash': 'keyboard', // the "/" key
};

/** Custom SVG icons rendered as <img>: path → Phosphor icon name. */
const IMG_ICONS = {
  '/icons/leaderboard.svg': 'ranking',
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons', 'phosphor');
const cssPath = path.join(root, 'phosphor-icons.css');

async function download(name) {
  const file = path.join(outDir, `${name}.svg`);
  if (existsSync(file)) return;
  const res = await fetch(`${SOURCE}/${name}.svg`);
  if (!res.ok) throw new Error(`Phosphor icon "${name}" not found (${res.status})`);
  const svg = await res.text();
  if (!svg.startsWith('<svg')) throw new Error(`Unexpected content for "${name}"`);
  await writeFile(file, svg.trim() + '\n');
  console.log(`downloaded ${name}.svg`);
}

function maskRule(selector, name) {
  const url = `url("/icons/phosphor/${name}.svg")`;
  return `${selector} {\n  -webkit-mask-image: ${url} !important;\n  mask-image: ${url} !important;\n}`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const names = [...new Set([...Object.values(ICONS), ...Object.values(IMG_ICONS)])].sort();
  for (const name of names) await download(name);

  const rules = Object.entries(ICONS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lucide, name]) =>
      maskRule(`html [style*="/lucide/"][style*="/${lucide}.svg"]`, name),
    );

  // <img> icons can't take the text colour, so hide the image's own pixels
  // and paint the element in currentColor through a mask of the icon.
  const imgSelectors = Object.keys(IMG_ICONS).map((src) => `html img[src$="${src}"]`);
  const imgRules = Object.entries(IMG_ICONS).map(([src, name]) => {
    const url = `url("/icons/phosphor/${name}.svg")`;
    return `html img[src$="${src}"] {\n  -webkit-mask: ${url} center / contain no-repeat;\n  mask: ${url} center / contain no-repeat;\n}`;
  });

  const css = `/*
 * GENERATED by scripts/sync-phosphor-icons.mjs. Do not edit by hand.
 * Phosphor ${PHOSPHOR_VERSION} (${WEIGHT}) icons in place of Lucide; see the script.
 */

${rules.join('\n\n')}

${imgSelectors.join(',\n')} {
  object-position: -9999px 0;
  background-color: currentColor !important;
}

${imgRules.join('\n\n')}
`;

  const previous = existsSync(cssPath) ? await readFile(cssPath, 'utf8') : '';
  if (previous !== css) {
    await writeFile(cssPath, css);
    console.log(`wrote ${path.relative(root, cssPath)}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
