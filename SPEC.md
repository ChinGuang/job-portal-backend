# Startup Job Portal — Backend Implementation Spec

Status: ready-for-agent
Scope: v1 demo (local only)

## Problem Statement

Job seekers have no single place to browse openings published by startups, and startups have no lightweight way to publish roles and triage the people who apply to them. Both sides currently need an account, a profile, and a way to move an application through a hiring conversation — none of which exists.

This is being built as a demonstrable local project on a zero budget, so every decision below is constrained by "must be free" and "must be showable from a laptop with Swagger and a single throwaway HTML page".

## Solution

A NestJS REST API backed by PostgreSQL, where:

- Identity is fully delegated to Supabase Auth. Users sign up and sign in (email/password or Google) directly against Supabase from a client. The API never sees a password and issues no tokens of its own.
- A person is not typed as "job seeker" or "employer". Instead, one account may create a job seeker profile, an employer profile, or both. Capability is derived from which profiles exist.
- Employers manage job listings through a full draft → published → closed → archived lifecycle.
- Anyone, logged in or not, can browse and search published listings.
- Job seekers apply with a résumé and optional cover letter; employers move each application through a constrained status machine.
- Résumés live in a private Supabase Storage bucket and are only readable through a short-lived signed URL issued after an ownership check.

## User Stories

### Account and identity

1. As a visitor, I want to register with an email and password through Supabase Auth, so that I can obtain an account without the portal ever handling my password.
2. As a visitor, I want to register with my Google account, so that I can sign up without creating another password.
3. As a returning user, I want to sign in with email and password, so that I can regain access to my profiles and data.
4. As a returning user, I want to sign in with Google, so that I can access my account with one click.
5. As a user who forgot my password, I want to request a reset email, so that I can regain access to my account.
6. As a user who has received a reset link, I want to set a new password, so that I can sign in again.
7. As a user who signed up with email and later signs in with Google using the same address, I want to land in the same account, so that my profiles and history are not split in two.
8. As a newly registered user, I want my first authenticated API call to succeed even if the account-sync webhook has not yet arrived, so that I never see a spurious error immediately after signing up.
9. As a user whose Supabase account has been deleted, I want any still-valid token to stop working against the API, so that a deleted account cannot keep acting.
10. As an API consumer, I want a clear 401 when my token is missing, expired, or invalid, so that I can distinguish authentication failure from authorization failure.
11. As an API consumer, I want a clear 403 when I am authenticated but lack the profile or ownership required, so that I understand what is missing.

### Job seeker profile

12. As a signed-in user, I want to create a job seeker profile with my name, so that I can start applying to jobs.
13. As a job seeker, I want to add a headline and bio, so that employers can see how I present myself.
14. As a job seeker, I want to record my phone number, so that employers have a second way to reach me.
15. As a job seeker, I want to list my skills, so that my application shows relevant expertise.
16. As a job seeker, I want to record my years of experience, so that employers can gauge my seniority.
17. As a job seeker, I want to upload my résumé file, so that it is attached to applications I submit.
18. As a job seeker, I want to replace my résumé with a newer version, so that my profile stays current.
19. As a job seeker, I want to read back my own profile, so that I can confirm what I have saved.
20. As a job seeker, I want to update any field of my profile, so that I can correct mistakes.
21. As a job seeker, I want my résumé to be rejected if it is not a PDF or Word document, so that I do not accidentally upload the wrong file.
22. As a job seeker, I want an oversized résumé upload to be rejected with a clear message, so that I know to compress it.

### Employer profile

23. As a signed-in user, I want to create an employer profile with my company name, so that I can publish job listings.
24. As an employer, I want to add my company website, so that candidates can research us.
25. As an employer, I want to add a company logo, so that our listings are recognisable.
26. As an employer, I want to record industry and company size, so that candidates know what kind of company we are.
27. As an employer, I want to write a company description, so that candidates understand what we do.
28. As an employer, I want to record our address, so that candidates know where we are based.
29. As an employer, I want to read back and update my company profile, so that it stays accurate.
30. As a user, I want to hold both a job seeker profile and an employer profile on one account, so that I can act on both sides of the marketplace.

