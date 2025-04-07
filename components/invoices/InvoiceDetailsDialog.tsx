'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CalendarDaysIcon, BanknotesIcon, DocumentTextIcon, DocumentArrowDownIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, BuildingLibraryIcon, HashtagIcon, ChatBubbleLeftRightIcon, InboxIcon, TagIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// Re-use or import shared interfaces and helpers
// Assuming Invoice and Project interfaces exist elsewhere or define them here
export interface Invoice {
  id: string;
  amount?: number;
  dueDate?: Timestamp;
  fileURL?: string;
  fileName?: string;
  status?: 'pending_payment' | 'paid' | 'overdue' | 'cancelled';
  supplierId?: string;
  uploadedAt?: Timestamp;
  projectId?: string; // We might need project Number/Name here eventually
  comment?: string;
  isUrgent?: boolean;
  // Add other fields as necessary (e.g., project details if fetched)
}

// Assuming Project interface is defined (adjust if needed)
// Consider exporting this too if needed elsewhere
interface Project {
  id: string;
  name?: string;
  number?: string;
  // Add other project fields if needed later
}

// Interface for Supplier data from Firestore
// Consider exporting this too
interface Supplier {
    id: string;
    name?: string;
    tin?: string; // ИНН
}

// Define ClosingDocument interface (consistent structure)
interface ClosingDocument {
    id: string;
    projectId?: string; // Optional for project docs
    departmentInvoiceId?: string; // Optional for department docs
    fileName: string;
    fileURL: string;
    uploadedAt: Timestamp;
    type?: 'contract' | 'upd' | 'act' | 'other' | null;
    number?: string;
    date?: Timestamp | null;
    comment?: string | null;
}

interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  project: Project | null; // Keep for project context (can be null for dept invoice)
  closingDocuments?: ClosingDocument[]; // For project closing docs
  departmentClosingDocuments?: ClosingDocument[]; // For department closing docs
  loadingClosingDocs?: boolean; // Single loading state is fine
}

// Helper functions (import or define)
const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
};

// Helper component for Invoice Status Badge (moved outside main component for clarity)
const InvoiceStatusBadge: React.FC<{ status?: 'pending_payment' | 'paid' | 'overdue' | 'cancelled' }> = ({ status }) => {
  if (!status) return null; // Render nothing if no status
  const statusConfig = {
    pending_payment: { text: 'Ожидает оплаты', color: 'text-warning-700 dark:text-warning-300', icon: ClockIcon },
    paid: { text: 'Оплачен', color: 'text-success-700 dark:text-success-300', icon: CheckCircleIcon },
    overdue: { text: 'Просрочен', color: 'text-error-700 dark:text-error-300', icon: ExclamationTriangleIcon },
    cancelled: { text: 'Отменен', color: 'text-neutral-500 dark:text-neutral-400', icon: XMarkIcon }
  };
  const config = statusConfig[status];
  if (!config) return <Badge variant="secondary">{status}</Badge>; // Fallback for unknown status
  const IconComponent = config.icon;
  return (
    <span className={cn('inline-flex items-center text-xs font-medium', config.color)}>
      <IconComponent className="h-3.5 w-3.5 mr-1" />
      {config.text}
    </span>
  );
};

const DetailItem: React.FC<{ label: string; value?: string | number | React.ReactNode; icon?: React.ReactNode; fullWidth?: boolean }> = ({ label, value, icon, fullWidth }) => (
  <div className={cn(fullWidth ? 'sm:col-span-2' : '')}>
    <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center">
      {icon && <span className="mr-2 h-4 w-4 flex-shrink-0">{icon}</span>}
      {label}
    </dt>
    <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100 sm:col-span-2 sm:mt-0 break-words">
      {value ?? 'N/A'}
    </dd>
  </div>
);

