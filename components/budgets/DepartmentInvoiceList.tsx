'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, Timestamp, getDocs, documentId, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { DocumentArrowDownIcon, BuildingLibraryIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { DepartmentInvoiceData } from '@/lib/departmentInvoiceSchema';

// --- Interfaces ---
interface Supplier {
  id: string;
  name?: string;
}

// --- Helper Functions ---
const formatDate = (timestamp: Timestamp | undefined | null): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatCurrency = (amount: number | undefined | null, fallback: string = 'N/A'): string => {
    if (amount === undefined || amount === null) return fallback;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
};

// --- End Helper Functions ---

const DepartmentInvoiceList: React.FC = () => {
    const [invoices, setInvoices] = useState<DepartmentInvoiceData[]>([]);
    const [supplierMap, setSupplierMap] = useState<{ [id: string]: Supplier }>({});
    const [loadingInvoices, setLoadingInvoices] = useState(true);
    const [errorInvoices, setErrorInvoices] = useState<string | null>(null);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);

    // Fetch Suppliers based on loaded invoices
    useEffect(() => {
        if (invoices.length === 0) {
            setSupplierMap({});
            return;
        }

        const fetchSuppliers = async () => {
            const supplierIds = Array.from(new Set(
                invoices.map(inv => inv.supplierId).filter(id => id && !supplierMap[id])
            ));
            
            if (supplierIds.length === 0) { 
                return; // No new suppliers to fetch for these invoices
            }

            setLoadingSuppliers(true);
            const allNewlyFetchedSuppliers: { [id: string]: Supplier } = {}; // Accumulator object
            
            try {
                for (let i = 0; i < supplierIds.length; i += 30) {
                    const batchIds = supplierIds.slice(i, i + 30);
                    const q = query(collection(db, 'suppliers'), where(documentId(), 'in', batchIds)); 
                    const snapshot = await getDocs(q);
                    const fetchedBatch: { [id: string]: Supplier } = {};
                    snapshot.forEach(doc => fetchedBatch[doc.id] = { id: doc.id, ...doc.data() } as Supplier);
                    Object.assign(allNewlyFetchedSuppliers, fetchedBatch); // Accumulate results
                }

                // Only update state if new suppliers were actually fetched
                if (Object.keys(allNewlyFetchedSuppliers).length > 0) {
                    setSupplierMap(prev => ({ ...prev, ...allNewlyFetchedSuppliers }));
                }
            } catch (error) { 
                console.error("Error fetching suppliers for dept invoices:", error); 
            }
            finally { 
                setLoadingSuppliers(false); 
            }
        };

        fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoices]); // Reverted dependency to only invoices

    // Fetch All Department Invoices
    useEffect(() => {
        setLoadingInvoices(true);
        // Query all documents in 'departmentInvoices', ordered by upload date
        const q = query(
            collection(db, 'departmentInvoices'),
            orderBy('uploadedAt', 'desc') // Order by upload date, descending
        );

        // Subscribe to real-time updates
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const invoicesData: DepartmentInvoiceData[] = [];
            querySnapshot.forEach((doc) => {
                // Push document data along with its ID
                invoicesData.push({ id: doc.id, ...doc.data() } as DepartmentInvoiceData);
            });
            setInvoices(invoicesData); // Update state with fetched invoices
            setErrorInvoices(null); // Clear any previous error
            setLoadingInvoices(false); // Set loading to false
        }, (error) => {
            // Handle errors during fetch
            console.error("Error fetching department invoices: ", error);
            setErrorInvoices('Не удалось загрузить счета отдела.');
            setLoadingInvoices(false);
        });

        // Cleanup subscription on component unmount
        return () => unsubscribe();
    }, []);

    // Render Logic
    if (loadingInvoices) {
        return <p className="text-center py-4 text-neutral-500 dark:text-neutral-400">Загрузка счетов...</p>;
    }

    if (errorInvoices) {
        return <p className="text-center py-4 text-error-600 dark:text-error-400">{errorInvoices}</p>;
    }

    if (invoices.length === 0) {
        // Simplified message for no invoices
        return <p className="text-center py-4 text-neutral-500 dark:text-neutral-400">Счета отделов еще не добавлены.</p>;
    }

    return (
        <div className="space-y-3">
            {loadingSuppliers && <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">Загрузка поставщиков...</p>}
            <ul className="space-y-3">
                {invoices.map((invoice) => {
                    const supplierName = invoice.supplierId ? supplierMap[invoice.supplierId]?.name : null;
                    const displaySupplierName = supplierName ?? (loadingSuppliers && invoice.supplierId ? '...' : 'Без поставщика');
                    
                    return (
                        <li
                            key={invoice.id}
                            className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md border border-neutral-200 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-shadow duration-150"
                        >
                            <div className="flex items-start justify-between flex-wrap gap-2">
                                {/* Left Side: Main Info */} 
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate flex items-center">
                                        <BuildingLibraryIcon className="h-4 w-4 mr-1.5 text-neutral-400 flex-shrink-0"/> 
                                        <span className="truncate">{displaySupplierName}</span>
                                        <span className="mx-1 text-neutral-400 dark:text-neutral-500">-</span>
                                        <span className="font-semibold whitespace-nowrap">{formatCurrency(invoice.amount)}</span>
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        Категория: {invoice.primaryCategory} / {invoice.secondaryCategory}
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                        Статус: <span className="font-medium">{invoice.status}</span> | Срок: {formatDate(invoice.dueDate)}
                                    </p>
                                    {invoice.fileName && 
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5" title={invoice.fileName}>Файл: {invoice.fileName}</p>
                                    }
                                    {invoice.comment && 
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 italic">Комментарий: {invoice.comment}</p>
                                    }
                                </div>
                                {/* Right Side: Submitter & Actions */} 
                                <div className="flex-shrink-0 flex flex-col items-end space-y-1">
                                   <div className="flex items-center space-x-1">
                                        {invoice.fileURL && (
                                            <a
                                                href={invoice.fileURL}
                                                target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center h-7 w-7 rounded-full text-neutral-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                title="Скачать счет"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <DocumentArrowDownIcon className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center" title={`Загружен: ${formatDate(invoice.uploadedAt)}`}>
                                         <UserCircleIcon className="h-3.5 w-3.5 mr-1 text-neutral-400 flex-shrink-0"/> 
                                         <span className="truncate">{invoice.submitterName || 'Неизвестно'}</span>
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default DepartmentInvoiceList; 