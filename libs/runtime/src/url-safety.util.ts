import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for user-defined HTTP tools.
 *
 * An agent could otherwise be tricked (hallucination or prompt injection)
 * into making the platform fetch internal services — databases, admin
 * panels — or the cloud metadata endpoint (169.254.169.254), which leaks
 * cloud credentials. Spec §12.2 / §19.
 *
 * Residual limitation: after this check the `fetch` call resolves DNS
 * again, so a hostile name server could return a public IP here and a
 * private one to fetch ("DNS rebinding"). A fully bulletproof fix pins
 * the resolved IP and connects to it directly — out of scope for now.
 */

/** True when an IPv4 literal falls in a private / reserved / loopback range. */
function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  // Malformed input → fail closed (treat as unsafe).
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8   — "this host"
  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 10) return true; // 10.0.0.0/8  — private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — carrier-grade NAT
  if (a >= 224) return true; // 224.0.0.0/4+ — multicast / reserved
  return false;
}

/** True when an IPv6 literal is loopback, link-local, unique-local, etc. */
function ipv6IsPrivate(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  // IPv4-mapped form (::ffff:1.2.3.4) — extract and reuse the v4 check.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  // fe80::/10 — link-local. The second hex digit is 8, 9, a or b.
  if (/^fe[89ab]/.test(lower)) return true;
  // fc00::/7 — unique-local addresses.
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

function ipIsPrivate(ip: string): boolean {
  return isIP(ip) === 6 ? ipv6IsPrivate(ip) : ipv4IsPrivate(ip);
}

/**
 * Throws when `rawUrl` is not safe to fetch from the server: a non-http(s)
 * scheme, a literal private IP, or a hostname that resolves to one.
 * Callers convert the thrown error into a tool-failure result so the
 * reasoning loop continues gracefully.
 */
export async function assertUrlIsSafe(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`URL scheme must be http(s), got "${url.protocol}"`);
  }

  const host = url.hostname;

  // Host is already a literal IP — check it directly, no DNS needed.
  if (isIP(host)) {
    if (ipIsPrivate(host)) {
      throw new Error(`URL points to a private/internal address: ${host}`);
    }
    return;
  }

  // Hostname → resolve every A/AAAA record. A public-looking domain can
  // still be configured to resolve to 127.0.0.1 or a metadata IP.
  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new Error(`could not resolve host: ${host}`);
  }
  for (const { address } of records) {
    if (ipIsPrivate(address)) {
      throw new Error(`host "${host}" resolves to a private address (${address})`);
    }
  }
}
