'use client';

import React, { useState, useEffect, useCallback, useRef, Fragment, ChangeEvent } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { invoiceSchema, InvoiceData } from '@/lib/invoiceSchema'; // Use project invoice schema
import SupplierCombobox, { SupplierOption } from '@/components/shared/SupplierCombobox';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

// Define props interface
interface UploadInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
  projectId: string; // Required project ID
}

// Derive form data type from Zod schema
type InvoiceFormData = Zod.infer<typeof invoiceSchema>;

export default function UploadInvoiceDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId
}: UploadInvoiceDialogProps) {

  const { user, userData } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSupplierOption, setSelectedSupplierOption] = useState<SupplierOption | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      projectId: projectId, // Pre-fill projectId
      supplierId: '',
      amount: undefined,
      dueDate: undefined,
      isUrgent: false,
      comment: '',
      // fileURL and fileName are handled separately
      // status, uploadedAt, paidAt, submitterUid, submitterName are set on submission
    },
  });

  // Effect to update default projectId if it changes while dialog is open (optional)
  useEffect(() => {
    if (isOpen) {
        setValue('projectId', projectId);
    }
  }, [projectId, isOpen, setValue]);

  // Reset form and state when dialog opens/closes
  const handleClose = useCallback((resetForm = true) => {
    if (!isOpen && resetForm) return;

    setSelectedFile(null);
    setUploadProgress(0);
    setFileError(null);
    setServerError(null);
    setIsSubmitting(false);
    setSelectedSupplierOption(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Reset form with default values including the current projectId
    reset({
      projectId: projectId,
      supplierId: '',
      amount: undefined,
      dueDate: undefined,
      isUrgent: false,
      comment: '',
    });
    onClose();
  }, [isOpen, onClose, reset, projectId]);


  useEffect(() => {
    if (isOpen) {
        // Reset state, form is reset in handleClose or on initial open via defaultValues
       setSelectedFile(null);
       setUploadProgress(0);
       setFileError(null);
       setServerError(null);
       setIsSubmitting(false);
       setSelectedSupplierOption(null);
       if (fileInputRef.current) {
           fileInputRef.current.value = "";
       }
       // Optionally reset form explicitly if needed beyond defaultValues
       reset({
         projectId: projectId,
         supplierId: '',
         amount: undefined,
         dueDate: undefined,
         isUrgent: false,
         comment: '',
       });
    }
  }, [isOpen, reset, projectId]);


  // File selection handler
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const maxSize = 15 * 1024 * 1024; // 15MB limit
      if (file.size > maxSize) {
        setFileError("Файл слишком большой (макс. 15MB)");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
      setFileError(null);
    } else {
      setSelectedFile(null);
    }
  };

  // Form submission handler
  const onSubmit: SubmitHandler<InvoiceFormData> = async (data) => {
    if (!selectedFile) {
      setFileError('Пожалуйста, выберите файл счета.');
      return;
    }
    if (!user || !userData) {
      setServerError("Не удалось получить данные пользователя. Пожалуйста, войдите снова.");
      return;
    }
    // Ensure projectId is set (should be from defaultValues/useEffect)
    if (!data.projectId) {
         setServerError("Не удалось определить ID проекта.");
         return;
    }


    setIsSubmitting(true);
    setServerError(null);
    setFileError(null);
    setUploadProgress(0);

    try {
      const filePath = `project_invoices/${data.projectId}/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Upload failed:", error);
            setFileError(`Ошибка загрузки файла: ${error.code}`);
            setIsSubmitting(false);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              // Data validated by Zod resolver is in `data` argument
              // Construct the final object matching Firestore structure
              const invoiceDataToSave: Omit<InvoiceData, 'id' | 'dueDate' | 'paidAt'> & { dueDate: Timestamp | null; paidAt?: Timestamp | null } = {
                   projectId: data.projectId,
                   supplierId: data.supplierId,
                   amount: data.amount, 
                   dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
                   isUrgent: data.isUrgent,
                   comment: data.comment || null,
                   fileURL: downloadURL,
                   fileName: selectedFile.name,
                   status: 'pending_payment', // Default status
                   uploadedAt: serverTimestamp() as Timestamp,
                   // paidAt is not set on initial upload
                   submitterUid: user.uid,
                   submitterName: userData.displayName || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || user.email || 'Неизвестный пользователь',
               };

              const docRef = await addDoc(collection(db, 'invoices'), invoiceDataToSave);
              console.log('Project invoice uploaded successfully! ID:', docRef.id);
              onSuccess(docRef.id); // Callback on success
              handleClose(true);   // Close and reset
              resolve();
            } catch (firestoreError) {
              console.error("Error saving invoice data to Firestore: ", firestoreError);
              setServerError("Ошибка сохранения данных счета в базе данных.");
              setIsSubmitting(false);
              reject(firestoreError);
            }
          }
        );
      });

    } catch (error) {
      if (!fileError && !serverError) {
        setServerError("Произошла непредвиденная ошибка при загрузке.");
      }
      console.error("Overall submission error: ", error);
      setIsSubmitting(false);
    }
  };


  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => handleClose(false)}>
        {/* Overlay */}
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            {/* Panel */}
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Title */}
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  Загрузить счет для проекта
                  <button type="button" className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none" onClick={() => handleClose(false)} aria-label="Закрыть">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                  {/* Supplier */}
                  <div>
                    <Label htmlFor="supplierId">Поставщик *</Label>
                    <Controller
                      name="supplierId"
                      control={control}
                      render={({ field }) => (
                        <SupplierCombobox
                          value={selectedSupplierOption}
                          onChange={(supplierOption) => {
                            setSelectedSupplierOption(supplierOption);
                            field.onChange(supplierOption ? supplierOption.id : '');
                          }}
                          disabled={isSubmitting}
                          error={!!errors.supplierId}
                        />
                      )}
                    />
                    {errors.supplierId && <p className="text-sm text-red-600 mt-1">{errors.supplierId.message}</p>}
                  </div>

                  {/* Amount */}
                  <div>
                    <Label htmlFor="amount">Сумма *</Label>
                    <Input id="amount" type="number" step="0.01" {...register("amount")} placeholder="10000.00" className="mt-1" />
                    {errors.amount && <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>}
                  </div>

                  {/* Due Date */}
                  <div>
                    <Label htmlFor="dueDate">Срок оплаты</Label>
                    <Controller
                      name="dueDate"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="dueDate"
                          type="date"
                          className="mt-1"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            field.onChange(e.target.value ? new Date(e.target.value) : undefined);
                          }}
                          ref={field.ref}
                          disabled={isSubmitting}
                        />
                      )}
                    />
                    {errors.dueDate && <p className="text-sm text-red-600 mt-1">{errors.dueDate.message}</p>}
                  </div>

                  {/* Comment */}
                    <div>
                      <Label htmlFor="comment">Комментарий</Label>
                      <Input id="comment" {...register("comment")} placeholder="Назначение платежа..." className="mt-1" />
                      {errors.comment && <p className="text-sm text-red-600 mt-1">{errors.comment.message}</p>}
                    </div>

                  {/* File Upload */}
                  <div>
                    <Label htmlFor="projectInvoiceFile" className={cn("flex items-center justify-center cursor-pointer border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-md p-4 text-center hover:border-primary-500 transition-colors", fileError && "border-red-500")}>
                      <ArrowUpTrayIcon className="h-5 w-5 mr-2 text-neutral-500 dark:text-neutral-400" />
                      <span className={cn("text-sm", selectedFile ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400")}>
                        {selectedFile ? selectedFile.name : 'Нажмите или перетащите файл *'}
                      </span>
                      <Input
                        id="projectInvoiceFile"
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.heic"
                        ref={fileInputRef}
                        disabled={isSubmitting}
                      />
                    </Label>
                    {fileError && <p className="text-sm text-red-600 mt-1">{fileError}</p>}
                    {/* Upload Progress Bar */}
                    {uploadProgress > 0 && (
                      <div className="w-full bg-neutral-200 dark:bg-neutral-600 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div className="bg-primary-600 h-full rounded-full transition-width duration-300 ease-in-out" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    )}
                  </div>

                   {/* Urgent Checkbox */}
                   <div className="flex items-center space-x-2">
                     <input
                        id="isUrgent"
                        type="checkbox"
                        {...register("isUrgent")}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600"
                     />
                     <Label htmlFor="isUrgent" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Срочный платеж
                     </Label>
                   </div>

                  {serverError && (
                    <p className="text-sm text-red-600 mt-2 text-center bg-red-100 dark:bg-red-900/30 p-2 rounded-md">{serverError}</p>
                  )}

                  {/* Footer Buttons */}
                  <div className="mt-6 flex justify-end space-x-3 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                    <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={isSubmitting || uploadProgress > 0 && uploadProgress < 100}>
                      {isSubmitting ? (uploadProgress > 0 ? `Загрузка... ${Math.round(uploadProgress)}%` : 'Сохранение...') : 'Загрузить счет'}
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
}