'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
    XMarkIcon, 
    DocumentArrowUpIcon, 
    ClockIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    UserCircleIcon,
    DocumentArrowDownIcon
} from '@heroicons/react/24/solid';
import { collection, query, where, onSnapshot, orderBy, Timestamp, documentId, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import InvoiceDetailsDialog from '../invoices/InvoiceDetailsDialog';
import UploadInvoiceDialog from '../invoices/UploadInvoiceDialog';
import { InvoiceData } from '@/lib/invoiceSchema';

// --- Interfaces ---
interface Supplier {
  id: string;
  name?: string;
}

// Extend InvoiceData to ensure id is present if not implicitly included by schema inference
// (Alternatively, adjust schema or usage where id is needed)
interface Invoice extends InvoiceData {
    id: string;
}

// Add ClosingDocument interface
interface ClosingDocument {
    id: string;
    projectId: string;
    invoiceId: string;
    fileName: string;
    fileURL: string;
    uploadedAt: Timestamp;
    type?: 'contract' | 'upd' | 'act' | 'other';
    number?: string;
    date?: Timestamp;
    comment?: string;
}

// --- End Interfaces ---

// --- Helper Functions (Define locally) ---
// Accept Date or Timestamp for formatting
const formatDate = (dateOrTimestamp: Date | Timestamp | null | undefined): string => {
  if (!dateOrTimestamp) return 'N/A';
  // Convert Timestamp to Date if necessary
  const date = dateOrTimestamp instanceof Timestamp ? dateOrTimestamp.toDate() : dateOrTimestamp;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatCurrency = (amount: number | undefined | null, fallback: string = 'N/A'): string => {
    if (amount === undefined || amount === null) return fallback;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
};
const InvoiceStatusBadge: React.FC<{ status?: 'pending_payment' | 'paid' | 'overdue' | 'cancelled' }> = ({ status }) => {
  if (!status) return <span className="text-neutral-500">N/A</span>;
  const statusConfig = {
    pending_payment: { text: 'Ожидает оплаты', color: 'text-warning-700 dark:text-warning-300', icon: <ClockIcon className="h-3 w-3 inline-block mr-1" /> },
    paid: { text: 'Оплачен', color: 'text-success-700 dark:text-success-300', icon: <CheckCircleIcon className="h-3 w-3 inline-block mr-1" /> },
    overdue: { text: 'Просрочен', color: 'text-error-700 dark:text-error-300', icon: <ExclamationTriangleIcon className="h-3 w-3 inline-block mr-1" /> },
    cancelled: { text: 'Отменен', color: 'text-neutral-500 dark:text-neutral-400', icon: <XMarkIcon className="h-3 w-3 inline-block mr-1" /> }
  };
  const config = statusConfig[status];
  if (!config) return <span className="text-neutral-500">{status}</span>;
  return (
    <span className={cn('font-medium', config.color)}>
      {config.icon}
      {config.text}
    </span>
  );
};
// --- End Helper Functions ---

interface ProjectInvoicesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

const ProjectInvoicesDialog: React.FC<ProjectInvoicesDialogProps> = ({ isOpen, onClose, projectId, projectName }) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [supplierMap, setSupplierMap] = useState<{ [id: string]: Supplier }>({});
    const [allClosingDocs, setAllClosingDocs] = useState<ClosingDocument[]>([]); // State for ALL closing docs for the project
    const [loadingInvoices, setLoadingInvoices] = useState(true); // Renamed from loading
    const [loadingSuppliers, setLoadingSuppliers] = useState(false); // State for supplier loading
    const [loadingAllClosingDocs, setLoadingAllClosingDocs] = useState(true); // State for closing docs loading
    const [error, setError] = useState<string | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isUploadInvoiceOpen, setIsUploadInvoiceOpen] = useState(false);
    const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
    
    // Combined loading state might be useful later if needed
    const isLoading = loadingInvoices || loadingSuppliers; // Simplified loading for display
    const generalError = error;

    // Effect to fetch ONLY invoices
    useEffect(() => {
      let unsubscribeInvoices: (() => void) | null = null;
      
      const fetchData = async () => {
        setLoadingInvoices(true);
        setError(null);

        try {
          const invoicesRef = collection(db, 'invoices');
          const q = query(invoicesRef, where('projectId', '==', projectId), orderBy('uploadedAt', 'desc'));

          unsubscribeInvoices = onSnapshot(q,
            async (querySnapshot) => {
              const fetchedInvoices: Invoice[] = [];
              
              querySnapshot.forEach((doc) => {
                const data = doc.data();
                const invoiceItem: Invoice = {
                  id: doc.id,
                  projectId: data.projectId,
                  supplierId: data.supplierId,
                  amount: typeof data.amount === 'number' ? data.amount : 0,
                  status: data.status ?? 'pending_payment',
                  dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : undefined,
                  paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : undefined,
                  fileURL: data.fileURL ?? '',
                  fileName: data.fileName ?? '',
                  uploadedAt: data.uploadedAt instanceof Timestamp ? data.uploadedAt : Timestamp.now(),
                  comment: data.comment || null,
                  submitterUid: data.submitterUid ?? '',
                  submitterName: data.submitterName ?? '',
                  isUrgent: data.isUrgent ?? false,
                };

                if (invoiceItem.id && invoiceItem.projectId && invoiceItem.supplierId && invoiceItem.uploadedAt) {
                  fetchedInvoices.push(invoiceItem);
                } else {
                  console.warn("Skipping invoice item with missing essential data:", doc.id, data);
                }
              });
              
              setInvoices(fetchedInvoices); 
              setLoadingInvoices(false); // Invoices loaded (supplier loading handled separately)
            },
            (err) => { 
              console.error("Error fetching invoices snapshot: ", err);
              setError("Не удалось загрузить счета.");
              setLoadingInvoices(false);
            }
          );
        } catch (initialError) {
            console.error("Error setting up invoice listener: ", initialError);
            setError("Ошибка при настройке получения счетов.");
            setLoadingInvoices(false);
        }
      };

      if (isOpen && projectId) {
        fetchData();
      } else {
         setInvoices([]);
         setSupplierMap({});
         if (!isOpen) setLoadingInvoices(false);
         setError(null);
      }

      return () => {
          if (unsubscribeInvoices) {
            console.log("Unsubscribing from invoice listener");
            unsubscribeInvoices();
          }
      };
    }, [isOpen, projectId]); // REMOVED supplierMap dependency

    // Effect to fetch suppliers based on fetched invoices
    useEffect(() => {
        const fetchSuppliers = async () => {
            // 1. Get unique supplier IDs from current invoices
            const supplierIds = new Set<string>();
            invoices.forEach(invoice => {
                if (invoice.supplierId) {
                    supplierIds.add(invoice.supplierId);
                }
            });

            if (supplierIds.size === 0) {
                setLoadingSuppliers(false); // No suppliers to fetch
                return;
            }

            // 2. Identify which supplier IDs are missing from the current map
            const neededSupplierIds = Array.from(supplierIds).filter(id => !supplierMap[id]);

            if (neededSupplierIds.length === 0) {
                setLoadingSuppliers(false); // All needed suppliers are already loaded
                return;
            }

            // 3. Fetch missing suppliers
            setLoadingSuppliers(true);
            try {
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
                // Update state functionally to merge new suppliers with existing ones
                setSupplierMap(prevMap => ({ ...prevMap, ...fetchedSuppliersUpdate }));
            } catch (supplierError) {
                console.error("Error fetching suppliers: ", supplierError);
                setError(prev => prev ? `${prev} Ошибка загрузки поставщиков.` : "Ошибка загрузки поставщиков.");
            } finally {
                setLoadingSuppliers(false);
            }
        };

        // Only run if invoices have been loaded (or changed) and the dialog is open
        if (isOpen && !loadingInvoices && invoices.length > 0) {
             fetchSuppliers();
        } else if (invoices.length === 0) {
             // If invoices array becomes empty (e.g., project change), ensure loading stops
             setLoadingSuppliers(false);
        }

        // No cleanup needed here as getDocs is not a listener

    }, [invoices, isOpen, loadingInvoices, supplierMap]); // Depend on invoices array, isOpen, loadingInvoices status, and supplierMap

    // Effect to fetch ALL closing documents for the project
    useEffect(() => {
        let unsubscribeDocs: (() => void) | null = null;
        
        const fetchClosingDocs = () => {
            setLoadingAllClosingDocs(true);
            setAllClosingDocs([]); // Reset on fetch

            const docsRef = collection(db, 'closingDocuments');
            // Query for docs matching the projectId
            const q = query(docsRef, where('projectId', '==', projectId));

            unsubscribeDocs = onSnapshot(q,
                (querySnapshot) => {
                    const fetchedDocs: ClosingDocument[] = [];
                    querySnapshot.forEach((doc) => {
                        fetchedDocs.push({ id: doc.id, ...doc.data() } as ClosingDocument);
                    });
                    setAllClosingDocs(fetchedDocs);
                    setLoadingAllClosingDocs(false);
                },
                (err) => {
                    console.error("Error fetching closing documents snapshot: ", err);
                    setError(prev => prev ? `${prev} Ошибка загрузки закр. док.` : "Ошибка загрузки закр. док.");
                    setLoadingAllClosingDocs(false);
                }
            );
        };

        if (isOpen && projectId) {
            fetchClosingDocs();
        } else {
            setAllClosingDocs([]);
            setLoadingAllClosingDocs(false); // Ensure loading stops if closed early
        }

        // Cleanup function
        return () => {
            if (unsubscribeDocs) {
                console.log("Unsubscribing from closing documents listener");
                unsubscribeDocs();
            }
        };
    }, [isOpen, projectId]); // Depend on isOpen and projectId - This seems correct

    const handleInvoiceClick = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setIsInvoiceDetailsOpen(true);
    };
    const handleCloseInvoiceDetails = () => {
        setIsInvoiceDetailsOpen(false);
        setTimeout(() => setSelectedInvoice(null), 300); // Delay reset for transition
    };
    const handleOpenUploadInvoice = () => {
        setIsUploadInvoiceOpen(true);
    };
    const handleCloseUploadInvoice = () => {
        setIsUploadInvoiceOpen(false);
    };
    const handleUploadInvoiceSuccess = (invoiceId: string) => {
        console.log(`Invoice ${invoiceId} uploaded successfully.`);
        // Optionally trigger a re-fetch or show notification
    };

    // Simplified close handler
    const handleClose = () => {
        // Allow closing even if loading, cleanup effects handle stopping fetches
        onClose();
        // State reset is handled by the main useEffect when isOpen becomes false
    };

    return (
    <>
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[51]" onClose={handleClose}>
                {/* Overlay */}
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        {/* Panel */}
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                                {/* Title and Actions */} 
                                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center mb-4">
                                    <span>Счета: {projectName || 'Загрузка...'}</span>
                                    <div className="flex items-center space-x-2">
                                        {/* Icon-only Upload Button */}
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            onClick={handleOpenUploadInvoice}
                                            title="Добавить счет"
                                            disabled={isLoading}
                                        >
                                            <span className="sr-only">Добавить счет</span>
                                            <DocumentArrowUpIcon className="h-5 w-5" />
                                        </Button>
                                        {/* Close Button */} 
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-neutral-500 dark:text-neutral-400"
                                            onClick={handleClose}
                                            aria-label="Закрыть"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </Dialog.Title>

                                {/* Invoice List Area */} 
                                <div className="min-h-[400px] border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                    {/* Loading State */}
                                    {isLoading && <p className="text-sm text-center py-4 text-neutral-500 dark:text-neutral-400">Загрузка данных...</p>}
                                    {/* Error State */} 
                                    {generalError && <p className="text-sm text-center py-4 text-error-600 dark:text-error-400">{generalError}</p>}
                                    
                                    {/* Content Area */} 
                                    {!isLoading && !generalError && (
                                        invoices.length > 0 ? (
                                            <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                {invoices.map((invoice) => {
                                                    const supplierName = invoice.supplierId ? (supplierMap[invoice.supplierId]?.name || (loadingSuppliers ? 'Загрузка...' : 'Поставщик?' )) : 'Не указан';
                                                    // Get associated closing documents count for this invoice
                                                    const closingDocsCount = allClosingDocs.filter(doc => doc.invoiceId === invoice.id).length;

                                                    return (
                                                        <li 
                                                           key={invoice.id} 
                                                           className="py-3 px-4 bg-white dark:bg-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-700/60 transition-colors duration-150 group shadow-sm cursor-pointer"
                                                           onClick={() => handleInvoiceClick(invoice)}
                                                           title="Посмотреть детали счета"
                                                        >
                                                            <div className="flex items-start justify-between flex-wrap gap-2">
                                                                {/* Invoice Main Info */} 
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400" title={supplierName}>{supplierName}</p>
                                                                    <p className="text-base font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
                                                                        {formatCurrency(invoice.amount)}
                                                                    </p>
                                                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                                        Статус: <InvoiceStatusBadge status={invoice.status} /> | Срок: {formatDate(invoice.dueDate)}
                                                                    </p>
                                                                    <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center mt-1.5" title={`Загружен: ${formatDate(invoice.uploadedAt)} пользователем ${invoice.submitterName || 'Неизвестно'}`}>
                                                                        <UserCircleIcon className="h-3.5 w-3.5 mr-1 text-neutral-400"/> 
                                                                        <span className="truncate">{invoice.submitterName || 'Неизвестно'}</span>
                                                                    </div>
                                                                    {invoice.comment && (
                                                                        <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400 italic truncate" title={invoice.comment}>Комм: {invoice.comment}</p>
                                                                    )}
                                                                    {/* Closing Docs Indicator */} 
                                                                    {loadingAllClosingDocs ? (
                                                                        <span className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500 block">Загрузка док...</span>
                                                                    ) : closingDocsCount > 0 && (
                                                                        <span className="mt-1.5 text-xs text-success-600 dark:text-success-400 font-medium block">Есть закр. док. ({closingDocsCount})</span>
                                                                    )}
                                                                </div>
                                                                {/* Actions (Download & Details Button) */} 
                                                                <div className="flex-shrink-0 flex flex-col items-end space-y-1">
                                                                     {invoice.fileURL && (
                                                                        <a 
                                                                            href={invoice.fileURL} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            onClick={(e) => e.stopPropagation()} // Prevent li click
                                                                            className="p-1.5 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-blue-100 dark:hover:bg-neutral-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                                            title={`Скачать ${invoice.fileName || 'файл'}`}
                                                                        >
                                                                            <DocumentArrowDownIcon className="h-5 w-5" /> 
                                                                        </a>
                                                                    )}
                                                                    {/* Optional: Add a dedicated details button if needed, though the whole item is clickable */} 
                                                                    {/* <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleInvoiceClick(invoice); }}><ChevronRightIcon className="h-4 w-4" /></Button> */} 
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-center py-4 text-neutral-500 dark:text-neutral-400">Счетов по этому проекту пока нет.</p>
                                        )
                                    )}
                                </div>

                                {/* Footer Close Button */}
                                <div className="mt-6 flex justify-end border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                    <Button type="button" variant="outline" onClick={handleClose} >
                                        Закрыть
                                    </Button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
        
        {/* Invoice Details Dialog */} 
        {selectedInvoice && (
            <InvoiceDetailsDialog 
                isOpen={isInvoiceDetailsOpen}
                onClose={handleCloseInvoiceDetails}
                invoice={{
                    ...selectedInvoice,
                    dueDate: selectedInvoice.dueDate instanceof Date ? Timestamp.fromDate(selectedInvoice.dueDate) : undefined,
                    comment: selectedInvoice.comment ?? undefined,
                }}
                project={{id: projectId, name: projectName}} 
                // Filter and pass closing documents for the selected invoice
                closingDocuments={allClosingDocs.filter(doc => doc.invoiceId === selectedInvoice.id)}
                loadingClosingDocs={loadingAllClosingDocs} // Pass the loading state
            />
        )}
        {/* Invoice Upload Dialog */} 
        {isUploadInvoiceOpen && projectId && (
            <UploadInvoiceDialog 
                isOpen={isUploadInvoiceOpen}
                onClose={handleCloseUploadInvoice}
                onSuccess={handleUploadInvoiceSuccess}
                projectId={projectId} // Pass projectId
            />
        )}
    </>
    );
};

export default ProjectInvoicesDialog; 