import { cookies } from 'next/headers';
import type { StaffRole } from '@/lib/constants';

export interface SessionPayload {
  staffId: string;
  name: string;
  role: StaffRole;
}

// Web Crypto (not node:crypto) so the same code runs in middleware (edge) and route handlers (node).
async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.SESSION_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString('hex');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = await sign(encoded);
  return `${encoded}.${sig}`;
}

export async function decodeSession(cookie: string): Promise<SessionPayload | null> {
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!timingSafeEqual(sig, await sign(encoded))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('vivah_session')?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

// Demo gate: visitors verify their email via OTP before reaching the store gate.
// Cookie holds just the verified email, HMAC-signed like vivah_session.
export const DEMO_COOKIE = 'vivah_demo';

export async function encodeDemoCookie(email: string): Promise<string> {
  const encoded = Buffer.from(email).toString('base64');
  return `${encoded}.${await sign(encoded)}`;
}

export async function setDemoCookie(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, await encodeDemoCookie(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getDemoEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  const [encoded, sig] = raw.split('.');
  if (!encoded || !sig || !timingSafeEqual(sig, await sign(encoded))) return null;
  return Buffer.from(encoded, 'base64').toString('utf8');
}

export async function requireRole(roles: StaffRole[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}
