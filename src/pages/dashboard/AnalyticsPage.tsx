import { useStore } from '@/lib/store';
import { formatXMR, formatFiat } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, BarChart3, Users } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { useMemo, useState } from 'react';
import { useRates } from '@/hooks/use-rates';
import { getXmrPrice } from '@/lib/currency-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TimePeriod = 'day' | 'week' | 'month';

function getGroupKey(date: Date, period: TimePeriod): string {
  if (period === 'day') return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  if (period === 'week') {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    return `W${Math.ceil(start.getDate() / 7)} ${start.toLocaleString('default', { month: 'short' })}`;
  }
  return date.toLocaleString('default', { month: 'short', year: '2-digit' });
}

export default function AnalyticsPage() {
  const invoices = useStore(s => s.invoices);
  const merchant = useStore(s => s.merchant);
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';
  const { rates } = useRates();
  const users = merchant.posUsers || [];

  const [period, setPeriod] = useState<TimePeriod>('day');

  const paid = invoices.filter(i => i.status === 'paid');
  const totalFiat = paid.reduce((s, i) => s + i.fiatAmount, 0);
  const totalXMR = paid.reduce((s, i) => s + i.xmrAmount, 0);
  const xmrPrice = rates ? getXmrPrice(cur, rates) : null;

  // All unique user IDs from invoices
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    paid.forEach(inv => ids.add(inv.createdBy || 'admin'));
    return Array.from(ids);
  }, [paid]);

  const getUserName = (id: string) => {
    if (id === 'admin' || !id) return 'Admin';
    return users.find(u => u.id === id)?.name || id;
  };

  // Overall revenue by period
  const revenueData = useMemo(() => {
    const map = new Map<string, { revenue: number; txCount: number }>();
    paid.forEach(inv => {
      const d = new Date(inv.paidAt || inv.createdAt);
      const key = getGroupKey(d, period);
      const existing = map.get(key) || { revenue: 0, txCount: 0 };
      map.set(key, { revenue: existing.revenue + inv.fiatAmount, txCount: existing.txCount + 1 });
    });
    return Array.from(map.entries()).map(([label, data]) => ({ label, ...data }));
  }, [paid, period]);

  // Per-user stats
  const userStats = useMemo(() => {
    return allUserIds.map(userId => {
      const userInvoices = paid.filter(i => (i.createdBy || 'admin') === userId);
      const revenue = userInvoices.reduce((s, i) => s + i.fiatAmount, 0);
      const xmr = userInvoices.reduce((s, i) => s + i.xmrAmount, 0);
      const count = userInvoices.length;

      // Per-period breakdown
      const periodData = new Map<string, number>();
      userInvoices.forEach(inv => {
        const d = new Date(inv.paidAt || inv.createdAt);
        const key = getGroupKey(d, period);
        periodData.set(key, (periodData.get(key) || 0) + inv.fiatAmount);
      });

      return {
        userId,
        name: getUserName(userId),
        revenue,
        xmr,
        count,
        periodData: Array.from(periodData.entries()).map(([label, amount]) => ({ label, amount })),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [allUserIds, paid, period, users]);

  // Colors for user charts
  const userColors = ['hsl(24, 100%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(280, 67%, 55%)', 'hsl(47, 96%, 53%)', 'hsl(352, 83%, 54%)'];

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-7 h-7 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Analytics
                
                <HelpTooltip
                  title="Analytics"
                  text="Revenue tracking and sales overview. View totals, charts, and per-user performance breakdowns. Toggle between daily, weekly, and monthly views."
                />
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">Revenue tracking, XMR price monitoring, and sales overview</p>
          </div>
          <Select value={period} onValueChange={v => setPeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[120px] h-9 bg-background border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="day">By Day</SelectItem>
              <SelectItem value="week">By Week</SelectItem>
              <SelectItem value="month">By Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Total Revenue', value: formatFiat(totalFiat, sym, cur), sub: formatXMR(totalXMR), icon: DollarSign, color: 'text-primary' },
          { label: 'XMR Price', value: xmrPrice ? formatFiat(xmrPrice, sym, cur) : 'Loading...', sub: `live rate in ${cur}`, icon: TrendingUp, color: 'text-success' },
        ].map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.05}>
            <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground text-sm">{s.label}</span>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-muted-foreground text-xs mt-1">{s.sub}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Overall Revenue Chart */}
      {revenueData.length > 0 ? (
        <FadeIn delay={0.2}>
          <div className="p-6 rounded-xl bg-card border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Overall Revenue</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(24, 100%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(24, 100%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(240, 5%, 55%)', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(240, 5%, 55%)', fontSize: 12 }} tickFormatter={v => `${sym}${v}`} />
                  <Tooltip contentStyle={{ background: 'hsl(240, 10%, 7%)', border: '1px solid hsl(240, 5%, 17%)', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(24, 100%, 50%)" strokeWidth={2} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.2}>
          <div className="p-12 rounded-xl bg-card border border-border text-center">
            <p className="text-muted-foreground">No paid invoices yet. Revenue charts will appear once payments are received.</p>
          </div>
        </FadeIn>
      )}

      {/* Per-User Performance */}
      {userStats.length > 1 && (
        <FadeIn delay={0.3}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Performance by User</h2>
            </div>

            {/* User summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userStats.map((u, i) => (
                <div key={u.userId} className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: userColors[i % userColors.length] }} />
                      <span className="text-sm font-semibold text-foreground">{u.name}</span>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">{u.count} sales</Badge>
                  </div>
                  <p className="text-xl font-bold text-foreground">{formatFiat(u.revenue, sym, cur)}</p>
                  <p className="text-muted-foreground text-xs mt-1">{formatXMR(u.xmr)}</p>

                  {/* Mini sparkline per user */}
                  {u.periodData.length > 1 && (
                    <div className="h-16 mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={u.periodData}>
                          <Area type="monotone" dataKey="amount" stroke={userColors[i % userColors.length]} strokeWidth={1.5} fill={userColors[i % userColors.length]} fillOpacity={0.15} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Single user but has data - show their name */}
      {userStats.length === 1 && userStats[0].count > 0 && (
        <FadeIn delay={0.3}>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">All sales by <span className="text-foreground font-medium">{userStats[0].name}</span></span>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
