/**
 * Generates an RSA-4096 keypair for RS256 JWT signing.
 *
 * Run once per environment:
 *   npx ts-node scripts/generate-jwt-keys.ts
 *
 * Outputs:
 *   keys/jwt-private.pem  (sign tokens — keep secret, gitignored)
 *   keys/jwt-public.pem   (verify tokens — safe to share / put in env)
 *
 * Both files are written to keys/ which must be in .gitignore.
 * Refuses to overwrite existing files; delete them first if you really
 * want a fresh pair (this will invalidate every issued JWT).
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEYS_DIR = resolve(__dirname, '..', 'keys');
const PRIVATE_KEY_PATH = resolve(KEYS_DIR, 'jwt-private.pem');
const PUBLIC_KEY_PATH = resolve(KEYS_DIR, 'jwt-public.pem');

function main(): void {
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (existsSync(PRIVATE_KEY_PATH) || existsSync(PUBLIC_KEY_PATH)) {
    console.error(
      `\nKeys already exist at ${KEYS_DIR}.\n` +
        `Delete them manually if you really want to rotate (this WILL invalidate every issued JWT).\n`,
    );
    process.exit(1);
  }

  console.log('Generating RSA-4096 keypair (this takes a few seconds)…');

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

  console.log(`\n✅ Private key written: ${PRIVATE_KEY_PATH}`);
  console.log(`✅ Public  key written: ${PUBLIC_KEY_PATH}\n`);
  console.log('Add these to your .env:');
  console.log('  JWT_PRIVATE_KEY_PATH=keys/jwt-private.pem');
  console.log('  JWT_PUBLIC_KEY_PATH=keys/jwt-public.pem\n');
}

main();
