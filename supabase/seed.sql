-- Database webhook: mirror Supabase auth.users INSERTs into the app's user table.
--
-- After a new auth user is committed, fire an HTTP POST (via pg_net) at the
-- NestJS endpoint, which upserts the mirrored user. The shared secret must match
-- SUPABASE_WEBHOOK_SECRET in the app's environment (test env: "test-webhook-secret").
--
-- host.docker.internal resolves to the host running the API from inside the
-- Supabase containers (see docker/test/docker-compose.yml host-gateway alias).

-- pg_net powers supabase_functions.http_request.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS "create-user" ON "auth"."users";

CREATE TRIGGER "create-user"
AFTER INSERT ON "auth"."users"
FOR EACH ROW
EXECUTE FUNCTION "supabase_functions"."http_request"(
  'http://host.docker.internal:3000/webhooks/supabase/users',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"test-webhook-secret"}',
  '{}',
  '5000'
);