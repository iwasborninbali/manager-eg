import { redirect } from 'next/navigation';

// This is the root page, it should redirect to the main projects view
export default function RootPage() {
  redirect('/projects');
  // Next.js handles the redirect, so technically nothing below this line runs,
  // but returning null is good practice.
  // return null;
} 