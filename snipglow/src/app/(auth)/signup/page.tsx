import { redirect } from 'next/navigation';

// Signup and Login use the same Google OAuth flow
// Redirect /signup to /login
export default function SignupPage() {
  redirect('/login');
}
