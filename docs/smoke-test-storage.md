# Manual smoke test — real Supabase storage adapter

## Why this exists

Résumé storage sits behind a swappable `StorageService` interface
([`storage.service.interface.ts`](../src/modules/storage/storage.service.interface.ts)).
Automated tests bind the **in-memory fake**
([`in-memory-storage.service.ts`](../src/modules/storage/services/in-memory-storage.service.ts)),
so the **real** adapter —
[`SupabaseStorageService`](../src/modules/storage/services/supabase-storage.service.ts) —
is never exercised against an actual Supabase Storage bucket in CI (there are no
project credentials there). This is a repeatable manual check to run against a
live Supabase project **before a demo**.

## What it verifies

The three operations the adapter actually performs, against a real private
bucket:

- `upload` — writes to a private bucket with `upsert: true`.
- re-`upload` to the same path — confirms upsert (overwrite) works; the résumé
  flow relies on a fixed path per profile.
- `createSignedUrl` — mints a short-lived URL for a private object.
- the signed URL resolves to the **exact bytes** uploaded (HTTP 200 + length match).
- `delete` — removes the object; the signed URL then stops resolving.

## Prerequisites

1. A Supabase project — either cloud, or local via `supabase start`.
2. A **private** Storage bucket whose name matches `SUPABASE_RESUME_BUCKET`
   (defaults to `resumes` — see
   [`supabase-storage.service.ts:7`](../src/modules/storage/services/supabase-storage.service.ts#L7)).
   Create it in Studio → Storage, or with the CLI, and leave "Public bucket"
   **off**.
3. `.env.local` populated with (keys defined in
   [`config.ts`](../src/common/constants/config.ts), template in
   [`.env.example`](../.env.example)):

   ```dotenv
   SUPABASE_URL=https://<your-project-ref>.supabase.co   # or http://127.0.0.1:54321 for local
   SUPABASE_SERVICE_ROLE_KEY=<service-role key>          # NOT the anon key
   SUPABASE_RESUME_BUCKET=resumes                        # optional; omit to use the default
   ```

   > The **service-role** key is required. The adapter runs server-side and this
   > key bypasses RLS — the anon key will be denied. It never reaches a client.

## The smoke-test script

The script is committed at [`scripts/smoke-storage.ts`](../scripts/smoke-storage.ts).
It talks to Supabase Storage exactly the way the adapter does —
`createClient(url, serviceRoleKey)` then `upload` / `createSignedUrl` / `remove` —
and prints a ✅/❌ line per step, exiting non-zero on the first failure.

## Run it

```bash
pnpm smoke:storage
```

This wraps `dotenv -e .env.local -- ts-node scripts/smoke-storage.ts` (see the
`smoke:storage` entry in `package.json`), so it loads `.env.local` the same way
the `start` script does. `ts-node` and the `dotenv` CLI are already dev-deps.

### Expected output

```
✅ upload -> smoke-test/1724680000000.pdf
✅ upsert (overwrite same path)
✅ createSignedUrl
✅ signed URL 200, 15 bytes match
✅ delete
✅ object no longer resolves after delete

✅ All storage smoke checks passed.
```

Any failed step prints `❌ ...` and exits non-zero.

## Optional: broader end-to-end via the API

The direct script above is the primary check because it isolates the adapter. To
additionally exercise the whole résumé feature through HTTP:

1. Start the app (`pnpm start` / `pnpm start:dev`) pointed at the same
   `.env.local`.
2. Obtain a **real Supabase-issued RS256 JWT** for a user — the guard validates
   it against JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
   ([`supabase-jwt.strategy.ts`](../src/common/strategies/supabase-jwt.strategy.ts)),
   so a hand-made token won't pass.
3. Create a profile: `POST /profiles/job-seeker` (Bearer token).
4. Upload: `POST /profiles/job-seeker/resume` as `multipart/form-data` with a
   `file` field (PDF/DOC/DOCX, ≤ 5 MB).
5. `GET /profiles/job-seeker` — the response's `resumeUrl` is a fresh signed URL;
   confirm it downloads the file.

This path needs GoTrue, a real user, and an existing profile row, which is why
the direct script is preferred for a quick pre-demo confidence check.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Bucket not found` | Bucket name doesn't match `SUPABASE_RESUME_BUCKET` (default `resumes`). |
| `new row violates row-level security` / 400 on upload | Using the **anon** key instead of the **service-role** key. |
| `fetch failed` / invalid URL | `SUPABASE_URL` missing the `https://`/`http://` scheme. |
| Signed URL returns the object even after delete | Bucket is **public** — recreate it as private. |
| `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set` | Forgot `dotenv -e .env.local --`, or keys are blank in `.env.local`. |
