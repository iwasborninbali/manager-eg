'use client';

import React, { useState, Fragment, useCallback, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Timestamp, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { DepartmentInvoice } from '@/components/budgets/DepartmentInvoiceList'; // Import DepartmentInvoice type

// Interface for the data structure saved to Firestore
interface DepartmentClosingDocumentData {
    departmentInvoiceId: string;
    fileName: string;
    fileURL: string;
    uploadedAt: Timestamp;
    comment?: string | null;
    type?: 'contract' | 'upd' | 'act' | 'other' | null;
    date?: Timestamp | null;
}

// Props Interface
interface UploadDepartmentClosingDocDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (docIds: string[]) => void; // Callback on success
  departmentInvoices: DepartmentInvoice[]; // Pass the list of department invoices
  suppliers: { [id: string]: { id: string; name?: string; } }; // Suppliers map remains useful
}

// --- Helper Functions --- (Copied from UploadClosingDocumentDialog)
const formatDate = (timestamp: Timestamp | undefined | null): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('ru-RU'); // Short format
};
const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};
// --- End Helper Functions ---

const UploadDepartmentClosingDocDialog: React.FC<UploadDepartmentClosingDocDialogProps> = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    departmentInvoices, // Receive department invoices
    suppliers 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [docType, setDocType] = useState<'contract' | 'upd' | 'act' | 'other' | '' >('');
  const [docDate, setDocDate] = useState(''); 
  const [selectedDeptInvoiceIds, setSelectedDeptInvoiceIds] = useState<string[]>([]); // State for selected IDs
  const [invoiceSelectionError, setInvoiceSelectionError] = useState<string | null>(null);

  // Memoize sorted invoices
  const sortedDeptInvoices = useMemo(() => 
      [...departmentInvoices].sort((a, b) => (b.dueDate?.toMillis() ?? 0) - (a.dueDate?.toMillis() ?? 0)), 
      [departmentInvoices]
  );

  const resetForm = useCallback(() => {
    setFile(null);
    setFileError(null);
    setLoading(false);
    setComment('');
    setDocType('');
    setDocDate('');
    setSelectedDeptInvoiceIds([]); // Reset selected invoices
    setInvoiceSelectionError(null);
  }, []);

  const handleClose = () => {
    if (loading) return; 
    resetForm();
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const maxSize = 15 * 1024 * 1024; // 15 MB limit
      if (selectedFile.size > maxSize) {
        setFileError('Файл слишком большой (макс. 15 МБ).');
        setFile(null);
      } else {
        setFileError(null);
        setFile(selectedFile);
      }
    } else {
      setFile(null);
      setFileError(null);
    }
  };

  const handleInvoiceSelectionChange = (deptInvoiceId: string) => {
    setSelectedDeptInvoiceIds(prev => 
        prev.includes(deptInvoiceId) 
            ? prev.filter(id => id !== deptInvoiceId) 
            : [...prev, deptInvoiceId]
    );
    setInvoiceSelectionError(null); // Clear error on change
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFileError(null);
    setInvoiceSelectionError(null);

    if (!file) { 
        setFileError("Не выбран файл для загрузки.");
        return;
    }
    if (selectedDeptInvoiceIds.length === 0) {
        setInvoiceSelectionError("Не выбран ни один счет для приложения документа.");
        return;
    }
    if (loading) return;

    setLoading(true);

    try {
      // 1. Upload file to Storage (NEW PATH)
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Store directly under a general folder, linking via Firestore doc ID later might be complex
      // Let's store under a dedicated path, maybe using the document ID eventually?
      // For now: department_closing_documents/{timestamp}_{filename}
      const storagePath = `department_closing_documents/${Date.now()}_${sanitizedFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // 2. Prepare base data
      const baseDocData: Omit<DepartmentClosingDocumentData, 'departmentInvoiceId'> = {
        fileName: file.name,
        fileURL: downloadURL,
        uploadedAt: Timestamp.now(),
        comment: comment || null,
        type: docType || null,
        date: docDate ? Timestamp.fromDate(new Date(docDate)) : null,
      };
      
       // Remove null/empty fields
       const cleanBaseDocData = { ...baseDocData };
       Object.keys(cleanBaseDocData).forEach(keyStr => {
           const key = keyStr as keyof typeof cleanBaseDocData;
           if (cleanBaseDocData[key] === null || cleanBaseDocData[key] === '') {
               delete cleanBaseDocData[key];
           }
       });

      // 3. Save document metadata to Firestore for EACH selected invoice
      const createdDocIds: string[] = [];
      const promises = selectedDeptInvoiceIds.map(deptInvId => {
          const finalDocData: DepartmentClosingDocumentData = { 
              ...cleanBaseDocData,
              departmentInvoiceId: deptInvId // Use department invoice ID
          }; 
          // NEW COLLECTION: departmentClosingDocuments
          return addDoc(collection(db, 'departmentClosingDocuments'), finalDocData); 
      });
      
      const results = await Promise.all(promises);
      results.forEach(docRef => createdDocIds.push(docRef.id));

      console.log('Department closing documents uploaded for invoices:', selectedDeptInvoiceIds, ' Doc IDs:', createdDocIds);
      onSuccess(createdDocIds);
      handleClose();

    } catch (error: unknown) {
      console.error('Error uploading department closing document:', error);
      const message = error instanceof Error ? error.message : 'Ошибка загрузки файла или сохранения данных. Попробуйте еще раз.';
      setFileError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}> {/* High z-index */} 
        {/* Overlay */}
        <Transition.Child /* ... */ >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        {/* Dialog Content */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child /* ... */ >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  <span>Загрузить закр. документ (Бюджет отдела)</span>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    <span className="sr-only">Закрыть</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {/* Invoice Selection List */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Применить к счетам отдела *</label>
                        {invoiceSelectionError && <p className="text-xs text-error-500 mb-2">{invoiceSelectionError}</p>}
                        <div className="max-h-60 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 space-y-2 bg-neutral-50 dark:bg-neutral-900/50">
                            {sortedDeptInvoices.length === 0 ? (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-2">Счетов для выбора нет.</p>
                            ) : (
                                sortedDeptInvoices.map(invoice => {
                                    const supplierName = invoice.supplierId ? suppliers[invoice.supplierId]?.name : 'Без поставщика';
                                    const isChecked = selectedDeptInvoiceIds.includes(invoice.id);
                                    return (
                                        <label 
                                            key={invoice.id} 
                                            className={cn(
                                                "flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors",
                                                isChecked ? 'bg-primary-100 dark:bg-primary-900/50' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700/50'
                                            )}
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={isChecked} 
                                                onChange={() => handleInvoiceSelectionChange(invoice.id)}
                                                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-primary-600 dark:ring-offset-neutral-900"
                                                disabled={loading}
                                            />
                                            <div className="text-sm">
                                                <span className="font-medium text-neutral-800 dark:text-neutral-200">{supplierName}</span>
                                                <span className="text-neutral-600 dark:text-neutral-400 ml-2">{formatCurrency(invoice.amount)}</span>
                                                <span className="text-xs text-neutral-500 dark:text-neutral-500 block">Срок: {formatDate(invoice.dueDate)}</span>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* File Input */}
                     <div>
                        <label htmlFor="deptClosingDocFile" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Файл документа *</label>
                        <Input
                            type="file"
                            id="deptClosingDocFile"
                            name="deptClosingDocFile"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.heic"
                            disabled={loading}
                            fileNameDisplay={file?.name} // Assuming Input supports this
                            error={fileError || undefined}
                        />
                        {/* Display selected file name if Input doesn't */} 
                        {!Input.hasOwnProperty('fileNameDisplay') && file && (
                             <p className="text-xs mt-1 text-neutral-600 dark:text-neutral-400">Выбрано: {file.name}</p>
                         )}
                    </div>

                   {/* Document Metadata */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="deptDocType" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Тип документа</label>
                            <select 
                                id="deptDocType"
                                value={docType}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDocType(e.target.value as 'contract' | 'upd' | 'act' | 'other' | '')}
                                disabled={loading}
                                className={cn(
                                    'flex h-10 w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2 text-sm',
                                    'border-neutral-200 dark:border-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0',
                                    'disabled:cursor-not-allowed disabled:opacity-50'
                                )}
                            >
                                <option value="">Не выбран</option>
                                <option value="contract">Договор</option>
                                <option value="upd">УПД</option>
                                <option value="act">Акт</option>
                                <option value="other">Другое</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="deptDocDate" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Дата документа</label>
                            <Input 
                                type="date"
                                id="deptDocDate"
                                value={docDate}
                                onChange={(e) => setDocDate(e.target.value)}
                                disabled={loading}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                             />
                        </div>
                   </div>
                   
                   <div>
                        <label htmlFor="deptComment" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Комментарий</label>
                        <Input
                            type="text"
                            id="deptComment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Необязательный комментарий"
                            disabled={loading}
                         />
                    </div>

                   {/* Submit Button */}
                   <div className="mt-6">
                        <Button 
                            type="submit"
                            className="w-full"
                            disabled={loading || !file || selectedDeptInvoiceIds.length === 0}
                            isLoading={loading}
                        >
                           {loading ? 'Загрузка...' : 'Загрузить документ'}
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

export default UploadDepartmentClosingDocDialog; 