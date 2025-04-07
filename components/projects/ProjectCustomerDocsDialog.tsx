'use client';

import React, { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentArrowUpIcon, DocumentTextIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { collection, query, where, onSnapshot, addDoc, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Interface for Customer Documents
interface CustomerDocument {
  id: string;
  projectId: string;
  fileName: string;
  fileURL: string;
  uploadedAt: Timestamp;
  comment?: string;
  // Add other relevant fields if needed (e.g., document type: 'contract', 'act', 'report')
  type?: string;
  lastUpdated?: Timestamp;
}

interface ProjectCustomerDocsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

// Define Customer Document Types to match Closing Docs
const customerDocTypes = [
  { value: 'contract', label: 'Договор' },
  { value: 'upd', label: 'УПД' },
  { value: 'act', label: 'Акт' },
  { value: 'other', label: 'Другое' },
];

const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const ProjectCustomerDocsDialog: React.FC<ProjectCustomerDocsDialogProps> = ({ isOpen, onClose, projectId, projectName }) => {
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [docType, setDocType] = useState<string>(''); // Use string type for select value
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editingDoc, setEditingDoc] = useState<CustomerDocument | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editDocType, setEditDocType] = useState<string>(''); // Use string type for select value

  // Fetch documents in real-time
  useEffect(() => {
    if (!projectId || !isOpen) {
      setDocuments([]);
      setLoading(true); // Reset loading state when closed or projectId changes
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'customerDocuments'), where('projectId', '==', projectId));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument));
      // Sort by upload date, newest first
      docsData.sort((a, b) => (b.uploadedAt?.toMillis() ?? 0) - (a.uploadedAt?.toMillis() ?? 0));
      setDocuments(docsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching customer documents:", err);
      setError('Не удалось загрузить документы.');
      setLoading(false);
      toast.error("Ошибка загрузки документов заказчика", { description: 'Не удалось загрузить документы.' });
    });

    // Cleanup listener on component unmount or when dialog closes/projectId changes
    return () => unsubscribe();
  }, [projectId, isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileToUpload(event.target.files[0]);
    } else {
      setFileToUpload(null);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload || !projectId) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const storageRef = ref(storage, `projects/${projectId}/customerDocuments/${Date.now()}_${fileToUpload.name}`);
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        setError('Ошибка загрузки файла.');
        setUploading(false);
        toast.error("Ошибка загрузки файла", { description: `Не удалось загрузить файл: ${error.message}` });
      },
      async () => {
        // Upload completed successfully, now get the download URL
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          // Add document metadata to Firestore
          await addDoc(collection(db, 'customerDocuments'), {
            projectId: projectId,
            fileName: fileToUpload.name,
            fileURL: downloadURL,
            uploadedAt: Timestamp.now(),
            comment: comment || null,
            type: docType || null, // Add type if provided
          });

          // Reset form
          setFileToUpload(null);
          setComment('');
          setDocType('');
          setUploading(false);
          setUploadProgress(0);
          toast.success("Успех", { description: "Документ успешно загружен." });
        } catch (error: any) {
          console.error("Error saving document metadata:", error);
          setError('Ошибка сохранения данных документа.');
          setUploading(false);
          toast.error("Ошибка сохранения данных", { description: `Не удалось сохранить данные документа: ${error.message}` });
          // Attempt to delete the uploaded file if Firestore entry failed
          try {
             await deleteObject(storageRef);
             console.log("Orphaned file deleted from storage.");
          } catch (deleteError) {
             console.error("Failed to delete orphaned file from storage:", deleteError);
          }
        }
      }
    );
  };

  const handleDelete = async (docToDelete: CustomerDocument) => {
    if (!window.confirm(`Вы уверены, что хотите удалить файл "${docToDelete.fileName}"?`)) {
      return;
    }

    try {
        // 1. Delete Firestore document
        await deleteDoc(doc(db, 'customerDocuments', docToDelete.id));

        // 2. Delete file from Storage
        if (docToDelete.fileURL) {
            try {
                const fileRef = ref(storage, docToDelete.fileURL);
                await deleteObject(fileRef);
            } catch (storageError: any) {
                // Log error but continue, Firestore doc is already deleted
                console.error("Error deleting file from storage (Firestore doc deleted):", storageError);
                toast.warning("Предупреждение", { description: "Запись о документе удалена, но файл в хранилище удалить не удалось." });
            }
        }
        toast.success("Успех", { description: "Документ удален." });
    } catch (error: any) {
        console.error("Error deleting document:", error);
        toast.error("Ошибка удаления", { description: `Не удалось удалить документ: ${error.message}` });
    }
  };

  const handleStartEdit = (docToEdit: CustomerDocument) => {
      setEditingDoc(docToEdit);
      setEditComment(docToEdit.comment || '');
      setEditDocType(docToEdit.type || '');
  };

  const handleCancelEdit = () => {
      setEditingDoc(null);
      setEditComment('');
      setEditDocType('');
  };

  const handleSaveEdit = async () => {
      if (!editingDoc) return;

      const docRef = doc(db, 'customerDocuments', editingDoc.id);
      try {
          await updateDoc(docRef, {
              comment: editComment || null,
              type: editDocType || null,
              lastUpdated: Timestamp.now()
          });
          toast.success("Успех", { description: "Данные документа обновлены." });
          handleCancelEdit(); // Close edit form
      } catch (error: any) {
          console.error("Error updating document:", error);
          toast.error("Ошибка обновления", { description: `Не удалось обновить документ: ${error.message}` });
      }
  };


  // Close handler also cancels edit
  const handleCloseDialog = () => {
    handleCancelEdit();
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[52]" onClose={handleCloseDialog}> {/* Higher z-index than details */} 
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all flex flex-col h-[70vh]"> {/* Max height */} 
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center mb-4 flex-shrink-0">
                  Документы с Заказчиком: {projectName}
                  <button
                    type="button"
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:ring-offset-neutral-800"
                    onClick={handleCloseDialog}
                  >
                    <span className="sr-only">Закрыть</span>
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                {/* Upload Section */} 
                <div className="mb-6 border-b border-neutral-200 dark:border-neutral-700 pb-4 flex-shrink-0">
                  <h4 className="text-md font-medium text-neutral-800 dark:text-neutral-200 mb-2">Загрузить новый документ</h4>
                  <div className="space-y-3">
                     <Input
                        type="file"
                        onChange={handleFileChange}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/20 dark:file:text-primary-300 dark:hover:file:bg-primary-900/30"
                     />
                     {/* Display selected file name and clear button */} 
                     {fileToUpload && (
                       <div className="flex items-center justify-between text-sm mt-1 p-2 bg-neutral-100 dark:bg-neutral-700 rounded">
                         <span className="text-neutral-700 dark:text-neutral-300 truncate pr-2" title={fileToUpload.name}>
                           Выбран: {fileToUpload.name}
                         </span>
                         <button 
                           type="button"
                           onClick={() => setFileToUpload(null)} 
                           className="text-neutral-500 dark:text-neutral-400 hover:text-error-600 dark:hover:text-error-400 flex-shrink-0"
                           title="Убрать файл"
                         >
                           <XMarkIcon className="h-4 w-4" />
                         </button>
                       </div>
                     )}
                     {/* End selected file display */} 
                     <div>
                       <label htmlFor="customerDocTypeUpload" className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Тип документа</label>
                       <select 
                           id="customerDocTypeUpload"
                           value={docType}
                           onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDocType(e.target.value)}
                           disabled={uploading}
                           className={cn(
                               'flex h-10 w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2 text-sm',
                               'border-neutral-200 dark:border-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0',
                               'disabled:cursor-not-allowed disabled:opacity-50'
                           )}
                       >
                           <option value="">Не выбран</option>
                           {customerDocTypes.map(type => (
                             <option key={type.value} value={type.value}>{type.label}</option>
                           ))}
                       </select>
                     </div>
                     <Input
                        type="text"
                        placeholder="Комментарий (необязательно)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        disabled={uploading}
                     />
                     {uploading && (
                        <Progress value={uploadProgress} className="w-full h-2" />
                     )}
                     {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                     <Button 
                        onClick={handleUpload}
                        disabled={!fileToUpload || uploading}
                        size="sm"
                     >
                         {uploading ? 'Загрузка...' : 'Загрузить'}
                         <DocumentArrowUpIcon className="ml-2 h-4 w-4" />
                     </Button>
                  </div>
                </div>

                {/* Document List Section */} 
                <div className="flex-grow overflow-y-auto pr-2"> {/* Scrollable list */} 
                  <h4 className="text-md font-medium text-neutral-800 dark:text-neutral-200 mb-3">Загруженные документы</h4>
                  {loading ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка документов...</p>
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Документы еще не загружены.</p>
                  ) : (
                    <ul className="space-y-3">
                      {documents.map((doc) => (
                        <li key={doc.id} className="p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-md shadow-sm">
                          {editingDoc?.id === doc.id ? (
                              // Edit Form
                              <div className="space-y-2">
                                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{doc.fileName}</p>
                                  <div>
                                    <label htmlFor={`customerDocTypeEdit-${doc.id}`} className="block text-xs font-medium mb-1 text-neutral-600 dark:text-neutral-400">Тип документа</label>
                                    <select 
                                        id={`customerDocTypeEdit-${doc.id}`}
                                        value={editDocType}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditDocType(e.target.value)}
                                        className={cn(
                                            'flex h-9 w-full rounded-md border bg-white dark:bg-neutral-800 px-3 py-1.5 text-sm',
                                            'border-neutral-300 dark:border-neutral-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-0',
                                            'disabled:cursor-not-allowed disabled:opacity-50'
                                        )}
                                    >
                                        <option value="">Не выбран</option>
                                        {customerDocTypes.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                   </div>
                                  <Input
                                      type="text"
                                      placeholder="Комментарий"
                                      value={editComment}
                                      onChange={(e) => setEditComment(e.target.value)}
                                  />
                                  <div className="flex justify-end space-x-2 mt-2">
                                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Отмена</Button>
                                      <Button size="sm" onClick={handleSaveEdit}>Сохранить</Button>
                                  </div>
                              </div>
                          ) : (
                              // Display Mode
                              <div className="flex items-center justify-between space-x-3">
                                <div className="flex-1 min-w-0">
                                  <a
                                    href={doc.fileURL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline truncate block"
                                    title={`Скачать ${doc.fileName}`}
                                  >
                                    <DocumentTextIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
                                    {doc.fileName}
                                  </a>
                                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 space-x-2">
                                      {doc.type && <Badge variant="outline">{doc.type}</Badge>}
                                      <span>Загружен: {formatDate(doc.uploadedAt)}</span>
                                      {doc.comment && <span className="italic block truncate pt-1" title={doc.comment}>"{doc.comment}"</span>}
                                      {doc.lastUpdated && <span className="block pt-1">Обновлен: {formatDate(doc.lastUpdated)}</span>}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 space-x-1">
                                   <Button variant="ghost" size="icon" title="Редактировать" onClick={() => handleStartEdit(doc)}>
                                       <PencilIcon className="h-4 w-4" />
                                   </Button>
                                   <Button variant="ghost" size="icon" title="Удалить" className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300 hover:bg-error-100/50 dark:hover:bg-error-900/20" onClick={() => handleDelete(doc)}>
                                       <TrashIcon className="h-4 w-4" />
                                   </Button>
                                </div>
                              </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Footer for Close button */} 
                <div className="mt-5 sm:mt-6 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleCloseDialog}
                  >
                    Закрыть
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ProjectCustomerDocsDialog; 