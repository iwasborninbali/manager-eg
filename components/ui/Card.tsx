import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-xl overflow-hidden transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-md hover:shadow-lg',
        glass: 'bg-neutral-50/70 dark:bg-neutral-900/70 backdrop-blur-md border border-neutral-50/20 dark:border-neutral-800/20 shadow-glass',
        outline: 'bg-transparent border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
        flat: 'bg-neutral-50 dark:bg-neutral-800 border-0',
      },
      radius: {
        default: 'rounded-xl',
        lg: 'rounded-2xl',
        full: 'rounded-3xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      radius: 'default',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, radius, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, radius, className }))}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-xl font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-neutral-600 dark:text-neutral-400', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }; 