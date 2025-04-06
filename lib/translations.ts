import { ProjectStatus } from './projectSchema'; // Assuming ProjectStatus type exists or can be defined

export const projectStatusTranslations: Record<ProjectStatus | string, string> = {
  planning: 'Планирование',
  active: 'В работе',
  completed: 'Завершен',
  on_hold: 'На паузе',
  cancelled: 'Отменен',
  // Add other potential statuses from your data source if needed
  'in-progress': 'В работе', // Example mapping
};

export const translateProjectStatus = (status: ProjectStatus | string | undefined | null): string => {
  if (!status) return 'Неизвестно';
  // Ensure status is treated as a string key
  const statusKey = String(status);
  return projectStatusTranslations[statusKey] || statusKey; // Fallback to original status key if translation not found
};
