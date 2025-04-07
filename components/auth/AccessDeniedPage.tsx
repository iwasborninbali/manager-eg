'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ExclamationTriangleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

export default function AccessDeniedPage() {
  const { logOut } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-100 dark:bg-neutral-900 text-center p-4">
      <ExclamationTriangleIcon className="h-16 w-16 text-error-500 dark:text-error-400 mb-4" />
      <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">Доступ запрещен</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md">
        У вас нет необходимых прав для доступа к этому приложению. Пожалуйста, свяжитесь с администратором, 
если вы считаете, что это ошибка.
      </p>
      <Button onClick={logOut} variant="destructive">
        <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
        Выйти
      </Button>
    </div>
  );
} 