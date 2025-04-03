import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
        secondary: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300',
        success: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300',
        warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
        error: 'bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300',
        info: 'bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-300',
        outline: 'border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
      withDot: {
        true: 'pl-2',
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      withDot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, withDot, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size, withDot, className }))}
        {...props}
      >
        {withDot && (
          <div className={cn(
            'mr-1.5 h-2 w-2 rounded-full',
            {
              'bg-primary-500': variant === 'default',
              'bg-secondary-500': variant === 'secondary',
              'bg-success-500': variant === 'success',
              'bg-warning-500': variant === 'warning',
              'bg-error-500': variant === 'error',
              'bg-info-500': variant === 'info',
              'bg-neutral-500': variant === 'outline',
            }
          )} />
        )}
        {props.children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants }; 