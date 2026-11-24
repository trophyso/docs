# Translation glossary

How to translate Trophy docs consistently. English at the repo root is the source; each target locale lives under `<locale>/` (today only `es/`). Every PR that changes an English page updates the matching locale pages in the same PR.

## Voice

- Write for developers: clear, concise and practical.
- Prefer technical precision, active voice and plain wording.
- Match the English page's structure and intent, but don't translate so literally that it reads awkwardly.
- Keep terminology consistent across pages (use the tables below). No slang; stay professional, helpful and confident.

## Never translate

- Code blocks, inline code, URLs, route slugs, API and SDK identifiers (for example `achievement`, `tenantId`, `read_tenants`).
- `{#…}` heading anchors, Accordion `id`s and `openapi:` frontmatter lines.
- Dashboard UI labels when quoting the UI (for example **Settings**, **Channels**, **Brand kit**).
- Brand, product and service names: Trophy, Duolingo, Expo Push Service, Slack, Firebase, Resend.
- Languages and runtimes: JavaScript, TypeScript, Node.js, Python, Ruby, Go, Swift, React, PHP, Java, C#.
- Acronyms: API, SDK, CLI, MCP, OAuth, JWT, JSON, MDX, HTTP, URL, UTC, DNS, DKIM, CNAME, FCM, MAU, XP, SSO, MFA, RBAC.

## Spanish (`es`)

Use informal **tú** throughout.

### Product areas

| English | Spanish | Notes |
| --- | --- | --- |
| Agentic messaging | Mensajería agéntica | |
| AI lifecycle marketing agents | Agentes de marketing de ciclo de vida con IA | Short form: agentes de ciclo de vida |
| In-app features | Funciones dentro de la app | |
| Data sources | Fuentes de datos | |
| Customer engagement | Customer engagement | Kept in English; "engagement" alone is also fine |
| Legacy (emails, push) | Heredado / heredados / heredadas | For example "Emails (heredados)" |

### Features and data

| English | Spanish | Notes |
| --- | --- | --- |
| Milestone(s) | Hito(s) | The product feature |
| Achievement(s) | Logro(s) | Only where English still says "achievement" (API objects, webhook titles, data-sync tables) |
| Streak(s) | Racha(s) | |
| Streak freeze(s) | Congelación / congelaciones de racha | |
| Streak pause(s) | Pausa(s) de racha | |
| Points | Puntos | |
| Points system | Sistema de puntos | |
| Points level | Nivel de puntos | |
| Points boost | Impulso de puntos | |
| Trigger | Activador | Not "disparador" |
| Leaderboard(s) | Clasificación / clasificaciones | Never shorten to "board" in English either |
| Reward(s) | Recompensa(s) | |
| Goal(s) | Meta(s) | |
| Objective(s) | Objetivo(s) | Agentic messaging objectives |
| Guardrails | Salvaguardas | |
| Rollout | Despliegue | |
| User preferences | Preferencias de usuario | |
| Metric(s) | Métrica(s) | |
| Event(s) | Evento(s) | |
| User attributes | Atributos de usuario | |
| Brand kit | Kit de marca | In prose; quote the UI label in English |
| Push notifications | Notificaciones push | |
| Template(s) | Plantilla(s) | |
| Tenant(s) | Cliente(s) | Multi-tenancy: multitenencia |
| Environment(s) | Entorno(s) | |
| Experimentation | Experimentación | |
| Monthly active users | Usuarios activos mensuales | |
| Sender verification | Verificación del remitente | |
| Reactivation | Reactivación | |
| Wrapped | Resumen anual | |

### Docs and API terms

| English | Spanish | Notes |
| --- | --- | --- |
| Overview | Descripción general | |
| Quickstart | Inicio rápido | |
| Rate limits | Límites de velocidad | The badge heading on endpoint pages is **Límites de Velocidad** |
| Idempotency | Idempotencia | |
| Client libraries | Bibliotecas cliente | |
| Dashboard | Panel | "panel de Trophy" |
| Get support | Obtener soporte | Closing section: "¿Quieres ponerte en contacto con el equipo de Trophy? Escríbenos por [correo electrónico](mailto:support@trophy.so). ¡Estamos aquí para ayudarte!" |
