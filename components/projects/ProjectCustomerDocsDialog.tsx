'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'; // Removed DocumentTextIcon
import { collection, query, where, onSnapshot, addDoc, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/progress';
// import { Badge } from '@/components/ui/Badge'; // Removed unused Badge
import { toast } from 'sonner';
// import { cn } from '@/lib/utils'; // Removed unused cn
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Interface for Customer Documents
interface CustomerDoc { // Renamed for clarity
  id: string;
  projectId: string;
  fileName: string;
  fileURL: string;
  uploadedAt: Timestamp;
  updatedAt?: Timestamp; // Added updatedAt
  comment?: string | null; // Allow null
  date?: Timestamp | null; // Add date field
  type?: 'contract' | 'act' | 'invoice' | 'upd' | 'other' | null; // Defined types + null
}

interface ProjectCustomerDocsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: { id: string; name: string } | null; // Expect project object or null
}

// Define Customer Document Types to match Closing Docs
const customerDocTypes: { value: NonNullable<CustomerDoc['type']>; label: string }[] = [
  { value: 'contract', label: 'Договор' },
  { value: 'act', label: 'Акт' },
  { value: 'invoice', label: 'Счет-фактура' },
  { value: 'upd', label: 'УПД' },
  { value: 'other', label: 'Другое' },
];

