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

// --- Interfaces (Should match ProjectDetailsDialog) ---
interface Invoice {
  id: string;
  amount?: number;
  dueDate?: Timestamp;
  supplierId?: string;
  // Add other relevant fields displayed in the selection list
}

interface Supplier {
  id: string;
  name?: string;
}
// --- End Interfaces ---

// Interface for the data structure saved to Firestore
interface ClosingDocumentData {
    projectId: string;
    invoiceId?: string;
    fileName: string;
    fileURL: string;
    uploadedAt: Timestamp;
    comment?: string | null;
    type?: 'contract' | 'upd' | 'act' | 'other' | null;
    date?: Timestamp | null;
}

interface UploadClosingDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (docIds: string[]) => void; // Changed signature
  projectId: string;
  invoices: Invoice[]; // Changed from invoiceId
  suppliers: { [id: string]: Supplier }; // Added suppliers map
}

// Helper (can be moved to utils)
const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('ru-RU'); // Short format for list
};
const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const UploadClosingDocumentDialog: React.FC<UploadClosingDocumentDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  invoices, // Use invoices list
  suppliers, // Use suppliers map
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [docType, setDocType] = useState<'contract' | 'upd' | 'act' | 'other' | '' >('');
  const [docDate, setDocDate] = useState(''); 
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]); // State for selected IDs
  const [invoiceSelectionError, setInvoiceSelectionError] = useState<string | null>(null);

  // Memoize sorted invoices for stable rendering
  const sortedInvoices = useMemo(() => 
      [...invoices].sort((a, b) => (b.dueDate?.toMillis() ?? 0) - (a.dueDate?.toMillis() ?? 0)), 
      [invoices]
  );

  const resetForm = useCallback(() => {
    setFile(null);
    setFileError(null);
    setLoading(false);
    setComment('');
    setDocType('');
    setDocDate('');
    setSelectedInvoiceIds([]); // Reset selected invoices
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
      // Basic validation (e.g., size)
      const maxSize = 15 * 1024 * 1024; // 15 MB limit for closing docs
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

  const handleInvoiceSelectionChange = (invoiceId: string) => {
    setSelectedInvoiceIds(prev => 
        prev.includes(invoiceId) 
            ? prev.filter(id => id !== invoiceId) // Uncheck: remove ID
            : [...prev, invoiceId] // Check: add ID
    );
    setInvoiceSelectionError(null); // Clear error on selection change
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFileError(null);
    setInvoiceSelectionError(null);

    if (!file) { 
        setFileError("Не выбран файл для загрузки.");
        return;
    }
    if (selectedInvoiceIds.length === 0) {
        setInvoiceSelectionError("Не выбран ни один счет для приложения документа.");
        return;
    }
    if (loading) return;

    setLoading(true);

    try {
      // 1. Upload file to Storage (NEW PATH)
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `projects/${projectId}/closing_documents/${Date.now()}_${sanitizedFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // 2. Prepare base data (Use the new interface instead of any)
      const baseDocData: Omit<ClosingDocumentData, 'invoiceId'> = {
        projectId,
        fileName: file.name,
        fileURL: downloadURL,
        uploadedAt: Timestamp.now(),
        comment: comment || null,
        type: docType || null,
        date: docDate ? Timestamp.fromDate(new Date(docDate)) : null,
      };
      
       // Remove null fields from base data
       const cleanBaseDocData = { ...baseDocData };
       Object.keys(cleanBaseDocData).forEach(keyStr => {
           const key = keyStr as keyof typeof cleanBaseDocData;
           if (cleanBaseDocData[key] === null || cleanBaseDocData[key] === '') {
               delete cleanBaseDocData[key];
           }
       });

      // 3. Save document metadata to Firestore for EACH selected invoice
      const createdDocIds: string[] = [];
      const promises = selectedInvoiceIds.map(invId => {
          // Combine clean base data with the specific invoiceId
          const finalDocData: ClosingDocumentData = { 
              ...cleanBaseDocData,
              invoiceId: invId 
          }; 
          return addDoc(collection(db, 'closingDocuments'), finalDocData);
      });
      
      const results = await Promise.all(promises);
      results.forEach(docRef => createdDocIds.push(docRef.id));

      console.log('Closing documents uploaded for invoices:', selectedInvoiceIds, ' Doc IDs:', createdDocIds);
      onSuccess(createdDocIds);
      handleClose();

    } catch (error: unknown) {
      console.error('Error uploading closing document:', error);
      const message = error instanceof Error ? error.message : 'Ошибка загрузки файла или сохранения данных. Попробуйте еще раз.';
      setFileError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}> {/* Ensure high z-index */}
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
                  <span>Загрузить закрывающий документ</span>
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
                        <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Применить к счетам *</label>
                        {invoiceSelectionError && <p className="text-xs text-error-500 mb-2">{invoiceSelectionError}</p>}
                        <div className="max-h-60 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 space-y-2 bg-neutral-50 dark:bg-neutral-900/50">
                            {sortedInvoices.length === 0 ? (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-2">Счетов для выбора нет.</p>
                            ) : ( 
                                sortedInvoices.map(invoice => {
                                    const supplierName = invoice.supplierId ? suppliers[invoice.supplierId]?.name : 'Без поставщика';
                                    const isChecked = selectedInvoiceIds.includes(invoice.id);
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
                        <label htmlFor="closingDocFile" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Файл документа *</label>
                        <Input
                            type="file"
                            id="closingDocFile"
                            name="closingDocFile"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.heic"
                            disabled={loading}
                            fileNameDisplay={file?.name}
                            error={fileError || undefined}
                        />
                    </div>

                   {/* Document Metadata */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="docType" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Тип документа</label>
                            <select 
                                id="docType"
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
                            <label htmlFor="docDate" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Дата документа</label>
                            <Input 
                                type="date"
                                id="docDate"
                                value={docDate}
                                onChange={(e) => setDocDate(e.target.value)}
                                disabled={loading}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                             />
                        </div>
                   </div>
                   
                   <div>
                        <label htmlFor="comment" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Комментарий</label>
                        <Input
                            type="text"
                            id="comment"
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
                            disabled={loading || !file || selectedInvoiceIds.length === 0} // Updated disabled condition
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

export default UploadClosingDocumentDialog; 