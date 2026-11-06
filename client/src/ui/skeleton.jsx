import { cn } from '../lib/utils.js';

export const Skeleton = ({ className, ...props }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
);
