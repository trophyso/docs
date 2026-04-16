# Trophy Documentation

Our documentation is built on top of [Mintlify](https://mintlify.com). We welcome contributions for fixing small issues such as typos and for adding new or updating existing content that you think would help others.

### Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mintlify) to preview the documentation changes locally. To install, use the following command:

```
npm i -g mintlify
```

Run the following command at the root of your documentation (where docs.json is):

```
npm run dev
```

### Structure

Our docs are written in [MDX](https://mdxjs.com/), which if you haven't used it before is a bit if markdown and React had a baby.

See the [full guide](https://mintlify.com/docs/content/components) from Mintlify on writing MDX and the components that are available for how best to contribute.

### Localization (Lingo.dev)

This repository uses Lingo.dev for static-content localization of docs pages and language-specific navigation labels in `docs.json`.

#### Install Lingo MCP in Cursor

1. Open your Cursor MCP config file:
   - `~/.cursor/mcp.json`
2. Add a Lingo MCP server entry:

```json
{
  "mcpServers": {
    "lingo": {
      "url": "https://mcp.lingo.dev/account",
      "headers": {
        "x-api-key": "${env:LINGO_API_KEY}"
      }
    }
  }
}
```

3. Ensure the API key is available to the Cursor app process as an environment variable:
   - `LINGO_API_KEY`
4. Restart Cursor fully after updating `mcp.json` or environment variables.
5. Verify by asking Cursor chat to list engines from the Lingo MCP server.

Notes:
- This repo ignores `.env` via `.cursorignore`, so Cursor agents should not read API keys from project files.
- If Cursor was launched before env vars were set, restart Cursor from a shell where env vars are already exported.

#### Localization files

- `lingo/glossary.csv`: Terms that must stay fixed or use specific translations.
- `lingo/brand-voice.md`: Single brand voice used for all locales.
- `scripts/translate-docs-json.mjs`: Translates language-specific `docs.json` navigation labels directly in the source-of-truth `docs.json`. Prefer `npm run translate:docs-json -- --target <locale>`.
- `scripts/localize-internal-links.mjs`: Rewrites internal absolute **navigation** links in each locale’s MDX for whatever locale is being processed (`--target`, `--all`, or default targets): bare paths get that locale’s prefix (e.g. `/platform/points` → `/es/platform/points` when processing `es/`), and any path already prefixed with **another** locale from `i18n.json` (`en`, `es`, future `fr`, etc.) is re-prefixed to the active locale (so `/en/...` or stale `/es/...` on a `fr/` page become `/fr/...`). Longer codes are matched first (e.g. `en-US` before `en`). It does **not** change relative image or video `src` paths or MDX `import` paths (those are normalized by `scripts/localize-mdx-paths.mjs` after translation: components, `snippets/`, and repo-root `assets/`). Prefer `npm run translate:localize-links --` with `--target`, `--all`, or `--all --check`.
- `scripts/localize-mdx-paths.mjs`: Rewrites MDX paths for locale docs: (1) `.../<locale>/components/...jsx` for the active locale, (2) `import ... ".../snippets/..."` depth to repo-root `snippets/`, and (3) JSX `src=".../assets/..."` depth to repo-root `assets/` (Lingo copies English relative paths). Use `--target`, `--all`, or default targets; `translate:generate` and translate-on-main run it after Lingo.
- **Shared MDX snippets (`snippets/*.mdx`)**: Reusable MDX blocks stay in repo-root `snippets/` (not per-locale). Import them with relative paths from each page (for example `../../snippets/foo.mdx` from `locale/<section>/<page>.mdx`, or more `../` segments for deeper pages). They are excluded from Lingo buckets in `i18n.json` so they stay English and identical everywhere.
- **Localized React components (`components/*.jsx` for default language, `<locale>/components/*.jsx` for targets)**: UI components that can contain locale text are stored per locale (for example `components/rate-limit-badge.jsx`, `es/components/rate-limit-badge.jsx`) and manually maintained per locale (not translated by PIT/CI automation).
- **Media paths**: Default-language pages live at repo root paths like `<section>/<page>.mdx` and target locales live under `<locale>/<section>/<page>.mdx`; shared files sit in repo-root `assets/`. Prefer relative `src="../assets/..."` (or more `../`) from English source; `scripts/localize-mdx-paths.mjs` rewrites `assets/` `src` depth for each target locale file.
- **`openapi.yml`**: One OpenAPI 3.1 spec at the **repository root** (alongside `docs.json`). API and webhook pages reference it explicitly in frontmatter, for example `openapi: openapi.yml get /users/{id}` or `openapi: openapi.yml webhook points.changed`. Do not duplicate the YAML under locale folders; Lingo must not alter `openapi:` lines.
- **`scripts/sync-openapi-titles.mjs`**: Copies each operation/webhook **`summary`** from `openapi.yml` into the English page’s **`title:`** frontmatter (Mintlify’s default when `title` is omitted). Target locales get an English `title` only if missing (bootstrap); run **`npm run translate:generate`** so Lingo translates those titles. Runs automatically at the start of `translate:generate` and in translate-on-main before Lingo.
- `scripts/sync-heading-anchors.mjs`: Writes Mintlify [custom heading IDs](https://www.mintlify.com/docs/create/text#custom-heading-ids) as **`## Title {#slug}`** markdown. Slugs match Mintlify’s auto rules from the **English** title so hashes like `#pro-plan` stay stable across locales. Run `npm run translate:sync-anchors` after bulk heading edits; translation pipelines run it automatically (see **Heading anchors and Lingo** below). The script can also migrate one-line **`<h2 id="slug">…</h2>`** left from older tooling back to `{#slug}` syntax.
- `scripts/validate-glossary-csv.mjs`: Validates glossary schema and duplicate canonical keys. Prefer `npm run lingo:validate-glossary`.

#### Heading anchors and Lingo

- **Canonical behavior** is enforced by **`scripts/sync-heading-anchors.mjs`** (runs at the end of `translate:generate` and on the translate-on-main workflow). It rewrites default-language root files from current English titles and reapplies the **same** `{#slug}` suffixes to translated headings in document order. Hash links stay aligned even if Lingo alters titles or fragments.
- **Lingo:** Keep **`lingo/brand-voice.md`** to tone and style only. For structural rules (for example Mintlify `{#slug}` on headings), optionally add a separate line in your Lingo engine **Instructions** field (not brand voice), such as: “Preserve `{#…}` heading fragments exactly—do not translate or alter the slug.” That only reduces churn; **the script + `translate:sync-anchors:check` are authoritative.**
- **Strict MDX parsers** (for example unconfigured `mdx-js`) can treat `{` as JSX and error on `{#slug}`; **Mintlify’s `mint dev` / deploy pipeline** is expected to handle this documented syntax. If you see Acorn errors locally, update the Mintlify CLI (`npm i -D mint@latest` or global `mintlify`) or check [Mintlify support](https://mintlify.com/docs); do not switch to raw HTML headings unless Mintlify asks you to.
- **Do not** fold this into `localize-internal-links.mjs`: that script only handles absolute path `href`s; heading anchors are a separate structural pass and must run **after** Lingo (and after link localization) so all three stay consistent.

#### npm scripts (localization and checks)

Use `npm run <script> -- <args>` when a script needs CLI flags (the `--` forwards arguments to the underlying command).

| Script | Purpose |
| --- | --- |
| `translate:generate` | Run Lingo for target locale(s), then `docs.json` labels, internal links, `translate:localize-mdx-paths`, and heading-anchor sync. Requires `.env` with `LINGO_*` vars. Optional: `--target <locale>` (comma-separated), `--paths <substring>` (comma-separated; matches English source MDX paths by substring), `--force` (with `--paths`, purge is file-scoped; without `--paths`, full locale—see step 5). |
| `translate:docs-json` | Translate `docs.json` nav for one `--target` locale. Requires `.env`. |
| `translate:localize-links` | Localize internal `href` paths; pass `--target`, `--all`, and/or `--check`. |
| `translate:localize-links:all` | Same as `translate:localize-links -- --all`. |
| `translate:localize-links:check` | CI-style check: all locales, no writes (`--all --check`). |
| `translate:localize-mdx-paths` | Fix localized MDX paths: locale `components/` imports, `snippets/` import depth, relative `assets/` `src` depth. |
| `translate:localize-mdx-paths:check` | CI-style check: fail if any of the above is wrong for its locale/path. |
| `translate:sync-anchors` | Apply English-derived `{#slug}` on default-language root MDX and target locales (see `i18n.json` `locale.targets`). |
| `translate:sync-anchors:check` | Fail if any MDX needs re-sync (CI). |
| `translate:sync-openapi-titles` | Set default-language API & webhook `title:` from `openapi.yml` summaries; bootstrap missing target `title` from English. |
| `translate:sync-openapi-titles:check` | CI: fail if any OpenAPI-backed page title differs from the spec. |
| `lingo:validate-glossary` | Validate `lingo/glossary.csv`. |
| `translate:validate` | MDX parity and frontmatter checks (source root -> target locales, e.g. `es`). No `.env` required. |
| `translate:verify` | `lingo.dev run --frozen` (freshness gate). |
| `mint:validate` | Mintlify `validate`. |
| `mint:broken-links` | Mintlify `broken-links` with anchor and snippet checks. |

#### Apply in Lingo.dev engine

1. Configure `LINGO_ENGINE_ID` as an environment variable/secret.
   - Local: `export LINGO_ENGINE_ID=eng_...`
   - CI: set repository secret `LINGO_ENGINE_ID`
   - `i18n.json` intentionally omits `engineId`; workflows/scripts inject `engineId` from `LINGO_ENGINE_ID` at runtime.
2. In the Lingo.dev engine:
   - import/create glossary entries from `lingo/glossary.csv`
   - sync wildcard brand voice from `lingo/brand-voice.md` via Cursor chat + Lingo MCP (on demand)
3. Run:
   - `npx lingo.dev@latest run` to generate/update translations
   - `npm run translate:docs-json -- --target es` to translate language-specific labels in `docs.json`
   - `npm run translate:localize-links -- --target es` to localize on-page internal links for that locale
   - `npm run lingo:validate-glossary` to validate glossary rows before MCP sync
   - `npx lingo.dev@latest run --frozen` or `npm run translate:verify` to enforce no pending translation deltas

Brand voice sync workflow (manual via Cursor + MCP):
- Update `lingo/brand-voice.md`.
- In Cursor chat ask: "Sync `lingo/brand-voice.md` to Lingo brand voice for engine `<engine_id>`."
- The agent will use MCP tools to find the engine brand voice id and update it.

Glossary sync workflow (manual via Cursor + MCP):
- Validate first: `npm run lingo:validate-glossary`
- Always run dry-run first, then apply
- Canonical key used for reconciliation: `sourceLocale|targetLocale|type|sourceText`
- Dry run prompt:
  - `Dry-run glossary sync for engine <ENGINE_ID> using lingo/glossary.csv via Lingo MCP. Use canonical key sourceLocale|targetLocale|type|sourceText. Show counts and exact create/update/delete operations. Do not apply changes yet.`
- Apply prompt:
  - `Apply glossary sync for engine <ENGINE_ID> using lingo/glossary.csv via Lingo MCP. Use canonical key sourceLocale|targetLocale|type|sourceText. Perform create/update and prune missing entries (delete remote items not in CSV).`
- Use prune only when you want remote glossary to match CSV exactly.

#### Add a new language

1. Add the locale to `docs.json`:
   - In `navigation.languages`, add a new object with `language: "<locale>"`.
   - Copy the default-language structure (tabs/groups/pages) and prefix pages with `<locale>/...`.
   - Add language-specific `anchors` and `navbar` fields in that locale block.
2. Add the locale to `i18n.json`:
   - In `locale.targets`, append the locale code (for example `fr` or `de`).
3. Create the language content directory:
   - Mirror the root default-language structure under `<locale>/` with the same filenames.
   - Example: `platform/overview.mdx` -> `fr/platform/overview.mdx`.
   - Keep MDX snippets shared in repo-root `snippets/` (no per-locale snippet trees).
   - Keep React components locale-local under `<locale>/components/*.jsx` and mirror updates manually across locales (not via Lingo automation).
4. Configure Lingo.dev engine controls for the new locale:
   - Add/update brand voice for that locale.
   - Add locale-specific glossary entries if needed.
5. Generate translations (requires `.env` with `LINGO_API_KEY` and `LINGO_ENGINE_ID`):
   - One locale: `npm run translate:generate -- --target <locale>`
   - Multiple locales: `npm run translate:generate -- --target es,fr,de`
   - All configured targets: `npm run translate:generate`
   - **Single-page (or subset) regeneration:** pass `--paths` with a substring of each English source path (repo root, no `en/` prefix). Example for Spanish points page only:
     - Delta run (no purge): `npm run translate:generate -- --target es --paths platform/points.mdx`
     - Full re-run for those files only: `npm run translate:generate -- --target es --paths platform/points.mdx --force`
     - Multiple paths: `npm run translate:generate -- --target es --paths platform/points.mdx,platform/achievements.mdx`
   - **Full-locale force** (no `--paths`): `npm run translate:generate -- --target <locale> --force`. This deletes local `i18n.cache` if present, runs `lingo.dev purge --locale <target> --yes-really` for **all** managed keys for that locale, then `lingo.dev run --target-locale <target> --force`. Use for recovery or when you need every file reprocessed.
   - **File-scoped `--force`:** when `--paths` is set, purge is limited to the MDX bucket and only paths that matched `--paths` (`lingo.dev purge --locale <target> --bucket mdx --file <path> … --yes-really`), then `lingo.dev run --target-locale <target> --force` for the same staged set. Both purge and `run --force` matter when the lock/cache would otherwise skip work (“from cache”). For ad-hoc narrower purges outside this script, see [`lingo.dev purge`](https://lingo.dev/en/docs/cli/remove-translations).
6. Validate before merge:
   - `npm run translate:validate`
   - `npm run translate:localize-links:check`
   - `npm run translate:sync-anchors:check`
   - `npm run mint:validate`
   - `npm run mint:broken-links`

Notes:
- The workflow `.github/workflows/translate-on-main.yml` automatically reads locales from `i18n.json` `locale.targets`.
- Keep English as source/default and preserve identical relative file paths across locales.
- `--force` without `--paths` purges **all** Lingo-managed content for that target locale—use only for recovery/backfill (for example, cache stuck after bootstrap). With `--paths`, purge is scoped to the matched source files only. Do not use `--force` in CI; CI should run delta translation based on `i18n.lock`.
- Shared `snippets/*.mdx` are not in the MDX translation bucket; changing a snippet does not run Lingo on that path—update English pages that import it, or run a wider `--paths` / full generate as needed.
