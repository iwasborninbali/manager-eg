'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config'; // Adjust the path as necessary
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button'; // Import Button
import { ChartBarIcon } from '@heroicons/react/24/outline'; // Import icon for financials button
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline'; // Import icon for closing docs button
import { cn } from '@/lib/utils';
import ProjectFinancialsDialog from './ProjectFinancialsDialog';
import ProjectDetailsDialog from './ProjectDetailsDialog';
import ProjectClosingDocsDialog from './ProjectClosingDocsDialog';
import { Fragment } from 'react'; // Убедитесь, что Fragment импортирован

// Define the structure of a Project document
interface Project {
  id: string; // Firestore document ID
  actual_budget?: number;    // Added back (was budget)
  planned_budget?: number;   // Added back
  createdAt?: Timestamp;
  customer?: string;
  duedate?: Timestamp;
  estimatecostlink?: string;
  managerid?: string;
  name?: string;
  number?: string;
  planned_revenue?: number;
  actual_revenue?: number;   // Added back
  presentationlink?: string;
  status?: string;
  updatedAt?: Timestamp;
  description?: string;      // Added back
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
  const isMounted = useRef(false); // Ref to track mount status for listener
  
  // State for Details Dialog
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // State for Financials Dialog
  const [isFinancialsOpen, setIsFinancialsOpen] = useState(false);
  const [selectedProjectIdForFinancials, setSelectedProjectIdForFinancials] = useState<string | null>(null);

  // State for Closing Docs Dialog
  const [isClosingDocsOpen, setIsClosingDocsOpen] = useState(false);
  const [selectedProjectForClosingDocs, setSelectedProjectForClosingDocs] = useState<Project | null>(null);

  // Effect for Initial Load
  useEffect(() => {
    isMounted.current = true; // Mark as mounted
    let didCancel = false; // Flag to prevent state update on unmount

    const fetchInitialProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'projects'));
        const querySnapshot = await getDocs(q);
        if (!didCancel) {
          const projectsData: Project[] = [];
          querySnapshot.forEach((doc) => {
            projectsData.push({ id: doc.id, ...doc.data() } as Project);
          });
          console.log("Initial projects fetched successfully.");
          setProjects(projectsData);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching initial projects: ", err);
        if (!didCancel) {
          setError("Failed to load initial projects.");
          setLoading(false);
        }
      }
    };

    fetchInitialProjects();

    // Cleanup function
    return () => {
      didCancel = true;
      isMounted.current = false; // Mark as unmounted
      console.log("ProjectList unmounted, initial fetch effect cleanup.");
    };
  }, []); // Runs once on mount

  // Effect for Real-time Updates (runs after initial load)
  useEffect(() => {
    // Ensure this runs only after mount and initial load is attempted
    if (!isMounted.current || loading) {
       // Do nothing if not mounted or initial load is still in progress
       // This check might be redundant due to the [] dependency array in the first effect,
       // but provides extra safety.
      return;
    }

    console.log("Setting up Firestore listener for real-time updates.");
    const q = query(collection(db, 'projects'));
    const unsubscribe = onSnapshot(q,
      (querySnapshot) => {
        // Prevent updates during initial mount/load phase (handled by first effect)
         if (!isMounted.current) return; 

        console.log("Firestore listener received update.");
        const projectsData: Project[] = [];
        querySnapshot.forEach((doc) => {
          projectsData.push({ id: doc.id, ...doc.data() } as Project);
        });

        // Update state only with subsequent changes, using comparison
        setProjects(currentProjects => {
          if (
            projectsData.length !== currentProjects.length ||
            !projectsData.every((newProj, index) => newProj.id === currentProjects[index]?.id)
          ) {
            console.log("Firestore data changed, updating projects state via listener.");
            return projectsData;
          }
          return currentProjects;
        });
        // No need to set loading/error here, handled by initial load
      },
      (err) => {
        // Handle listener errors (optional: update error state if needed)
        console.error("Error in Firestore listener: ", err);
         if (isMounted.current) {
            // Optionally set an error state specific to the listener
            // setError("Failed to get real-time updates."); 
         }
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log("Cleaning up Firestore listener.");
      unsubscribe();
    };
  // Depend on `loading` to ensure listener setup after initial load finishes
  // Or keep empty [] if the isMounted check is deemed sufficient. Let's try with [loading].
  }, [loading]); 

  // Handlers for Details Dialog
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setIsDetailsOpen(true);
  };
  const handleCloseDetailsDialog = () => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedProject(null), 300); 
  };

  // Handlers for Financials Dialog
  const handleOpenFinancialsDialog = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering card click (details dialog)
    setSelectedProjectIdForFinancials(projectId);
    setIsFinancialsOpen(true);
  };
  const handleCloseFinancialsDialog = () => {
    setIsFinancialsOpen(false);
    setSelectedProjectIdForFinancials(null);
  };

  // Handlers for Closing Docs Dialog
  const handleOpenClosingDocsDialog = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    setSelectedProjectForClosingDocs(project);
    setIsClosingDocsOpen(true);
  };
  const handleCloseClosingDocsDialog = () => {
    setIsClosingDocsOpen(false);
    setSelectedProjectForClosingDocs(null);
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
            className="relative group" 
          >
            <Card 
              variant="outline" 
              className="h-full flex flex-col hover:shadow-lg transition-shadow duration-300 cursor-pointer" 
              onClick={() => handleProjectClick(project)}
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
              <CardContent className="space-y-3 flex-grow">
                <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Бюджет (План):</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(project.planned_budget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Бюджет (Факт):</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(project.actual_budget)}</span>
                  </div>
                   <div className="flex justify-between">
                    <span>Выручка (План):</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(project.planned_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Выручка (Факт):</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(project.actual_revenue)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="text-xs text-neutral-500 dark:text-neutral-400 flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-700">
                <div className="flex flex-col">
                  <span>Срок: {formatDate(project.duedate)}</span>
                </div>
                <div className="flex items-center space-x-0.5"> {/* Adjusted spacing */}
                    {/* Closing Docs Button */}
                    <Button 
                       variant="ghost" size="icon" 
                       className="text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400"
                       onClick={(e) => handleOpenClosingDocsDialog(project, e)}
                       aria-label="Закрывающие документы"
                       title="Закрывающие документы"
                    >
                       <DocumentDuplicateIcon className="h-5 w-5" />
                    </Button>
                    {/* Financials Button */}
                    <Button 
                       variant="ghost" size="icon" 
                       className="text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400"
                       onClick={(e) => handleOpenFinancialsDialog(project.id, e)}
                       aria-label="Финансовые показатели"
                       title="Финансовые показатели"
                    >
                       <ChartBarIcon className="h-5 w-5" />
                    </Button>
                </div>
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

       {/* Render the Financials Dialog */} 
       {isFinancialsOpen && (
           <ProjectFinancialsDialog
               isOpen={isFinancialsOpen}
               onClose={handleCloseFinancialsDialog}
               projectId={selectedProjectIdForFinancials}
           />
       )}

       {/* Render the Closing Docs Dialog */} 
       {selectedProjectForClosingDocs && (
           <ProjectClosingDocsDialog
               isOpen={isClosingDocsOpen}
               onClose={handleCloseClosingDocsDialog}
               projectId={selectedProjectForClosingDocs.id}
               projectName={selectedProjectForClosingDocs.name}
           />
       )}
    </>
  );
};

export default ProjectList; 