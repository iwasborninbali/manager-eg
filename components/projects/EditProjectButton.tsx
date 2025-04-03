'use client';

import React from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
// import { useAuth } from '@/context/AuthContext'; // Remove this import

interface EditProjectButtonProps {
  onClick: () => void;
}

const EditProjectButton: React.FC<EditProjectButtonProps> = ({ onClick }) => {
  // const { user } = useAuth(); // Remove user access

  // Remove the role check
  // if (user?.role !== 'CEO') { // Remove this condition
  //   return null;
  // }

  // Always render the button
  return (
    <Button variant="secondary" onClick={onClick}>
      <PencilSquareIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
      Редактировать
    </Button>
  );
};

export default EditProjectButton; 