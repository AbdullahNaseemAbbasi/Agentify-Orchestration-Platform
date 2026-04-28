import * as argon2 from 'argon2';

/**
 * Argon2id parameters tuned for backend auth.
 * - memoryCost 19 MiB and 2 iterations is OWASP's 2023 baseline.
 * - parallelism 1 keeps latency predictable on a single request.
 *
 * The salt is generated automatically by argon2 and embedded inside the
 * returned hash string, so callers never manage salts manually.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length === 0) {
    throw new Error('Cannot hash an empty password');
  }
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) {
    return Promise.resolve(false);
  }
  return argon2.verify(hash, plain);
}
