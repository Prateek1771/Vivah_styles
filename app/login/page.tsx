import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/LoginForm';
import { getDemoEmail } from '@/lib/auth';

// Store gate sits behind the demo email-OTP gate so every trial is tracked.
export default async function LoginPage() {
  const demoEmail = await getDemoEmail();
  if (!demoEmail) redirect('/try');

  return <LoginForm />;
}