const InvoiceDetailsDialog: React.FC<InvoiceDetailsDialogProps> = ({ 
    isOpen, 
    onClose, 
    invoice, 
    project, // Still receive project, but might be null
    closingDocuments = [], // Default project docs
    departmentClosingDocuments = [], // Default department docs
    loadingClosingDocs = false 
}) => {
  const [supplierData, setSupplierData] = useState<Supplier | null>(null);
  const [loadingSupplier, setLoadingSupplier] = useState(false);

  // Fetch supplier details when invoice or isOpen changes
  useEffect(() => {
    const fetchSupplierData = async () => {
      if (invoice?.supplierId) {
        setLoadingSupplier(true);
        setSupplierData(null); // Reset previous data
        try {
          const supplierRef = doc(db, 'suppliers', invoice.supplierId);
          const docSnap = await getDoc(supplierRef);
          if (docSnap.exists()) {
            setSupplierData({ id: docSnap.id, ...docSnap.data() } as Supplier);
          } else {
            console.warn(`Supplier data not found for ID: ${invoice.supplierId}`);
            setSupplierData(null);
          }
        } catch (error) {
          console.error("Error fetching supplier data:", error);
          setSupplierData(null); // Clear on error
        } finally {
          setLoadingSupplier(false);
        }
      } else {
        setSupplierData(null); // Clear if no supplierId
      }
    };

    if (isOpen) {
      fetchSupplierData();
    }
  }, [invoice?.supplierId, isOpen]);

  // Determine which document list to use
  const documentsToDisplay = project ? closingDocuments : departmentClosingDocuments;
  // Determine project name/number or indicate department context
  const contextName = project ? project.name : 'Бюджет отдела';
  const contextNumber = project ? project.number : 'N/A';

  if (!invoice) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[51]" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  {/* Title content with flex alignment */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                     {/* Invoice Status Icon/Badge */}
                     {invoice.status && <InvoiceStatusBadge status={invoice.status} />}
                     {/* Invoice Title Text */}
                     <span className="truncate"> 
                        Детали счета: {loadingSupplier ? 'Загрузка...' : (supplierData?.name || 'Поставщик не найден')}
                     </span>
                     {/* Urgent Badge (if applicable) */}
                     {invoice.isUrgent && <Badge className="ml-2 bg-error-100 text-error-700 dark:bg-error-900/50 dark:text-error-300 flex-shrink-0">Срочно</Badge>} 
                  </div>

                  {/* Close Button */}
                  <button
                    type="button"
                    className="ml-auto inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                    onClick={onClose}
                  >
                    <span className="sr-only">Закрыть</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </Dialog.Title>

                <div className="mt-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <DetailItem label="Поставщик" value={loadingSupplier ? 'Загрузка...' : supplierData?.name} icon={<BuildingLibraryIcon />} />
                    <DetailItem label="ИНН" value={loadingSupplier ? 'Загрузка...' : supplierData?.tin} icon={<InboxIcon />} />
                    <DetailItem label="Сумма" value={formatCurrency(invoice.amount)} icon={<BanknotesIcon />} />
                    <DetailItem label="Статус" value={<InvoiceStatusBadge status={invoice.status} />} icon={<TagIcon className="h-4 w-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />} />
                    <DetailItem label="Срок оплаты" value={formatDate(invoice.dueDate)} icon={<CalendarDaysIcon />} />
                    <DetailItem label={project ? "Проект" : "Контекст"} value={`${contextName} (#${contextNumber})`} icon={<HashtagIcon />} />
                    <DetailItem label="Дата загрузки" value={formatDate(invoice.uploadedAt)} icon={<CalendarDaysIcon />} />

                    {invoice.fileName && (
                        <DetailItem
                            label="Файл счета"
                            icon={<DocumentTextIcon />}
                            value={
                            invoice.fileURL && invoice.fileURL !== 'placeholder_url' ? (
                                <a href={invoice.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center">
                                    {invoice.fileName} <DocumentArrowDownIcon className="ml-1 h-4 w-4" />
                                </a>
                            ) : (
                                `${invoice.fileName} (ссылка недоступна)`
                            )
                            }
                            fullWidth={!invoice.comment}
                        />
                    )}

                    {invoice.comment && (
                      <DetailItem label="Комментарий" value={invoice.comment} icon={<ChatBubbleLeftRightIcon />} fullWidth />
                    )}
                  </dl>
                </div>

                {/* Closing Documents Section - Use documentsToDisplay */}
                <div className="mt-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                  <h4 className="text-md font-medium text-neutral-900 dark:text-neutral-100 mb-3">Закрывающие документы</h4>
                   {loadingClosingDocs && <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка документов...</p>}
                   {!loadingClosingDocs && documentsToDisplay.length === 0 && (
                       <p className="text-sm text-warning-600 dark:text-warning-400 font-medium flex items-center">
                          <ExclamationCircleIcon className="h-4 w-4 mr-1.5 inline-block"/>
                          Закрывающие документы по этому счету еще не загружены.
                       </p>
                   )}
                   {!loadingClosingDocs && documentsToDisplay.length > 0 && (
                       <ul className="space-y-2">
                          {documentsToDisplay.map(doc => (
                              <li key={doc.id} className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-700/50 rounded-md">
                                 <a 
                                    href={doc.fileURL} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm truncate hover:underline text-primary-600 dark:text-primary-400 flex-1 min-w-0"
                                    title={`Скачать ${doc.fileName}`}
                                 >
                                    {/* Display Doc Info */} 
                                    {doc.type && <span className="uppercase font-semibold mr-1">{doc.type}</span>}
                                    {doc.number && `№${doc.number}`}
                                    {doc.date && ` от ${formatDate(doc.date)}`}
                                    {!doc.type && !doc.number && !doc.date && doc.fileName} {/* Fallback to filename */} 
                                    {doc.comment && <span className="text-xs text-neutral-400 ml-1">({doc.comment})</span>}
                                </a>
                                 {/* Optional: Add delete button here later */} 
                              </li>
                          ))}
                       </ul>
                   )}
                   {/* Placeholder for button to add closing docs */}
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                  <Button variant="outline" onClick={onClose}>
                    Закрыть
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default InvoiceDetailsDialog; 