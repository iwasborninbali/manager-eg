'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { LinkIcon, CalendarDaysIcon, UserCircleIcon, CurrencyDollarIcon, DocumentTextIcon, PresentationChartLineIcon, UserIcon as SolidUserIcon, ChartBarIcon, DocumentDuplicateIcon, TagIcon, ArrowDownTrayIcon, XMarkIcon as OutlineXMarkIcon } from '@heroicons/react/24/solid';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { translateProjectStatus } from '@/lib/translations';
import ProjectFinancialsDialog from './ProjectFinancialsDialog';
import ProjectInvoicesDialog from './ProjectInvoicesDialog';
import ProjectClosingDocsDialog from './ProjectClosingDocsDialog';
import ProjectCustomerDocsDialog from './ProjectCustomerDocsDialog';
import { generateAndDownloadHtmlReport, calculateFinancialSummary } from '@/lib/reportUtils';
import { ProjectReportData } from '@/components/projects/ProjectFinancialReport';

// Re-define Project interface locally to include id (or import from a shared type if available)
interface Project {
  id: string; // Ensure ID is part of the interface
  actual_budget?: number;
  planned_budget?: number;
  createdAt?: Timestamp;
  customer?: string;
  duedate?: Timestamp;
  estimatecostlink?: string;
  managerid?: string;
  name?: string;
  number?: string;
  planned_revenue?: number;
  actual_revenue?: number;
  presentationlink?: string;
  status?: string;
  updatedAt?: Timestamp;
  description?: string;
  usn_tax?: number;
  nds_tax?: number;
}

// Define necessary interfaces for fetching report data
interface Invoice {
  id: string;
  projectId?: string;
  supplierId?: string;
  amount?: number;
  status?: string;
  dueDate?: Timestamp;
  paidAt?: Timestamp;
  fileURL?: string;
}

interface ClosingDocument {
  id: string;
  projectId?: string;
  invoiceId?: string;
  fileName?: string;
  uploadedAt?: Timestamp;
  date?: Timestamp | null;
  fileURL?: string;
}

interface Supplier {
  id: string;
  name?: string;
}

interface ProjectDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null; // Use the local Project interface
}

