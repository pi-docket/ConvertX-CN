# Reserved REST adapter

This directory intentionally registers no routes yet.

The future `/api/v1` adapter will authenticate API keys into an `Actor`, validate
OpenAPI request schemas, and call services from `src/application/`. It must not
duplicate converter metadata, ownership rules, upload limits or job transitions.

The legacy unmounted `src/pages/rasApi.tsx` experiment was removed so it cannot be
mistaken for a public or reusable contract.

See `docs/application-architecture.md`.
