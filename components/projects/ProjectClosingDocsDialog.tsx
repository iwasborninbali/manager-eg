'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentArrowDownIcon, DocumentArrowUpIcon, InboxIcon } from '@heroicons/react/24/solid';
import { Timestamp, collection, query, where, onSnapshot, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import UploadClosingDocumentDialog from '../documents/UploadClosingDocumentDialog';

// --- Interfaces (Copied/Adapted) ---
interface Invoice {
    id: string;
    projectId: string;
    supplierId?: string;
    // Minimal fields needed for context
}

interface Supplier {
  id: string;
  name?: string;
}

interface ClosingDocument {
  id: string;
  projectId: string;
  invoiceId?: string; // Might be optional if doc applies to whole project?
  fileName: string;
  fileURL: string;
  uploadedAt: Timestamp;
  type?: 'contract' | 'upd' | 'act' | 'other';
  number?: string;
  date?: Timestamp;
  comment?: string;
}
// --- End Interfaces ---

// --- Helper Functions ---
const formatDate = (timestamp: Timestamp | undefined, fallback = 'N/A'): string => {
  if (!timestamp) return fallback;
  return timestamp.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
// --- End Helper Functions ---

interface ProjectClosingDocsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName?: string;
}

// Group documents by invoice ID
interface GroupedDocuments {
    [invoiceId: string]: ClosingDocument[];
}

const ProjectClosingDocsDialog: React.FC<ProjectClosingDocsDialogProps> = ({
    isOpen,
    onClose,
    projectId,
    projectName
}) => {
    // State for data
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [supplierMap, setSupplierMap] = useState<{ [id: string]: Supplier }>({});
    const [documents, setDocuments] = useState<ClosingDocument[]>([]); // Store as flat array initially
    const [groupedDocuments, setGroupedDocuments] = useState<GroupedDocuments>({}); // Store grouped docs

    // State for loading/error
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [errorDocs, setErrorDocs] = useState<string | null>(null);
    const [loadingInvoices, setLoadingInvoices] = useState(false); // Need invoices for context
    const [loadingSuppliers, setLoadingSuppliers] = useState(false); // Need suppliers for context

    // State for nested upload dialog
    const [isUploadClosingDocOpen, setIsUploadClosingDocOpen] = useState(false);

    const isLoading = loadingDocs || loadingInvoices || loadingSuppliers;

    // --- Data Fetching Effects ---
    // Fetch Invoices (for context)
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        if (isOpen && projectId) {
            setLoadingInvoices(true);
            const invoicesRef = collection(db, 'invoices');
            const q = query(invoicesRef, where('projectId', '==', projectId));
            unsubscribe = onSnapshot(q, snapshot => {
                const fetchedInvoices: Invoice[] = [];
                snapshot.forEach(doc => fetchedInvoices.push({ id: doc.id, ...doc.data() } as Invoice));
                setInvoices(fetchedInvoices);
                setLoadingInvoices(false);
            }, error => {
                console.error("Error fetching invoices for closing docs dialog:", error);
                setLoadingInvoices(false);
            });
        } else {
            setInvoices([]);
            if (!isOpen) setLoadingInvoices(false);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [isOpen, projectId]);

    // Fetch Suppliers (for context)
    useEffect(() => {
        if (invoices.length === 0) {
            setSupplierMap({}); return;
        }
        const fetchSuppliers = async () => {
            setLoadingSuppliers(true);
            const supplierIds = Array.from(new Set(invoices.map(inv => inv.supplierId).filter(id => id && !supplierMap[id]))); 
            if (supplierIds.length === 0) { setLoadingSuppliers(false); return; }
            try {
                const limitedIds = supplierIds.slice(0, 30);
                const q = query(collection(db, 'suppliers'), where(documentId(), 'in', limitedIds)); 
                const snapshot = await getDocs(q);
                const fetched: { [id: string]: Supplier } = {};
                snapshot.forEach(doc => fetched[doc.id] = { id: doc.id, ...doc.data() } as Supplier);
                setSupplierMap(prev => ({ ...prev, ...fetched }));
            } catch (error) { console.error("Error fetching suppliers for closing docs dialog:", error); }
            finally { setLoadingSuppliers(false); }
        };
        fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoices]); // Removed supplierMap from dependencies to prevent infinite loop. The effect logic correctly uses the current supplierMap state to fetch only missing suppliers.

    // Fetch Closing Documents
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        if (isOpen && projectId) {
            setLoadingDocs(true);
            setErrorDocs(null);
            const docsRef = collection(db, 'closingDocuments');
            const q = query(docsRef, where('projectId', '==', projectId));
            unsubscribe = onSnapshot(q, snapshot => {
                const fetchedDocs: ClosingDocument[] = [];
                snapshot.forEach(doc => fetchedDocs.push({ id: doc.id, ...doc.data() } as ClosingDocument));
                // Sort documents (e.g., by upload date)
                fetchedDocs.sort((a, b) => (b.uploadedAt?.toMillis() ?? 0) - (a.uploadedAt?.toMillis() ?? 0));
                setDocuments(fetchedDocs);
                setLoadingDocs(false);
            }, error => {
                console.error("Error fetching closing documents:", error);
                setErrorDocs("Не удалось загрузить документы.");
                setLoadingDocs(false);
            });
        } else {
            setDocuments([]);
            if (!isOpen) setLoadingDocs(false);
            setErrorDocs(null);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [isOpen, projectId]);

    // Group documents by invoiceId whenever documents or invoices change
    useEffect(() => {
        const grouped: GroupedDocuments = {};
        // Initialize keys based on fetched invoices to show invoices even without docs
        invoices.forEach(inv => {
            grouped[inv.id] = [];
        });
        // Populate with actual documents
        documents.forEach(doc => {
            if (doc.invoiceId) {
                if (!grouped[doc.invoiceId]) {
                    // This case might happen if an invoice was deleted but docs remained
                    // Decide how to handle: create the key or ignore the doc?
                    // For now, let's create the key to show the doc
                    grouped[doc.invoiceId] = []; 
                }
                grouped[doc.invoiceId].push(doc);
            } else {
                // Handle documents without invoiceId (e.g., general project docs)
                 if (!grouped['__general__']) { grouped['__general__'] = []; }
                 grouped['__general__'].push(doc);
            }
        });
        setGroupedDocuments(grouped);
    }, [documents, invoices]);

    // --- Handlers --- 
    const handleOpenUploadClosingDoc = () => {
        setIsUploadClosingDocOpen(true);
    };
    const handleCloseUploadClosingDoc = () => {
        setIsUploadClosingDocOpen(false);
    };
    const handleUploadClosingDocSuccess = (docIds: string[]) => {
        console.log(`Closing documents ${docIds.join(', ')} uploaded.`);
        handleCloseUploadClosingDoc(); 
    };

    const handleClose = () => {
        if (isLoading) return;
        onClose();
        // Reset state
        setInvoices([]);
        setSupplierMap({});
        setDocuments([]);
        setGroupedDocuments({});
        setErrorDocs(null);
        setLoadingDocs(false);
        setLoadingInvoices(false);
        setLoadingSuppliers(false);
        setIsUploadClosingDocOpen(false);
    };

    // Get invoice details for display
    const getInvoiceContext = (invoiceId: string): { supplierName: string | null, invoiceIdentifier: string } => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (!invoice) return { supplierName: null, invoiceIdentifier: `Счет ID: ${invoiceId}` };
        const supplierName = invoice.supplierId ? supplierMap[invoice.supplierId]?.name : null;
        return {
            supplierName: supplierName ?? (loadingSuppliers ? '...' : 'Поставщик?'),
            invoiceIdentifier: supplierName ? `${supplierName}` : `Счет ID: ${invoiceId.substring(0, 5)}...`
        }
    };

    return (
        <>
            <Transition appear show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[52]" onClose={handleClose}> {/* Higher z-index */}
                    {/* Overlay */}
                    <Transition.Child /* ... */ >
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                    </Transition.Child>

                    {/* Dialog Content */}
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child /* ... */ >
                                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                                    {/* Title */} 
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                                        <span>Закр. документы: {projectName || projectId || '...'}</span>
                                        <div className="flex items-center space-x-1">
                                            {/* Icon-only Upload Button */}
                                            <Button variant="secondary" size="icon" onClick={handleOpenUploadClosingDoc} disabled={isLoading} title="Загрузить документ">
                                                <span className="sr-only">Загрузить документ</span>
                                                <DocumentArrowUpIcon className="h-5 w-5"/>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-neutral-500 dark:text-neutral-400"
                                                onClick={handleClose}
                                                disabled={isLoading}
                                                aria-label="Закрыть"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </Dialog.Title>

                                    {/* Main Content */}
                                    <div className="mt-4 min-h-[400px] border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                        {isLoading && <p className="text-sm text-center py-4 text-neutral-500 dark:text-neutral-400">Загрузка документов...</p>}
                                        {errorDocs && <p className="text-sm text-center py-4 text-error-600 dark:text-error-400">{errorDocs}</p>}
                                        
                                        {!isLoading && !errorDocs && Object.keys(groupedDocuments).length === 0 && (
                                            <p className="text-sm text-center py-4 text-neutral-500 dark:text-neutral-400">Документы не найдены.</p>
                                        )}

                                        {!isLoading && !errorDocs && Object.keys(groupedDocuments).length > 0 && (
                                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                {/* General Documents Card */} 
                                                {groupedDocuments['__general__']?.length > 0 && (
                                                    <Card className="mb-4 bg-neutral-50 dark:bg-neutral-900/50 shadow-sm">
                                                        <CardHeader className="p-3 pb-2 border-b dark:border-neutral-700">
                                                            <CardTitle className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Общие документы проекта</CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="p-3">
                                                            <ul className="space-y-1.5 text-xs">
                                                                {groupedDocuments['__general__'].map(doc => (
                                                                    <li key={doc.id} className="flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-700/40 p-1 rounded">
                                                                        <span className="flex-1 min-w-0 truncate mr-2" title={`${doc.fileName} (Загружен: ${formatDate(doc.uploadedAt)})`}>
                                                                            {doc.fileName} <span className="text-neutral-500 text-[11px]">({formatDate(doc.uploadedAt)})</span>
                                                                        </span>
                                                                        <a href={doc.fileURL} target="_blank" rel="noopener noreferrer" className="ml-2 p-1 rounded-full text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/50" title="Скачать">
                                                                            <DocumentArrowDownIcon className="h-4 w-4" />
                                                                        </a>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </CardContent>
                                                    </Card>
                                                )}
                                                
                                                {/* Invoice-Specific Documents Cards */} 
                                                {Object.entries(groupedDocuments).filter(([key]) => key !== '__general__').map(([invoiceId, docs]) => {
                                                    const { invoiceIdentifier } = getInvoiceContext(invoiceId);
                                                    return (
                                                        <Card key={invoiceId} className="bg-white dark:bg-neutral-800/80 shadow-sm">
                                                             <CardHeader className="p-3 pb-2 border-b dark:border-neutral-700">
                                                                <CardTitle className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center">
                                                                    <InboxIcon className="h-4 w-4 inline mr-1.5 opacity-70"/> Счет: {invoiceIdentifier}
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="p-3">
                                                                {docs.length > 0 ? (
                                                                    <ul className="space-y-1.5 text-xs">
                                                                        {docs.map(doc => (
                                                                            <li key={doc.id} className="flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-700/40 p-1 rounded">
                                                                                <span className="flex-1 min-w-0 truncate mr-2" title={`${doc.fileName} (Загружен: ${formatDate(doc.uploadedAt)})`}>
                                                                                   {doc.fileName} <span className="text-neutral-500 text-[11px]">({formatDate(doc.uploadedAt)})</span>
                                                                                </span>
                                                                                <a href={doc.fileURL} target="_blank" rel="noopener noreferrer" className="ml-2 p-1 rounded-full text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/50" title="Скачать">
                                                                                    <DocumentArrowDownIcon className="h-4 w-4" />
                                                                                </a>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 py-1">Нет документов для этого счета.</p>
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */} 
                                    <div className="mt-6 flex justify-end space-x-3 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                        <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                                            Закрыть
                                        </Button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
            
            {/* Render Nested Upload Dialog */}
            {projectId && (
                <UploadClosingDocumentDialog 
                    isOpen={isUploadClosingDocOpen}
                    onClose={handleCloseUploadClosingDoc}
                    onSuccess={handleUploadClosingDocSuccess}
                    projectId={projectId} 
                    invoices={invoices} 
                    suppliers={supplierMap} 
                /> 
            )}
        </>
    );
};

export default ProjectClosingDocsDialog; 