'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { LinkIcon, CalendarDaysIcon, UserCircleIcon, CurrencyDollarIcon, DocumentTextIcon, PresentationChartLineIcon, UserIcon as SolidUserIcon, PencilSquareIcon, ChartBarIcon, DocumentDuplicateIcon, TagIcon, ArrowDownTrayIcon, XMarkIcon as OutlineXMarkIcon } from '@heroicons/react/24/solid';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { translateProjectStatus } from '@/lib/translations';
import EditProjectDialog from './EditProjectDialog';
import ProjectFinancialsDialog from './ProjectFinancialsDialog';
import ProjectInvoicesDialog from './ProjectInvoicesDialog';
import ProjectClosingDocsDialog from './ProjectClosingDocsDialog';
import { generateAndDownloadHtmlReport } from '@/lib/reportUtils';
import { ProjectReportData, FinancialSummaryData } from '@/components/projects/ProjectFinancialReport';

// Re-define Project interface (or import from a shared types file if you have one)
interface Project {
  id: string;
  budget?: number;
  planned_budget?: number;
  actual_budget?: number;
  planned_revenue?: number;
  actual_revenue?: number;
  usn_tax?: number;
  nds_tax?: number;
  status?: string;
  duedate?: Timestamp;
  createdAt?: Timestamp;
  customer?: string;
  estimatecostlink?: string;
  managerid?: string;
  name?: string;
  number?: string;
  presentationlink?: string;
  updatedAt?: Timestamp;
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
  project: Project | null;
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFinancialsOpen, setIsFinancialsOpen] = useState(false);
  const [isInvoicesOpen, setIsInvoicesOpen] = useState(false);
  const [isClosingDocsOpen, setIsClosingDocsOpen] = useState(false);
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
        if (status === 'overdue') {
          summary.overdueCount += 1;
        }
        // Could add more logic here, e.g., check if dueDate is past and status isn't paid/cancelled
        const now = new Date();
        const dueDate = inv.dueDate?.toDate();
        if (dueDate && dueDate < now && status !== 'paid' && status !== 'cancelled'){
          // Potentially mark as overdue even if status field isn't set yet
          if (status !== 'overdue') summary.overdueCount += 1; 
        }

        return summary;
      }, { countByStatus: {} as { [status: string]: number }, overdueCount: 0 });
      console.log("Calculated invoice summary:", invoiceSummary);

      // --- Calculate Financial Summary (with Variances & Net Profit) --- 
      const spent = invoices
          .filter(inv => inv.status !== 'cancelled' && typeof inv.amount === 'number')
          .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

      const actualBudget = projectData.actual_budget ?? 0;
      const plannedBudget = projectData.planned_budget ?? 0;
      const actualRevenue = projectData.actual_revenue ?? 0;
      const plannedRevenue = projectData.planned_revenue ?? 0;

      const remainingBudget = actualBudget - spent;
      const budgetVariance = actualBudget - plannedBudget; // Fact - Plan
      const revenueVariance = actualRevenue - plannedRevenue; // Fact - Plan

      const budgetVariancePercent = plannedBudget !== 0 ? (budgetVariance / plannedBudget) * 100 : undefined;
      const revenueVariancePercent = plannedRevenue !== 0 ? (revenueVariance / plannedRevenue) * 100 : undefined;

      let plannedMargin: number | undefined = undefined;
      if (plannedRevenue !== 0) {
          plannedMargin = ((plannedRevenue - plannedBudget) / plannedRevenue) * 100;
      }

      let actualMargin: number | undefined = undefined;
      if (actualRevenue !== 0) {
          actualMargin = ((actualRevenue - actualBudget) / actualRevenue) * 100;
      }

      let marginVariancePercent: number | undefined = undefined;
      if (plannedMargin !== undefined && actualMargin !== undefined) {
           marginVariancePercent = actualMargin - plannedMargin; // Difference in percentage points
      }

      // Calculate estimated taxes and net profit
      const usnTaxAmount = projectData.usn_tax ?? 0;
      const ndsTaxAmount = projectData.nds_tax ?? 0;
      const totalEstimatedTaxes = usnTaxAmount + ndsTaxAmount;
      const estimatedNetProfit = actualRevenue - actualBudget - totalEstimatedTaxes;

      const financialSummary: FinancialSummaryData = {
          totalSpent: spent,
          remainingBudget: remainingBudget,
          plannedMargin: plannedMargin,
          actualMargin: actualMargin,
          budgetVariance: budgetVariance,
          budgetVariancePercent: budgetVariancePercent,
          revenueVariance: revenueVariance,
          revenueVariancePercent: revenueVariancePercent,
          marginVariancePercent: marginVariancePercent,
          estimatedNetProfit: estimatedNetProfit
      };
      console.log("Calculated financial summary (enhanced):", financialSummary);
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
                        {/* Edit Button */}
                        <button
                           type="button"
                           onClick={handleOpenEditDialog}
                           className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                           title="Редактировать проект"
                         >
                           <span className="sr-only">Редактировать проект</span>
                           <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
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
         <EditProjectDialog
            isOpen={isEditDialogOpen}
            onClose={handleCloseEditDialog}
            project={project}
            onSuccess={handleEditSuccess}
         />
      )}
      
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
       
    </>
  );
};

export default ProjectDetailsDialog;