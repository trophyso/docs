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
        "x-api-key": "${env:LINGODOTDEV_API_KEY}"
      }
    }
  }
}
```

3. Ensure the API key is available to the Cursor app process as an environment variable:
   - `LINGODOTDEV_API_KEY`
4. Restart Cursor fully after updating `mcp.json` or environment variables.
5. Verify by asking Cursor chat to list engines from the Lingo MCP server.

Notes:
- This repo ignores `.env` via `.cursorignore`, so Cursor agents should not read API keys from project files.
- If Cursor was launched before env vars were set, restart Cursor from a shell where env vars are already exported.

#### Localization files

- `lingo/glossary.csv`: Terms that must stay fixed or use specific translations.
- `lingo/brand-voice.md`: Single brand voice used for all locales.
- `scripts/translate-docs-json.mjs`: Translates language-specific `docs.json` navigation labels directly in the source-of-truth `docs.json`.
- `scripts/validate-glossary-csv.mjs`: Validates glossary schema and duplicate canonical keys.

#### Apply in Lingo.dev engine

1. Configure `LINGO_ENGINE_ID` as an environment variable/secret.
   - Local: `export LINGO_ENGINE_ID=eng_...`
   - CI: set repository secret `LINGO_ENGINE_ID`
   - `i18n.json` uses `"engineId": "${LINGO_ENGINE_ID}"` and workflows/scripts inject the real value at runtime.
2. In the Lingo.dev engine:
   - import/create glossary entries from `lingo/glossary.csv`
   - sync wildcard brand voice from `lingo/brand-voice.md` via Cursor chat + Lingo MCP (on demand)
3. Run:
   - `npx lingo.dev@latest run` to generate/update translations
   - `node scripts/translate-docs-json.mjs --target es` to translate language-specific labels in `docs.json`
   - `npm run lingo:validate-glossary` to validate glossary rows before MCP sync
   - `npx lingo.dev@latest run --frozen` to enforce no pending translation deltas

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
   - Copy the structure from `en` (tabs/groups/pages) and prefix pages with `<locale>/...`.
   - Add language-specific `anchors` and `navbar` fields in that locale block.
2. Add the locale to `i18n.json`:
   - In `locale.targets`, append the locale code (for example `fr` or `de`).
3. Create the language content directory:
   - Mirror the `en/` structure under `<locale>/` with the same filenames.
   - Example: `en/platform/overview.mdx` -> `fr/platform/overview.mdx`.
4. Configure Lingo.dev engine controls for the new locale:
   - Add/update brand voice for that locale.
   - Add locale-specific glossary entries if needed.
5. Generate translations:
   - One locale: `node scripts/generate-translations.mjs --target <locale>`
   - Multiple locales: `node scripts/generate-translations.mjs --target es,fr,de`
   - All configured targets: `node scripts/generate-translations.mjs`
6. Validate before merge:
   - `npm run translate:validate`
   - `npx mint@latest validate`
   - `npx mint@latest broken-links --check-anchors --check-snippets`

Notes:
- The workflow `.github/workflows/translate-on-main.yml` automatically reads locales from `i18n.json` `locale.targets`.
- Keep `en` as source/default and preserve identical file paths across locales.