### Job listings — employer side

31. As an employer, I want to create a job listing as a draft, so that I can write it over several sittings before anyone sees it.
32. As an employer, I want to give a listing a title, description, requirements, and location, so that candidates know what the role involves.
33. As an employer, I want to set the job type, so that candidates can tell full-time from contract or internship.
34. As an employer, I want to set an optional salary range and currency, so that candidates can self-select.
35. As an employer, I want to publish a draft listing, so that it becomes visible to job seekers.
36. As an employer, I want to edit a listing after publishing, so that I can fix errors without recreating it.
37. As an employer, I want to close a listing, so that it stays visible but stops accepting applications.
38. As an employer, I want to archive a listing, so that it disappears from public browsing.
39. As an employer, I want to list all of my own listings including drafts and archived ones, so that I have a complete view of my postings.
40. As an employer, I want to be prevented from editing or deleting another company's listing, so that my listings are safe from others.
41. As a user without an employer profile, I want to be told I need one before creating a listing, so that the requirement is obvious.

### Job browsing — seeker side

42. As a visitor, I want to browse published job listings without signing in, so that I can evaluate the portal before registering.
43. As a visitor, I want listings paginated with a total count, so that I can navigate large result sets.
44. As a visitor, I want to filter listings by job type, so that I only see the arrangements I want.
45. As a visitor, I want to filter listings by location, so that I only see jobs where I can work.
46. As a visitor, I want to keyword-search titles and descriptions, so that I can find roles by technology or function.
47. As a visitor, I want to open a single listing by id and see its full detail alongside the company's public profile, so that I can decide whether to apply.
48. As a visitor, I want draft and archived listings excluded from browsing and hidden on direct access, so that I never see roles I cannot reach.

### Applications — seeker side

49. As a job seeker, I want to apply to a published listing, so that the employer receives my candidacy.
50. As a job seeker, I want to attach a cover letter to my application, so that I can explain my interest.
51. As a job seeker, I want my profile résumé used automatically when I do not supply one, so that applying is a single step.
52. As a job seeker, I want to supply a specific résumé for one application, so that I can tailor it to the role.
53. As a job seeker, I want to be stopped from applying to the same listing twice, so that I do not spam the employer.
54. As a job seeker, I want applying to a non-published listing to fail clearly, so that I am not misled about a role's availability.
55. As a job seeker, I want to be told to upload a résumé when neither my profile nor my request has one, so that I know what is missing.
56. As a job seeker, I want to list all applications I have submitted with their current status, so that I can track my search.
57. As a job seeker, I want to open one of my applications and see the listing it was for, so that I remember what I applied to.
58. As a job seeker, I want to be prevented from reading another seeker's applications, so that my job search stays private.
59. As a user without a job seeker profile, I want to be told I need one before applying, so that the requirement is obvious.

### Applications — employer side

60. As an employer, I want to list every application submitted to one of my listings, so that I can review candidates.
61. As an employer, I want to filter a listing's applications by status, so that I can focus on the ones still in play.
62. As an employer, I want to read an applicant's cover letter and profile, so that I can assess them.
63. As an employer, I want to open an applicant's résumé through a short-lived link, so that I can read it without the file being publicly exposed.
64. As an employer, I want to mark an application as reviewed, so that my team knows it has been triaged.
65. As an employer, I want to mark a reviewed application as offered, so that the candidate sees the outcome.
66. As an employer, I want to mark a reviewed application as rejected, so that the candidate is not left waiting.
67. As an employer, I want invalid status transitions rejected, so that an application cannot move backwards or out of a final decision.
68. As an employer, I want to be prevented from touching applications on another company's listings, so that candidate data stays compartmentalised.
69. As a job seeker, I want to be prevented from changing my own application's status, so that the process stays credible.

