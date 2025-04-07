import { Timestamp } from 'firebase/firestore';

// Define the possible project statuses
export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled' | 'in-progress'; // Added 'in-progress' based on translation file

// Defines the structure of a project document in Firestore
export interface ProjectData {
  number?: string; // Optional, might be assigned later or not used
  name: string;
  customer?: string; // Optional
  duedate: Timestamp; // Stored as Firestore Timestamp
  managerid: string; // UID of the assigned manager
  estimatecostlink?: string; // Optional URL
  presentationlink?: string; // Optional URL
  planned_revenue?: number; // Stored as number
  actual_revenue?: number;
  planned_budget?: number;
  actual_budget?: number;
  usn_tax?: number;
  nds_tax?: number;
  description?: string;
  status: ProjectStatus; // Use the exported type
  createdAt: Timestamp;
  updatedAt: Timestamp;
  total_non_cancelled_invoice_amount?: number; // Add this field for denormalization
  // Add any other fields relevant to your project structure
} 