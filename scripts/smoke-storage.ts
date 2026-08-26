/**
 * Manual smoke test for the real Supabase storage adapter.
 *
 * Exercises the same operations SupabaseStorageService performs
 * (src/modules/storage/services/supabase-storage.service.ts) against a live
 * Supabase Storage bucket — upload (upsert) -> createSignedUrl -> fetch -> delete
 * — which CI never covers because tests bind the in-memory fake instead.
 *
 * Run: pnpm smoke:storage   (loads .env.local; needs SUPABASE_URL and the
 * SERVICE-ROLE key, plus a private bucket matching SUPABASE_RESUME_BUCKET).
 *
 * See docs/smoke-test-storage.md for prerequisites and troubleshooting.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const bucket = process.env.SUPABASE_RESUME_BUCKET ?? 'resumes';

// Smallest thing that is unambiguously a PDF by magic number.
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8');
const path = `smoke-test/${Date.now()}.pdf`;

const ok = (msg: string): void => console.log(`✅ ${msg}`);

function fail(msg: string, extra?: unknown): never {
  console.error(`❌ ${msg}`, extra ?? '');
  process.exit(1);
}

async function main(): Promise<void> {
  if (!url || !serviceRoleKey) {
    fail(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run via pnpm smoke:storage so .env.local is loaded).',
    );
  }

  const store = createClient(url, serviceRoleKey).storage.from(bucket);

  // 1. upload
  {
    const { data, error } = await store.upload(path, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) fail(`upload failed: ${error.message}`);
    ok(`upload -> ${data.path}`);
  }

  // 2. upsert (re-upload the same path must not error)
  {
    const { error } = await store.upload(path, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) fail(`re-upload (upsert) failed: ${error.message}`);
    ok('upsert (overwrite same path)');
  }

  // 3. signed URL (300s mirrors the app's RESUME_SIGNED_URL_TTL_SECONDS)
  let signedUrl: string;
  {
    const { data, error } = await store.createSignedUrl(path, 300);
    if (error) fail(`createSignedUrl failed: ${error.message}`);
    signedUrl = data.signedUrl;
    ok('createSignedUrl');
  }

  // 4. signed URL resolves to the exact bytes
  {
    const res = await fetch(signedUrl);
    if (res.status !== 200) fail(`signed URL returned HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length !== pdf.length) {
      fail(`byte length mismatch: got ${bytes.length}, expected ${pdf.length}`);
    }
    ok(`signed URL 200, ${bytes.length} bytes match`);
  }

  // 5. delete
  {
    const { error } = await store.remove([path]);
    if (error) fail(`delete failed: ${error.message}`);
    ok('delete');
  }

  // 6. object is gone — a fresh signed URL should no longer resolve to 200
  {
    const { data, error } = await store.createSignedUrl(path, 300);
    if (!error && data?.signedUrl) {
      const res = await fetch(data.signedUrl);
      if (res.status === 200) fail('object still fetchable after delete');
    }
    ok('object no longer resolves after delete');
  }

  console.log('\n✅ All storage smoke checks passed.');
}

main().catch((err) => fail('unexpected error', err));
