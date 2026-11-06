import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

const field =
  'w-full rounded-md border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground transition-shadow hover:border-foreground/60 aria-[invalid=true]:border-destructive disabled:opacity-50';

export const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      field,
      'h-11 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[7rem] py-2.5', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(field, 'h-11 pr-8', className)} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Label = ({ className, ...props }) => (
  <label className={cn('mb-1.5 block text-sm font-medium leading-none', className)} {...props} />
);
