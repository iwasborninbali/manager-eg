'use client';

import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, LinkIcon, CalendarDaysIcon, UserCircleIcon, CurrencyDollarIcon, DocumentTextIcon, PresentationChartLineIcon, UserIcon as SolidUserIcon, DocumentArrowDownIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, PlusCircleIcon, PencilSquareIcon } from '@heroicons/react/24/solid';
import { Timestamp, doc, getDoc, collection, query, where, onSnapshot, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import InvoiceDetailsDialog from '../invoices/InvoiceDetailsDialog';
import EditProjectDialog from './EditProjectDialog';
import UploadInvoiceDialog from '../invoices/UploadInvoiceDialog';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import UploadClosingDocumentDialog from '../documents/UploadClosingDocumentDialog';

// Re-define Project interface (or import from a shared types file if you have one)
interface Project {
  id: string;
  budget?: number;
  createdAt?: Timestamp;
  customer?: string;
  duedate?: Timestamp;
  estimatecostlink?: string;
  managerid?: string;
  name?: string;
  number?: string;
  planned_revenue?: number;
  presentationlink?: string;
  status?: string;
  updatedAt?: Timestamp;
}

// Define Invoice interface
interface Invoice {
  id: string;
  amount?: number;
  dueDate?: Timestamp;
  fileURL?: string;
  fileName?: string;
  status?: 'pending_payment' | 'paid' | 'overdue' | 'cancelled';
  supplierId?: string;
  uploadedAt?: Timestamp;
  projectId?: string;
  comment?: string;
}

// Define Supplier interface
interface Supplier {
  id: string;
  name?: string;
  tin?: string;
}

// Define ClosingDocument interface (copy from previous step or define here)
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

interface ProjectDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

// Helper functions
const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
};

// Status badge mapping for Projects
const projectStatusColors: { [key: string]: string } = {
  planning: 'bg-info-100 text-info-700 dark:bg-info-900/50 dark:text-info-300',
  active: 'bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-300',
  completed: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  on_hold: 'bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300',
  cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/50 dark:text-error-300',
};

const DetailItem: React.FC<{ label: string; value?: string | number | React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div>
    <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center">
      {icon && <span className="mr-2 h-4 w-4 flex-shrink-0">{icon}</span>}
      {label}
    </dt>
    <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100 sm:col-span-2 sm:mt-0 break-words">
      {value ?? 'N/A'}
    </dd>
  </div>
);

