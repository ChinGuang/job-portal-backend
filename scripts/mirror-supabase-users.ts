/**
 * Mirror Supabase auth users into the local `users` table directly, bypassing
 * the webhook — a shortcut for local seeding when the app isn't running.
 *
 * This writes exactly what the webhook path (UserRepoService.upsertBySupabaseId)
 * writes: supabaseId = the auth user's id, plus email and provider. It's an
 * idempotent upsert keyed on supabaseId, so it's safe to run alongside / before
 * the real webhook and safe to re-run.
 *
 * Run: pnpm mirror:users   (loads .env.local; needs SUPABASE_URL + the
 * SERVICE-ROLE key for the auth read, and the POSTGRES_* vars for the write).
 *
 * By default only users tagged by the seeder (user_metadata.seeded === true)
 * are mirrored. Set MIRROR_ALL=1 to mirror every auth user instead.
 */
import { createClient } from '@supabase/supabase-js';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/data-source';
import { AuthProvider, User } from '../src/modules/users/entities/user.entity';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const mirrorAll = process.env.MIRROR_ALL === '1';

const ok = (msg: string): void => console.log(`✅ ${msg}`);

function fail(msg: string, extra?: unknown): never {
  console.error(`❌ ${msg}`, extra ?? '');
  process.exit(1);
}

async function main(): Promise<void> {
  if (!url || !serviceRoleKey) {
    fail(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run via pnpm mirror:users so .env.local is loaded).',
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin;

  // Page through auth.users — listUsers is capped per page.
  const authUsers: { id: string; email?: string; seeded: boolean }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`listUsers failed: ${error.message}`);
    if (data.users.length === 0) break;
    for (const u of data.users) {
      authUsers.push({
        id: u.id,
        email: u.email,
        seeded:
          (u.user_metadata as { seeded?: boolean } | null)?.seeded === true,
      });
    }
    if (data.users.length < 1000) break;
  }

  const toMirror = authUsers.filter(
    (u) => typeof u.email === 'string' && (mirrorAll || u.seeded),
  );

  if (toMirror.length === 0) {
    fail(
      mirrorAll
        ? 'no auth users with an email found.'
        : 'no seeded auth users found. Run pnpm seed:users first, or set MIRROR_ALL=1.',
    );
  }

  const dataSource = new DataSource({
    ...dataSourceOptions,
    entities: ['src/**/*.entity.ts'],
  });
  await dataSource.initialize();
  // ok(`connected to ${dataSourceOptions.database}@${dataSourceOptions.host}`);

  try {
    const userRepo = dataSource.getRepository(User);
    for (const u of toMirror) {
      // Same write the webhook makes: keyed on supabaseId, only email/provider
      // set, so an existing (possibly soft-deleted) row keeps the rest of its state.
      await userRepo.upsert(
        {
          supabaseId: u.id,
          email: u.email as string,
          provider: AuthProvider.SUPABASE,
        },
        { conflictPaths: ['supabaseId'], skipUpdateIfNoValuesChanged: true },
      );
      ok(`mirrored ${u.email}`);
    }
    console.log(
      `\nMirrored ${toMirror.length} user(s) into the local users table.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => fail('unexpected error', err));
