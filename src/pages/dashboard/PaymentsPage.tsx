import { useStore } from '@/lib/store';
import { formatXMR, formatFiat } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Send, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { SendXmrDialog } from '@/components/SendXmrDialog';

export default function PaymentsPage() {
  const invoices = useStore(s => s.invoices);
  const merchant = useStore(s => s.merchant);
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';
  const users = merchant.posUsers || [];

  // Include both paid (received) and sent transactions
  const payments = invoices.filter(i => i.status === 'paid' || i.type === 'sent');
  const [filterUser, setFilterUser] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'received' | 'sent'>('all');
  const [showSendDialog, setShowSendDialog] = useState(false);

  const filtered = payments
    .filter(i => {
      if (filterUser !== 'all') {
        if ((i.createdBy || 'admin') !== filterUser) return false;
      }
      if (filterType === 'sent') return i.type === 'sent';
      if (filterType === 'received') return i.type !== 'sent';
      return true;
    })
    .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payment History
              
                <HelpTooltip
                  title="Payment History"
                  text="All confirmed XMR payments — both received and sent. Filter by type or user. Click a TX hash to view it on the blockchain explorer."
                />
            </h1>
            <p className="text-muted-foreground text-sm">All confirmed XMR payments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowSendDialog(true)}
              className="bg-gradient-orange hover:opacity-90 gap-2"
            >
              <Send className="w-4 h-4" />
              Send XMR
            </Button>

            {/* Type filter */}
            <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
              <SelectTrigger className="w-[120px] h-9 bg-background border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
              </SelectContent>
            </Select>

            {users.length > 0 && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[140px] h-9 bg-background border-border text-sm">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No payments yet. Create an invoice and simulate a payment!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium w-8"></th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">{cur}</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">XMR</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">TX Hash</th>
                    {users.length > 0 && <th className="text-center py-3 px-4 text-muted-foreground font-medium">User</th>}
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const isSent = inv.type === 'sent';
                    const creatorName = inv.createdBy === 'admin' || !inv.createdBy ? 'Admin' : users.find(u => u.id === inv.createdBy)?.name || inv.createdBy;

                    return (
                      <tr
                        key={inv.id}
                        className={`border-b border-border/50 hover:bg-muted/10 transition-colors ${
                          isSent ? 'bg-pink-500/[0.03]' : ''
                        }`}
                      >
                        {/* Direction icon */}
                        <td className="py-3 px-3 text-center">
                          {isSent ? (
                            <ArrowUpRight className="w-4 h-4 text-pink-400 inline-block" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4 text-success inline-block" />
                          )}
                        </td>

                        {/* Description */}
                        <td className={`py-3 px-4 ${isSent ? 'text-pink-300' : 'text-foreground'}`}>
                          {inv.description}
                          {inv.simulated && <Badge className="ml-2 bg-warning/10 text-warning border-warning/20 text-[9px]">SIM</Badge>}
                          {isSent && inv.feeXmr && (
                            <span className="ml-2 text-[9px] text-muted-foreground">
                              fee: {formatXMR(inv.feeXmr)}
                            </span>
                          )}
                        </td>

                        {/* Fiat amount */}
                        <td className={`py-3 px-4 text-right font-medium ${isSent ? 'text-pink-300' : 'text-foreground'}`}>
                          {isSent ? '-' : ''}{formatFiat(inv.fiatAmount, sym, cur)}
                        </td>

                        {/* XMR amount */}
                        <td className={`py-3 px-4 text-right font-mono text-xs ${isSent ? 'text-pink-400' : 'text-muted-foreground'}`}>
                          {isSent ? '-' : ''}{formatXMR(inv.xmrAmount)}
                        </td>

                        {/* TX Hash */}
                        <td className="py-3 px-4">
                          {inv.txid ? (
                            <a
                              href={`https://xmrchain.net/tx/${inv.txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[10px] text-primary hover:underline"
                            >
                              {inv.txid.slice(0, 10)}...{inv.txid.slice(-6)}
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* User */}
                        {users.length > 0 && <td className="py-3 px-4 text-center text-xs text-muted-foreground">{creatorName}</td>}

                        {/* Date */}
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleString() : '-'}
                        </td>

                        {/* Status badge */}
                        <td className="py-3 px-4 text-center">
                          {isSent ? (
                            <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20">sent</Badge>
                          ) : (
                            <Badge className="bg-success/10 text-success border-success/20">confirmed</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>

      <SendXmrDialog open={showSendDialog} onOpenChange={setShowSendDialog} />
    </div>
  );
}
