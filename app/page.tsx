'use client'; // Make it a client component

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { Button } from '@/components/ui/Button';

// This is the root page, it should redirect to the main projects view
export default function RootPage() {
  const { user, userData, loading, googleSignIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is done, user is logged in, and has a role, redirect to projects
    if (!loading && user && userData && userData.role && userData.role.length > 0) {
      console.log("User authenticated with role, redirecting to /projects...");
      router.push('/projects');
    }
    // Note: If user is logged in but has NO role, they will be shown AccessDeniedPage by RootClientLayout
    // Note: If user is NOT logged in (!user), this page will render the login button
  }, [user, userData, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Проверка авторизации...</p>
      </div>
    );
  }

  // If user is loaded but not logged in, show login button
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-800">
          <h1 className="text-3xl font-bold mb-4 text-neutral-800 dark:text-neutral-200">Добро пожаловать!</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">Пожалуйста, войдите для доступа к системе.</p>
          <Button onClick={googleSignIn} size="lg">
              <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
              Войти через Google
          </Button>
      </div>
    );
  }

  // If user is logged in but redirect hasn't happened yet (or no role), render null or loading
  // The RootClientLayout will handle the AccessDenied case
  return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Перенаправление...</p> 
      </div>
  ); // Or a loading indicator while redirect effect runs
} 