// Helper functions
const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return 'Н/Д';
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
  const [isFinancialsOpen, setIsFinancialsOpen] = useState(false);
  const [isInvoicesOpen, setIsInvoicesOpen] = useState(false);
  const [isClosingDocsOpen, setIsClosingDocsOpen] = useState(false);
  const [isCustomerDocsOpen, setIsCustomerDocsOpen] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

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

  // Handlers for Financials Dialog
  const handleOpenFinancialsDialog = () => {
    setIsFinancialsOpen(true);
  };
  const handleCloseFinancialsDialog = () => {
    setIsFinancialsOpen(false);
  };

  // Handlers for Invoices Dialog (managed locally)
  const handleOpenInvoicesDialog = () => {
    setIsInvoicesOpen(true);
  };
  const handleCloseInvoicesDialog = () => {
    setIsInvoicesOpen(false);
  };

  // Handlers for Closing Docs Dialog (managed locally)
  const handleOpenClosingDocsDialog = () => {
    setIsClosingDocsOpen(true);
  };
  const handleCloseClosingDocsDialog = () => {
    setIsClosingDocsOpen(false);
  };

  // Handlers for Customer Docs Dialog
  const handleOpenCustomerDocsDialog = () => {
    setIsCustomerDocsOpen(true);
  };
  const handleCloseCustomerDocsDialog = () => {
    setIsCustomerDocsOpen(false);
  };

  // --- Data Fetching for Report ---
  const fetchReportData = async (projectId: string): Promise<ProjectReportData | null> => {
    if (!projectId) return null;
    console.log(`Fetching report data for project: ${projectId}`);
    try {
      // 1. Fetch Project (ensure we have the latest/required fields)
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) {
        console.error("Project not found for report:", projectId);
        // TODO: Show user feedback (e.g., toast notification)
        return null;
      }
      // Explicitly cast to Project, assuming Firestore structure matches
      const projectData = { id: projectSnap.id, ...projectSnap.data() } as Project;
      console.log("Fetched project data:", projectData);

      // 2. Fetch Invoices for this project
      const invoicesQuery = query(collection(db, 'invoices'), where('projectId', '==', projectId));
      const invoicesSnap = await getDocs(invoicesQuery);
      const invoices = invoicesSnap.docs.map(doc => {
        const data = doc.data();
        // Log uses correct field name from data
        console.log(`Fetched Invoice URL for ${doc.id}:`, data.fileURL);
        return { id: doc.id, ...data } as Invoice;
      });
      console.log(`Fetched ${invoices.length} invoices.`);

      // 3. Fetch Closing Documents for this project
      const docsQuery = query(collection(db, 'closingDocuments'), where('projectId', '==', projectId));
      const docsSnap = await getDocs(docsQuery);
      const closingDocuments = docsSnap.docs.map(doc => {
        const data = doc.data();
        // Log uses correct field name from data
        console.log(`Fetched Doc URL for ${doc.id} (fileName: ${data.fileName}):`, data.fileURL);
        return { id: doc.id, ...data } as ClosingDocument;
      });
      console.log(`Fetched ${closingDocuments.length} closing documents.`);

      // 4. Fetch Suppliers (unique IDs from invoices)
      const supplierIds = [...new Set(invoices.map(inv => inv.supplierId).filter((id): id is string => !!id))]; // Filter out undefined/null and type guard
      const suppliersMap = new Map<string, string>();
      if (supplierIds.length > 0) {
          console.log(`Fetching names for ${supplierIds.length} unique suppliers...`);
          // Consider batching reads if many suppliers (Firestore v9 'in' query or Promise.all)
          const supplierPromises = supplierIds.map(id => getDoc(doc(db, 'suppliers', id)));
          const supplierSnaps = await Promise.all(supplierPromises);

          supplierSnaps.forEach((snap, index) => {
            if (snap.exists()) {
              // Explicitly cast, assuming structure matches
              const data = snap.data() as Supplier;
              suppliersMap.set(snap.id, data.name || 'Имя не указано');
            } else {
               console.warn(`Supplier document not found for ID: ${supplierIds[index]}`);
               suppliersMap.set(supplierIds[index], 'Поставщик не найден');
            }
          });
          console.log("Fetched supplier names:", suppliersMap);
      }

      // --- Calculate Invoice Summary --- 
      const invoiceSummary = invoices.reduce((summary, inv) => {
        const status = inv.status || 'unknown';
        summary.countByStatus[status] = (summary.countByStatus[status] || 0) + 1;

        // Track total pending amount
        if (status === 'pending_payment') {
          summary.pendingAmount += inv.amount ?? 0; // Add amount if pending
        }

        // Track overdue count
        const now = new Date();
        const dueDate = inv.dueDate?.toDate();
        let isOverdue = false;
        if (dueDate && dueDate < now && status !== 'paid' && status !== 'cancelled') {
          isOverdue = true;
        }
        if (status === 'overdue') {
          isOverdue = true;
        }
        if (isOverdue) {
          summary.overdueCount += 1;
        }

        return summary;
      }, { 
          countByStatus: {} as { [status: string]: number }, 
          overdueCount: 0, 
          pendingAmount: 0 // Initialize pending amount
      });
      console.log("Calculated invoice summary:", invoiceSummary);

      // --- Calculate Financial Summary using utility function ---
      const nonCancelledInvoices = invoices.filter(inv => inv.status !== 'cancelled');
      // Use projectData and nonCancelledInvoices which are already defined
      const financialSummary = calculateFinancialSummary(projectData, nonCancelledInvoices);
      console.log("Calculated financial summary:", financialSummary);

      // --- End Financial Summary Calculation ---

      // 5. Structure the data
      const docsByInvoiceId = closingDocuments.reduce((acc, doc) => {
        const invoiceId = doc.invoiceId;
        if (invoiceId) {
          if (!acc[invoiceId]) acc[invoiceId] = [];
          acc[invoiceId].push({
            id: doc.id,
            fileName: doc.fileName || 'Без имени',
            uploadedAt: doc.uploadedAt || Timestamp.now(),
            date: doc.date || null,
            fileURL: doc.fileURL || '',
          });
        }
        return acc;
      }, {} as { [invoiceId: string]: Required<ProjectReportData['invoices'][0]['closingDocuments'][0]>[] });

      const structuredInvoices: ProjectReportData['invoices'] = invoices.map(inv => ({
        id: inv.id,
        supplierName: suppliersMap.get(inv.supplierId!) || 'Поставщик не указан',
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        fileURL: inv.fileURL,
        closingDocuments: docsByInvoiceId[inv.id] || [],
      }));

      const reportData: ProjectReportData = {
        project: {
          id: projectData.id,
          name: projectData.name,
          number: projectData.number,
          customer: projectData.customer,
          planned_budget: projectData.planned_budget,
          actual_budget: projectData.actual_budget,
          planned_revenue: projectData.planned_revenue,
          actual_revenue: projectData.actual_revenue,
          status: projectData.status,
          duedate: projectData.duedate,
          usn_tax: projectData.usn_tax,
          nds_tax: projectData.nds_tax
        },
        invoices: structuredInvoices,
        financialSummary: financialSummary,
        invoiceSummary: invoiceSummary
      };

      console.log("Successfully structured enhanced report data:", reportData);
      return reportData;

    } catch (error) {
      console.error("Error fetching report data:", error);
      // TODO: Show user feedback (e.g., toast notification)
      return null;
    }
  };

  // --- Download Handler ---
  const handleDownloadReport = async () => {
    if (!project || isDownloadingReport) return;

    setIsDownloadingReport(true);
    console.log("Attempting to download report...");
    try {
      const reportData = await fetchReportData(project.id);
      if (reportData) {
        generateAndDownloadHtmlReport(reportData, project.id);
        console.log("Report download initiated.");
        // TODO: Show success toast
      } else {
         console.error("Failed to generate report data. Download cancelled.");
         // TODO: Show error toast
      }
    } catch (error) {
      console.error("Error generating or downloading report:", error);
       // TODO: Show error toast
    } finally {
      setIsDownloadingReport(false);
      console.log("Download process finished (or failed).");
    }
  };

  if (!project) return null;

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
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all flex flex-col">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center mb-4 flex-shrink-0">
                    <span className="truncate mr-4">Детали проекта: {project.name || 'Без имени'} (#{project.number || 'N/A'})</span>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        {/* Customer Docs Button */}
                         <button
                           type="button"
                           onClick={handleOpenCustomerDocsDialog}
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           title="Документы с Заказчиком"
                         >
                           <span className="sr-only">Документы с Заказчиком</span>
                           {/* Choose an appropriate icon, e.g., DocumentChartBarIcon or ClipboardDocumentListIcon */}
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                           </svg>
                         </button>
                        {/* Closing Docs Button */}
                        <button
                           type="button"
                           onClick={handleOpenClosingDocsDialog}
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           title="Закрывающие документы"
                         >
                           <span className="sr-only">Закрывающие документы</span>
                           <DocumentDuplicateIcon className="h-5 w-5" aria-hidden="true" />
                         </button>
                        {/* Invoices Button */} 
                        <button
                           type="button"
                           onClick={handleOpenInvoicesDialog}
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           title="Счета проекта"
                         >
                           <span className="sr-only">Счета проекта</span>
                           <DocumentTextIcon className="h-5 w-5" aria-hidden="true" />
                         </button>
                        {/* Financials Button */}
                        <button
                           type="button"
                           onClick={handleOpenFinancialsDialog}
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           title="Финансы проекта"
                         >
                           <span className="sr-only">Финансы проекта</span>
                           <ChartBarIcon className="h-5 w-5" aria-hidden="true" />
                         </button>
                        {/* Close Button */}
                        <button
                           type="button"
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           onClick={onClose}
                         >
                          <span className="sr-only">Закрыть</span>
                          <OutlineXMarkIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                  </Dialog.Title>
                  
                  {/* Main Content Area - Simplified */}
                  <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                      {/* Project Details Section */}
                      <div className="pt-4">
                        <h4 className="text-md font-medium text-neutral-900 dark:text-neutral-100 mb-3">Детали проекта</h4>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                          <DetailItem label="Заказчик" value={project.customer} icon={<UserCircleIcon />} />
                          <DetailItem 
                            label="Статус" 
                            icon={<TagIcon className="h-4 w-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />}
                            value={project.status ? 
                              <Badge 
                                variant="secondary"
                                className={cn(
                                  "text-xs px-2.5 py-1 rounded-full whitespace-nowrap",
                                  projectStatusColors[project.status] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                                )}
                              >
                                {translateProjectStatus(project.status)}
                              </Badge> 
                              : 'Н/Д'} 
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
                  </div>

                  {/* --- Dialog Footer --- */}
                  <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end space-x-3 flex-shrink-0">
                      <Button
                          variant="outline"
                          onClick={onClose}
                          disabled={isDownloadingReport}
                      >
                          Закрыть
                      </Button>
                      <Button
                          onClick={handleDownloadReport}
                          disabled={isDownloadingReport}
                          variant="secondary"
                      >
                          {isDownloadingReport ? (
                              <>
                                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                   </svg>
                                  Генерация...
                              </>
                          ) : (
                              <>
                                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                                  Скачать отчет
                              </>
                          )}
                      </Button>
                  </div>

                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* --- Render Dependent Dialogs --- */}
      {project && (
           <ProjectFinancialsDialog
               isOpen={isFinancialsOpen}
               onClose={handleCloseFinancialsDialog}
               projectId={project.id}
           />
       )}
       
      {project && (
           <ProjectInvoicesDialog
               isOpen={isInvoicesOpen}
               onClose={handleCloseInvoicesDialog}
               projectId={project.id}
               projectName={project.name || 'Unknown Project'}
           />
       )}
       
      {project && (
           <ProjectClosingDocsDialog
               isOpen={isClosingDocsOpen}
               onClose={handleCloseClosingDocsDialog}
               projectId={project.id}
               projectName={project.name || 'Unknown Project'}
           />
       )}
       
      {/* Render Customer Docs Dialog */} 
      {project && (
           <ProjectCustomerDocsDialog
               isOpen={isCustomerDocsOpen}
               onClose={handleCloseCustomerDocsDialog}
               project={{ id: project.id, name: project.name || 'Unknown Project' }}
           />
       )}
       
    </>
  );
};

export default ProjectDetailsDialog;