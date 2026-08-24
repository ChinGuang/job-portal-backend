import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export class TestAuthSeam {
  private privateKey!: string;
  private publicKey!: string;
  public kid = 'test-key-id';

  setupKeys() {
    // Generate RSA key pair using Node's native crypto module (Pure CJS)
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  // Returns PEM public key directly for the passportJwtSecret spy
  getPublicKeyPem(): string {
    return this.publicKey;
  }

  // Mint signed JWT using jsonwebtoken
  mintToken(
    sub: string,
    customClaims: Record<string, any> = {},
    issuerUrl = 'http://localhost:3000',
  ): string {
    return jwt.sign(
      {
        sub,
        email: `${sub}@example.com`,
        role: 'authenticated',
        ...customClaims,
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        keyid: this.kid,
        issuer: `${issuerUrl}/auth/v1`,
        expiresIn: '1h',
      },
    );
  }
}
