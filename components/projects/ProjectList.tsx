'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, Timestamp, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase/config'; // Adjust the path as necessary
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChartBarIcon } from '@heroicons/react/24/outline'; // Import icon for financials button
import { DocumentDuplicateIcon, BanknotesIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'; // Added missing icons
import { cn } from '@/lib/utils';
import { translateProjectStatus } from '@/lib/translations'; // Import the translation function
import ProjectFinancialsDialog from './ProjectFinancialsDialog';
import ProjectDetailsDialog from './ProjectDetailsDialog';
import ProjectClosingDocsDialog from './ProjectClosingDocsDialog';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
// import { PlusIcon, DocumentIcon } from '@heroicons/react/24/outline';
// import CreateProjectDialog from './CreateProjectDialog';
// import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'; // Commented out - needs path correction or removal

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
  usn_tax?: number;          // Added for display
  nds_tax?: number;          // Added for display
  // total_non_cancelled_invoice_amount?: number; // Removed - not used without balance calc
}

// Function to format Firestore Timestamps (optional, but recommended)
const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); // Changed format
};

// Function to format currency (optional)
const formatCurrency = (amount: number | undefined, fallback: string = 'Н/Д'): string => {
  if (amount === undefined || amount === null) return fallback;
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
  const { user } = useAuth(); // Get the current user
  
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
    if (!user) {
      // If no user, don't fetch projects (or handle appropriately)
      setLoading(false);
      return;
    }

    setLoading(true);
    // Filter projects where managerid matches the current user's UID
    const q = query(
      collection(db, 'projects'), 
      where('managerid', '==', user.uid), // Filter by managerid
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const projectsData: Project[] = [];
      querySnapshot.forEach((doc) => {
        projectsData.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(projectsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching projects:", err);
      setError("Не удалось загрузить проекты.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]); // Re-run when user changes

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Skeleton Loader */} 
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="h-full animate-pulse">
              <CardHeader>
                <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-neutral-100 dark:border-neutral-700">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
              </CardFooter>
            </Card>
          ))}
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Мои Проекты</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard 
             key={project.id} 
             project={project} 
             onDetailsClick={() => handleProjectClick(project)}
             onFinancialsClick={(e) => handleOpenFinancialsDialog(project.id, e)}
             onClosingDocsClick={(e) => handleOpenClosingDocsDialog(project, e)}
          />
        ))}
      </div>

      {/* Render Dialogs */}
      <ProjectDetailsDialog 
        isOpen={isDetailsOpen} 
        onClose={handleCloseDetailsDialog} 
        project={selectedProject} 
      />
      <ProjectFinancialsDialog
        isOpen={isFinancialsOpen}
        onClose={handleCloseFinancialsDialog}
        projectId={selectedProjectIdForFinancials}
      />
      <ProjectClosingDocsDialog
        isOpen={isClosingDocsOpen}
        onClose={handleCloseClosingDocsDialog}
        projectId={selectedProjectForClosingDocs?.id ?? null}
        projectName={selectedProjectForClosingDocs?.name}
      />
    </div>
  );
};

// --- Project Card Component ---
// Ensure this component is defined below or imported correctly
interface ProjectCardProps {
  project: Project;
  onDetailsClick: () => void;
  onFinancialsClick: (event: React.MouseEvent) => void;
  onClosingDocsClick: (event: React.MouseEvent) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDetailsClick, onFinancialsClick, onClosingDocsClick }) => {
  const statusClass = statusColors[project.status || 'planning'] || statusColors.planning;

  return (
    <Card 
        className="h-full flex flex-col transition-shadow duration-300 hover:shadow-lg dark:hover:shadow-primary-900/30 cursor-pointer overflow-hidden" 
        onClick={onDetailsClick}
        variant="glass"
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold mb-1 line-clamp-2">{project.name || 'Без названия'}</CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              {project.number ? `№ ${project.number}` : ''} {project.customer ? `| ${project.customer}` : ''}
            </CardDescription>
          </div>
          <Badge variant="outline" className={cn("text-xs whitespace-nowrap", statusClass)}>
            {translateProjectStatus(project.status || 'planning')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-grow space-y-2 text-sm">
        <div className="flex items-center text-neutral-600 dark:text-neutral-300">
          <CalendarDaysIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Срок сдачи: {formatDate(project.duedate)}</span>
        </div>
        <div className="flex items-center text-neutral-600 dark:text-neutral-300">
          <BanknotesIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Бюджет: {formatCurrency(project.actual_budget)} (План: {formatCurrency(project.planned_budget)})</span>
        </div>
        <div className="flex items-center text-neutral-600 dark:text-neutral-300">
          <ArrowTrendingUpIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Выручка: {formatCurrency(project.actual_revenue)} (План: {formatCurrency(project.planned_revenue)})</span>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end space-x-2">
        <Button variant="outline" size="sm" onClick={onFinancialsClick} title="Финансы">
          <ChartBarIcon className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onClosingDocsClick} title="Закрывашки">
          <DocumentDuplicateIcon className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProjectList; 