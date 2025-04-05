import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Defines the structure of a department invoice document in Firestore
export interface DepartmentInvoiceData {
    id?: string; // Firestore document ID (optional, usually added after creation)
    primaryCategory: string; // EG, Brand Group, Imagineers, БЭКОФИС
    secondaryCategory: string; // Зарплата, Коммандировки, HR, etc.
    submitterUid: string;      // UID of the user who submitted the invoice
    submitterName: string;     // Name of the user (denormalized for easier display)
    supplierId: string;        // ID of the supplier from the 'suppliers' collection
    amount: number;            // Invoice amount
    dueDate?: Timestamp | null; // Optional due date
    fileURL: string;           // URL of the uploaded invoice file in Storage
    fileName: string;          // Original name of the uploaded file
    uploadedAt: Timestamp;     // Timestamp when the invoice was uploaded (server-side)
    status: 'pending_payment' | 'paid' | 'cancelled'; // Status of the invoice
    comment?: string | null;    // Optional comment
}

// Zod Schema for validation (optional, but good practice)
export const departmentInvoiceSchema = z.object({
    primaryCategory: z.string().min(1, "Категория 1 обязательна"),
    secondaryCategory: z.string().min(1, "Категория 2 обязательна"),
    supplierId: z.string().min(1, "Поставщик обязателен"),
    amount: z.preprocess(
        (val) => parseFloat(String(val)), 
        z.number().positive("Сумма должна быть положительной")
    ),
    dueDate: z.preprocess(
        (arg) => typeof arg === 'string' || arg instanceof Date ? new Date(arg) : undefined,
        z.date().optional().nullable()
    ),
    comment: z.string().optional().nullable(),
    // Fields added server-side or during upload process:
    // submitterUid: z.string(),
    // submitterName: z.string(),
    // fileURL: z.string().url(),
    // fileName: z.string(),
    // uploadedAt: z.instanceof(Timestamp),
    // status: z.enum(['pending_payment', 'paid', 'cancelled'])
});

// Type for form data derived from schema (useful if using react-hook-form)
export type DepartmentInvoiceFormData = z.infer<typeof departmentInvoiceSchema>; 