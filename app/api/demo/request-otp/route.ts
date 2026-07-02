import { z } from 'zod';

import { createServerClient } from '@/lib/insforge/server';
import { setDemoCookie } from '@/lib/auth';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase().trim();
    const client = createServerClient();

    // Returning visitor: already verified once — let them in, count the visit.
    // ponytail: returning emails re-enter without OTP; switch to reset-password-code flow if re-verification matters
    const existing = await client.database
      .from('demo_visitors')
      .select('id, visits')
      .eq('email', email)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (existing.data) {
      const updated = await client.database
        .from('demo_visitors')
        .update({ visits: existing.data.visits + 1, last_visit_at: new Date().toISOString() })
        .eq('id', existing.data.id);
      if (updated.error) throw updated.error;
      await setDemoCookie(email);
      return Response.json({ ok: true, data: { verified: true } });
    }

    // New visitor: create an InsForge auth user (throwaway password) so InsForge
    // emails them a 6-digit verification code.
    const { error } = await client.auth.signUp({
      email,
      password: crypto.randomUUID(),
    });
    if (error) {
      // User exists in InsForge auth but not in demo_visitors (e.g. earlier
      // attempt abandoned) — re-send the code instead of failing.
      const resent = await client.auth.resendVerificationEmail({ email });
      if (resent.error) throw resent.error;
    }

    return Response.json({ ok: true, data: { verified: false } });
  } catch (error) {
    console.error('[demo] request-otp failed:', error);
    return Response.json({ ok: false, error: 'Could not send the code. Try again.' }, { status: 500 });
  }
}
