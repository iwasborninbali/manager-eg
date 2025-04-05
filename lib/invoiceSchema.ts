import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// Define the Zod schema for Invoice data, this will be the primary source of truth
export const invoiceSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  supplierId: z.string().min(1, "Supplier is required"), // ID of the supplier/vendor from 'suppliers' collection
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/\s/g, '')) : val),
    z.number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    }).positive("Amount must be positive")
  ),
  // Keep dueDate optional for now based on previous request, but use refine for validation if needed later
  dueDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return arg; // Keep null as is
  }, z.date().nullable().optional()),
  isUrgent: z.boolean().default(false),
  // Changed paymentPurpose to comment and made it optional
  comment: z.string().optional().nullable(),
  fileURL: z.string().url("Invalid file URL format"),
  fileName: z.string().min(1, "File name is required"),
  status: z.enum(['pending_payment', 'paid', 'overdue', 'cancelled']).default('pending_payment'),
  uploadedAt: z.instanceof(Timestamp), // Should be set by serverTimestamp typically
  paidAt: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return arg; // Keep null as is
  }, z.date().nullable().optional()),
  // Added submitter info
  submitterUid: z.string().min(1),
  submitterName: z.string().min(1),
  // Add any other relevant fields derived from the schema if needed
});

// Derive the TypeScript type from the Zod schema
export type InvoiceData = z.infer<typeof invoiceSchema>;

// Example Usage (for reference):
// const validatedData = invoiceSchema.parse(yourRawInvoiceObject); 