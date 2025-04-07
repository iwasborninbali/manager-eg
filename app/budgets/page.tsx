'use client';

import React, { useState, useEffect } from 'react';
import DepartmentInvoiceList, { DepartmentInvoice } from '@/components/budgets/DepartmentInvoiceList';
import UploadDepartmentInvoiceDialog from '@/components/budgets/UploadDepartmentInvoiceDialog';
import UploadDepartmentClosingDocDialog from '@/components/budgets/UploadDepartmentClosingDocDialog';
import InvoiceDetailsDialog, { Invoice } from '@/components/invoices/InvoiceDetailsDialog';
import { Button } from '@/components/ui/Button';
import { DocumentArrowUpIcon, DocumentPlusIcon, InboxArrowDownIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { Timestamp, collection, query, onSnapshot, orderBy, getDocs, where, documentId } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Interface for Department Closing Docs (match dialog)
interface DepartmentClosingDocument {
    id: string;
    departmentInvoiceId: string;
    fileName: string;
    fileURL: string;
    uploadedAt: Timestamp;
    comment?: string | null;
    type?: 'contract' | 'upd' | 'act' | 'other' | null;
    date?: Timestamp | null;
}

// Interface for Suppliers (simplified, match what's needed)
interface Supplier {
    id: string;
    name?: string;
}

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
  // --- State --- 
  const [departmentInvoices, setDepartmentInvoices] = useState<DepartmentInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<{ [id: string]: Supplier }>({});
  const [departmentClosingDocs, setDepartmentClosingDocs] = useState<DepartmentClosingDocument[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingClosingDocs, setLoadingClosingDocs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUploadInvoiceOpen, setIsUploadInvoiceOpen] = useState(false);
  const [isUploadClosingDocOpen, setIsUploadClosingDocOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null); 
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // --- Data Fetching --- 
  // Fetch Department Invoices
  useEffect(() => {
    setLoadingInvoices(true);
    setError(null);
    const q = query(collection(db, 'departmentInvoices'), orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const invoicesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepartmentInvoice));
        setDepartmentInvoices(invoicesData);
        setLoadingInvoices(false);
      }, 
      (err) => {
        console.error("Error fetching department invoices:", err);
        setError("Не удалось загрузить счета отдела.");
        setLoadingInvoices(false);
      }
    );
    return () => unsubscribe(); // Cleanup listener
  }, []);

  // Fetch Suppliers based on fetched invoices
  useEffect(() => {
    const fetchSuppliers = async () => {
      const supplierIds = new Set<string>();
      departmentInvoices.forEach(invoice => {
        if (invoice.supplierId) supplierIds.add(invoice.supplierId);
      });

      if (supplierIds.size === 0) {
          setLoadingSuppliers(false); return;
      }
      const neededSupplierIds = Array.from(supplierIds).filter(id => !suppliers[id]);
      if (neededSupplierIds.length === 0) {
          setLoadingSuppliers(false); return;
      }

      setLoadingSuppliers(true);
      try {
          // Fetch in chunks of 30 for 'in' query limit
          const supplierIdChunks = neededSupplierIds.reduce((acc, item, i) => {
              const chunkIndex = Math.floor(i / 30);
              if (!acc[chunkIndex]) { acc[chunkIndex] = []; }
              acc[chunkIndex].push(item);
              return acc;
          }, [] as string[][]);

          const fetchedSuppliersUpdate: Record<string, Supplier> = {};
          await Promise.all(supplierIdChunks.map(async (chunk) => {
              if (chunk.length === 0) return;
              const suppliersQuery = query(collection(db, 'suppliers'), where(documentId(), 'in', chunk));
              const supplierSnapshot = await getDocs(suppliersQuery);
              supplierSnapshot.forEach((doc) => {
                  fetchedSuppliersUpdate[doc.id] = { id: doc.id, name: doc.data().name, ...doc.data() } as Supplier;
              });
          }));
          setSuppliers(prevMap => ({ ...prevMap, ...fetchedSuppliersUpdate }));
      } catch (supplierError) {
          console.error("Error fetching suppliers: ", supplierError);
          setError(prev => prev ? `${prev} Ошибка загр. поставщиков.` : "Ошибка загр. поставщиков.");
      } finally {
          setLoadingSuppliers(false);
      }
    };

    if (!loadingInvoices && departmentInvoices.length > 0) {
         fetchSuppliers();
    } else if (departmentInvoices.length === 0) {
         setLoadingSuppliers(false);
    }

  }, [departmentInvoices, loadingInvoices, suppliers]); // Depend on invoices, loading state, and suppliers map

  // Fetch Department Closing Documents
  useEffect(() => {
    setLoadingClosingDocs(true);
    // Query all docs, filtering will happen when needed in InvoiceDetailsDialog
    const q = query(collection(db, 'departmentClosingDocuments'), orderBy('uploadedAt', 'desc')); 
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepartmentClosingDocument));
      setDepartmentClosingDocs(docsData);
      setLoadingClosingDocs(false);
    }, (err) => {
      console.error("Error fetching department closing documents:", err);
      setError(prev => prev ? `${prev} Ошибка загр. закр. док.` : "Ошибка загр. закр. док.");
      setLoadingClosingDocs(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Handlers --- 
  // Open details dialog (maps DepartmentInvoice to Invoice for the dialog)
  const handleInvoiceClick = (deptInvoice: DepartmentInvoice) => {
    const mappedInvoice = mapDeptInvoiceToInvoiceDetails(deptInvoice);
    setSelectedInvoice(mappedInvoice);
    setIsDetailsOpen(true);
  };
  // Close details dialog
  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedInvoice(null), 300);
  };
  // Open/Close Upload Invoice Dialog
  const handleOpenUploadInvoice = () => setIsUploadInvoiceOpen(true);
  const handleCloseUploadInvoice = () => setIsUploadInvoiceOpen(false);
  // Open/Close Upload Closing Doc Dialog
  const handleOpenUploadClosingDoc = () => setIsUploadClosingDocOpen(true);
  const handleCloseUploadClosingDoc = () => setIsUploadClosingDocOpen(false);
  
  // Success handler for closing doc upload (optional: show toast)
  const handleClosingDocUploadSuccess = (docIds: string[]) => {
      console.log("Department closing docs uploaded:", docIds);
      // Could show a success toast here
  };

  // --- Render --- 
  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 lg:p-12 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">Бюджет отдела</h1>
          {/* Action Buttons */}
          <div className="flex space-x-2">
              {/* Upload Closing Doc Button - Changed Icon */}
              <Button 
                 onClick={handleOpenUploadClosingDoc} 
                 variant="secondary" 
                 size="icon" 
                 title="Загрузить закрывающий документ отдела"
                 disabled={loadingInvoices || departmentInvoices.length === 0} // Disable if no invoices to attach to
              >
                 <span className="sr-only">Загрузить закрывающий документ отдела</span>
                 <PaperClipIcon className="h-5 w-5" />
              </Button>
              {/* Upload Invoice Button - Changed Icon */}
              <Button 
                 onClick={handleOpenUploadInvoice} 
                 variant="secondary" 
                 size="icon" 
                 title="Загрузить счет отдела"
              >
                 <span className="sr-only">Загрузить счет отдела</span>
                 <InboxArrowDownIcon className="h-5 w-5" />
              </Button>
           </div>
        </div>

        {/* Pass fetched data and click handler to DepartmentInvoiceList */}
        <div className="p-6 bg-white dark:bg-neutral-800 rounded-lg shadow">
          {loadingInvoices && <p className="text-center text-neutral-500">Загрузка счетов...</p>} 
          {error && <p className="text-center text-red-500">{error}</p>} 
          {!loadingInvoices && !error && (
            <DepartmentInvoiceList 
              onInvoiceClick={handleInvoiceClick} 
            />
          )}
        </div>
      </div>

      {/* Upload Invoice Dialog */}
      <UploadDepartmentInvoiceDialog
        isOpen={isUploadInvoiceOpen}
        onClose={handleCloseUploadInvoice}
      />
      
      {/* NEW Upload Department Closing Doc Dialog */}
      <UploadDepartmentClosingDocDialog
          isOpen={isUploadClosingDocOpen}
          onClose={handleCloseUploadClosingDoc}
          onSuccess={handleClosingDocUploadSuccess}
          departmentInvoices={departmentInvoices} // Pass fetched invoices
          suppliers={suppliers} // Pass suppliers map
      />

      {/* Invoice Details Dialog */}
      {selectedInvoice && (
        <InvoiceDetailsDialog
            isOpen={isDetailsOpen}
            onClose={handleCloseDetails}
            invoice={selectedInvoice}
            project={null} // Explicitly null for department invoices
            departmentClosingDocuments={departmentClosingDocs.filter(doc => doc.departmentInvoiceId === selectedInvoice.id)}
            loadingClosingDocs={loadingClosingDocs}
        />
      )}
    </main>
  );
}
