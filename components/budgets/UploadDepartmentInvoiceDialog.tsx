'use client';

import React, { useState, useEffect, useCallback, useRef, Fragment, ChangeEvent } from 'react';
import { useForm, SubmitHandler, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
// Corrected imports for renamed UI components
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea'; // Assuming Textarea exists and is needed for comment
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"; // Import Select components
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { z } from 'zod'; // Import Zod
// Remove Select, Calendar, Popover imports if not used directly here
// Keep existing schema imports, but will modify schema usage
import { departmentInvoiceSchema as baseDepartmentInvoiceSchema, DepartmentInvoiceData } from '@/lib/departmentInvoiceSchema';
import SupplierCombobox, { SupplierOption } from '@/components/shared/SupplierCombobox';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

// Use the base schema directly as it already defines the required fields for the form
const formSchema = baseDepartmentInvoiceSchema;

// Type for form data derived from the new schema
type DepartmentInvoiceFormData = z.infer<typeof formSchema>;

// Define category options STRUCTURE
const categoryMap: Record<string, { value: string; label: string }[]> = {
    'EG': [
      { value: 'Salary - Fixed', label: 'Зарплата - оклад' },
      { value: 'Salary - Percentage', label: 'Зарплата - процент' },
      { value: 'Business Trip', label: 'Командировки' },
      { value: 'Project Specific', label: 'Проектные' },
      { value: 'Tender Support', label: 'Тендерное сопровождение' },
      { value: 'Other EG', label: 'Другое (EG)' },
    ],
    'Brand Group': [
      { value: 'Salary - Fixed', label: 'Зарплата - оклад' },
      { value: 'Salary - Percentage', label: 'Зарплата - процент' },
      { value: 'Printing', label: 'Типографии' },
      { value: 'Installation', label: 'Монтажники' },
      { value: 'Procurement', label: 'Закупки' },
      { value: 'Contractors', label: 'Подрядчики' },
      { value: 'Production', label: 'Производство' },
      { value: 'Other Brand Group', label: 'Другое (Brand Group)' },
    ],
    'Imagineers': [
      { value: 'Salary - Fixed', label: 'Зарплата - оклад' },
      { value: 'Salary - Percentage', label: 'Зарплата - процент' },
      { value: 'Business Trip', label: 'Командировки' },
      { value: 'Production', label: 'Производство' },
      { value: 'Other Imagineers', label: 'Другое (Imagineers)' },
    ],
    'БЭКОФИС': [
      { value: 'HR', label: 'HR' },
      { value: 'Office', label: 'Офис' },
      { value: 'Other Backoffice', label: 'Другое (БЭКОФИС)' },
    ],
    'Other': [
      { value: 'Other General', label: 'Другое (Общее)' },
    ]
  };
  
  const primaryCategoryOptions = [
      { value: 'EG', label: 'EG' },
      { value: 'Brand Group', label: 'Brand Group' },
      { value: 'Imagineers', label: 'Imagineers' },
      { value: 'БЭКОФИС', label: 'БЭКОФИС' },
      { value: 'Other', label: 'Другое' },
  ];

// Remove static secondary options
// const secondaryCategoryOptions = [ ... ];

// Interface for component props
interface UploadDepartmentInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadDepartmentInvoiceDialog({ isOpen, onClose }: UploadDepartmentInvoiceDialogProps) {
  const { user, userData } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSupplierOption, setSelectedSupplierOption] = useState<SupplierOption | null>(null);
  
  // State for dynamic secondary options
  const [currentSecondaryOptions, setCurrentSecondaryOptions] = useState<{ value: string; label: string }[]>([]);

  const { 
      register, 
      handleSubmit, 
      control, 
      reset, 
      setValue, // Add setValue
      formState: { errors } 
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      primaryCategory: '',
      secondaryCategory: '',
      supplierId: '',
      amount: 0,
      dueDate: undefined,
      comment: ''
    },
  });

  // Watch primary category changes
  const watchedPrimaryCategory = useWatch({ control, name: 'primaryCategory' });

  // Update secondary options when primary category changes
  useEffect(() => {
    const options = categoryMap[watchedPrimaryCategory] || [];
    setCurrentSecondaryOptions(options);
    // Reset secondary category if the primary changes to prevent invalid state
    // Only reset if watchedPrimaryCategory is not the initial empty string
    if (watchedPrimaryCategory) { 
        setValue('secondaryCategory', '');
    }
  }, [watchedPrimaryCategory, setValue]);

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
    reset(); // Reset includes resetting categories
    setCurrentSecondaryOptions([]); // Clear dynamic options on close
    onClose();
  }, [isOpen, onClose, reset]);

  useEffect(() => {
    if (isOpen) {
      reset({
        primaryCategory: '',
        secondaryCategory: '',
        supplierId: '',
        amount: 0,
        dueDate: undefined,
        comment: ''
      });
      setCurrentSecondaryOptions([]); // Clear dynamic options on open/reset
      setSelectedFile(null);
      setUploadProgress(0);
      setFileError(null);
      setServerError(null);
      setIsSubmitting(false);
      setSelectedSupplierOption(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
    }
  }, [isOpen, reset]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const maxSize = 15 * 1024 * 1024; // 15MB
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

  const onSubmit: SubmitHandler<DepartmentInvoiceFormData> = async (data) => {
    if (!selectedFile) {
      setFileError('Пожалуйста, выберите файл счета.');
      return;
    }
    if (!user || !userData) {
      setServerError("Не удалось получить данные пользователя.");
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setFileError(null);
    setUploadProgress(0);

    try {
      const filePath = `department_invoices/${user.uid}/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
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

              const invoiceDataToSave: Omit<DepartmentInvoiceData, 'id' | 'departmentId' | 'departmentName'> = {
                  primaryCategory: data.primaryCategory,
                  secondaryCategory: data.secondaryCategory,
                  supplierId: data.supplierId,
                  amount: data.amount,
                  comment: data.comment || null,
                  submitterUid: user.uid,
                  submitterName: userData.displayName || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || user.email || 'Неизвестно',
                  fileURL: downloadURL,
                  fileName: selectedFile.name,
                  uploadedAt: serverTimestamp() as Timestamp,
                  status: 'pending_payment', 
                  dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
              };

              await addDoc(collection(db, 'departmentInvoices'), invoiceDataToSave);
              console.log('Department invoice uploaded successfully!');
              handleClose(true);
              resolve();
            } catch (firestoreError) {
              console.error("Error saving to Firestore:", firestoreError);
              setServerError("Ошибка сохранения данных счета.");
              setIsSubmitting(false);
              reject(firestoreError);
            }
          }
        );
      });

    } catch (error) {
      if (!fileError && !serverError) {
          setServerError("Произошла ошибка при загрузке счета.");
      }
      console.error("Overall submission error:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => handleClose(false)}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  Загрузить счет для бюджета отдела
                  <button type="button" className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 focus:outline-none" onClick={() => handleClose(false)} aria-label="Закрыть">
                      <XMarkIcon className="h-5 w-5"/>
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                    {/* Primary Category Select */}
                    <div>
                      <Label htmlFor="primaryCategory">Основная категория *</Label>
                      <Controller
                        name="primaryCategory"
                        control={control}
                        render={({ field }) => (
                          <Select 
                            value={field.value} 
                            onValueChange={(value) => {
                                field.onChange(value);
                                // We don't need to manually reset secondary here, useEffect handles it
                            }}
                            required
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Выберите категорию" />
                            </SelectTrigger>
                            <SelectContent>
                              {primaryCategoryOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.primaryCategory && <p className="text-sm text-red-600 mt-1">{errors.primaryCategory.message}</p>}
                    </div>

                    {/* Secondary Category Select (Dynamic) */}
                    <div>
                      <Label htmlFor="secondaryCategory">Дополнительная категория *</Label>
                      <Controller
                        name="secondaryCategory"
                        control={control}
                        render={({ field }) => (
                          <Select 
                            value={field.value} 
                            onValueChange={field.onChange}
                            required
                            disabled={!watchedPrimaryCategory || currentSecondaryOptions.length === 0} // Disable if no primary selected or no options
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder={watchedPrimaryCategory ? "Выберите подкатегорию" : "Сначала выберите основную категорию"} />
                            </SelectTrigger>
                            <SelectContent>
                              {currentSecondaryOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.secondaryCategory && <p className="text-sm text-red-600 mt-1">{errors.secondaryCategory.message}</p>}
                    </div>

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
                      <Textarea 
                        id="comment"
                        {...register("comment")} 
                        placeholder="Назначение платежа, детали..." 
                        className="mt-1"
                        rows={3}
                      />
                      {errors.comment && <p className="text-sm text-red-600 mt-1">{errors.comment.message}</p>}
                    </div>
                    
                    {/* File Upload */}
                    <div>
                        <Label htmlFor="invoiceFile" className={cn("flex items-center justify-center cursor-pointer border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-md p-4 text-center hover:border-primary-500 transition-colors", fileError && "border-red-500")}>
                            <ArrowUpTrayIcon className="h-5 w-5 mr-2 text-neutral-500 dark:text-neutral-400"/>
                            <span className={cn("text-sm", selectedFile ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400")}>
                                {selectedFile ? selectedFile.name : 'Нажмите или перетащите файл *'}
                            </span>
                            <Input
                                id="invoiceFile"
                                type="file"
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.heic"
                                ref={fileInputRef}
                                disabled={isSubmitting}
                            />
                        </Label>
                        {fileError && <p className="text-sm text-red-600 mt-1">{fileError}</p>}
                        {uploadProgress > 0 && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 text-center">
                            Загрузка: {Math.round(uploadProgress)}%
                          </p>
                        )}
                    </div>

                    {serverError && (
                        <p className="text-sm text-red-600 mt-2 text-center bg-red-100 dark:bg-red-900/30 p-2 rounded-md">{serverError}</p>
                    )}

                    <div className="mt-6 flex justify-end space-x-3 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                        <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
                            Отмена
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting || !selectedFile || uploadProgress > 0 && uploadProgress < 100}
                          leftIcon={<CloudArrowUpIcon className="h-5 w-5" />}
                        >
                          Загрузить счет для себестоимости отдела
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