const ProjectDetailsDialog: React.FC<ProjectDetailsDialogProps> = ({ isOpen, onClose, project }) => {
  const [managerName, setManagerName] = useState<string | null>(null);
  const [loadingManager, setLoadingManager] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [errorInvoices, setErrorInvoices] = useState<string | null>(null);

  // State for Supplier Data Cache
  const [supplierMap, setSupplierMap] = useState<{ [id: string]: Supplier }>({});
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // State for Invoice Details Dialog
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // State for Edit Project Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // State for Upload Invoice Dialog
  const [isUploadInvoiceOpen, setIsUploadInvoiceOpen] = useState(false);

  // State for Closing Documents
  const [closingDocuments, setClosingDocuments] = useState<{ [invoiceId: string]: ClosingDocument[] }>({});
  const [loadingClosingDocs, setLoadingClosingDocs] = useState(false);
  const [errorClosingDocs, setErrorClosingDocs] = useState<string | null>(null);

  // Calculate budget information
  const budgetInfo = useMemo(() => {
    if (!project) return { budget: 0, spent: 0, remaining: 0 };

    const projectBudget = project.budget ?? 0;
    const spentAmount = invoices
      .filter(inv => inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

    const remainingAmount = projectBudget - spentAmount;

    return {
      budget: projectBudget,
      spent: spentAmount,
      remaining: remainingAmount,
    };
  }, [project, invoices]);

  useEffect(() => {
    const fetchManagerName = async () => {
      if (project?.managerid) {
        setLoadingManager(true);
        setManagerName(null);
        try {
          const userDocRef = doc(db, 'users', project.managerid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const managerData = docSnap.data();
            const name = managerData.first_name && managerData.last_name 
                          ? `${managerData.first_name} ${managerData.last_name}`
                          : managerData.displayName;
            setManagerName(name || 'Имя не найдено');
          } else {
            setManagerName('Менеджер не найден');
          }
        } catch (error) {
          console.error("Error fetching manager name: ", error);
          setManagerName('Ошибка загрузки');
        } finally {
          setLoadingManager(false);
        }
      } else {
        setManagerName(null);
      }
    };

    if (isOpen && project) {
      fetchManagerName();
    }
  }, [isOpen, project]);

  useEffect(() => {
    let unsubscribeInvoices: (() => void) | null = null;
    if (isOpen && project?.id) {
      setLoadingInvoices(true);
      setErrorInvoices(null);
      setInvoices([]);
      setSupplierMap({}); // Clear supplier map when project changes

      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('projectId', '==', project.id));

      unsubscribeInvoices = onSnapshot(q,
        (querySnapshot) => {
          const fetchedInvoices: Invoice[] = [];
          querySnapshot.forEach((doc) => {
            fetchedInvoices.push({ id: doc.id, ...doc.data() } as Invoice);
          });
          setInvoices(fetchedInvoices);
          setLoadingInvoices(false);
          // Supplier fetching will be triggered by the invoices state change below
        },
        (error) => {
          console.error("Error fetching invoices: ", error);
          setErrorInvoices("Не удалось загрузить счета.");
          setLoadingInvoices(false);
        }
      );
    } else {
      setInvoices([]);
      setLoadingInvoices(false);
      setErrorInvoices(null);
      setSupplierMap({});
    }
    // Cleanup invoice subscription
    return () => {
        if (unsubscribeInvoices) unsubscribeInvoices();
    };
  }, [isOpen, project?.id]);

  // useEffect for fetching Supplier data based on loaded invoices
  useEffect(() => {
    if (invoices.length === 0) {
        setSupplierMap({}); // Clear map if no invoices
        return;
    }

    const fetchSuppliers = async () => {
        setLoadingSuppliers(true);
        // Get unique, non-empty IDs not already in map
        const supplierIds = Array.from(new Set(invoices.map(inv => inv.supplierId).filter(id => id && !supplierMap[id]))); 
        
        if (supplierIds.length === 0) {
            setLoadingSuppliers(false);
            return; // All needed suppliers are already loaded
        }

        console.log("Fetching suppliers for IDs:", supplierIds);

        try {
            if (supplierIds.length > 30) {
                console.warn("Fetching more than 30 suppliers, consider pagination.");
            }
            const limitedIds = supplierIds.slice(0, 30);

            const suppliersRef = collection(db, 'suppliers');
            const q = query(suppliersRef, where(documentId(), 'in', limitedIds)); 
            const querySnapshot = await getDocs(q);
            
            const fetchedSuppliers: { [id: string]: Supplier } = {};
            querySnapshot.forEach((doc) => {
                fetchedSuppliers[doc.id] = { id: doc.id, ...doc.data() } as Supplier;
            });

            setSupplierMap(prevMap => ({ ...prevMap, ...fetchedSuppliers }));

        } catch (error) {
            console.error("Error fetching suppliers:", error);
        } finally {
            setLoadingSuppliers(false);
        }
    };

    fetchSuppliers();

  }, [invoices, supplierMap]); // Added supplierMap dependency

  // Effect for fetching Closing Documents based on Project ID
  useEffect(() => {
    let unsubscribeDocs: (() => void) | null = null;
    if (isOpen && project?.id) {
        setLoadingClosingDocs(true);
        setErrorClosingDocs(null);
        setClosingDocuments({}); // Clear existing docs

        const docsRef = collection(db, 'closingDocuments');
        const q = query(docsRef, where('projectId', '==', project.id));

        unsubscribeDocs = onSnapshot(q,
            (querySnapshot) => {
                const fetchedDocs: { [invoiceId: string]: ClosingDocument[] } = {};
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() } as ClosingDocument;
                    if (data.invoiceId) {
                        if (!fetchedDocs[data.invoiceId]) {
                            fetchedDocs[data.invoiceId] = [];
                        }
                        fetchedDocs[data.invoiceId].push(data);
                        // Optional: Sort documents by upload date or document date
                        fetchedDocs[data.invoiceId].sort((a, b) => (b.uploadedAt?.toMillis() ?? 0) - (a.uploadedAt?.toMillis() ?? 0));
                    }
                });
                setClosingDocuments(fetchedDocs);
                setLoadingClosingDocs(false);
            },
            (error) => {
                console.error("Error fetching closing documents: ", error);
                setErrorClosingDocs("Не удалось загрузить закрывающие документы.");
                setLoadingClosingDocs(false);
            }
        );
    } else {
        setClosingDocuments({});
        setLoadingClosingDocs(false);
        setErrorClosingDocs(null);
    }

    // Cleanup subscription
    return () => {
        if (unsubscribeDocs) unsubscribeDocs();
    };
}, [isOpen, project?.id]);

  // Handlers for Invoice Details Dialog
  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
  };

  const handleCloseInvoiceDetails = () => {
    setIsInvoiceDetailsOpen(false);
    setTimeout(() => setSelectedInvoice(null), 300);
  };

  // Handlers for Edit Project Dialog
  const handleOpenEditDialog = () => {
    setIsEditDialogOpen(true);
  };
  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    // Data should refetch automatically if ProjectList uses onSnapshot
    // or we could manually trigger a refetch if needed
  };
  const handleEditSuccess = (updatedData: Partial<Project>) => {
    console.log("Project updated in Details Dialog:", updatedData);
    // Potentially update local state if needed, but onSnapshot is preferred
  };

  // Handlers for Upload Invoice Dialog
  const handleOpenUploadInvoice = () => {
    setIsUploadInvoiceOpen(true);
  };
  const handleCloseUploadInvoice = () => {
    setIsUploadInvoiceOpen(false);
  };
  const handleUploadInvoiceSuccess = (invoiceId: string) => {
    console.log(`Invoice ${invoiceId} uploaded successfully via Project Details.`);
    // Optionally show a success toast/notification
    // No need to manually refetch invoices if using onSnapshot
  };

  // Handler for Upload Closing Document Dialog
  const [isUploadClosingDocOpen, setIsUploadClosingDocOpen] = useState(false);

  // Now just opens the dialog, doesn't need a specific invoice
  const handleOpenUploadClosingDoc = () => {
      // setSelectedInvoiceForDoc(invoice);
      setIsUploadClosingDocOpen(true);
      console.log("Opening upload closing doc dialog for project:", project?.id);
  };

  const handleCloseUploadClosingDoc = () => {
      setIsUploadClosingDocOpen(false);
      // setSelectedInvoiceForDoc(null);
  };

  // Receives an array of IDs now
  const handleUploadClosingDocSuccess = (docIds: string[]) => {
      console.log(`Closing documents ${docIds.join(', ')} uploaded successfully.`);
      // Data will refresh via onSnapshot, so just log or show notification
      handleCloseUploadClosingDoc(); 
  };

  if (!project) return null;

  // Log projectId before returning JSX
  if (project) {
      console.log("[ProjectDetailsDialog] project.id before render:", project.id);
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          {/* Overlay */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          {/* Dialog Content */}
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center mb-4">
                    <span>Детали проекта: {project.name || 'Без имени'} (#{project.number || 'N/A'})</span>
                    <div className="flex items-center space-x-2">
                        <button
                           type="button"
                           onClick={handleOpenEditDialog}
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           title="Редактировать проект"
                         >
                           <span className="sr-only">Редактировать проект</span>
                           <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                         </button>
                        <button
                           type="button"
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           onClick={onClose}
                         >
                          <span className="sr-only">Закрыть</span>
                          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                  </Dialog.Title>
                  
                  {/* Main Content Area */}
                  <div className="space-y-6"> 
                      {/* Project Details Section */}
                      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                        <h4 className="text-md font-medium text-neutral-900 dark:text-neutral-100 mb-3">Детали проекта</h4>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                          <DetailItem label="Заказчик" value={project.customer} icon={<UserCircleIcon />} />
                          <DetailItem 
                            label="Статус" 
                            icon={<Badge className="h-4 w-4 p-0 border-none bg-transparent" />}
                            value={project.status ? 
                              <Badge className={cn("text-xs px-2 py-1 rounded-full", projectStatusColors[project.status] || 'bg-neutral-100 text-neutral-700')}>
                                {project.status}
                              </Badge> 
                              : 'N/A'} 
                          />
                          <DetailItem label="Выручка (план)" value={formatCurrency(project.planned_revenue)} icon={<CurrencyDollarIcon />} />
                          <DetailItem label="Срок сдачи" value={formatDate(project.duedate)} icon={<CalendarDaysIcon />} />
                          <DetailItem 
                            label="Менеджер" 
                            icon={<SolidUserIcon />}
                            value={loadingManager ? 'Загрузка...' : managerName ?? 'N/A'}
                          /> 
                          
                          {/* Links - conditionally render if present */}
                          {project.estimatecostlink && (
                            <DetailItem 
                              label="Смета"
                              icon={<DocumentTextIcon />}
                              value={
                                <a href={project.estimatecostlink} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center">
                                  Открыть <LinkIcon className="ml-1 h-4 w-4" />
                                </a>
                              }
                            />
                          )}
                          {project.presentationlink && (
                            <DetailItem 
                              label="Презентация"
                              icon={<PresentationChartLineIcon />}
                              value={
                                <a href={project.presentationlink} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center">
                                  Открыть <LinkIcon className="ml-1 h-4 w-4" />
                                </a>
                              } 
                            />
                          )}
                          
                          <DetailItem label="Дата создания" value={formatDate(project.createdAt)} icon={<CalendarDaysIcon />} />
                          {/* Optional: Add Updated At if needed */}
                          {/* <DetailItem label="Последнее обновление" value={formatDate(project.updatedAt)} icon={<CalendarDaysIcon />} /> */} 
                        </dl>
                      </div>

                      {/* Budgeting Section */}
                      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                          <h4 className="text-md font-medium text-neutral-900 dark:text-neutral-100 mb-3">Бюджетирование</h4>
                          <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                  <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Себестоимость</dt>
                                  <dd className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(budgetInfo.budget)}</dd>
                              </div>
                              <div>
                                  <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Потрачено</dt>
                                  <dd className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(budgetInfo.spent)}</dd>
                              </div>
                              <div>
                                  <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Остаток</dt>
                                  <dd className={cn(
                                      "mt-1 text-lg font-semibold",
                                      budgetInfo.remaining >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"
                                  )}>{formatCurrency(budgetInfo.remaining)}</dd>
                              </div>
                          </div>
                           {/* Optional: Add a progress bar or visual indicator? */} 
                           {budgetInfo.budget > 0 && (
                              <div className="mt-3 h-2 w-full bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                                  <div 
                                      className={cn(
                                          "h-full rounded-full",
                                          budgetInfo.remaining >= 0 ? "bg-primary-600" : "bg-error-600"
                                      )}
                                      style={{ width: `${Math.min(100, Math.max(0, (budgetInfo.spent / budgetInfo.budget) * 100))}%` }}
                                  ></div>
                              </div>
                          )}
                      </div>

                      {/* Invoices Section with Closing Docs Rendering */}
                      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                        {/* Updated Header: Added General Upload Button */}
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-md font-medium text-neutral-900 dark:text-neutral-100">Счета по проекту</h4>
                             {/* Buttons Group */} 
                            <div className="flex items-center space-x-1">
                                {/* Upload Closing Doc Button */}
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleOpenUploadClosingDoc} 
                                    className="text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400"
                                    title="Загрузить закрывающий документ"
                                    // Disable if no invoices exist?
                                    disabled={invoices.length === 0} 
                                >
                                    <DocumentArrowUpIcon className="h-5 w-5 mr-1" />
                                    Загрузить док.
                                </Button>
                                {/* Add Invoice Button */}
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={handleOpenUploadInvoice} 
                                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 rounded-full"
                                    title="Добавить счет"
                                >
                                    <span className="sr-only">Добавить счет</span>
                                    <PlusCircleIcon className="h-6 w-6" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                        {/* ... existing loading/error states ... */}
                         {loadingInvoices && <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка счетов...</p>}
                         {errorInvoices && <p className="text-sm text-error-600 dark:text-error-400">{errorInvoices}</p>}
                         {loadingSuppliers && !loadingInvoices && <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка данных поставщиков...</p>}
                         {loadingClosingDocs && !loadingInvoices && <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка закрывающих документов...</p>}
                         {errorClosingDocs && <p className="text-sm text-error-600 dark:text-error-400">{errorClosingDocs}</p>} 
                        
                        {!loadingInvoices && !errorInvoices && (
                          invoices.length > 0 ? (
                            <ul className="space-y-3">
                              {invoices.map((invoice) => {
                                const supplierName = invoice.supplierId ? supplierMap[invoice.supplierId]?.name : null;
                                const displaySupplierName = supplierName ?? 'Поставщик не найден';
                                const invoiceClosingDocs = closingDocuments[invoice.id] || []; 

                                return (
                                  <li
                                    key={invoice.id}
                                    className="p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-md"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div 
                                        className="flex-1 min-w-0 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
                                        onClick={() => handleInvoiceClick(invoice)} 
                                        title="Посмотреть детали счета"
                                      >
                                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                           {!loadingClosingDocs && invoiceClosingDocs.length === 0 && (
                                               <span title="Нет закрывающих документов" className="mr-1">❗️</span>
                                           )}
                                            {loadingSuppliers && !supplierName ? 'Загрузка...' : displaySupplierName} - {formatCurrency(invoice.amount)}
                                          </p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                          Статус: <InvoiceStatusBadge status={invoice.status} /> | Срок: {formatDate(invoice.dueDate)}
                                        </p>
                                        {invoice.fileName && 
                                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">Счет: {invoice.fileName}</p>
                                        }
                                      </div>
                                       {/* Action Buttons - Removed Upload Doc Button */}
                                       <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                                          {/* Download Invoice Button */}
                                          {invoice.fileURL && (
                                              <a
                                                  href={invoice.fileURL}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="inline-flex items-center justify-center h-8 w-8 rounded-full text-neutral-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                                  title="Скачать счет"
                                              >
                                                  <span className="sr-only">Скачать счет</span>
                                                  <DocumentArrowDownIcon className="h-5 w-5" />
                                              </a>
                                          )}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Счетов по этому проекту пока нет.</p>
                          )
                        )}
                      </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Render Invoice Details Dialog - PASS CLOSING DOCS */}
      {selectedInvoice && (
          <InvoiceDetailsDialog 
            isOpen={isInvoiceDetailsOpen}
            onClose={handleCloseInvoiceDetails}
            invoice={selectedInvoice}
            project={project}
            closingDocuments={closingDocuments[selectedInvoice.id] || []} // Pass relevant docs
            loadingClosingDocs={loadingClosingDocs} // Pass loading state
          />
      )}

      {/* Render Edit Project Dialog */} 
      {project && (
          <EditProjectDialog
              isOpen={isEditDialogOpen}
              onClose={handleCloseEditDialog}
              project={project}
              onSuccess={handleEditSuccess}
          />
      )}

      {/* Render Upload Invoice Dialog */}
      {project && (
          <UploadInvoiceDialog 
              isOpen={isUploadInvoiceOpen}
              onClose={handleCloseUploadInvoice}
              onSuccess={handleUploadInvoiceSuccess}
              projectId={project.id}
          />
      )}

       {/* Render Upload Closing Document Dialog - Updated Props */}
       {project && (
           <UploadClosingDocumentDialog 
               isOpen={isUploadClosingDocOpen}
               onClose={handleCloseUploadClosingDoc}
               onSuccess={handleUploadClosingDocSuccess} // Now accepts array of IDs
               projectId={project.id} 
               invoices={invoices} // Pass all project invoices
               suppliers={supplierMap} // Pass supplier map
           /> 
       )}
    </>
  );
};

export default ProjectDetailsDialog;

// Helper component for Invoice Status Badge
const InvoiceStatusBadge: React.FC<{ status?: 'pending_payment' | 'paid' | 'overdue' | 'cancelled' }> = ({ status }) => {
  if (!status) return <span className="text-neutral-500">N/A</span>;

  const statusConfig = {
    pending_payment: {
      text: 'Ожидает оплаты',
      color: 'text-warning-700 dark:text-warning-300',
      icon: <ClockIcon className="h-3 w-3 inline-block mr-1" />,
    },
    paid: {
      text: 'Оплачен',
      color: 'text-success-700 dark:text-success-300',
      icon: <CheckCircleIcon className="h-3 w-3 inline-block mr-1" />,
    },
    overdue: {
      text: 'Просрочен',
      color: 'text-error-700 dark:text-error-300',
      icon: <ExclamationTriangleIcon className="h-3 w-3 inline-block mr-1" />,
    },
    cancelled: {
        text: 'Отменен',
        color: 'text-neutral-500 dark:text-neutral-400',
        icon: <XMarkIcon className="h-3 w-3 inline-block mr-1" />,
    }
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