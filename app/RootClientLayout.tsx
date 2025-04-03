"use client";

import React from 'react';
import { AuthProvider } from "../context/AuthContext";
import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper";

interface RootClientLayoutProps {
  children: React.ReactNode;
}

export default function RootClientLayout({ children }: RootClientLayoutProps) {
  return (
    <AuthProvider>
      <ClientLayoutWrapper>
        {children}
      </ClientLayoutWrapper>
    </AuthProvider>
  );
} 