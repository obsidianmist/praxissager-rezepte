import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none shadow-sm",
          {
            "bg-primary text-white hover:bg-primary/90": variant === 'primary',
            "bg-white text-text-main hover:bg-gray-50 border border-gray-200 dark:bg-dark-surface dark:text-dark-text dark:border-gray-500 dark:hover:bg-gray-700": variant === 'secondary',
            "hover:bg-gray-100 text-text-main shadow-none dark:text-dark-text dark:hover:bg-gray-800": variant === 'ghost',
          },
          className
        )}
        {...props}
      >
        {isLoading ? <span className="animate-spin mr-2 border-2 border-current border-t-transparent rounded-full w-4 h-4 inline-block"></span> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
