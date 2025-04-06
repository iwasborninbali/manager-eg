'use client';

import React, { useState } from 'react';
import DepartmentInvoiceList, { DepartmentInvoice } from '@/components/budgets/DepartmentInvoiceList'; // Import interface
import UploadDepartmentInvoiceDialog from '@/components/budgets/UploadDepartmentInvoiceDialog';
import InvoiceDetailsDialog, { Invoice } from '@/components/invoices/InvoiceDetailsDialog'; // Revert Import
import { Button } from '@/components/ui/Button';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Updated mapping function to return the imported Invoice type (or null)
const mapDeptInvoiceToInvoiceDetails = (deptInvoice: DepartmentInvoice): Invoice | null => {
    if (!deptInvoice) return null;

    // Ensure the status is one of the allowed values or undefined
    const validStatuses = ['pending_payment', 'paid', 'overdue', 'cancelled'];
    const mappedStatus = validStatuses.includes(deptInvoice.status ?? '') 
        ? deptInvoice.status as Invoice['status'] // Cast if valid
        : undefined; // Default to undefined if not valid

    return {
        id: deptInvoice.id, // Assuming DepartmentInvoice has id
        amount: deptInvoice.amount,
        supplierId: deptInvoice.supplierId,
        status: mappedStatus,
        dueDate: deptInvoice.dueDate instanceof Timestamp ? deptInvoice.dueDate : undefined,
        fileURL: deptInvoice.fileURL,
        fileName: deptInvoice.fileName,
        uploadedAt: deptInvoice.uploadedAt instanceof Timestamp ? deptInvoice.uploadedAt : Timestamp.now(),
        comment: deptInvoice.comment ?? undefined, // Map null comment to undefined
        // Fields required by Invoice interface but not directly in DepartmentInvoice
        projectId: undefined, // Department invoices don't belong to a project
        // Need to check Invoice type definition for other required fields
    };
};


export default function DepartmentBudgetsPage() {
  // State for upload dialog
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // State for Invoice Details - use the imported Invoice type
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null); 
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
            project={null} // Pass null explicitly
            closingDocuments={[]} // Pass empty array explicitly
            loadingClosingDocs={false}
        />
      )}
    </main>
  );
}
