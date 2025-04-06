'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Timestamp, doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Define User interface for managers list
interface ManagerUser {
    uid: string;
    name: string; // Combine first/last or use displayName
}

// Define Project interface (or import)
interface Project {
    id: string;
    actual_budget?: number; // Renamed from budget (Себестоимость - факт)
    planned_budget?: number; // Added (Себестоимость - план)
    createdAt?: Timestamp;
    customer?: string;
    duedate?: Timestamp;
    estimatecostlink?: string;
    managerid?: string; // Keep managerid
    name?: string;
    number?: string;
    planned_revenue?: number; // Выручка - план
    actual_revenue?: number; // Added (Выручка - факт)
    presentationlink?: string;
    status?: string;
    updatedAt?: Timestamp;
    description?: string;
    usn_tax?: number; // УСН 1,5%
    nds_tax?: number; // НДС 5%
}

// Separate interface for form data to handle date string
interface EditProjectFormData {
    name?: string;
    number?: string;
    customer?: string;
    duedate?: string; // Store date as YYYY-MM-DD string
    budget?: number; // Represents actual_budget in form
    planned_revenue?: number; // Represents actual_revenue in form
    estimatecostlink?: string;
    presentationlink?: string;
    managerid?: string; // Add managerid to form data
    status?: string;
    description?: string;
    usn_tax?: number;
    nds_tax?: number;
}

interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSuccess?: (updatedProject: Partial<Project>) => void; // Optional success callback
}

