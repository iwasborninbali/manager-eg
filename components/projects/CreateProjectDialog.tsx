import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { db } from '@/firebase/config'; // Adjust path if needed
import { collection, query, where, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProjectData } from '@/lib/projectSchema';
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

      // Add fields that are set automatically
      const finalProjectData: ProjectData = {
          ...projectData,
          status: 'planning', // Set default status
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
      }

      // Add the document to the 'projects' collection
      const projectsColRef = collection(db, 'projects');
      const docRef = await addDoc(projectsColRef, finalProjectData);
      console.log("Document written with ID: ", docRef.id);

      onSuccess(docRef.id); // Pass the new project ID back
      onClose(); // Close dialog on success

    } catch (err) {
      console.error("Error creating project:", err);
      setError("Failed to create project. Please check the details and try again.");
      // Keep the dialog open if there is an error
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                type="text" 
                id="number" 
                name="number" 
                value={formData.number} 
                onChange={handleChange} 
                label="Номер проекта"
              />
              
              <Input 
                type="text" 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                label="Название проекта *" 
                required
                error={!formData.name ? "Обязательное поле" : undefined}
              />
            </div>
            
            <Input 
              type="text" 
              id="customer" 
              name="customer" 
              value={formData.customer} 
              onChange={handleChange} 
              label="Клиент"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label htmlFor="budget" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Себестоимость (RUB)
              </label>
              <Input
                type="number" 
                id="budget" 
                name="budget" 
                value={formData.budget} 
                onChange={handleChange} 
                leftElement={<span className="text-sm">₽</span>}
              />
              
              <Input 
                type="number" 
                id="planned_revenue" 
                name="planned_revenue" 
                value={formData.planned_revenue} 
                onChange={handleChange} 
                label="Запланированный доход" 
                leftElement={<span className="text-sm">₽</span>}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="managerid" className="text-sm font-medium leading-none">
                  Менеджер проекта *
                </label>
                <select
                  id="managerid"
                  name="managerid"
                  value={formData.managerid}
                  onChange={handleChange}
                  required
                  className={`flex h-10 w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2 text-sm transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${!formData.managerid ? 'border-error-500 focus-visible:ring-error-500' : 'border-neutral-200 dark:border-neutral-700 focus-visible:border-primary-500'}`}
                >
                  <option value="" disabled>-- Выберите менеджера --</option>
                  {managers.map(manager => (
                    <option key={manager.uid} value={manager.uid}>
                      {manager.first_name || 'N/A'} {manager.last_name || ''}
                    </option>
                  ))}
                </select>
                {!formData.managerid && <p className="text-xs text-error-500">Обязательное поле</p>}
                {loading && managers.length === 0 && <p className="text-xs text-neutral-500">Загрузка списка менеджеров...</p>}
              </div>
              
              <Input 
                type="date" 
                id="duedate" 
                name="duedate" 
                value={formData.duedate} 
                onChange={handleChange} 
                label="Дата завершения *" 
                required
                error={!formData.duedate ? "Обязательное поле" : undefined}
              />
            </div>
            
            <Input 
              type="url" 
              id="estimatecostlink" 
              name="estimatecostlink" 
              value={formData.estimatecostlink} 
              onChange={handleChange} 
              label="Ссылка на смету" 
              placeholder="https://"
            />
            
            <Input 
              type="url" 
              id="presentationlink" 
              name="presentationlink" 
              value={formData.presentationlink} 
              onChange={handleChange} 
              label="Ссылка на презентацию" 
              placeholder="https://"
            />

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-700 dark:bg-error-900/50 dark:text-error-300">
                <p className="font-medium">Ошибка</p>
                <p>{error}</p>
              </div>
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