// Manual Jest mock for the `jwks-rsa` node module, shared by every e2e spec.
//
// Each spec opts in with a single hoisted `jest.mock('jwks-rsa')` line (no
// factory), and Jest resolves the implementation from this file. A per-file
// opt-in is required because Jest's rootDir here is the `test/` directory, so
// node-module mocks are not auto-applied — but the factory body itself lives
// only here rather than being copy-pasted into each spec.
//
// SupabaseJwtStrategy calls passportJwtSecret() to obtain a secretOrKeyProvider.
// Here it resolves the verification key from process.env.TEST_PUBLIC_KEY, which
// TestAuthSeam sets to the public half of a locally generated RSA key pair.

type SecretProviderCallback = (err: Error | null, secret?: string) => void;

export const passportJwtSecret = jest.fn(
  () => (_req: unknown, _rawJwtToken: unknown, cb: SecretProviderCallback) => {
    cb(null, process.env.TEST_PUBLIC_KEY);
  },
);
