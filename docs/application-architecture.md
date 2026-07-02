# Application core and future REST adapter

The Web UI is now an adapter over a small shared application core:

```text
Web UI / session auth ----\
                           -> Actor -> application services -> executor / DB / filesystem
Future REST / API key ----/
```

The shared boundary lives in `src/application/`:

- `Actor` carries `userId` and scopes. Session authentication and future API-key
  authentication must both produce an Actor.
- `UploadService` owns upload sessions, limits, path containment, chunk validation,
  merge and cleanup.
- `JobService` owns ownership checks and the job/file state machines.
- `ConversionOrchestrator` owns asynchronous submission, batching, result
  aggregation and the replaceable `ConversionExecutor` port.
- `ArtifactService` owns artifact validation and contained deletion.

HTTP adapters may parse cookies, headers, form/JSON schemas and choose an HTTP
response. They must not implement ownership, filesystem paths or state transitions.

## Reserved REST adapter

No `/api/v1` route is registered in this release. The first implementation should
live under `src/adapters/rest/` and be mounted by the Bun/Elysia process as an
independent adapter. It must call the same application services as the Web adapter;
it must not proxy Web forms.

The legacy unmounted `src/pages/rasApi.tsx` experiment was removed. This reserved
adapter directory and the shared application services are the only foundation for
the future REST implementation.

The public contract is OpenAPI and remains independent of implementation language.
A later Rust, Go or other adapter can replace the Bun adapter without changing that
contract.

Baseline operations:

- list engines and formats;
- create and complete resumable uploads;
- create asynchronous conversion jobs (`202 Accepted` plus `job_id`);
- list and read owner jobs;
- stream progress over SSE;
- cancel jobs;
- list and download artifacts;
- delete jobs and artifacts.

Suggested API-key scopes are `jobs:create`, `jobs:read`, `jobs:cancel`,
`artifacts:read` and `jobs:delete`. Keys must store only a cryptographic hash,
display prefix, scopes, creation/expiry time and last-used time. The existing
plaintext `api_keys` table is not a migration foundation.

Durable queues, workers, rate limiting, SSE, API-key UI and OpenAPI publication are
P1/API work. The current in-process executor is intentionally replaceable.
