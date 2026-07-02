import { z } from 'zod';

import { createServerClient } from '@/lib/insforge/server';
import { setDemoCookie } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: 'Enter your email and the 6-digit code.' }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase().trim();
    const client = createServerClient();

    const { error } = await client.auth.verifyEmail({ email, otp: parsed.data.otp });
    if (error) {
      return Response.json({ ok: false, error: 'Invalid or expired code.' }, { status: 401 });
    }

    // Record the verified visitor for tracking (insert once; repeats are
    // counted in request-otp's returning-visitor path).
    const inserted = await client.database.from('demo_visitors').insert({ email });
    if (inserted.error && !/duplicate|unique/i.test(inserted.error.message ?? '')) {
      throw inserted.error;
    }

    await setDemoCookie(email);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[demo] verify-otp failed:', error);
    return Response.json({ ok: false, error: 'Could not verify the code. Try again.' }, { status: 500 });
  }
}
