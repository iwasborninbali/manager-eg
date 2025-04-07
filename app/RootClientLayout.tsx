"use client";

import React from 'react';
import { AuthProvider } from "../context/AuthContext";
import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper";
// Remove unused imports if they were added here
// import { usePathname } from 'next/navigation'; 
// import SideMenu from '@/components/layout/SideMenu'; 
// import { Toaster } from "@/components/ui/sonner"; // Toaster is handled in ClientLayoutWrapper

interface RootClientLayoutProps {
  children: React.ReactNode;
}

export default function RootClientLayout({ children }: RootClientLayoutProps) {
  // Revert to original structure
  return (
    <AuthProvider>
      <ClientLayoutWrapper>
        {children}
      </ClientLayoutWrapper>
      {/* Toaster is rendered inside ClientLayoutWrapper */}
    </AuthProvider>
  );
} 