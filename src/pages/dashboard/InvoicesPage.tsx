import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { formatXMR, formatUSDT, formatFiat } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ExternalLink, FileDown, Loader2, FlaskConical, RefreshCw, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { toast } from 'sonner';
import { useRates } from '@/hooks/use-rates';
import { getXmrPrice } from '@/lib/currency-service';

export default function InvoicesPage() {
  const invoices = useStore(s => s.invoices);
  const createInvoice = useStore(s => s.createInvoice);
  const simulateInvoice = useStore(s => s.simulateInvoice);
  const verifyInvoiceTxHash = useStore(s => s.verifyInvoiceTxHash);
  const verifyAllPendingInvoices = useStore(s => s.verifyAllPendingInvoices);
  const merchant = useStore(s => s.merchant);
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';
  const users = merchant.posUsers || [];
  const adminPasswordSet = !!merchant.adminPasswordHash;
  const { rates } = useRates();

  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [filterUser, setFilterUser] = useState('all');
  const [showSimulate, setShowSimulate] = useState(false);
  const [simDesc, setSimDesc] = useState('Test Payment');
  const [simAmount, setSimAmount] = useState('25');
  const [simulating, setSimulating] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminVerified, setAdminVerified] = useState(false);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');
  const [verifyingInvoiceId, setVerifyingInvoiceId] = useState<string | null>(null);
  const [verifyingSingle, setVerifyingSingle] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Auto-refresh invoices every 10 seconds AND when localStorage changes from other tabs
  useEffect(() => {
    // Poll for updates (refreshes store from localStorage)
    const interval = setInterval(() => {
      setLastUpdated(Date.now()); // Trigger re-render by updating state
      console.log('[InvoicesPage] Auto-refreshing invoices...');
    }, 10000);

    // Listen for localStorage changes from other tabs (e.g., payment links)
    const handleStorageChange = () => {
      setLastUpdated(Date.now()); // Force component update
      console.log('[InvoicesPage] Storage changed - refreshing invoices...');
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const hashPassword = (pw: string) => {
    let hash = 0;
    for (let i = 0; i < pw.length; i++) {
      const chr = pw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  };

  const handleCreate = async () => {
    if (!desc || !amount || isNaN(Number(amount))) return;
    setCreating(true);
    try {
      const inv = await createInvoice(desc, Number(amount));
      toast.success(`Invoice ${inv.id} created!`);
      setOpen(false);
      setDesc('');
      setAmount('');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to create invoice');
    }
    setCreating(false);
  };

  const handleSimulate = async () => {
    if (!simDesc || !simAmount || isNaN(Number(simAmount))) return;
    setSimulating(true);
    try {
      const inv = await simulateInvoice(simDesc, Number(simAmount));
      toast.success(`Simulated payment ${inv.id} created! Check Payments tab.`);
      setShowSimulate(false);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to simulate');
    }
    setSimulating(false);
  };

  const handleVerifyAdmin = () => {
    if (hashPassword(adminPass) === merchant.adminPasswordHash) {
      setAdminVerified(true);
      setAdminPass('');
    } else {
      toast.error('Wrong admin password');
    }
  };

  const handleVerifyAll = async () => {
    setVerifyingAll(true);
    try {
      const result = await verifyAllPendingInvoices();
      if (result.verified > 0) {
        toast.success(`✅ Verified ${result.verified} invoice(s) on-chain!`);
      } else if (result.failed > 0) {
        toast.info(`Checked pending invoices: ${result.failed} could not be verified. Add TX hashes to verify.`);
      } else {
        toast.info('No pending invoices with TX hashes to verify.');
      }
    } catch (e) {
      toast.error('Verification failed');
    }
    setVerifyingAll(false);
  };

  const handleVerifySingle = async (invoiceId: string) => {
    if (!txHashInput || txHashInput.length < 10) {
      toast.error('Please enter a valid TX hash');
      return;
    }
    setVerifyingSingle(true);
    try {
      const result = await verifyInvoiceTxHash(invoiceId, txHashInput.trim());
      if (result.success) {
        toast.success('✅ Transaction verified on blockchain!');
        setVerifyingInvoiceId(null);
        setTxHashInput('');
      } else {
        toast.error(result.error || 'Verification failed');
      }
    } catch {
      toast.error('Verification failed');
    }
    setVerifyingSingle(false);
  };

  const filteredInvoices = filterUser === 'all'
    ? [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [...invoices].filter(i => (i.createdBy || 'admin') === filterUser)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const xmrPrice = rates ? getXmrPrice(cur, rates) : null;
  const pendingCount = invoices.filter(i => i.status === 'pending' || i.status === 'seen_on_chain' || i.status === 'confirming').length;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Invoices
              <HelpTooltip
                title="Invoices"
                text="Create and manage payment invoices. Each invoice generates a unique address for tracking payments on-chain (Monero or TRON/USDT)."
              />
            </h1>
            <p className="text-muted-foreground text-sm">
              Create and manage payment invoices
              {xmrPrice && <span className="ml-2 text-primary font-mono text-xs">XMR: {formatFiat(xmrPrice, sym, cur)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyAll}
                  disabled={verifyingAll}
                  className="border-primary/30 hover:border-primary/50 text-primary"
                >
                  {verifyingAll ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Verify Pending ({pendingCount})
                </Button>
                <HelpTooltip
                  title="Verify Pending"
                  text="Check all pending invoices against the blockchain to confirm payments. This uses the TX hashes stored with each invoice."
                />
              </div>
            )}

            {/* User filter */}
            {users.length > 0 && (
              <div className="flex items-center gap-2">
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
                <HelpTooltip
                  title="Filter by User"
                  text="Filter invoices to show only those created by a specific POS user. Useful for tracking individual sales performance."
                />
              </div>
            )}
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

            {/* Simulate Invoice (admin only) */}
            {adminPasswordSet && adminVerified && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowSimulate(true)} className="border-border hover:border-warning/50 text-warning">
                  <FlaskConical className="w-4 h-4 mr-1" /> Simulate
                </Button>
                <HelpTooltip
                  title="Simulate Payment"
                  text="Create a fake 'paid' invoice with a simulated transaction hash for testing purposes. Useful for testing accounting, payouts, and reporting."
                />
              </div>
            )}
            {adminPasswordSet && adminVerified && (
              <Button variant="outline" onClick={() => setShowSimulate(true)} className="border-border hover:border-warning/50 text-warning">
                <FlaskConical className="w-4 h-4 mr-1" /> Simulate
              </Button>
            )}
            {adminPasswordSet && !adminVerified && (
              <div className="flex items-center gap-1">
                <Input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="Admin pass" className="h-9 w-32 bg-background border-border text-xs" onKeyDown={e => e.key === 'Enter' && handleVerifyAdmin()} />
                <Button variant="ghost" size="sm" onClick={handleVerifyAdmin} className="text-xs text-muted-foreground">🔓</Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-orange hover:opacity-90"><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
                </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">Create Invoice</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label className="text-foreground">Description</Label>
                    <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Pro Subscription" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Amount ({cur})</Label>
                    <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="49.99" className="bg-background border-border" />
                  </div>
                  <Button onClick={handleCreate} disabled={creating} className="w-full bg-gradient-orange hover:opacity-90">
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {creating ? 'Generating secure mainnet subaddress...' : 'Create Invoice'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
              <HelpTooltip
                title="Create Invoice"
                text="Generate a new payment invoice with a unique Monero subaddress. Each invoice tracks its own payment on-chain separately."
              />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Simulate dialog */}
      <Dialog open={showSimulate} onOpenChange={setShowSimulate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground flex items-center gap-2"><FlaskConical className="w-5 h-5 text-warning" /> Simulate Payment</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Creates a fake "paid" invoice with a simulated TX hash for testing accounting & payouts.</p>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Description</Label>
              <Input value={simDesc} onChange={e => setSimDesc(e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Amount ({cur})</Label>
              <Input value={simAmount} onChange={e => setSimAmount(e.target.value)} type="number" min="0" step="0.01" className="bg-background border-border" />
            </div>
            <Button onClick={handleSimulate} disabled={simulating} className="w-full bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30">
              {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
              Create Simulated Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TX Hash Verify Dialog */}
      <Dialog open={!!verifyingInvoiceId} onOpenChange={(o) => { if (!o) { setVerifyingInvoiceId(null); setTxHashInput(''); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" /> Verify Invoice Payment
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Paste the Monero transaction hash to verify this payment against the blockchain explorer.
          </p>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Transaction Hash</Label>
              <Input
                value={txHashInput}
                onChange={e => setTxHashInput(e.target.value)}
                placeholder="64-character hex TX hash"
                className="bg-background border-border font-mono text-xs"
              />
            </div>
            <Button
              onClick={() => verifyingInvoiceId && handleVerifySingle(verifyingInvoiceId)}
              disabled={verifyingSingle || txHashInput.length < 10}
              className="w-full bg-gradient-orange hover:opacity-90"
            >
              {verifyingSingle ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {verifyingSingle ? 'Checking blockchain...' : 'Verify on Blockchain'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FadeIn delay={0.1}>
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No invoices yet. Create one to generate a unique address for tracking payments (Monero or TRON/USDT).</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Created</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Invoice</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Amount ({cur})</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Crypto</th>
                    {users.length > 0 && <th className="text-center py-3 px-4 text-muted-foreground font-medium">User</th>}
                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(inv => {
                    const creatorName = inv.createdBy === 'admin' || !inv.createdBy ? 'Admin' : users.find(u => u.id === inv.createdBy)?.name || inv.createdBy;
                    const isPending = inv.status === 'pending' || inv.status === 'seen_on_chain' || inv.status === 'confirming';
                    const isTrxInvoice = inv.chainType === 'trx' && inv.trxAddress;
                    const cryptoDisplay = isTrxInvoice ? formatUSDT(inv.trxAmount || 0) : formatXMR(inv.xmrAmount);
                    const ChainBadge = null; // Remove duplicate USDT badge since cryptoDisplay already includes it
                    return (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {inv.paidAt 
                            ? new Date(inv.paidAt).toLocaleString()
                            : new Date(inv.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{inv.id}</td>
                        <td className="py-3 px-4 text-foreground">
                          {inv.description}
                          {inv.simulated && <Badge className="ml-2 bg-warning/10 text-warning border-warning/20 text-[9px]">SIMULATED</Badge>}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-foreground">{formatFiat(inv.fiatAmount, sym, cur)}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground text-xs font-mono">
                          {cryptoDisplay}
                          {ChainBadge}
                        </td>
                        {users.length > 0 && <td className="py-3 px-4 text-center text-xs text-muted-foreground">{creatorName}</td>}
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline"
                            className={
                              inv.status === 'paid' ? 'bg-success/10 text-success border-success/20' :
                              inv.status === 'confirming' ? 'bg-primary/10 text-primary border-primary/20' :
                              inv.status === 'seen_on_chain' ? 'bg-primary/10 text-primary border-primary/20' :
                              inv.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' :
                              inv.status === 'expired' ? 'bg-muted/10 text-muted-foreground border-muted/20' :
                              'text-muted-foreground'
                            }>
                            {inv.status === 'seen_on_chain' ? 'seen' : inv.status}
                            {inv.confirmations !== undefined && inv.confirmations > 0 && ` (${inv.confirmations})`}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Verify button for pending invoices */}
                            {isPending && !inv.simulated && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary h-8 px-2"
                                onClick={() => { setVerifyingInvoiceId(inv.id); setTxHashInput(inv.txid || ''); }}
                                title="Verify payment with TX hash"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Link to={`/invoice/${inv.id}`}>
                              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary h-8 px-2">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary h-8 px-2" onClick={() => toast.info('PDF export coming soon!')}>
                              <FileDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
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
    </div>
  );
}
