'use client'; // Add this if ProjectList uses client-side hooks

import React from 'react';
import ProjectList from '@/components/projects/ProjectList'; // Import the ProjectList component

export default function ProjectsPage() { // Rename function for clarity
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Проекты
      </h1>
      {/* Render the ProjectList component */}
      <ProjectList /> 
    </div>
  );
} 