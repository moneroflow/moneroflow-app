import { Info } from 'lucide-react';
import { useHelp } from './HelpProvider';
import { Button } from './ui/button';

interface HelpTooltipProps {
  title: string;
  text: string;
  className?: string;
}

export function HelpTooltip({ title, text, className = '' }: HelpTooltipProps) {
  const { helpEnabled, openHelp } = useHelp();

  if (!helpEnabled) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-5 w-5 p-0 hover:bg-primary/10 text-muted-foreground hover:text-primary ${className}`}
      onClick={() => openHelp(title, text)}
      title={`Help: ${title}`}
    >
      <span className="inline-flex items-center justify-center">
        <span className="sr-only">Help for {title}</span>
        <Info className="w-3.5 h-3.5" />
      </span>
    </Button>
  );
}
