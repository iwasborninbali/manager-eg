'use client';

import React, { useState } from 'react';
import DepartmentInvoiceList, { DepartmentInvoice } from '@/components/budgets/DepartmentInvoiceList'; // Import interface
import UploadDepartmentInvoiceDialog from '@/components/budgets/UploadDepartmentInvoiceDialog';
import InvoiceDetailsDialog from '@/components/invoices/InvoiceDetailsDialog'; // Import Invoice Details Dialog
import { Button } from '@/components/ui/Button';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Simple mapping function (adjust based on actual DepartmentInvoice structure)
const mapDeptInvoiceToInvoiceDetails = (deptInvoice: DepartmentInvoice): any /* Use a specific type if possible */ => {
    if (!deptInvoice) return null;
    // Map fields from DepartmentInvoice to what InvoiceDetailsDialog expects
    // This is a placeholder, adjust according to your actual data structure
    return {
        id: deptInvoice.id,
        amount: deptInvoice.amount,
        supplierId: deptInvoice.supplierId, // Assuming supplierId exists
        status: deptInvoice.status ?? 'pending_payment', // Map status or use default
        dueDate: deptInvoice.dueDate instanceof Timestamp ? deptInvoice.dueDate : undefined,
        fileURL: deptInvoice.fileURL,
        fileName: deptInvoice.fileName,
        uploadedAt: deptInvoice.uploadedAt instanceof Timestamp ? deptInvoice.uploadedAt : Timestamp.now(), // Provide default if needed
        comment: deptInvoice.comment,
        // project details might be null or fetched separately if needed
        project: null,
        // closingDocuments need to be fetched separately if you want to show them here
        closingDocuments: [],
        // Add other necessary fields from Invoice interface
    };
};


export default function DepartmentBudgetsPage() {
  // State for upload dialog
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // State for Invoice Details
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null); // Use 'any' or a more specific type
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Handler to open details dialog
  const handleInvoiceClick = (invoice: DepartmentInvoice) => {
    const mappedInvoice = mapDeptInvoiceToInvoiceDetails(invoice);
    setSelectedInvoice(mappedInvoice);
    setIsDetailsOpen(true);
  };

  // Handler to close details dialog
  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedInvoice(null), 300); // Delay for transition
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 lg:p-12 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">Бюджет отделов</h1>
          {/* Icon-only Upload Button */}
          <Button onClick={() => setIsUploadOpen(true)} variant="secondary" size="icon" title="Загрузить счет отдела">
             <span className="sr-only">Загрузить счет отдела</span>
             <DocumentArrowUpIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Pass click handler to DepartmentInvoiceList */}
        <div className="p-6 bg-white dark:bg-neutral-800 rounded-lg shadow">
          <DepartmentInvoiceList onInvoiceClick={handleInvoiceClick} />
        </div>
      </div>

      {/* Upload Dialog */}
      <UploadDepartmentInvoiceDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      {/* Invoice Details Dialog */}
      {selectedInvoice && (
        <InvoiceDetailsDialog
            isOpen={isDetailsOpen}
            onClose={handleCloseDetails}
            invoice={selectedInvoice}
            project={selectedInvoice.project} // Pass project details if mapped
            // Pass closing docs and loading state if fetched/mapped
            closingDocuments={selectedInvoice.closingDocuments}
            loadingClosingDocs={false} // Assuming not loaded here for now
        />
      )}
    </main>
  );
}
