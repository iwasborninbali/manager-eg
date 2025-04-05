import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6",
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
        "2xl": "h-20 w-20",
      },
      border: {
        none: "",
        thin: "ring-1",
        thick: "ring-2",
      },
      borderColor: {
        default: "ring-neutral-200 dark:ring-neutral-800",
        primary: "ring-primary-500",
        secondary: "ring-secondary-500",
        white: "ring-white dark:ring-neutral-950",
      },
      status: {
        none: "",
        online: "",
        offline: "",
        busy: "",
        away: "",
      },
    },
    defaultVariants: {
      size: "md",
      border: "none",
      borderColor: "default",
      status: "none",
    },
    compoundVariants: [
      {
        border: ["thin", "thick"],
        status: "none",
        className: "border-neutral-200 dark:border-neutral-700",
      },
    ],
  }
);

const statusDotClasses = {
  online: "bg-success-500",
  offline: "bg-neutral-400",
  busy: "bg-error-500",
  away: "bg-warning-500",
};

const statusDotSizes = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
  "2xl": "h-4 w-4",
};

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: string;
  fallbackColor?: "primary" | "secondary" | "neutral" | "success" | "warning" | "error" | "info";
  onError?: () => void;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt = "",
      fallback,
      fallbackColor = "neutral",
      size,
      border,
      borderColor,
      status,
      onError,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = React.useState(false);
    const hasValidSrc = src && !imageError;
    const initials = fallback
      ? fallback.slice(0, 2)
      : alt
      ? alt
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
      : "";

    const fallbackColorMap = {
      primary: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
      secondary: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300",
      neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
      success: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
      warning: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
      error: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
      info: "bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-300",
    };

    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size, border, borderColor, status, className }))}
        {...props}
      >
        {hasValidSrc ? (
          <Image
            src={src}
            alt={alt || 'User avatar'}
            fill={true}
            className="object-cover"
            onError={() => {
              setImageError(true);
              if (onError) onError();
            }}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center font-medium uppercase",
              fallbackColorMap[fallbackColor]
            )}
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        
        {status && status !== "none" && (
          <span
            className={cn(
              "absolute right-0 bottom-0 block rounded-full ring-2 ring-white dark:ring-neutral-950",
              statusDotClasses[status as keyof typeof statusDotClasses],
              statusDotSizes[size as keyof typeof statusDotSizes]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";

export { Avatar, avatarVariants }; 