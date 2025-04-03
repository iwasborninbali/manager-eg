'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { SupplierOption } from '@/components/shared/SupplierCombobox'; // Import shared type

interface AddSupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSupplier: SupplierOption) => void;
}

interface AddSupplierFormData {
  name: string;
  tin: string;
}

const AddSupplierDialog: React.FC<AddSupplierDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<AddSupplierFormData>({ name: '', tin: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name || !formData.tin) {
      setError("Наименование и ИНН обязательны.");
      return;
    }
    if (!/^(\d{10}|\d{12})$/.test(formData.tin)) {
        setError("Неверный формат ИНН (10 или 12 цифр).");
        return;
    }

    setLoading(true);

    try {
        // Check if supplier with this TIN already exists
        const suppliersRef = collection(db, 'suppliers');
        const q = query(suppliersRef, where('tin', '==', formData.tin));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Supplier found - show error, don't create duplicate
            const existingSupplier = querySnapshot.docs[0].data();
            setError(`Поставщик с ИНН ${formData.tin} уже существует: ${existingSupplier.name}. Выберите его из списка.`);
            setLoading(false);
            return;
        }

        // Supplier not found - Create new supplier document
        const newSupplierData = {
            name: formData.name,
            tin: formData.tin,
            createdAt: serverTimestamp(), // Optional: track creation time
        };
        const docRef = await addDoc(suppliersRef, newSupplierData);

        console.log("New supplier added with ID:", docRef.id);
        
        // Call onSuccess with the new supplier data
        onSuccess({ id: docRef.id, ...newSupplierData }); 
        
        onClose(); // Close the dialog
        setFormData({ name: '', tin: '' }); // Reset form

    } catch (err: unknown) {
      console.error("Error adding supplier:", err);
      // Type guard for error message
      const message = err instanceof Error ? err.message : "Не удалось добавить поставщика.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };
  
   // Reset form when closing
   useEffect(() => {
     if (!isOpen) {
         setFormData({ name: '', tin: '' });
         setError(null);
         setLoading(false);
     }
   }, [isOpen]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={() => !loading && onClose()}> {/* Higher z-index */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100 flex justify-between items-center"
                >
                  <span>Добавить нового поставщика</span>
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
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Наименование *</label>
                    <Input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="tin" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">ИНН *</label>
                    <Input
                      type="text"
                      id="tin"
                      name="tin"
                      value={formData.tin}
                      onChange={handleChange}
                      required
                      pattern="^(\d{10}|\d{12})$"
                      title="Введите 10 или 12 цифр ИНН"
                      disabled={loading}
                      className="mt-1"
                    />
                  </div>

                  {error && <p className="text-sm text-error-600 dark:text-error-400">{error}</p>}

                  <div className="mt-6 flex justify-end space-x-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                      Отмена
                    </Button>
                    <Button type="submit" variant="default" isLoading={loading} disabled={loading}>
                      Добавить поставщика
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

export default AddSupplierDialog; 