const formatDate = (timestamp: Timestamp | undefined | null): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function ProjectCustomerDocsDialog({ isOpen, onClose, project }: ProjectCustomerDocsDialogProps) {
  const [customerDocs, setCustomerDocs] = useState<CustomerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<CustomerDoc['type']>(null); // Use defined types, init with null
  const [selectedDate, setSelectedDate] = useState<string>(''); // Keep as string for input type=date
  const [comment, setComment] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null); // Specific state for form/upload errors
  // const [uploadSuccess, setUploadSuccess] = useState<boolean>(false); // Removed unused uploadSuccess state

  // Edit related state
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>(''); // Keep as string for input type=date
  const [editType, setEditType] = useState<CustomerDoc['type']>(null); // Use defined types, init with null
  const [editComment, setEditComment] = useState<string | undefined | null>(''); // Allow undefined/null

  // --- Firestore Listener ---
  useEffect(() => {
    if (!project?.id || !isOpen) {
      setCustomerDocs([]);
      setLoading(true); // Reset loading state
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'customerDocs'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDoc));
      docsData.sort((a, b) => (b.uploadedAt?.toMillis() ?? 0) - (a.uploadedAt?.toMillis() ?? 0));
      setCustomerDocs(docsData);
      setLoading(false);
    }, (error: Error) => { // Explicit error type
      console.error("Error fetching customer documents:", error);
      setFormError('Не удалось загрузить документы.');
      setLoading(false);
      toast.error("Ошибка загрузки документов заказчика", { description: 'Не удалось загрузить документы.' });
    });

    return () => unsubscribe();
  }, [project?.id, isOpen]); // Depend on projectId and isOpen

  // Reset form state when dialog opens/closes or project changes
  useEffect(() => {
    setSelectedFile(null);
    setSelectedFileType(null); // Reset to null
    setSelectedDate('');
    setComment('');
    setFormError(null);
    // setUploadSuccess(false); // Removed
    setUploading(false);
    setUploadProgress(null);
    setEditingDocId(null); // Cancel edit on open/close
    setEditErrors({});
  }, [isOpen, project?.id]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
          const file = event.target.files[0];
          if (file.size > MAX_FILE_SIZE) {
              toast.error(`Файл слишком большой (максимум ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
              setFormError(`Файл слишком большой (максимум ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
              return;
          }
          setSelectedFile(file);
          setFormError(null); // Clear form errors on new file selection
      }
  };

  const handleUpload = async () => {
    if (!selectedFile || !project?.id) {
        setFormError('Пожалуйста, выберите файл.');
        toast.error('Пожалуйста, выберите файл.');
        return;
    }
    if (!selectedFileType) {
        setFormError('Пожалуйста, укажите тип документа.');
        toast.error('Пожалуйста, укажите тип документа.');
        return;
    }
    if (!selectedDate) { // Add date check for upload
        setFormError('Пожалуйста, укажите дату документа.');
        toast.error('Пожалуйста, укажите дату документа.');
        return;
    }

    setUploading(true);
    setUploadProgress(0);
    setFormError(null);

    const uploadingFile = selectedFile; // Keep reference

    try {
        const fileName = `${Date.now()}_${uploadingFile.name}`;
        const storageRef = ref(storage, `projects/${project.id}/customerDocs/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, uploadingFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error: { code?: string; message?: string }) => {
                console.error("Upload failed:", error);
                let message = "Не удалось загрузить файл.";
                if (error.code === 'storage/unauthorized') { message = "Нет прав для загрузки файла."; }
                else if (error.code === 'storage/canceled') { message = "Загрузка отменена."; }
                else if (error.code) { message = `Ошибка хранилища: ${error.code}`; }
                else if (error.message) { message = error.message; }

                setFormError(message);
                toast.error("Ошибка загрузки: " + message);
                setUploading(false);
                setUploadProgress(null);
            },
            async () => {
                try {
                    const downloadURL: string = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('File available at', downloadURL);
                    await addDoc(collection(db, 'customerDocs'), {
                        projectId: project.id,
                        fileName: uploadingFile.name,
                        fileURL: downloadURL,
                        uploadedAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        date: selectedDate ? Timestamp.fromDate(new Date(selectedDate)) : null,
                        type: selectedFileType || null,
                        comment: comment?.trim() || null
                    });

                    toast.success("Документ успешно загружен.");
                    // setUploadSuccess(true); // Removed
                    // Reset form after successful upload
                    setSelectedFile(null);
                    setSelectedFileType(null); // Reset to null
                    setSelectedDate('');
                    setComment('');
                } catch (error) {
                    console.error("Error saving document metadata:", error);
                    let errorMessage = " Не удалось сохранить данные документа.";
                    if (error instanceof Error) { errorMessage = ` (${error.message})`; }
                    setFormError("Ошибка при сохранении данных: " + errorMessage);
                    toast.error("Ошибка сохранения данных:" + errorMessage);
                } finally {
                    setUploading(false);
                    setUploadProgress(null);
                }
            }
        );
    } catch (error) { // Catch potential errors setting up the upload
        console.error("Error setting up upload:", error);
        let errorMessage = " Ошибка инициализации загрузки.";
        if (error instanceof Error) { errorMessage = ` (${error.message})`; }
        setFormError("Ошибка загрузки: " + errorMessage);
        toast.error("Ошибка загрузки:" + errorMessage);
        setUploading(false);
        setUploadProgress(null);
    }
  };


  // --- Edit Functions ---
  const handleEditCommentChange = (docId: string, value: string) => {
    setEditComment(value);
    setEditErrors(prev => ({ ...prev, [docId]: '' })); // Clear error on change
  };

  const startEdit = (doc: CustomerDoc) => {
      setEditDate(doc.date ? doc.date.toDate().toISOString().split('T')[0] : '');
      setEditType(doc.type || null); // Reset to null if no type
      setEditComment(doc.comment || '');
      setEditingDocId(doc.id);
      setEditErrors({});
  };

  const handleUpdateDocument = async (docId: string) => {
      const docRef = doc(db, 'customerDocs', docId);
      if (!editType || !editDate) {
          setEditErrors(prev => ({ ...prev, [docId]: 'Дата и тип документа обязательны.'}));
          return;
      }

      try {
          await updateDoc(docRef, {
              date: editDate ? Timestamp.fromDate(new Date(editDate)) : null,
              type: editType || null,
              updatedAt: Timestamp.now(),
              comment: editComment?.trim() || null
          });
          toast.success("Документ успешно обновлен.");
          setEditingDocId(null); // Exit edit mode
      } catch (error) {
          console.error("Error updating document:", error);
          let errorMessage = "Неизвестная ошибка.";
          if (error instanceof Error) { errorMessage = error.message; }
          else if (typeof error === 'string') { errorMessage = error; }
          setEditErrors(prev => ({ ...prev, [docId]: "Ошибка: " + errorMessage }));
          toast.error("Ошибка обновления: " + errorMessage);
      }
  };

  const handleDelete = async (docId: string, fileURL: string) => {
      if (!project?.id) {
          toast.error("Ошибка: ID проекта не найден.");
          return;
      }
      if (!window.confirm("Вы уверены, что хотите удалить этот документ?")) return;

      const docRef = doc(db, 'customerDocs', docId);

      try {
          // 1. Delete Firestore Document
          await deleteDoc(docRef);
          toast.success("Документ успешно удален."); // Notify user immediately

          // 2. Attempt to Delete Storage File (if URL valid)
          if (fileURL && fileURL.startsWith('https://firebasestorage.googleapis.com/')) {
              try {
                  const fileStorageRef = ref(storage, fileURL);
                  await deleteObject(fileStorageRef);
                  console.log("File deleted from storage:", fileURL);
              } catch (storageError) {
                  console.error("Error deleting storage file (Firestore doc was deleted):", storageError);
                  let storageErrorMessage = "Не удалось удалить связанный файл из хранилища.";
                  if (storageError instanceof Error) {
                    storageErrorMessage = storageError.message;
                  }
                  // Show specific error for storage failure, but acknowledge Firestore success
                  toast.error("Ошибка удаления файла из хранилища", {
                      description: storageErrorMessage + " Запись документа была удалена.",
                  });
              }
          } else {
              console.warn("File URL not provided or invalid, skipping storage deletion:", fileURL);
              // Optional: Notify user file wasn't deleted
              // toast.info("Запись документа удалена, но связанный файл не был удален (неверный URL).");
          }

      } catch (error) { // Catch errors primarily from deleteDoc
          console.error("Error deleting Firestore document:", error);
          let deleteErrorMessage = "Не удалось удалить документ.";
          if (error instanceof Error) {
              deleteErrorMessage = error.message;
          }
          toast.error("Ошибка удаления документа: " + deleteErrorMessage);
      }
  };

  // Close handler also cancels edit
  const handleCloseDialog = () => {
    setEditingDocId(null); // Cancel edit on close
    setEditErrors({});
    onClose();
  };


  // --- Render ---
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[52]" onClose={handleCloseDialog}>
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
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                            Документы Заказчика ({project?.name ?? 'Проект не выбран'})
                            <Button variant="ghost" size="icon" onClick={handleCloseDialog}>
                                <XMarkIcon className="h-5 w-5" />
                            </Button>
                        </Dialog.Title>

                        {/* Document List */}
                        <div className="mt-4 max-h-[40vh] overflow-y-auto pr-2">
                            {loading ? <p className="text-center text-neutral-500">Загрузка...</p> :
                            customerDocs.length > 0 ?
                            <ul className="space-y-3">
                                {customerDocs.map((doc) => (
                                    <li key={doc.id} className="p-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/50">
                                        {editingDocId === doc.id ? (
                                            // Edit Form
                                            <div className="space-y-3">
                                                <Input
                                                    type="date"
                                                    value={editDate}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDate(e.target.value)}
                                                    className="w-full"
                                                />
                                                 <Select
                                                    value={editType || ''}
                                                    onValueChange={(value) => setEditType(value === '' ? null : value as CustomerDoc['type'])}
                                                 >
                                                    <SelectTrigger><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                                                    <SelectContent>
                                                        {customerDocTypes.map(type => (
                                                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    type="text"
                                                    value={editComment ?? ''} // Handle potential null/undefined
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleEditCommentChange(doc.id, e.target.value)}
                                                    placeholder="Комментарий (необязательно)"
                                                    className="w-full"
                                                />
                                                {editErrors[doc.id] && <div className="text-sm text-red-500 mt-1">{editErrors[doc.id]}</div>}
                                                <div className="flex justify-end space-x-2 mt-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingDocId(null)}>Отмена</Button>
                                                    <Button size="sm" onClick={() => handleUpdateDocument(doc.id)} disabled={!editDate || !editType}>Сохранить</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            // View Mode
                                            <div className="flex items-center justify-between">
                                                <a href={doc.fileURL} target="_blank" rel="noopener noreferrer" className="flex flex-col flex-grow mr-2 overflow-hidden">
                                                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{doc.fileName}</span>
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                        ({doc.type ? customerDocTypes.find(t => t.value === doc.type)?.label ?? doc.type : 'N/A'}, {formatDate(doc.date)}) - Загружен: {formatDate(doc.uploadedAt)}
                                                    </span>
                                                    {doc.comment && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300 break-words">{doc.comment}</p>}
                                                </a>
                                                <div className="flex-shrink-0 flex space-x-1">
                                                    <Button variant="ghost" size="icon" onClick={() => startEdit(doc)} title="Редактировать">
                                                        <PencilIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-error-500 hover:text-error-700" onClick={() => handleDelete(doc.id, doc.fileURL)} title="Удалить">
                                                        <TrashIcon className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul> : <p className="text-sm text-neutral-500 text-center">Нет загруженных документов.</p>}
                        </div>

                        {/* Upload section */}
                        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                            <h3 className="text-lg font-medium mb-3">Загрузить новый документ</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                {/* File Input */}
                                <div className="space-y-2">
                                    <label htmlFor="customer-doc-file" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Выберите файл (&quot;макс 10 МБ&quot;)</label>
                                    <Input
                                        id="customer-doc-file"
                                        type="file"
                                        onChange={handleFileChange}
                                        className="w-full"
                                        disabled={uploading}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" // Example accept types
                                    />
                                </div>
                                {/* Other Inputs (Type, Date, Comment) */}
                                <div className="space-y-2">
                                     <label htmlFor="customer-doc-type" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Тип документа *</label>
                                     <Select
                                        value={selectedFileType || ''}
                                        onValueChange={(value) => setSelectedFileType(value === '' ? null : value as CustomerDoc['type'])}
                                     >
                                        <SelectTrigger id="customer-doc-type"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                                        <SelectContent>
                                            {customerDocTypes.map(type => (
                                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                     <label htmlFor="customer-doc-date" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Дата документа *</label>
                                     <Input
                                        id="customer-doc-date"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                                        className="w-full"
                                        disabled={uploading}
                                    />
                                    <label htmlFor="customer-doc-comment" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Комментарий</label>
                                    <Input
                                        id="customer-doc-comment"
                                        type="text"
                                        value={comment}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComment(e.target.value)}
                                        placeholder="(необязательно)"
                                        className="w-full"
                                        disabled={uploading}
                                    />
                                </div>
                            </div>
                            {formError && <div className="text-sm text-red-500 mt-2">{formError}</div>}
                             {/* Progress Bar */}
                            {uploading && uploadProgress !== null && (
                                <div className="mt-3">
                                    <Progress value={uploadProgress} className="w-full h-2" />
                                    <p className="text-xs text-neutral-500 text-center mt-1">{Math.round(uploadProgress)}%</p>
                                </div>
                            )}
                            <div className="mt-4 flex justify-end">
                                <Button onClick={handleUpload} disabled={uploading || !selectedFile || !selectedFileType || !selectedDate}>
                                    {uploading ? 'Загрузка...' : 'Загрузить документ'}
                                </Button>
                            </div>
                        </div>
                    </Dialog.Panel>
                </Transition.Child>
            </div>
        </div>
      </Dialog>
    </Transition>
  );
}
