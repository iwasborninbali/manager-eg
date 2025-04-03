import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500',
        secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 focus-visible:ring-secondary-500',
        outline: 'border border-neutral-200 dark:border-neutral-700 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800',
        ghost: 'bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800',
        destructive: 'bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500',
        subtle: 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900 dark:hover:bg-primary-800 dark:text-primary-300',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
      isLoading: {
        true: 'relative text-transparent transition-none hover:text-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      isLoading: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { 
      className, 
      variant, 
      size, 
      isLoading, 
      leftIcon, 
      rightIcon, 
      children,
      ...props 
    }, 
    ref
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, isLoading, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </span>
        )}
        <span className="flex items-center">
          {leftIcon && <span className={cn('mr-2', { 'opacity-0': isLoading })}>{leftIcon}</span>}
          <span className={isLoading ? 'opacity-0' : ''}>{children}</span>
          {rightIcon && <span className={cn('ml-2', { 'opacity-0': isLoading })}>{rightIcon}</span>}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants }; 