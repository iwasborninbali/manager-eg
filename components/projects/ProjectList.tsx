'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config'; // Adjust the path as necessary
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button'; // Import Button
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'; // Import icon for upload button
import { cn } from '@/lib/utils';
import ProjectDetailsDialog from './ProjectDetailsDialog'; // Import the details dialog component
import UploadInvoiceDialog from '../invoices/UploadInvoiceDialog'; // Import the invoice dialog component

// Define the structure of a Project document
interface Project {
  id: string; // Firestore document ID
  budget?: number;
  createdAt?: Timestamp;
  customer?: string;
  duedate?: Timestamp;
  estimatecostlink?: string;
  managerid?: string;
  name?: string;
  number?: string;
  planned_revenue?: number;
  presentationlink?: string;
  status?: string;
  updatedAt?: Timestamp;
  // Add other fields if necessary
}

// Function to format Firestore Timestamps (optional, but recommended)
const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); // Changed format
};

// Function to format currency (optional)
const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined) return 'N/A';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount); // Adjust locale/currency
};

// Status badge mapping
const statusColors: { [key: string]: string } = {
  planning: 'bg-info-100 text-info-700 dark:bg-info-900/50 dark:text-info-300',
  active: 'bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-300',
  completed: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  on_hold: 'bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300',
  cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/50 dark:text-error-300',
};

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for Details Dialog
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // State for Invoice Dialog
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  // Store only the ID needed for the invoice dialog context
  const [selectedProjectIdForInvoice, setSelectedProjectIdForInvoice] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'));

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const projectsData: Project[] = [];
        querySnapshot.forEach((doc) => {
          projectsData.push({ id: doc.id, ...doc.data() } as Project);
        });
        setProjects(projectsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching projects: ", err);
        setError("Failed to load projects.");
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Handlers for Details Dialog
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setIsDetailsOpen(true);
  };
  const handleCloseDetailsDialog = () => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedProject(null), 300); 
  };

  // Handlers for Invoice Dialog
  const handleOpenInvoiceDialog = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering card click (details dialog)
    setSelectedProjectIdForInvoice(projectId);
    setIsInvoiceDialogOpen(true);
  };
  const handleCloseInvoiceDialog = () => {
    setIsInvoiceDialogOpen(false);
    setSelectedProjectIdForInvoice(null);
  };
  const handleInvoiceSuccess = (invoiceId: string) => {
    console.log(`Invoice ${invoiceId} uploaded successfully!`);
    // Optionally show a success notification/toast
  };


  if (loading) {
    return (
      <div className="text-center py-10">
        <p className="text-neutral-500 dark:text-neutral-400">Загрузка проектов...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-error-600 dark:text-error-400">
        <p>{error}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-neutral-500 dark:text-neutral-400">Проекты не найдены.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div 
            key={project.id} 
            className="relative group" // Needed for potential absolute positioning inside card if desired
          >
            <Card 
              variant="outline" 
              className="h-full flex flex-col hover:shadow-lg transition-shadow duration-300 cursor-pointer" 
              onClick={() => handleProjectClick(project)} // Open details on card click
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="mb-1">{project.name || 'Безымянный проект'}</CardTitle>
                    <CardDescription>#{project.number || 'N/A'} - {project.customer || 'Нет заказчика'}</CardDescription>
                  </div>
                  {project.status && (
                    <Badge 
                      className={cn(
                        "text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2", // Added margin and shrink
                        statusColors[project.status] || 'bg-neutral-100 text-neutral-700'
                      )}
                    >
                      {project.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-grow"> {/* flex-grow to push footer down */}
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  <p><span className="font-medium text-neutral-700 dark:text-neutral-300">Бюджет:</span> {formatCurrency(project.budget)}</p>
                  <p><span className="font-medium text-neutral-700 dark:text-neutral-300">Выручка (план):</span> {formatCurrency(project.planned_revenue)}</p>
                </div>
              </CardContent>
              <CardFooter className="text-xs text-neutral-500 dark:text-neutral-400 flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-700">
                <div className="flex flex-col">
                  <span>Срок: {formatDate(project.duedate)}</span>
                  {/* <span>Создан: {formatDate(project.createdAt)}</span> */}
                </div>
                 {/* Upload Invoice Button */}
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400 -mr-2" 
                   onClick={(e) => handleOpenInvoiceDialog(project.id, e)} // Pass project ID and event
                   aria-label="Загрузить счет"
                 >
                   <ArrowUpTrayIcon className="h-5 w-5" />
                 </Button>
              </CardFooter>
            </Card>
           </div>
        ))}
      </div>

      {/* Render the Details Dialog */}
      <ProjectDetailsDialog 
        isOpen={isDetailsOpen} 
        onClose={handleCloseDetailsDialog} 
        project={selectedProject}
      />

       {/* Render the Invoice Upload Dialog */} 
       {/* Only render when needed to fetch projects only when open */} 
       {isInvoiceDialogOpen && selectedProjectIdForInvoice && (
         <UploadInvoiceDialog
            isOpen={isInvoiceDialogOpen} 
            onClose={handleCloseInvoiceDialog} 
            onSuccess={handleInvoiceSuccess}
            // Pass project ID which is now required
            projectId={selectedProjectIdForInvoice} 
         />
       )}
    </>
  );
};

export default ProjectList; 