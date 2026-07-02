'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Step = 'email' | 'otp';

export default function TryDemoPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function post(path: string, body: object) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function requestOtp(resend = false) {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const body = await post('/api/demo/request-otp', { email });
      if (!body.ok) {
        setError(body.error ?? 'Could not send the code.');
        return;
      }
      if (body.data.verified) {
        router.replace('/login');
        return;
      }
      setStep('otp');
      if (resend) setNotice('A new code is on its way.');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const body = await post('/api/demo/verify-otp', { email, otp });
      if (!body.ok) {
        setError(body.error ?? 'Could not verify the code.');
        return;
      }
      router.replace('/login');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">VivahStyle</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {step === 'email'
              ? 'Enter your email to try the demo'
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestOtp();
            }}
            className="flex flex-col gap-4"
          >
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {error && <p className="text-[12px] text-status-danger">{error}</p>}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Sending code…' : 'Send code'}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyOtp();
            }}
            className="flex flex-col gap-4"
          >
            <Input
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              autoComplete="one-time-code"
              required
            />
            {error && <p className="text-[12px] text-status-danger">{error}</p>}
            {notice && <p className="text-[12px] text-ink-muted">{notice}</p>}
            <Button type="submit" size="lg" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              className="text-[12px] text-ink-muted underline disabled:opacity-50"
              disabled={loading}
              onClick={() => void requestOtp(true)}
            >
              Resend code
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
