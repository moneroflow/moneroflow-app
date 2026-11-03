import { useStore } from '@/lib/store';
import { formatXMR, formatFiat } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { MoneroLogo } from '@/components/BrandLogo';
import { TrendingUp, FileText, Clock, DollarSign, Server, Wifi, WifiOff, Activity, Loader2, RefreshCw, Zap, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FadeIn } from '@/components/FadeIn';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useRates } from '@/hooks/use-rates';
import { getXmrPrice } from '@/lib/currency-service';
import { Switch } from '@/components/ui/switch';
import { useHelp } from '@/components/HelpProvider';
import { HelpTooltip } from '@/components/HelpTooltip';
import { SendXmrDialog } from '@/components/SendXmrDialog';
import { ReceiveXmrDialog } from '@/components/ReceiveXmrDialog';
import { Send, ArrowDownToLine, ScanLine } from 'lucide-react';

export default function DashboardOverview() {
  const invoices = useStore(s => s.invoices);
  const merchant = useStore(s => s.merchant);
  const autoConnectNode = useStore(s => s.autoConnectNode);
  const refreshNodeStatus = useStore(s => s.refreshNodeStatus);
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';
  const { rates, refresh: refreshRates, loading: ratesLoading } = useRates();

  const paid = invoices.filter(i => i.status === 'paid');
  const totalFiat = paid.reduce((s, i) => s + i.fiatAmount, 0);
  const totalXMR = paid.reduce((s, i) => s + i.xmrAmount, 0);
  const pending = invoices.filter(i => i.status === 'pending').length;

  const [refreshing, setRefreshing] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);

  const xmrPrice = rates ? getXmrPrice(cur, rates) : null;

  useEffect(() => {
    const shouldAutoConnect =
      (merchant.walletMode === 'viewonly' && merchant.viewOnlySetupComplete) ||
      merchant.walletMode === 'remote';
    if (shouldAutoConnect && merchant.nodeStatus !== 'online') {
      setAutoConnecting(true);
      autoConnectNode().finally(() => setAutoConnecting(false));
    }
  }, []);

  useEffect(() => {
    if (merchant.nodeStatus !== 'online' && merchant.nodeStatus !== 'syncing') return;
    const interval = setInterval(() => { refreshNodeStatus(); }, 60000);
    return () => clearInterval(interval);
  }, [merchant.nodeStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshNodeStatus(), refreshRates()]);
    setRefreshing(false);
  }, [refreshNodeStatus, refreshRates]);

  const handleReconnect = useCallback(async () => {
    setAutoConnecting(true);
    await autoConnectNode();
    setAutoConnecting(false);
  }, [autoConnectNode]);

  const [chartTimeframe, setChartTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const revenueData = useMemo(() => {
    const bucketMap = new Map<string, { revenue: number; txCount: number }>();
    paid.forEach(inv => {
      const d = new Date(inv.paidAt || inv.createdAt);
      let key: string;
      if (chartTimeframe === 'daily') {
        key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      } else if (chartTimeframe === 'weekly') {
        // Group by ISO week start (Monday)
        const dayOfWeek = d.getDay() || 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - dayOfWeek + 1);
        key = 'W ' + monday.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      } else {
        key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      }
      const existing = bucketMap.get(key) || { revenue: 0, txCount: 0 };
      bucketMap.set(key, { revenue: existing.revenue + inv.fiatAmount, txCount: existing.txCount + 1 });
    });
    return Array.from(bucketMap.entries()).map(([month, data]) => ({ month, ...data }));
  }, [paid, chartTimeframe]);

  const stats = [
    { label: 'Total Received', value: formatFiat(totalFiat, sym, cur), sub: formatXMR(totalXMR), icon: DollarSign, color: 'text-primary' },
    { label: 'XMR Rate', value: xmrPrice ? formatFiat(xmrPrice, sym, cur) : 'Loading...', sub: `1 XMR in ${cur}`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Total Invoices', value: invoices.length.toString(), sub: `${paid.length} paid`, icon: FileText, color: 'text-primary' },
    { label: 'Pending', value: pending.toString(), sub: 'awaiting payment', icon: Clock, color: 'text-warning' },
  ];

  const nodeStatus = merchant.nodeStatus;
  const isConnected = nodeStatus === 'online' || nodeStatus === 'syncing';
  const isLoading = autoConnecting || refreshing || nodeStatus === 'connecting';

  const statusConfig = {
    online: { label: 'Online & Synced', color: 'bg-success/10 text-success border-success/20', icon: Wifi, dot: 'bg-success' },
    syncing: { label: 'Syncing...', color: 'bg-warning/10 text-warning border-warning/20', icon: Activity, dot: 'bg-warning' },
    connecting: { label: 'Connecting...', color: 'bg-primary/10 text-primary border-primary/20', icon: Loader2, dot: 'bg-primary' },
    offline: { label: 'Offline', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: WifiOff, dot: 'bg-destructive' },
  };

  const currentStatus = statusConfig[nodeStatus] || statusConfig.offline;
  const StatusIcon = currentStatus.icon;

  const { helpEnabled, setHelpEnabled } = useHelp();

  const [sendOpen, setSendOpen] = useState(false);
  const [sendScan, setSendScan] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MoneroLogo size={28} />
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3 bg-card/50 px-3 py-1.5 rounded-lg border border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-primary/10"
              onClick={() => window.open('https://docs.moneroflow.com/wiki.html', '_blank')}
              title="Open MoneroFlow Wiki"
            >
              <Info className="w-3.5 h-3.5 text-primary" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium">Help</span>
            <Switch checked={helpEnabled} onCheckedChange={setHelpEnabled} size="sm" />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">Your MoneroFlow merchant overview</p>
      </FadeIn>

      {/* Action Buttons: Send / Receive / Scan */}
      <FadeIn delay={0.01}>
        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={() => { setSendScan(false); setSendOpen(true); }}
            className="bg-gradient-orange hover:opacity-90 h-14 flex-col gap-1 shadow-lg shadow-primary/10"
          >
            <Send className="w-5 h-5" />
            <span className="text-xs font-semibold">Send</span>
          </Button>
          <Button
            onClick={() => setReceiveOpen(true)}
            variant="outline"
            className="border-border hover:border-primary/50 h-14 flex-col gap-1 bg-card"
          >
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Receive</span>
          </Button>
          <Button
            onClick={() => { setSendScan(true); setSendOpen(true); }}
            variant="outline"
            className="border-border hover:border-primary/50 h-14 flex-col gap-1 bg-card"
          >
            <ScanLine className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Scan</span>
          </Button>
        </div>
      </FadeIn>

      {/* Wallet Status Widget */}
      <FadeIn delay={0.02}>
        <div className={`p-5 rounded-xl border transition-colors ${
          isConnected ? 'bg-card border-success/20' :
          nodeStatus === 'connecting' ? 'bg-card border-primary/20' :
          'bg-card border-destructive/20'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`relative p-2 rounded-lg ${isConnected ? 'bg-success/10' : 'bg-muted'}`}>
                <Server className={`w-4 h-4 ${isConnected ? 'text-success' : 'text-muted-foreground'}`} />
                {isConnected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Wallet Status</span>
                  <HelpTooltip
                    title="Wallet Status"
                    text="Shows whether your wallet is connected to a Monero node. Green = online and synced. You can reconnect or switch nodes in Settings."
                  />
                  <Badge variant="outline" className={`${currentStatus.color} text-[10px] gap-1`}>
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <StatusIcon className="w-3 h-3" />}
                    {isLoading ? 'Connecting...' : currentStatus.label}
                  </Badge>
                </div>
                {isConnected && merchant.connectedNodeLabel && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Connected to <span className="text-foreground font-medium">{merchant.connectedNodeLabel}</span>
                    {merchant.nodeLatencyMs > 0 && <span className="text-muted-foreground"> · {merchant.nodeLatencyMs}ms</span>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isConnected && !isLoading && (
                <Button variant="outline" size="sm" onClick={handleReconnect} className="text-xs border-border hover:border-primary/50 h-8 gap-1.5">
                  <Zap className="w-3 h-3" /> Reconnect
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading} className="text-muted-foreground hover:text-primary h-8 w-8 p-0">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {isConnected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border/50">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Network</p>
                <p className="text-sm text-success font-medium mt-0.5">Mainnet ✓</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Block Height</p>
                <p className="text-sm font-mono text-foreground mt-0.5">{merchant.nodeHeight.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mode</p>
                <p className="text-sm text-foreground mt-0.5 capitalize">{
                  merchant.walletMode === 'viewonly' ? 'Browser Wallet' :
                  merchant.walletMode === 'selfcustody' ? 'Self-Custody' : 'Managed'
                }</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Node</p>
                <p className="text-sm font-mono text-muted-foreground mt-0.5 truncate">{merchant.connectedNodeUrl}</p>
              </div>
            </div>
          )}

          {!isConnected && !isLoading && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {merchant.walletMode === 'viewonly' && !merchant.viewOnlySetupComplete
                  ? 'Set up your browser wallet in Settings → Wallet & Node to get started.'
                  : 'Could not connect to any remote node. Click Reconnect to try again, or switch nodes in Settings.'}
              </p>
            </div>
          )}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.05 + 0.05}>
            <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground text-sm">{s.label}</span>
                <HelpTooltip
                  title={s.label}
                  text={
                    s.label === 'Total Received' ? 'The total amount you\'ve been paid across all confirmed invoices, shown in your local currency and XMR.' :
                    s.label === 'XMR Rate' ? 'The current live exchange rate for 1 XMR in your local fiat currency.' :
                    s.label === 'Total Invoices' ? 'The total number of invoices you\'ve created, including paid, pending, and expired.' :
                    'The number of invoices currently awaiting payment from customers.'
                  }
                />
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-muted-foreground text-xs mt-1">{s.sub}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      {revenueData.length > 0 && (
        <FadeIn delay={0.25}>
          <div className="p-6 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Revenue
                <HelpTooltip
                  title="Revenue Chart"
                  text="Revenue chart showing your earnings over time. Toggle between daily, weekly, and monthly views. Only includes confirmed (paid) invoices."
                />
              </h2>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['daily', 'weekly', 'monthly'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setChartTimeframe(tf)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      chartTimeframe === tf
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(24, 100%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(24, 100%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(240, 5%, 55%)', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(240, 5%, 55%)', fontSize: 12 }} tickFormatter={v => `${sym}${v}`} />
                  <Tooltip contentStyle={{ background: 'hsl(240, 10%, 7%)', border: '1px solid hsl(240, 5%, 17%)', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(24, 100%, 50%)" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.3}>
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            Recent Invoices
            <HelpTooltip
              title="Recent Invoices"
              text="Your most recent invoices across all statuses. Click through to the Invoices page for full details and management."
            />
          </h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No invoices yet. Create one from the Invoices page.</p>
          ) : (
            <div className="space-y-3">
              {invoices.slice(0, 5).map(inv => {
                const creatorName = inv.createdBy === 'admin' || !inv.createdBy ? 'Admin' : (merchant.posUsers || []).find(u => u.id === inv.createdBy)?.name || inv.createdBy;
                return (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.description}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {inv.id}
                      {(merchant.posUsers || []).length > 0 && (
                        <span className="ml-2 text-primary/70">• {creatorName}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatFiat(inv.fiatAmount, sym, cur)}</p>
                      <p className="text-xs text-muted-foreground">{formatXMR(inv.xmrAmount)}</p>
                    </div>
                    <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'pending' ? 'secondary' : 'outline'}
                      className={inv.status === 'paid' ? 'bg-success/10 text-success border-success/20' : inv.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' : 'text-muted-foreground'}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </FadeIn>

      <SendXmrDialog open={sendOpen} onOpenChange={setSendOpen} autoStartScanner={sendScan} />
      <ReceiveXmrDialog open={receiveOpen} onOpenChange={setReceiveOpen} />
    </div>
  );
}
