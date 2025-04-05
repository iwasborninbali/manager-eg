'use client';

import React, { useState } from 'react';
// Import necessary components
import DepartmentInvoiceList from '@/components/budgets/DepartmentInvoiceList';
import UploadDepartmentInvoiceDialog from '@/components/budgets/UploadDepartmentInvoiceDialog';
import { Button } from '@/components/ui/Button';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';

export default function DepartmentBudgetsPage() {
  // State for upload dialog
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 lg:p-12 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">Бюджет отделов</h1>
          {/* Add Upload Button */}
          <Button onClick={() => setIsUploadOpen(true)} variant="default" size="sm">
             <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
            Загрузить счет отдела
          </Button> 
        </div>

        {/* Render DepartmentInvoiceList */}
        <div className="p-6 bg-white dark:bg-neutral-800 rounded-lg shadow">
          <DepartmentInvoiceList />
        </div>
      </div>

      {/* Upload Dialog */}
      <UploadDepartmentInvoiceDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
    </main>
  );
} 