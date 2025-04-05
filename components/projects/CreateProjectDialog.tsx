import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { db } from '@/firebase/config'; // Adjust path if needed
import { collection, query, where, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProjectData } from '@/lib/projectSchema';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Example using shadcn/ui dialog

// Define the structure for user profiles fetched from Firestore
interface Profile {
  uid: string;
  first_name?: string;
  last_name?: string;
  role?: string[];
  // Add other relevant fields if needed
}

// Define the structure for the form data
interface FormData {
  number: string;
  name: string;
  customer: string;
  budget: string;
  duedate: string;
  managerid: string; // Stores the UID of the selected manager
  estimatecostlink: string;
  presentationlink: string;
  planned_revenue: string;
}

// Define the props for the dialog component
interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectId: string) => void; // Callback on successful creation
}

export default function CreateProjectDialog({ isOpen, onClose, onSuccess }: CreateProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [formData, setFormData] = useState<FormData>({
    number: '',
    name: '',
    customer: '',
    budget: '',
    duedate: '',
    managerid: '',
    estimatecostlink: '',
    presentationlink: '',
    planned_revenue: ''
  });

  // Fetch managers when the dialog is opened
  useEffect(() => {
    if (isOpen) {
      const fetchManagers = async () => {
        setLoading(true);
        setError(null);
        try {
          const usersRef = collection(db, 'users');
          // Query for users where the 'role' array contains 'Manager'
          const q = query(usersRef, where('role', 'array-contains', 'Manager'));
          const querySnapshot = await getDocs(q);
          const fetchedManagers: Profile[] = [];
          querySnapshot.forEach((doc) => {
            // Assuming user document structure includes uid, first_name, last_name, role
            fetchedManagers.push({ uid: doc.id, ...doc.data() } as Profile);
          });
          setManagers(fetchedManagers);
        } catch (err) {
          console.error("Error fetching managers:", err);
          setError("Failed to load managers. Please try again.");
        } finally {
          setLoading(false);
        }
      };

      fetchManagers();
    } else {
      // Reset state when dialog closes
      setManagers([]);
      setFormData({
        number: '', name: '', customer: '', budget: '', duedate: '', managerid: '',
        estimatecostlink: '', presentationlink: '', planned_revenue: ''
      });
      setError(null);
      setLoading(false);
    }
  }, [isOpen]); // Re-run effect when isOpen changes

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Specific handler for Radix Select (onValueChange passes value directly)
  const handleManagerChange = (value: string) => {
    setFormData(prevData => ({
        ...prevData,
        managerid: value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic validation (add more as needed)
    if (!formData.name || !formData.managerid || !formData.duedate) {
        setError("Project Name, Manager, and Due Date are required.");
        setLoading(false);
        return;
    }

    try {
      // Prepare the data object according to ProjectData schema
      const projectData: Omit<ProjectData, 'createdAt' | 'updatedAt' | 'status'> & { // Exclude fields automatically set
          budget?: number;
          planned_revenue?: number;
          duedate: Timestamp;
      } = {
        number: formData.number || undefined, // Use undefined if empty
        name: formData.name,
        customer: formData.customer || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        planned_revenue: formData.planned_revenue ? parseFloat(formData.planned_revenue) : undefined,
        duedate: Timestamp.fromDate(new Date(formData.duedate)),
        managerid: formData.managerid,
        estimatecostlink: formData.estimatecostlink || undefined,
        presentationlink: formData.presentationlink || undefined,
      };

      // Add fields that are set automatically AND map/duplicate budget/revenue
      const budgetValue = formData.budget ? parseFloat(formData.budget) : undefined;
      const revenueValue = formData.planned_revenue ? parseFloat(formData.planned_revenue) : undefined;

      const finalProjectData: Omit<ProjectData, 'budget'> & { // Explicitly omit original budget
        planned_budget?: number;
        actual_budget?: number;
        planned_revenue?: number;
        actual_revenue?: number;
        status: string;
        createdAt: Timestamp;
        updatedAt: Timestamp;
      } = {
          ...projectData,
          planned_budget: budgetValue,   // Set planned_budget from form's budget
          actual_budget: budgetValue,    // Set actual_budget from form's budget
          planned_revenue: revenueValue, // Keep planned_revenue from form
          actual_revenue: revenueValue,  // Set actual_revenue from form's planned_revenue
          status: 'planning', // Set default status
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (finalProjectData as any).budget;

      // Add the document to the 'projects' collection
      const projectsColRef = collection(db, 'projects');
      const docRef = await addDoc(projectsColRef, finalProjectData);
      console.log("Document written with ID: ", docRef.id);

      onSuccess(docRef.id); // Pass the new project ID back
      onClose(); // Close dialog on success

    } catch (error: unknown) {
      console.error("Error creating project:", error);
      let errorMessage = "Произошла ошибка при создании проекта.";
      if (error instanceof Error) {
        errorMessage += ` ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Render null if dialog is not open (or use a proper Modal component)
  if (!isOpen) {
    return null;
  }

  // Modern dialog with Card component from design system
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card variant="glass" className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Создание нового проекта</CardTitle>
              <CardDescription>Заполните форму, чтобы создать новый проект</CardDescription>
            </div>
            <Badge variant="secondary" withDot>Planning</Badge>
          </div>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Project Number and Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Номер проекта" 
                id="number" 
                name="number" 
                value={formData.number} 
                onChange={handleChange} 
              />
              <Input 
                label="Название проекта *" 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required
                error={!formData.name ? "Обязательное поле" : undefined}
              />
            </div>
            
            {/* Customer */}
            <Input 
              label="Клиент" 
              id="customer" 
              name="customer" 
              value={formData.customer} 
              onChange={handleChange} 
            />
            
            {/* Budget and Revenue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Input 
                 label="Бюджет (RUB)"
                 type="number" 
                 id="budget" 
                 name="budget" 
                 value={formData.budget} 
                 onChange={handleChange} 
                 leftElement={<span className="text-sm text-neutral-500 dark:text-neutral-400">₽</span>}
               />
               <Input 
                 label="Выручка (RUB)" // Changed label
                 type="number" 
                 id="planned_revenue" 
                 name="planned_revenue" 
                 value={formData.planned_revenue} 
                 onChange={handleChange} 
                 leftElement={<span className="text-sm text-neutral-500 dark:text-neutral-400">₽</span>}
               />
            </div>
            
            {/* Manager and Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Manager Select */}
              <div className="flex flex-col space-y-1.5"> {/* Wrapper for label and select */}
                <label htmlFor="managerid" className="text-sm font-medium leading-none text-neutral-900 dark:text-neutral-100">
                  Менеджер проекта *
                </label>
                <Select 
                  name="managerid" 
                  value={formData.managerid} 
                  onValueChange={handleManagerChange} // Use onValueChange
                  required
                  disabled={loading} 
                >
                  {/* Wrap options in SelectTrigger and SelectContent as per Radix structure */}
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите менеджера" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* <option value="" disabled>Выберите менеджера</option> // Remove standard option */} 
                    {managers.map(manager => (
                      <SelectItem key={manager.uid} value={manager.uid}>
                        {`${manager.first_name || ''} ${manager.last_name || ''} (${manager.uid.substring(0, 5)}...)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error && <p className="text-xs text-error-600 dark:text-error-400 mt-1">{error}</p>}
              </div>

              {/* Due Date Input */}
              <Input 
                label="Срок сдачи *" 
                type="date" 
                id="duedate" 
                name="duedate" 
                value={formData.duedate} 
                onChange={handleChange} 
                required
                error={!formData.duedate ? "Обязательное поле" : undefined}
              />
            </div>
            
            {/* Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Ссылка на смету"
                id="estimatecostlink" 
                name="estimatecostlink" 
                value={formData.estimatecostlink} 
                onChange={handleChange} 
              />
              <Input 
                label="Ссылка на презентацию" 
                id="presentationlink" 
                name="presentationlink" 
                value={formData.presentationlink} 
                onChange={handleChange} 
              />
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            )}
          </CardContent>
          
          <CardFooter className="justify-end space-x-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={loading}
            >
              Отмена
            </Button>
            <Button 
              type="submit" 
              variant="default" 
              isLoading={loading}
              leftIcon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              }
            >
              Создать проект
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 