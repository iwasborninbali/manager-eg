'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { cn } from '@/lib/utils';
import AddSupplierDialog from '@/components/suppliers/AddSupplierDialog';

// Define the structure for suppliers
export interface SupplierOption {
  id: string;
  name: string;
  tin: string;
}

interface SupplierComboboxProps {
  value: SupplierOption | null;
  onChange: (supplier: SupplierOption | null) => void;
  disabled?: boolean;
  error?: boolean;
}

export default function SupplierCombobox({ 
    value, 
    onChange, 
    disabled = false, 
    error = false 
}: SupplierComboboxProps) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [queryState, setQueryState] = useState('');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State for Add Supplier Dialog
  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);

  // Fetch Suppliers on mount or when disabled state changes (e.g., dialog opens)
  useEffect(() => {
    // Fetch only when not disabled (e.g., when dialog is open)
    if (!disabled) {
      const fetchSuppliers = async () => {
        setLoadingSuppliers(true);
        setFetchError(null);
        try {
          const suppliersRef = collection(db, 'suppliers');
          const q = query(suppliersRef); // Consider ordering by name
          const querySnapshot = await getDocs(q);
          const fetchedSuppliers: SupplierOption[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.name && data.tin) {
              fetchedSuppliers.push({ id: doc.id, name: data.name, tin: data.tin });
            } else {
              console.warn(`Supplier with ID ${doc.id} skipped due to missing name or TIN.`);
            }
          });
          // Sort suppliers alphabetically by name
          fetchedSuppliers.sort((a, b) => a.name.localeCompare(b.name));
          setSuppliers(fetchedSuppliers);
        } catch (err) {
          console.error("Error fetching suppliers:", err);
          setFetchError("Ошибка загрузки поставщиков");
        } finally {
          setLoadingSuppliers(false);
        }
      };
      fetchSuppliers();
    } else {
        // Clear suppliers when disabled (e.g., dialog closed)
        setSuppliers([]);
        setQueryState('');
        setFetchError(null);
    }
  }, [disabled]); // Re-fetch if disabled changes (e.g., dialog open/close)

  // Filtered suppliers based on query
  const filteredSuppliers = queryState === ''
    ? suppliers
    : suppliers.filter((supplier) =>
        supplier.name
          .toLowerCase()
          .replace(/\s+/g, '')
          .includes(queryState.toLowerCase().replace(/\s+/g, ''))
      );

  // --- Handlers for Add Supplier Dialog --- 
  const openAddSupplierDialog = () => {
    setIsAddSupplierDialogOpen(true);
  };

  const closeAddSupplierDialog = () => {
    setIsAddSupplierDialogOpen(false);
  };

  const handleAddSupplierSuccess = (newSupplier: SupplierOption) => {
    closeAddSupplierDialog();
    // Add new supplier to the local list and sort again
    const updatedSuppliers = [...suppliers, newSupplier].sort((a, b) => a.name.localeCompare(b.name));
    setSuppliers(updatedSuppliers);
    // Select the newly added supplier
    onChange(newSupplier);
    // Clear the query to show the new selection
    setQueryState(''); 
  };

  return (
    <div className="w-full relative">
      <Combobox value={value} onChange={onChange} disabled={disabled || loadingSuppliers}>
        <div className="relative mt-1">
          <Combobox.Input
            className={cn(
              "w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-2 pl-3 pr-16 text-sm leading-5 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
              error ? 'border-error-500 ring-error-500' : '' // Highlight on error
            )}
            displayValue={(supplier: SupplierOption | null) => supplier?.name || ''}
            onChange={(event) => setQueryState(event.target.value)}
            placeholder="Начните вводить имя поставщика..."
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button 
              type="button" 
              onClick={openAddSupplierDialog} 
              disabled={disabled}
              className="p-1 text-neutral-400 hover:text-primary-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              title="Добавить нового поставщика"
             >
               <PlusCircleIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <Combobox.Button className="p-1 text-neutral-400 disabled:opacity-50">
              <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
            </Combobox.Button>
          </div>
        </div>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          afterLeave={() => setQueryState('')}
        >
          <Combobox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-neutral-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {loadingSuppliers ? (
              <div className="relative cursor-default select-none py-2 px-4 text-neutral-700 dark:text-neutral-300">Загрузка...</div>
            ) : fetchError ? (
              <div className="relative cursor-default select-none py-2 px-4 text-error-600 dark:text-error-400">{fetchError}</div>
            ) : filteredSuppliers.length === 0 && queryState !== '' ? (
              <div 
                className="relative cursor-pointer select-none py-2 px-4 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/50 flex items-center"
                onClick={openAddSupplierDialog} // Open dialog on click
               >
                 <PlusCircleIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                 Добавить поставщика "{queryState}"
              </div>
            ) : (
              filteredSuppliers.map((supplier) => (
                <Combobox.Option
                  key={supplier.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100' : 'text-neutral-900 dark:text-neutral-100'}`
                  }
                  value={supplier}
                >
                  {({ selected, active }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {supplier.name}
                      </span>
                      {selected ? (
                        <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-primary-600' : 'text-primary-600'}`}>
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </Transition>
      </Combobox>
       {/* Display Selected TIN below Combobox */} 
       {value && (
           <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">ИНН: {value.tin}</p>
       )}

       {/* Render Add Supplier Dialog */}
       <AddSupplierDialog 
          isOpen={isAddSupplierDialogOpen}
          onClose={closeAddSupplierDialog}
          onSuccess={handleAddSupplierSuccess}
       />
    </div>
  );
} 