const EditProjectDialog: React.FC<EditProjectDialogProps> = ({ isOpen, onClose, project, onSuccess }) => {
  // Use the specific form data interface for state
  const [formData, setFormData] = useState<EditProjectFormData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);

  // Fetch managers
  useEffect(() => {
    const fetchManagers = async () => {
      if (!isOpen) return;
      setLoadingManagers(true);
      setManagers([]); // Clear previous managers
      setError(null); // Clear previous errors
      try {
        const usersRef = collection(db, 'users');
        // Add the query to filter by role 'Manager'
        const q = query(usersRef, where('role', 'array-contains', 'Manager'));
        const querySnapshot = await getDocs(q);
        const managerList: ManagerUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Construct name (adjust based on your user data structure)
          const name = data.displayName || `${data.first_name || ''} ${data.last_name || ''}`.trim() || doc.id;
          managerList.push({ uid: doc.id, name: name });
        });
        setManagers(managerList);
      } catch (err) {
        console.error("Error fetching managers:", err);
        setError("Не удалось загрузить список менеджеров."); // Add specific error
      } finally {
        setLoadingManagers(false);
      }
    };
    fetchManagers();
  }, [isOpen]);

  // Initialize form data correctly, converting Timestamp to string
  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        name: project.name ?? '',
        number: project.number ?? '',
        customer: project.customer ?? '',
        duedate: project.duedate ? project.duedate.toDate().toISOString().split('T')[0] : '',
        budget: project.actual_budget ?? undefined, // Use actual_budget
        planned_revenue: project.actual_revenue ?? undefined, // Use actual_revenue
        estimatecostlink: project.estimatecostlink ?? '',
        presentationlink: project.presentationlink ?? '',
        managerid: project.managerid ?? '', // Initialize managerid
        status: project.status ?? 'planning',
        description: project.description ?? '',
        usn_tax: project.usn_tax ?? undefined,
        nds_tax: project.nds_tax ?? undefined,
      });
      setError(null);
    } else if (!isOpen) {
        // Clear form when closed
         setFormData({});
         setError(null);
         setLoading(false);
         setManagers([]); // Clear managers on close
    }
  }, [project, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Handle number inputs explicitly, converting empty string to undefined
    const val = type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  // Handler specifically for Select component (shadcn UI)
  const handleManagerChange = (value: string) => {
    setFormData(prev => ({ ...prev, managerid: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Keep the null check for project
    if (!project) {
        setError("Ошибка: Данные проекта отсутствуют.");
        return;
    }
    if (loading) return;
    setLoading(true);
    setError(null);

    // Revert update logic to previous state to fix type errors
    try {
       // Prepare data for update, converting date string back to Timestamp
       const updateData: Partial<Project> = {
         name: formData.name,
         number: formData.number,
         customer: formData.customer,
         duedate: formData.duedate ? Timestamp.fromDate(new Date(formData.duedate)) : undefined,
         // Map form fields to the correct Project interface fields for Firestore update
         actual_budget: formData.budget ? parseFloat(String(formData.budget)) : undefined,
         actual_revenue: formData.planned_revenue ? parseFloat(String(formData.planned_revenue)) : undefined,
         managerid: formData.managerid, // Include managerid
         estimatecostlink: formData.estimatecostlink,
         presentationlink: formData.presentationlink,
         status: formData.status,
         description: formData.description,
         usn_tax: formData.usn_tax ? parseFloat(String(formData.usn_tax)) : undefined,
         nds_tax: formData.nds_tax ? parseFloat(String(formData.nds_tax)) : undefined,
         updatedAt: Timestamp.now(),
       };

       // Remove undefined, null, or empty string fields before updating
       Object.keys(updateData).forEach(keyStr => {
         const key = keyStr as keyof Partial<Project>;
         if (updateData[key] === undefined || updateData[key] === null || updateData[key] === '') {
             delete updateData[key];
         }
       });

       if (!updateData.name) {
           throw new Error("Название проекта обязательно.");
       }

       const projectRef = doc(db, 'projects', project.id);
       await updateDoc(projectRef, updateData);

       console.log("Project updated successfully with data:", updateData);
       onSuccess?.(updateData);
       onClose();

     } catch (err: unknown) { // Specify type as unknown
       console.error("Error updating project:", err);
       // Type guard for error message
       const message = err instanceof Error ? err.message : "Не удалось обновить проект. Попробуйте снова.";
       setError(message);
     } finally {
       setLoading(false);
     }
   };

  if (!project) return null; // Should not happen if isOpen is true based on parent logic

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[51]" onClose={() => !loading && onClose()}> {/* Prevent closing while loading */}
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
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  <span>Редактировать проект: {project.name || 'Без имени'}</span>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                    onClick={onClose}
                    disabled={loading}
                  >
                    <span className="sr-only">Закрыть</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                  {/* --- Form Fields (similar structure as before) --- */}
                  {/* Row 1: Name & Number */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Название проекта</label>
                      <Input type="text" id="name" name="name" value={formData.name || ''} onChange={handleChange} required disabled={loading} />
                    </div>
                    <div>
                      <label htmlFor="number" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Номер проекта</label>
                      <Input type="text" id="number" name="number" value={formData.number || ''} onChange={handleChange} disabled={loading} />
                    </div>
                  </div>

                  {/* Row 2: Customer & Due Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                      <label htmlFor="customer" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Заказчик</label>
                      <Input type="text" id="customer" name="customer" value={formData.customer || ''} onChange={handleChange} disabled={loading} />
                    </div>
                    <div>
                      <label htmlFor="duedate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Срок сдачи</label>
                      <Input type="date" id="duedate" name="duedate" value={formData.duedate || ''} onChange={handleChange} disabled={loading} />
                    </div>
                  </div>

                  {/* Row 3: Budget & Planned Revenue */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="budget" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Бюджет (Факт, RUB)</label>
                      <Input type="number" id="budget" name="budget" value={formData.budget ?? ''} onChange={handleChange} leftElement={<span className="text-sm">₽</span>} disabled={loading} />
                    </div>
                     <div>
                      <label htmlFor="planned_revenue" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Выручка (Факт, RUB)</label>
                      <Input type="number" id="planned_revenue" name="planned_revenue" value={formData.planned_revenue ?? ''} onChange={handleChange} leftElement={<span className="text-sm">₽</span>} disabled={loading} />
                    </div>
                  </div>
                  
                   {/* Row 4: Taxes (USN & NDS) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="usn_tax" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">УСН 1,5% (RUB)</label>
                      <Input type="number" id="usn_tax" name="usn_tax" value={formData.usn_tax ?? ''} onChange={handleChange} leftElement={<span className="text-sm">₽</span>} disabled={loading} />
                    </div>
                     <div>
                      <label htmlFor="nds_tax" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">НДС 5% (RUB, опционально)</label>
                      <Input type="number" id="nds_tax" name="nds_tax" value={formData.nds_tax ?? ''} onChange={handleChange} leftElement={<span className="text-sm">₽</span>} disabled={loading} />
                    </div>
                  </div>

                  {/* Row 5: Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Описание</label>
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600 dark:text-white sm:text-sm disabled:opacity-50"
                      value={formData.description || ''}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                  
                  {/* Row 6: Links */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="estimatecostlink" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Ссылка на смету</label>
                      <Input type="url" id="estimatecostlink" name="estimatecostlink" value={formData.estimatecostlink || ''} onChange={handleChange} disabled={loading} />
                    </div>
                     <div>
                      <label htmlFor="presentationlink" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Ссылка на презентацию</label>
                      <Input type="url" id="presentationlink" name="presentationlink" value={formData.presentationlink || ''} onChange={handleChange} disabled={loading} />
                    </div>
                  </div>
                  
                   {/* Row 7: Status & Manager */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label htmlFor="status" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Статус</label>
                       <select
                         id="status"
                         name="status"
                         className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600 dark:text-white sm:text-sm disabled:opacity-50"
                         value={formData.status || ''}
                         onChange={handleChange}
                         disabled={loading}
                       >
                         <option value="planning">Планирование</option>
                         <option value="active">В работе</option>
                         <option value="completed">Завершен</option>
                         <option value="on_hold">На паузе</option>
                         <option value="cancelled">Отменен</option>
                         {/* Add other statuses? */}
                       </select>
                     </div>
                     {/* Manager Selection Dropdown */}
                     <div>
                       <label htmlFor="managerid" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Менеджер</label>
                       <Select
                         value={formData.managerid || ''}
                         onValueChange={handleManagerChange}
                         disabled={loading || loadingManagers}
                       >
                         <SelectTrigger className="w-full mt-1">
                           <div className="flex items-center">
                                <UserCircleIcon className="h-4 w-4 mr-2 opacity-50"/>
                                <SelectValue placeholder={loadingManagers ? "Загрузка..." : "Выберите менеджера"}>
                                    {formData.managerid
                                        ? managers.find(m => m.uid === formData.managerid)?.name ?? formData.managerid
                                        : (loadingManagers ? "Загрузка..." : "Выберите менеджера")
                                    }
                                </SelectValue>
                            </div>
                         </SelectTrigger>
                         <SelectContent>
                            {managers.map((manager) => (
                             <SelectItem key={manager.uid} value={manager.uid}>
                               {manager.name}
                             </SelectItem>
                           ))}
                           {managers.length === 0 && !loadingManagers && (
                               <div className="px-2 py-1.5 text-sm text-neutral-500">Менеджеры не найдены</div>
                           )}
                         </SelectContent>
                       </Select>
                     </div>
                   </div>

                  {/* Error Message */}
                  {error && <p className="mt-2 text-sm text-error-600 dark:text-error-400">{error}</p>}

                  {/* Buttons */}
                  <div className="mt-6 flex justify-end space-x-3 border-t border-neutral-200 dark:border-neutral-700 pt-4 sticky bottom-0 bg-white dark:bg-neutral-800 py-3">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                      Отмена
                    </Button>
                    <Button type="submit" variant="default" isLoading={loading} disabled={loading}> {/* Changed variant to default */}
                      Сохранить изменения
                    </Button>
                  </div>
                </form>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default EditProjectDialog;
