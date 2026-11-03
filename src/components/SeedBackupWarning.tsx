import { useStore } from '@/lib/store';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function SeedBackupWarning() {
  const merchant = useStore(s => s.merchant);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Only show if wallet exists but seed not backed up
  if (!merchant.viewOnlySetupComplete || merchant.viewOnlySeedBackedUp || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-destructive/20 via-warning/20 to-destructive/20 border border-destructive/30 rounded-lg px-3 py-2 flex items-center gap-2 animate-pulse-slow">
      <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
      <p className="text-xs text-warning font-medium truncate">
        ⚠️ Back up your seed phrase!
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="text-warning hover:text-warning hover:bg-warning/10 text-xs h-6 px-2 shrink-0"
        onClick={() => navigate('/dashboard/settings')}
      >
        Settings <ArrowRight className="w-3 h-3 ml-1" />
      </Button>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
