import React from 'react';
import { cn } from '@/lib/utils';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
  label?: string;
  helperText?: string;
  fileNameDisplay?: string | null;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { 
      className, 
      leftElement, 
      rightElement, 
      error, 
      label, 
      helperText, 
      fileNameDisplay,
      ...props 
    }, 
    ref
  ) => {
    const isFileType = props.type === 'file';

    const baseInputClasses = cn(
      'flex h-10 w-full rounded-lg border bg-white dark:bg-neutral-900 text-sm transition-colors',
      'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0',
      'disabled:cursor-not-allowed disabled:opacity-50',
      error
        ? 'border-error-500 focus-visible:ring-error-500'
        : 'border-neutral-200 dark:border-neutral-700 focus-visible:border-primary-500'
    );

    const hiddenFileInputClasses = cn(
      baseInputClasses,
      'absolute inset-0 opacity-0 z-10 cursor-pointer',
      'p-0 m-0 border-0',
      className
    );

    const styledFileDisplayClasses = cn(
      baseInputClasses,
      'px-3 py-2',
      'relative flex items-center text-neutral-600 dark:text-neutral-400',
      leftElement && 'pl-10',
      rightElement && 'pr-10'
    );

    const standardInputClasses = cn(
      baseInputClasses,
      'px-3 py-2',
      leftElement && 'pl-10',
      rightElement && 'pr-10',
      className
    );

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={props.id}
            className={cn(
              'block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
              error && 'text-error-500'
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500", isFileType && "z-20")}>
              {leftElement}
            </div>
          )}
          {isFileType ? (
            <>
              <div className={styledFileDisplayClasses}>
                <DocumentArrowUpIcon className="h-5 w-5 mr-2 flex-shrink-0 text-neutral-500" />
                <span className="truncate">
                  {fileNameDisplay || 'Выберите файл...'}
                </span>
              </div>
              <input
                type="file"
                className={hiddenFileInputClasses}
                ref={ref}
                {...props}
              />
            </>
          ) : (
            <input
              className={standardInputClasses}
              ref={ref}
              {...props}
            />
          )}
          {rightElement && (
            <div className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500", isFileType && "z-20")}>
              {rightElement}
            </div>
          )}
        </div>
        {(helperText || error) && (
          <p className={cn(
            'text-xs',
            error ? 'text-error-500' : 'text-neutral-500 dark:text-neutral-400'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input }; 