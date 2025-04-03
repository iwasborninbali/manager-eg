import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// Define the Zod schema for Invoice data, this will be the primary source of truth
export const invoiceSchema = z.object({
  projectId: z.string().min(1, "Проект обязателен"),
  supplierId: z.string().min(1, "Поставщик обязателен"), // ID of the supplier/vendor from 'suppliers' collection
  amount: z.number({
    required_error: "Сумма обязательна",
    invalid_type_error: "Сумма должна быть числом",
  }).positive("Сумма должна быть положительной"),
  // Keep dueDate optional for now based on previous request, but use refine for validation if needed later
  dueDate: z.instanceof(Timestamp).optional(), 
  isUrgent: z.boolean().default(false),
  // Changed paymentPurpose to comment and made it optional
  comment: z.string().optional(), 
  fileURL: z.string().url("Неверный формат URL файла"),
  fileName: z.string().min(1, "Имя файла обязательно"),
  status: z.enum(['pending_payment', 'paid', 'overdue', 'cancelled']).default('pending_payment'),
  uploadedAt: z.instanceof(Timestamp), // Should be set by serverTimestamp typically
  paidAt: z.instanceof(Timestamp).optional(),
  // Add any other relevant fields derived from the schema if needed
});

// Derive the TypeScript type from the Zod schema
export type InvoiceData = z.infer<typeof invoiceSchema>;

// Example Usage (for reference):
// const validatedData = invoiceSchema.parse(yourRawInvoiceObject); 