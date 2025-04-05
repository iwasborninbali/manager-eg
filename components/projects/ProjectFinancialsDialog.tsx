'use client';

import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Timestamp, doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Define Project interface locally for now (consider centralizing later)
interface Project {
  id: string;
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
}

// Define Invoice interface locally
interface Invoice {
    id: string;
    projectId: string;
    supplierId?: string;
    invoiceNumber?: string;
    invoiceDate?: Timestamp;
    amount?: number;
    status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
    // Add other relevant invoice fields
}

// Helper Functions (consider moving to lib/utils.ts later)
const formatCurrency = (amount: number | undefined | null, fallback: string = 'N/A'): string => {
    if (amount === undefined || amount === null) return fallback;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
};

const formatPercentage = (value: number | undefined | null, fallback: string = 'N/A'): string => {
    if (value === undefined || value === null || !isFinite(value)) return fallback;
    return new Intl.NumberFormat('ru-RU', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
};

interface ProjectFinancialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null; // Allow null initially
}

const ProjectFinancialsDialog: React.FC<ProjectFinancialsDialogProps> = ({ isOpen, onClose, projectId }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch project data
  useEffect(() => {
    if (isOpen && projectId) {
      setLoadingProject(true);
      setError(null);
      const fetchProject = async () => {
        try {
          const projectRef = doc(db, 'projects', projectId);
          const docSnap = await getDoc(projectRef);
          if (docSnap.exists()) {
            setProject({ id: docSnap.id, ...docSnap.data() } as Project);
          } else {
            setError('Проект не найден.');
            setProject(null);
          }
        } catch (err) {
          console.error("Error fetching project:", err);
          setError('Не удалось загрузить данные проекта.');
          setProject(null);
        } finally {
          setLoadingProject(false);
        }
      };
      fetchProject();
    } else {
        // Reset when closed or projectId is missing
        setProject(null);
        setError(null);
        if (!isOpen) setLoadingProject(false); // Ensure loading resets if closed
    }
  }, [isOpen, projectId]);

  // Effect to fetch invoices for the project
  useEffect(() => {
    let unsubscribeInvoices: (() => void) | null = null;
    if (isOpen && projectId) {
      setLoadingInvoices(true);
      setError(null); // Reset general error, specific invoice error handled below
      
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('projectId', '==', projectId));
      
      unsubscribeInvoices = onSnapshot(q, 
        (querySnapshot) => {
          const fetchedInvoices: Invoice[] = [];
          querySnapshot.forEach((doc) => {
            fetchedInvoices.push({ id: doc.id, ...doc.data() } as Invoice);
          });
          setInvoices(fetchedInvoices);
          setLoadingInvoices(false);
        },
        (err) => {
          console.error("Error fetching invoices: ", err);
          setError("Не удалось загрузить счета для проекта."); // Use general error state
          setLoadingInvoices(false);
        }
      );
    } else {
      setInvoices([]);
      if (!isOpen) setLoadingInvoices(false); // Ensure loading resets if closed
    }
    // Cleanup invoice subscription
    return () => {
        if (unsubscribeInvoices) unsubscribeInvoices();
    };
  }, [isOpen, projectId]);

  // --- Financial Calculations ---
  const { totalSpent, remainingBudget, plannedMargin, actualMargin } = useMemo(() => {
    if (!project) {
      return { totalSpent: 0, remainingBudget: 0, plannedMargin: undefined, actualMargin: undefined };
    }

    const spent = invoices
      .filter(inv => inv.status !== 'cancelled' && typeof inv.amount === 'number')
      .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

    const actualBudget = project.actual_budget ?? 0;
    const remaining = actualBudget - spent;

    const plannedRev = project.planned_revenue;
    const plannedBud = project.planned_budget;
    const actualRev = project.actual_revenue;
    const actualBud = project.actual_budget;

    let pMargin: number | undefined = undefined;
    if (typeof plannedRev === 'number' && typeof plannedBud === 'number' && plannedRev !== 0) {
        pMargin = ((plannedRev - plannedBud) / plannedRev) * 100;
    }

    let aMargin: number | undefined = undefined;
    if (typeof actualRev === 'number' && typeof actualBud === 'number' && actualRev !== 0) {
        aMargin = ((actualRev - actualBud) / actualRev) * 100;
    }

    return {
        totalSpent: spent,
        remainingBudget: remaining,
        plannedMargin: pMargin,
        actualMargin: aMargin
    };

  }, [project, invoices]);

  // --- Prepare data for the chart --- 
  const chartData = useMemo(() => {
    if (!project) return [];
    return [
      {
        name: 'Бюджет',
        План: project.planned_budget ?? 0,
        Факт: project.actual_budget ?? 0,
      },
      {
        name: 'Выручка',
        План: project.planned_revenue ?? 0,
        Факт: project.actual_revenue ?? 0,
      },
    ];
  }, [project]);

  const handleClose = () => {
    if (loadingProject || loadingInvoices) return; // Prevent closing while loading
    onClose();
    // Optionally reset state here if needed when closing
    // setProject(null);
    // setInvoices([]);
    // setError(null);
  };

  // Display loading state or error
  const isLoading = loadingProject || loadingInvoices;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  <span>Финансовые показатели: {project?.name || 'Загрузка...'}</span>
                   <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                      onClick={handleClose}
                      disabled={isLoading}
                    >
                      <span className="sr-only">Закрыть</span>
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                </Dialog.Title>

                <div className="mt-4 min-h-[300px]"> {/* Add min-height for loading state */}
                  {isLoading && (
                    <div className="flex justify-center items-center h-full">
                      <p className="text-neutral-500 dark:text-neutral-400">Загрузка данных...</p>
                      {/* TODO: Add a spinner component */}
                    </div>
                  )}
                  {error && (
                    <div className="flex justify-center items-center h-full">
                      <p className="text-error-600 dark:text-error-400">Ошибка: {error}</p>
                    </div>
                  )}
                  {!isLoading && !error && project && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* --- Metrics Section --- */}
                        <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                            <h4 className="text-md font-semibold text-neutral-800 dark:text-neutral-200 border-b pb-2">Основные показатели</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <span className="text-neutral-600 dark:text-neutral-400">Бюджет (План):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatCurrency(project.planned_budget)}</span>

                                <span className="text-neutral-600 dark:text-neutral-400">Бюджет (Факт):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatCurrency(project.actual_budget)}</span>

                                <span className="text-neutral-600 dark:text-neutral-400">Выручка (План):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatCurrency(project.planned_revenue)}</span>

                                <span className="text-neutral-600 dark:text-neutral-400">Выручка (Факт):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatCurrency(project.actual_revenue)}</span>

                                <span className="text-neutral-600 dark:text-neutral-400">Маржа (План):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatPercentage(plannedMargin)}</span>
                                
                                <span className="text-neutral-600 dark:text-neutral-400">Маржа (Факт):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatPercentage(actualMargin)}</span>
                            </div>
                        </div>
                        
                        {/* --- Budget Usage Section --- */}
                        <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                           <h4 className="text-md font-semibold text-neutral-800 dark:text-neutral-200 border-b pb-2">Использование бюджета (Факт)</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <span className="text-neutral-600 dark:text-neutral-400">Бюджет (Факт):</span>
                                <span className="font-medium text-right text-neutral-900 dark:text-neutral-100">{formatCurrency(project.actual_budget)}</span>

                                <span className="text-neutral-600 dark:text-neutral-400">Потрачено (Счета):</span>
                                <span className="font-medium text-right text-red-600 dark:text-red-400">{formatCurrency(totalSpent)}</span>
                                
                                <span className="text-neutral-600 dark:text-neutral-400 font-semibold">Остаток:</span>
                                <span className={`font-semibold text-right ${remainingBudget >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(remainingBudget)}
                                </span>
                            </div>
                            {/* TODO: Add Doughnut chart here later */}
                             <p className="text-xs text-center text-neutral-500 dark:text-neutral-400 pt-2">Потрачено = Сумма счетов НЕ в статусе &apos;cancelled&apos;.</p>
                        </div>

                        {/* --- Chart Section --- */}
                        <div className="md:col-span-2 mt-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                           <h4 className="text-md font-semibold mb-4 text-center text-neutral-800 dark:text-neutral-200">План / Факт</h4>
                           <div className="h-64 w-full"> {/* Ensure container has height */}
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={chartData}
                                        margin={{
                                            top: 5,
                                            right: 30,
                                            left: 20,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                        <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 12 }} />
                                        <YAxis tickFormatter={(value) => formatCurrency(value, '')} tick={{ fill: '#666', fontSize: 12 }} />
                                        <Tooltip 
                                            formatter={(value: number) => formatCurrency(value)} 
                                            cursor={{ fill: 'rgba(200,200,200,0.1)' }}
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                                            labelStyle={{ color: '#333' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px' }}/>
                                        <Bar dataKey="План" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Факт" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                           </div>
                        </div>
                    </div>
                  )}
                   {!isLoading && !error && !project && projectId && (
                     <div className="flex justify-center items-center h-full">
                       <p className="text-neutral-500 dark:text-neutral-400">Проект не найден.</p>
                     </div>
                   )}
                </div>

                {/* Footer Buttons */}
                <div className="mt-6 flex justify-end space-x-3 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                      Закрыть
                    </Button>
                    {/* Add other actions if needed */}
                  </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ProjectFinancialsDialog; 