### Operational

70. As an operator, I want a Supabase webhook to keep the local user mirror in step with Supabase Auth, so that user records exist without manual intervention.
71. As an operator, I want the webhook endpoint to reject calls without the shared secret, so that a public tunnel URL cannot be used to forge users.
72. As an operator, I want repeated delivery of the same webhook event to be harmless, so that retries do not corrupt data.
73. As an operator, I want every endpoint rate-limited, so that the demo cannot be trivially hammered.
74. As an operator, I want interactive API documentation, so that I can demonstrate every endpoint without a frontend.
75. As an operator, I want schema changes delivered as versioned migrations, so that the database can be rebuilt deterministically.

## Implementation Decisions

### Architecture

- **NestJS is a pure resource server.** It exposes no authentication endpoints. Registration, login, Google sign-in, email confirmation, and password reset are performed by the client directly against Supabase Auth. The API only consumes the resulting access token.
- **Supabase is used for two things only:** Auth, and Storage for résumé files. Application data lives in a separate, locally-run PostgreSQL instance.
- **PostgreSQL runs in Docker Compose** and is not the Supabase database. There is therefore no foreign key between the local user mirror and Supabase's `auth.users`; the link is a plain unique column.
- **TypeORM** is the ORM, with **generated migrations** from the start. `synchronize` is never enabled.
- **Modules:** an auth module (guards and token verification, plus the webhook controller), a users module, a profiles module covering both profile types, a jobs module, an applications module, a storage module, and a shared module for configuration, filters, and interceptors.

### Token verification

- Access tokens are verified **locally against Supabase's JWKS**, with the key set cached. No network call is made per request.
- The exact JWKS endpoint and key algorithm must be confirmed against current Supabase documentation at build time — this area has changed across releases.
- The authenticated principal is derived from the token's `sub` claim.
- No refresh-token handling exists in the API. Refresh is the client's business with Supabase.

### User mirror and provisioning

- The local user record holds its own UUID primary key plus a unique `supabaseId`, an email, a `provider` value, timestamps, and a nullable `deletedAt`.
- `provider` is single-valued in this version — every mirrored user is recorded as `SUPABASE`. The `LOCAL` and `GOOGLE` variants, along with `passwordHash`, `googleId`, and `isVerified`, are **not implemented in v1** and must not appear in the schema.
- **Two provisioning paths, both converging on an idempotent upsert keyed by `supabaseId`:**
  - A **Supabase Database Webhook** on `auth.users` for INSERT and UPDATE, posting to an endpoint exposed through ngrok during local demos.
  - **Lazy provisioning in the auth guard:** a valid token whose `sub` has no local row causes the row to be created from the token claims, and the request proceeds. This makes the webhook an optimisation rather than a correctness requirement.
- The webhook endpoint is protected by a **shared secret header** verified before any processing. It returns 2xx for event types it deliberately ignores, so Supabase stops retrying.
- **DELETE events soft-delete** the local user by setting `deletedAt`, and cascade to that user's employer listings by moving them to `ARCHIVED`. Applications and job seeker data are left intact so that other parties' records do not develop holes.
- **A soft-deleted user is never resurrected.** The guard rejects any token whose `sub` maps to a row with `deletedAt` set, before lazy provisioning is considered.

### Authorization

- There is **no role column.** Capability is derived: "is an employer" means an employer profile exists for the user; "is a job seeker" means a job seeker profile exists.
- Two layers of check on every protected route: a **capability guard** (does the required profile exist?) and a **per-resource ownership check** (does this job, application, or profile belong to the caller?).
- A single account may hold both profiles. Consequently a user **may apply to their own listing**; this is accepted for the demo and is not blocked.

### Domain model

