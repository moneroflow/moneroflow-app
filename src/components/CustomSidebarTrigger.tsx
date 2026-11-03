/**
 * Custom Sidebar Trigger with Monero-colored MenuIcon
 */
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { MenuIcon } from './MenuIcon';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as React from 'react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CustomSidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 text-primary hover:text-primary/80 hover:bg-primary/10", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <MenuIcon size={20} />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});

CustomSidebarTrigger.displayName = 'CustomSidebarTrigger';

export { CustomSidebarTrigger };