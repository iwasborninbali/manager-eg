import React, { Fragment, useRef } from 'react';
import Link from 'next/link';
import { Transition } from '@headlessui/react';
import {
  FolderIcon,
  BanknotesIcon,
  XMarkIcon,
  PlusIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

// Renamed props interface
interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  openCreateProjectDialog: () => void;
}

// Define type for navigation items
interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

// Renamed component to SideMenu
export default function SideMenu({ isOpen, onClose, openCreateProjectDialog }: SideMenuProps) {
  const { user, userData, googleSignIn, logOut } = useAuth();
  const menuPanelRef = useRef<HTMLDivElement>(null);

  // Removed internal state management for open/animation - controlled by props now

  const navigation: NavItem[] = [
    {
      name: 'Проекты',
      href: '/projects',
      icon: <FolderIcon className="h-5 w-5" aria-hidden="true" />
    },
    {
      name: 'Бюджеты отделов',
      href: '/budgets',
      icon: <BanknotesIcon className="h-5 w-5" aria-hidden="true" />
    },
    // Remove Suppliers link
    // Add more navigation items as needed
  ];

  // Construct user display name
  const userDisplayName = userData?.first_name && userData?.last_name
    ? `${userData.first_name} ${userData.last_name}`
    : (userData?.displayName || 'Пользователь');

  // Fallback for avatar if first/last name exist but display name doesn't
  const avatarFallback = userDisplayName !== 'Пользователь' 
    ? userDisplayName[0]
    : (userData?.displayName ? userData.displayName[0] : 'U');

  return (
    // Use Transition directly, controlled by isOpen prop
    <Transition
      as={Fragment}
      show={isOpen}
    >
      <div className="fixed inset-0 flex z-40">
        {/* Overlay for closing menu when clicking outside */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-black/30"
            aria-hidden="true"
            onClick={onClose} // Close menu when overlay is clicked
          />
        </Transition.Child>

        {/* Side Menu Panel */}
        <Transition.Child
          as={Fragment}
          enter="transition ease-in-out duration-300 transform"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition ease-in-out duration-300 transform"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <div
            ref={menuPanelRef}
            className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-neutral-900 shadow-xl"
          >
            {/* Close Button (Top-right outside panel) */}
            <Transition.Child
              as={Fragment}
              enter="ease-in-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in-out duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white text-white"
                  onClick={onClose}
                  aria-label="Закрыть меню"
                >
                  <span className="sr-only">Закрыть меню</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </Transition.Child>

            {/* Menu Content */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              {/* Menu Header (Logo) - REMOVED */}
              
              {/* User Info Section - Adjusted margin, removed top border */}
              {user && (
                <div className="px-5 py-6 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center space-x-4">
                    <Avatar
                      src={user.photoURL || undefined}
                      alt={userDisplayName} // Use constructed name for alt
                      fallback={avatarFallback} // Use calculated fallback
                      size="lg"
                      fallbackColor="primary"
                      status={userData?.role?.length ? "online" : "offline"}
                    />
                    <div>
                      <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{userDisplayName}</p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
                      {userData?.role ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {userData.role.map((roleItem: string) => (
                            <Badge key={roleItem} variant="secondary">{roleItem}</Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Badge variant="error">Нет ролей</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links - Adjusted margin */}
              <nav className={`${user ? 'mt-5' : 'mt-5'} px-2 space-y-1`}> {/* Ensure margin top exists even without user */} 
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
                    onClick={onClose} // Close menu on link click
                  >
                    <span className="text-primary-600 dark:text-primary-400 mr-3 group-hover:text-primary-700 dark:group-hover:text-primary-300">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </nav>
              
              {/* Actions Section */}
              <div className="mt-8 px-2 space-y-1">
                <h3 className="px-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    Действия
                </h3>
                <button
                  onClick={() => {
                    openCreateProjectDialog();
                    onClose(); // Close menu after triggering dialog
                  }}
                  className="flex items-center px-3 py-2 rounded-md text-base font-medium text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800 transition-colors w-full group"
                >
                  <span className="text-primary-600 dark:text-primary-400 mr-3 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                    <PlusIcon className="h-5 w-5" />
                  </span>
                  Создать проект
                </button>
              </div>
            </div>

            {/* Footer Actions (Login/Logout) */}
            <div className="flex-shrink-0 flex border-t border-neutral-200 dark:border-neutral-800 p-4">
              {user ? (
                <button
                  onClick={() => { logOut(); onClose(); }} // Close menu on logout
                  className="flex w-full items-center justify-center rounded-md border border-transparent bg-error-100 dark:bg-error-900/50 px-4 py-3 text-base font-medium text-error-700 dark:text-error-300 shadow-sm hover:bg-error-200 dark:hover:bg-error-800 transition-colors"
                  aria-label="Выйти из аккаунта"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                  Выйти
                </button>
              ) : (
                <button
                  onClick={() => { googleSignIn(); onClose(); }} // Close menu on sign in
                  className="flex w-full items-center justify-center rounded-md border border-transparent bg-primary-500 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
                  aria-label="Войти через Google"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  Войти через Google
                </button>
              )}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
}