- The job seeker profile and the employer profile each belong one-to-one to a user and are created on demand, not at registration.
- A job belongs to an employer profile. Requirements are stored as a string array.
- `JobStatus` retains four values with distinct meanings:
  - `DRAFT` — not publicly visible, not applicable to.
  - `PUBLISHED` — publicly visible, accepting applications.
  - `CLOSED` — publicly visible, **not** accepting applications.
  - `ARCHIVED` — not publicly visible.
- `CLOSED` is reachable through an explicit status-change endpoint. Deleting a job is a **soft operation**: it sets `ARCHIVED` and never removes the row, so that application history survives.
- An application belongs to a job and a job seeker profile, with a **unique database constraint on the pair**. A second attempt is a 409.
- Applications may only be created against a `PUBLISHED` job.
- `ApplicationStatus` is `SUBMITTED`, `REVIEWED`, `OFFERED`, `REJECTED`, governed by a state machine — `SUBMITTED → REVIEWED → OFFERED | REJECTED`. `OFFERED` and `REJECTED` are terminal. Only the employer owning the listing may transition.
- The application's `resumeUrl` is a **string snapshot** taken at apply time: the value supplied on the request, falling back to the job seeker profile's résumé. If neither is present, the application is rejected. No file is copied.
- **Removed from the original draft entirely:** the OTP verification table, the OTP purpose enum, the user role enum, and any refresh-token storage.

### Résumé storage

- A **private** Supabase Storage bucket. No object is ever publicly readable.
- Uploads are **proxied through the API** using the service-role key, which never reaches a client. Server-side validation: PDF, DOC, or DOCX only, 5 MB maximum, checked before anything is written to storage.
- Employers read a résumé through an API endpoint that verifies they own the job the application was submitted to, then issues a **short-lived signed URL**.
- Storage access sits behind a storage-service interface with upload, signed-URL, and delete operations, so the transport is swappable and fake-able.

### API contract

