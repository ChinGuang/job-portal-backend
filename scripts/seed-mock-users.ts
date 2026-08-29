/**
 * Seed mock users into Supabase Auth for local development / demos.
 *
 * Creates COUNT users via the Admin API (createUser), each with a confirmed
 * email so they can sign in immediately without the email-verification step.
 *
 * Run: pnpm seed:users            (loads .env.local; needs SUPABASE_URL and the
 * SERVICE-ROLE key — NOT the anon key, which cannot reach the Admin API).
 *
 * Configure via env (all optional):
 *   MOCK_USER_COUNT     how many to create        (default 10)
 *   MOCK_USER_DOMAIN    email domain              (default example.com)
 *   MOCK_USER_PASSWORD  shared password           (default Password123!)
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const count = Number(process.env.MOCK_USER_COUNT ?? 10);
const domain = process.env.MOCK_USER_DOMAIN ?? 'example.com';
const password = process.env.MOCK_USER_PASSWORD ?? 'Password123!';

const ok = (msg: string): void => console.log(`✅ ${msg}`);

function fail(msg: string, extra?: unknown): never {
  console.error(`❌ ${msg}`, extra ?? '');
  process.exit(1);
}

async function main(): Promise<void> {
  if (!url || !serviceRoleKey) {
    fail(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run via pnpm seed:users so .env.local is loaded).',
    );
  }

  // The service-role key is required: user creation via admin.* is refused
  // for the anon key.
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin;

  const stamp = Date.now();
  const created: string[] = [];

  for (let i = 1; i <= count; i++) {
    // The stamp keeps re-runs from colliding with already-existing emails.
    const email = `mock+${stamp}-${i}@${domain}`;

    const { data, error } = await admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { seeded: true },
    });

    if (error) fail(`createUser failed for ${email}: ${error.message}`);
    created.push(email);
    ok(`${email}  (id: ${data.user?.id})`);
  }

  console.log(
    `\nCreated ${created.length} user(s). Shared password: ${password}`,
  );
}

main().catch((err) => fail('unexpected error', err));
