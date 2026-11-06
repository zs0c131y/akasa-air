import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[0.95rem] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90',
        brand: 'bg-brand text-brand-foreground shadow-soft hover:bg-brand/90',
        outline: 'border border-input bg-card text-foreground hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        destructive: 'bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90',
        success: 'bg-status-green-fg text-background shadow-soft hover:opacity-90',
        link: 'text-brand underline underline-offset-4 hover:opacity-80',
      },
      size: { default: 'h-11 px-5', sm: 'h-10 px-3.5', lg: 'h-12 px-7 text-base', icon: 'h-11 w-11' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
