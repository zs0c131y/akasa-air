import { cva } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      neutral: 'bg-status-grey-bg text-status-grey-fg',
      blue: 'bg-status-blue-bg text-status-blue-fg',
      red: 'bg-status-red-bg text-status-red-fg',
      amber: 'bg-status-amber-bg text-status-amber-fg',
      green: 'bg-status-green-bg text-status-green-fg',
      purple: 'bg-status-purple-bg text-status-purple-fg',
      outline: 'border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export const Badge = ({ className, variant, ...props }) => <span className={cn(badgeVariants({ variant }), className)} {...props} />;
