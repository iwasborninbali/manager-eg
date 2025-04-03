'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent, Fragment } from 'react';
import { Dialog, Transition, Switch as HeadlessSwitch } from '@headlessui/react';
import { db, storage } from '@/firebase/config'; // Ensure storage is imported
import { collection, query, getDocs, Timestamp, addDoc, serverTimestamp, where, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Restore storage imports
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { InvoiceData } from '@/lib/invoiceSchema'; // Import the schema
import SupplierCombobox, { SupplierOption } from '@/components/shared/SupplierCombobox';

// Define the structure for projects fetched for the dropdown
interface ProjectOption {
  id: string;
  number?: string; // Use project number for display
  name?: string;
}

// Define the structure for the form data
interface InvoiceFormData {
  projectId: string;
  amount: string;
  dueDate: string;
  isUrgent: boolean;
  comment: string;
  file: File | null; // Add file back
}

// Define the props for the dialog component
interface UploadInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void; // Callback on successful upload
  projectId: string; // Make projectId a required prop
}

// Initial form state
const initialFormData: InvoiceFormData = {
  projectId: '',
  amount: '',
  dueDate: '',
  isUrgent: false,
  comment: '',
  file: null, // Add file back
};

export default function UploadInvoiceDialog({ isOpen, onClose, onSuccess, projectId }: UploadInvoiceDialogProps) {
  // Log received projectId
  console.log("[UploadInvoiceDialog] Received projectId prop:", projectId);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);

  // State for the selected supplier
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);
  const [fileError, setFileError] = useState<string | null>(null); // Restore fileError state

  // Fetch projects when dialog opens
  useEffect(() => {
    if (isOpen) {
      const fetchProjects = async () => {
        setLoading(true); // Use general loading for projects
        setError(null);
        try {
          const projectsRef = collection(db, 'projects');
          const projQ = query(projectsRef); 
          const projSnapshot = await getDocs(projQ);
          const fetchedProjects: ProjectOption[] = [];
          projSnapshot.forEach((doc) => {
            fetchedProjects.push({ id: doc.id, ...doc.data() } as ProjectOption);
          });
          setProjects(fetchedProjects);
        } catch (err) {
          console.error("Error fetching projects:", err);
          setError("Не удалось загрузить список проектов.");
        } finally {
          setLoading(false);
        }
      };
      fetchProjects();
    } else {
      // Reset state when dialog closes
      setProjects([]);
      setFormData(initialFormData);
      setSelectedSupplier(null);
      setError(null);
      setFileError(null); // Reset file error on close
      setLoading(false);
    }
  }, [isOpen]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFileError(null); // Clear previous file errors
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Basic validation (add more checks like size, specific types if needed)
      if (file.size > 10 * 1024 * 1024) { // Example: 10MB limit
        setFileError("Файл слишком большой (макс. 10 МБ).");
        setFormData(prev => ({ ...prev, file: null }));
        e.target.value = ""; // Clear the input
        return;
      }
      // Add accepted types check if desired
      // const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', ...];
      // if (!acceptedTypes.includes(file.type)) { ... }
      
      setFormData(prevData => ({ ...prevData, file: file }));
    } else {
       setFormData(prevData => ({ ...prevData, file: null }));
    }
  };

  const handleSwitchChange = (checked: boolean) => {
     setFormData(prevData => ({ ...prevData, isUrgent: checked }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFileError(null); // Clear file error on submit attempt
    
    // Log projectId at the start of submit
    console.log("[UploadInvoiceDialog] handleSubmit started with projectId:", projectId);

    if (!projectId || !selectedSupplier || !formData.amount || !formData.file) {
      if (!selectedSupplier) setError("Пожалуйста, выберите поставщика из списка.");
      else if (!formData.amount) setError("Пожалуйста, укажите сумму счета.");
      else if (!formData.file) setFileError("Пожалуйста, выберите файл счета."); // Specific file error
      else if (!projectId) setError("Ошибка: ID проекта не найден."); // Should not happen if passed correctly
      else setError("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    setLoading(true);

    try {
      const supplierId = selectedSupplier.id;
      console.log(`Using selected supplier ID: ${supplierId} for project ID: ${projectId}`);
      
      const file = formData.file; // File is guaranteed to exist here by validation

      console.log(`Uploading file ${file.name} for supplier ID: ${supplierId}, project ID: ${projectId}`);
      
      // --- 1. Upload file to Storage --- 
      const filePath = `invoices/${projectId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      console.log("File uploaded successfully:", downloadURL);

      // --- 2. Prepare Invoice Data --- 
      const invoiceDataToSave = {
        projectId: projectId,
        supplierId: supplierId,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate)) : null,
        isUrgent: formData.isUrgent,
        comment: formData.comment || null,
        fileURL: downloadURL, // Use actual download URL
        fileName: file.name, // Use actual file name
        status: 'pending_payment',
        uploadedAt: serverTimestamp(),
      };

      // Remove null fields
      Object.keys(invoiceDataToSave).forEach(keyStr => {
          const key = keyStr as keyof typeof invoiceDataToSave;
          if (invoiceDataToSave[key] === null) {
            delete invoiceDataToSave[key];
          }
      });

      // --- 3. Add Invoice Document --- 
      const invoicesColRef = collection(db, 'invoices');
      const docRef = await addDoc(invoicesColRef, invoiceDataToSave);
      console.log("Invoice document written with ID: ", docRef.id);

      onSuccess(docRef.id);
      onClose();

    } catch (err) {
      console.error("Error saving invoice or uploading file:", err);
      setError("Не удалось сохранить счет. Проверьте данные и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen}>
      <Dialog as="div" className="relative z-50" onClose={() => !loading && onClose()}>
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

        {/* Dialog Content Container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            
            {/* Dialog Panel Transition */}
            <Transition.Child
               as={Fragment}
               enter="ease-out duration-300"
               enterFrom="opacity-0 scale-95"
               enterTo="opacity-100 scale-100"
               leave="ease-in duration-200"
               leaveFrom="opacity-100 scale-100"
               leaveTo="opacity-0 scale-95"
             >
              {/* The Actual Dialog Panel */}
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                
                {/* Dialog Title */}
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  <span>Загрузка счета</span>
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
                
                {/* Form Start */}
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  
                  {/* Supplier Combobox */}
                   <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Поставщик *</label>
                        <SupplierCombobox 
                            value={selectedSupplier}
                            onChange={setSelectedSupplier}
                            disabled={loading}
                            error={!!error && !selectedSupplier}
                        />
                   </div> 
                  
                  {/* Amount and Due Date */} 
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <Input 
                           type="number" 
                           id="amount" 
                           name="amount" 
                           value={formData.amount} 
                           onChange={handleInputChange} 
                           label="Сумма *" 
                           leftElement={<span className="text-sm">₽</span>} 
                           required 
                           step="0.01" 
                           disabled={loading}
                       />
                       <Input 
                           type="date" 
                           id="dueDate" 
                           name="dueDate" 
                           value={formData.dueDate} 
                           onChange={handleInputChange} 
                           label="Срок оплаты" 
                           disabled={loading}
                       /> 
                  </div>

                  {/* File Input - Use fileNameDisplay prop */}
                  <div className="space-y-1.5">
                    <label htmlFor="file" className="block text-sm font-medium leading-none text-neutral-700 dark:text-neutral-300">Файл счета *</label>
                    <Input 
                        type="file" 
                        id="file" 
                        name="file" 
                        onChange={handleFileChange} 
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.heic"
                        className={fileError ? 'border-error-500 ring-error-500' : ''}
                        disabled={loading}
                        fileNameDisplay={formData.file?.name} // Pass the selected file name
                    />
                    {fileError && <p className="text-xs text-error-500 mt-1">{fileError}</p>}
                    {/* No longer need to display file name separately here */}
                    {/* {formData.file && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Выбран файл: {formData.file.name}</p>} */}
                 </div>

                  {/* Comment */} 
                  <div className="space-y-1.5">
                   <label htmlFor="comment" className="block text-sm font-medium leading-none text-neutral-700 dark:text-neutral-300">Комментарий</label>
                   <textarea 
                       id="comment" 
                       name="comment" 
                       rows={3} 
                       value={formData.comment} 
                       onChange={handleInputChange} 
                       className="flex min-h-[80px] w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" 
                       placeholder="e.g., Оплата услуг по договору №123" 
                       disabled={loading}
                   />
                  </div>
                  
                  {/* Urgent Payment Switch */} 
                  <div className="flex items-center justify-between pt-2">
                     <HeadlessSwitch.Group as="div" className="flex items-center">
                       <HeadlessSwitch.Label className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mr-4">
                         Срочный платеж?
                       </HeadlessSwitch.Label>
                       <HeadlessSwitch 
                           checked={formData.isUrgent} 
                           onChange={handleSwitchChange} 
                           disabled={loading} 
                           className={cn(
                               formData.isUrgent ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
                               'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
                            )}
                        >
                         <span className="sr-only">Срочный платеж</span>
                         <span 
                           aria-hidden="true" 
                           className={cn(
                               formData.isUrgent ? 'translate-x-5' : 'translate-x-0',
                               'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            )}
                          />
                       </HeadlessSwitch>
                     </HeadlessSwitch.Group>
                  </div>

                  {/* General Error Message */} 
                  {error && (
                   <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-700 dark:bg-error-900/50 dark:text-error-300">
                     <p className="font-medium">Ошибка</p>
                     <p>{error}</p>
                   </div>
                  )}

                  {/* Footer with buttons */} 
                  <div className="mt-6 flex justify-end space-x-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                   <Button 
                       type="button" 
                       variant="outline" 
                       onClick={onClose} 
                       disabled={loading}
                    >
                     Отмена
                   </Button>
                   <Button 
                       type="submit" 
                       variant="default" 
                       isLoading={loading}
                       disabled={loading} 
                    >
                     Загрузить счет
                   </Button>
                  </div>

                </form> 
                {/* Form End */} 

              </Dialog.Panel> 
              {/* End Actual Dialog Panel */} 

            </Transition.Child> 
            {/* End Dialog Panel Transition */} 

          </div> 
          {/* End Centering Container */} 

        </div> 
        {/* End Dialog Content Container */} 

      </Dialog> 
      {/* End Dialog */} 
      
    </Transition> 
  );
} 