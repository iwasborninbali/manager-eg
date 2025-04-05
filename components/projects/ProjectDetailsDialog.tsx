'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { LinkIcon, CalendarDaysIcon, UserCircleIcon, CurrencyDollarIcon, DocumentTextIcon, PresentationChartLineIcon, UserIcon as SolidUserIcon, PencilSquareIcon, ChartBarIcon, DocumentDuplicateIcon } from '@heroicons/react/24/solid';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import EditProjectDialog from './EditProjectDialog';
import ProjectFinancialsDialog from './ProjectFinancialsDialog';
import ProjectInvoicesDialog from './ProjectInvoicesDialog';
import ProjectClosingDocsDialog from './ProjectClosingDocsDialog';
import { Timestamp } from 'firebase/firestore';
import { XMarkIcon as OutlineXMarkIcon } from '@heroicons/react/24/outline';

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFinancialsOpen, setIsFinancialsOpen] = useState(false);
  const [isInvoicesOpen, setIsInvoicesOpen] = useState(false);

  // State for Closing Docs Dialog (managed locally)
  const [isClosingDocsOpen, setIsClosingDocsOpen] = useState(false);

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
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center mb-4">
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
                  <div className="space-y-6"> 
                      {/* Project Details Section */}
                      <div className="pt-4">
                        {/* Removed border-t */} 
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

                      {/* REMOVED Invoices Section */} 
                      {/* <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4"> ... </div> */}
                      
                  </div>
                  {/* REMOVED Dialog Actions (Upload buttons) */}
                  {/* <div className="mt-6 pt-4 border-t ... "> ... </div> */}

                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* --- Render Dependent Dialogs --- */}
      {/* Edit Dialog */} 
      {project && (
         <EditProjectDialog
            isOpen={isEditDialogOpen}
            onClose={handleCloseEditDialog}
            project={project}
            onSuccess={handleEditSuccess}
         />
      )}
      
      {/* Financials Dialog */} 
       {project && (
           <ProjectFinancialsDialog
               isOpen={isFinancialsOpen}
               onClose={handleCloseFinancialsDialog}
               projectId={project.id}
           />
       )}
       
      {/* Invoices Dialog */} 
       {project && (
           <ProjectInvoicesDialog
               isOpen={isInvoicesOpen}
               onClose={handleCloseInvoicesDialog}
               projectId={project.id}
               projectName={project.name ?? 'Без имени'}
           />
       )}
       
      {/* Closing Docs Dialog */} 
       {project && (
           <ProjectClosingDocsDialog
               isOpen={isClosingDocsOpen}
               onClose={handleCloseClosingDocsDialog}
               projectId={project.id}
               projectName={project.name}
           />
       )}
       
    </>
  );
};

export default ProjectDetailsDialog;