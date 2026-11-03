import { ShieldCheck } from 'lucide-react';
import { useStore } from '@/lib/store';

export function PrivacyBanner() {
  const privacyMode = useStore(s => s.merchant.privacyModeEnabled);
  if (!privacyMode) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium">
      <ShieldCheck className="w-4 h-4" />
      <span>Privacy mode</span>
    </div>
  );
}
