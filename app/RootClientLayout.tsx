"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from "../context/AuthContext";
import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper";
import AccessDeniedPage from "@/components/auth/AccessDeniedPage";
// import { Toaster } from "@/components/ui/sonner";
// import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
// Remove unused imports if they were added here
// import { usePathname } from 'next/navigation'; 
// import SideMenu from '@/components/layout/SideMenu'; 
// import { Toaster } from "@/components/ui/sonner"; // Toaster is handled in ClientLayoutWrapper

interface RootClientLayoutProps {
  children: React.ReactNode;
}

// Inner component to use the hook
function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Handle redirection for unauthenticated users *unless* they are already on the root page
  useEffect(() => {
    if (!loading && !user && pathname !== '/') {
      console.log(`User not authenticated on ${pathname}, redirecting to /...`);
      router.push('/'); 
    }
  }, [loading, user, router, pathname]);

  // 1. Handle Loading State
  if (loading) {
    // Optional: Render a more sophisticated loading skeleton/spinner
    return (
      <div className="flex items-center justify-center min-h-screen">
          <p>Загрузка данных пользователя...</p>
          {/* Spinner component could go here */}
      </div>
    );
  }

  // 2. Handle Authenticated User
  if (user) {
    // Check for role
    const hasRole = userData && userData.role && userData.role.length > 0;
    if (hasRole) {
      // User is authenticated and has a role - render the main app
      return (
          <ClientLayoutWrapper>
              {children}
          </ClientLayoutWrapper>
      );
    } else {
      // User is authenticated but NO role - render Access Denied page
      return <AccessDeniedPage />;
    }
  }

  // 3. Handle Unauthenticated User
  // If on the root page, let the page component (login button) render
  if (pathname === '/') {
      return <>{children}</>; // Render children (app/page.tsx)
  } 
  
  // If not authenticated and not on root page (and redirect effect hasn't completed yet), render null
  return null; 
}

export default function RootClientLayout({ children }: RootClientLayoutProps) {
  return (
    <AuthProvider>
        <LayoutContent>{children}</LayoutContent>
        {/* Toaster is better placed inside ClientLayoutWrapper or LayoutContent if needed globally after auth check */}
    </AuthProvider>
  );
} 