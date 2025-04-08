'use client';

import React, { useState } from 'react';
import SideMenu from '@/components/layout/SideMenu';
import CreateProjectDialog from '@/components/projects/CreateProjectDialog';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Toaster } from "@/components/ui/sonner";

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

  const handleProjectCreated = (projectId: string) => {
    console.log("Project created successfully with ID:", projectId);
    setIsCreateProjectDialogOpen(false); // Close the dialog on success
  };

  // const openCreateProjectDialog = () => {
  //   setIsCreateProjectDialogOpen(true);
  // };

  return (
    <div className="flex flex-col min-h-screen">
      {!isSideMenuOpen && (
        <button
          type="button"
          className="fixed top-4 left-4 z-30 inline-flex items-center justify-center rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm shadow-md transition-opacity duration-300 ease-in-out"
          onClick={() => setIsSideMenuOpen(true)}
          aria-label="Открыть меню"
        >
          <span className="sr-only">Открыть меню</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <SideMenu
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
      />

      <main className="flex-grow">
        {children}
      </main>

      <CreateProjectDialog
        isOpen={isCreateProjectDialogOpen}
        onClose={() => setIsCreateProjectDialogOpen(false)}
        onSuccess={handleProjectCreated}
      />
      <Toaster richColors position="bottom-right" />
    </div>
  );
} 