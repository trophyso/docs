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

### Localization

English pages live at the repo root and Spanish pages mirror them under `es/` with the same paths. Translations are written by hand (or by an agent) in the same PR as the English change: if a PR adds, changes, moves or deletes an English page, it makes the matching change under `es/` and in the Spanish navigation in `docs.json`.

- `i18n/glossary.md`: voice and fixed translations for product terms. Follow it, and add any new term you settle on.
- Locales come from `docs.json` `navigation.languages`. The entry with `default: true` is the source.
- Shared MDX snippets in `snippets/` stay English and are imported by every locale.
- Components that contain text live in `components/*.jsx` (English) and `es/components/*.jsx` (Spanish). Update both by hand.
- OpenAPI-backed pages pin a repo-local spec in frontmatter (for example `openapi: "/openapi/application.json GET /users/{id}"`). Keep that line identical across locales. Refresh specs with `npm run openapi:pull`, then `npm run translate:sync-openapi-titles` to update English titles from the spec summaries (translate the Spanish titles by hand).
- Heading anchors use Mintlify's `## Title {#slug}` syntax. `npm run translate:sync-anchors` derives slugs from English headings (keeping explicit ones) and copies them to Spanish headings in order, so both locales need the same headings in the same order. Never translate a `{#slug}`.

#### Checks

Run `npm run check` before opening a PR. CI runs the same checks in `.github/workflows/validate-docs.yml`.

| Script | Purpose |
| --- | --- |
| `translate:validate` | Every English page has a Spanish page (and vice versa) with the same frontmatter keys and a translated title and description. |
| `translate:localize-links` | Rewrite absolute internal links in locale pages to the locale prefix (`/features/points` → `/es/features/points`). `:check` fails instead of writing. |
| `translate:localize-mdx-paths` | Fix relative `assets/` and `snippets/` depth and `es/components/` imports in locale pages. `:check` fails instead of writing. |
| `translate:validate-links` | Fail on fragile `#parameter-*` links. |
| `translate:sync-anchors` | Apply English-derived `{#slug}` anchors to English and Spanish headings. `:check` fails instead of writing. |
| `translate:sync-openapi-titles` | Set English API and webhook titles from OpenAPI summaries. `:check` fails instead of writing. |
| `openapi:pull` | Download live OpenAPI specs into `openapi/`. |
| `mint:validate` | Mintlify `validate`. |
| `mint:broken-links` | Mintlify `broken-links` with anchor and snippet checks. |

#### Adding a language

1. Add a block to `docs.json` `navigation.languages` with `language: "<locale>"`, mirroring the English tabs, groups and pages with a `<locale>/` prefix.
2. Mirror every English page under `<locale>/`, and copy `es/components/` to `<locale>/components/` and translate it.
3. Add a section for the locale to `i18n/glossary.md`.
4. Run `npm run translate:localize-links:all`, `npm run translate:localize-mdx-paths -- --all`, `npm run translate:sync-anchors`, then `npm run check`.
