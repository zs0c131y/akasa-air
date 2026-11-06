import { cn } from '../lib/utils.js';

export const Card = ({ className, ...props }) => (
  <div className={cn('rounded-lg border bg-card text-card-foreground shadow-soft', className)} {...props} />
);
export const CardHeader = ({ className, ...props }) => <div className={cn('flex flex-col gap-1.5 p-5 sm:p-6', className)} {...props} />;
export const CardTitle = ({ className, as: As = 'h2', ...props }) => (
  <As className={cn('text-lg font-semibold leading-tight tracking-tight', className)} {...props} />
);
export const CardDescription = ({ className, ...props }) => <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
export const CardContent = ({ className, ...props }) => <div className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
