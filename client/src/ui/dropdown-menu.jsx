import * as DM from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/utils.js';

// modal={false}: avoids Radix injecting a <style> tag for scroll-lock, which the strict CSP would block.
export const DropdownMenu = (props) => <DM.Root modal={false} {...props} />;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuRadioGroup = DM.RadioGroup;

export const DropdownMenuContent = ({ className, sideOffset = 8, align = 'end', ...props }) => (
  <DM.Portal>
    <DM.Content
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[12rem] rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    />
  </DM.Portal>
);

const item =
  'relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
export const DropdownMenuItem = ({ className, ...props }) => <DM.Item className={cn(item, className)} {...props} />;
export const DropdownMenuRadioItem = ({ className, children, ...props }) => (
  <DM.RadioItem className={cn(item, 'pl-8', className)} {...props}>
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <DM.ItemIndicator>
        <span className="block size-2 rounded-full bg-brand" />
      </DM.ItemIndicator>
    </span>
    {children}
  </DM.RadioItem>
);
export const DropdownMenuLabel = ({ className, ...props }) => (
  <DM.Label className={cn('px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground', className)} {...props} />
);
export const DropdownMenuSeparator = ({ className, ...props }) => (
  <DM.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />
);