All routes are prefixed and documented with Swagger.

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/webhooks/supabase/users` | shared secret | idempotent upsert; soft-delete |
| GET | `/me` | token | mirrored user plus which profiles exist |
| POST / GET / PATCH | `/profiles/job-seeker` | token | one per user |
| POST | `/profiles/job-seeker/resume` | job seeker | multipart upload |
| POST / GET / PATCH | `/profiles/employer` | token | one per user |
| GET | `/jobs` | public | `PUBLISHED` only; pagination, `jobType`, `location`, keyword |
| GET | `/jobs/:id` | public | `PUBLISHED` and `CLOSED` only |
| POST | `/jobs` | employer | created as `DRAFT` |
| PATCH | `/jobs/:id` | owner | content edits |
| PATCH | `/jobs/:id/status` | owner | `DRAFT`→`PUBLISHED`, `PUBLISHED`→`CLOSED`, etc. |
| DELETE | `/jobs/:id` | owner | sets `ARCHIVED` |
| GET | `/jobs/mine` | employer | all statuses |
| POST | `/jobs/:id/applications` | job seeker | unique per pair |
| GET | `/jobs/:id/applications` | owner | filterable by status |
| GET | `/applications/mine` | job seeker | own applications |
| GET | `/applications/:id` | seeker owner or job owner | |
| PATCH | `/applications/:id/status` | job owner | state machine enforced |
| GET | `/applications/:id/resume` | job owner | short-lived signed URL |

- Listing endpoints use **offset/limit pagination returning items plus a total count**. Keyword search is a case-insensitive `LIKE` over title and description.
- Validation is via DTOs with a global validation pipe, whitelisting unknown properties.
- A global exception filter produces a consistent error body.
- Rate limiting is applied globally, in memory.

### Demo harness

- A **single throwaway static HTML page** using the Supabase JS client provides the Google and email sign-in buttons and prints the resulting access token for pasting into Swagger. This exists purely to make the browser-redirect flows demonstrable; it is not a product frontend.
- ngrok is started manually per session and the Supabase webhook URL updated to match, as a documented README step.

## Testing Decisions

### What makes a good test here

Tests assert **external behaviour through the HTTP boundary** — status codes, response bodies, and resulting database state. They never reach into services, guards, or repositories directly, and never assert on how a result was computed. A test should survive any internal refactor that preserves the API contract.

### The seam

**One seam: the HTTP layer.** Every test boots the real Nest application and drives it with Supertest. Guards, validation pipes, services, and TypeORM repositories are all exercised as a unit through real requests.

Two collaborators are faked, both genuinely external:

1. **Token verification.** Tests sign JWTs with a locally-generated key pair, and the verifier is pointed at a local key set in the test environment. A helper mints a token for an arbitrary subject, making "act as this user" one line.
2. **Storage.** The storage-service interface is bound to an in-memory fake that records uploads and returns predictable signed URLs. No test touches Supabase.

**PostgreSQL is not faked.** Tests run against the real Docker Compose database with migrations applied, truncated between tests. Unique constraints, array columns, the keyword search, and status filtering are all behaviours worth exercising for real.

The webhook needs no seam of its own — it is an HTTP endpoint, tested by posting representative Supabase payloads to it, with and without the shared secret.

### Coverage targets

- **Auth and provisioning:** missing, expired, and invalid tokens; lazy provisioning on first request; webhook-then-request and request-then-webhook orderings converging on one row; duplicate webhook delivery; unauthenticated webhook rejected; soft-deleted user rejected rather than resurrected.
- **Profiles:** creation; duplicate creation rejected; update; reading another user's profile refused; both profiles held on one account.
- **Jobs:** draft invisible publicly; publishing makes visible; closed visible but unapplicable; archived hidden; edit and status changes by a non-owner refused; pagination, each filter, and keyword search; delete archives rather than removes.
- **Applications:** successful apply; duplicate returns 409; apply to draft, closed, or archived refused; résumé fallback from profile; no résumé anywhere refused; seeker sees only own applications; employer sees only own listings' applications; every legal transition; every illegal transition refused; seeker cannot transition; signed URL issued only to the owning employer.

### Prior art

None — this is a greenfield repository. These end-to-end tests establish the pattern, and later features should follow the same single-seam approach rather than introducing unit tests against internal services.

## Out of Scope

- Any authentication endpoint in the API. Register, login, Google sign-in, email confirmation, and password reset are Supabase's, demonstrated through the static page and the Supabase dashboard.
- OTP generation, storage, hashing, expiry, or attempt limiting.
- Outbound email of any kind, including notifying candidates of status changes.
- Password hashing and refresh-token rotation.
- Local and Google auth providers as first-class variants, and the `isVerified` mirror.
- Deployment, CI, and any hosted environment. The demo is local only.
- A product frontend. The static page is a token-getter, not a UI.
- Preventing a user from applying to their own job listing.
- Hard deletion of users, jobs, or applications, and any erasure-request handling.
- Full-text search, relevance ranking, saved searches, and job alerts.
- Interview scheduling, messaging between parties, and richer application stages.
- File-copy résumé snapshots. Replacing a profile résumé changes what an employer sees on an already-submitted application; this is accepted.
- Distributed rate limiting. The throttler is in-memory and per-process.

## Further Notes

Known soft spots, accepted deliberately rather than overlooked:

- `provider` carries no information in v1, since every row holds the same value. It is retained only as a hook for future non-Supabase providers.
- Under ngrok's free tier the public URL changes on every restart, so the webhook will frequently be pointed at a dead host. Lazy provisioning covers user creation, but the soft-delete path is effectively untestable in a live demo without posting to the webhook endpoint by hand. It is covered by automated tests instead.
- Supabase free-tier projects pause after roughly a week of inactivity. The project must be woken before a demo.
- The largest divergence from the original brief: six of the ten original acceptance criteria concern registration, login, and password reset, and are now satisfied by Supabase rather than by code in this repository. If demonstrating self-built authentication is a goal of the exercise, this architecture does not serve it.
