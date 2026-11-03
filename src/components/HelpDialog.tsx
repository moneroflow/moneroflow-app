import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHelp } from './HelpProvider';
import { Info } from 'lucide-react';
import { useEffect } from 'react';

export function HelpDialog() {
  const { helpText, helpTitle, closeHelp } = useHelp();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHelp();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeHelp]);

  if (!helpText || !helpTitle) return null;

  return (
    <Dialog open={!!helpText} onOpenChange={closeHelp}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5 text-primary" />
            {helpTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {helpText}
        </div>
      </DialogContent>
    </Dialog>
  );
}
