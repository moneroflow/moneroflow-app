import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '@/lib/store';
import { formatUSD, formatXMR, formatFiat, XMR_USD_RATE } from '@/lib/mock-data';
import { FileSpreadsheet, Download, Calendar, Check, Lock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { isMerchantPro } from '@/lib/subscription';

function ProLock() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className="w-4 h-4 text-yellow-500 shrink-0 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="bg-card border-border text-xs">Unlock Pro Sub for this feature</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PayoutsPage() {
  const merchant = useStore(s => s.merchant);
  const invoices = useStore(s => s.invoices);
  const isPro = isMerchantPro(merchant);
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';

  const [exportRange, setExportRange] = useState('month');

  const paidInvoices = invoices.filter(i => i.status === 'paid' && i.type !== 'sent');
  const totalXmr = paidInvoices.reduce((sum, i) => sum + i.xmrAmount, 0);
  const totalFiat = paidInvoices.reduce((sum, i) => sum + i.fiatAmount, 0);

  const handleProAction = (action: () => void) => {
    if (!isPro) { toast.error('Upgrade to Pro to use this feature'); return; }
    action();
  };

  const generateCSV = (invoiceList: typeof paidInvoices): string => {
    const headers = ['Invoice ID', 'Date', 'Description', `Amount (${cur})`, 'XMR Amount', 'XMR/USD Rate', 'Status', 'Subaddress', 'TX Hash', 'Paid At'];
    const rows = invoiceList.map(inv => [
      inv.id, inv.createdAt, `"${inv.description.replace(/"/g, '""')}"`,
      inv.fiatAmount.toFixed(2), inv.xmrAmount.toFixed(6), XMR_USD_RATE.toFixed(2),
      inv.status, inv.subaddress, inv.txid || '', inv.paidAt || '',
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const generateQuickBooksIIF = (invoiceList: typeof paidInvoices): string => {
    const lines: string[] = [];
    lines.push('!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO');
    lines.push('!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO');
    lines.push('!ENDTRNS');
    invoiceList.forEach(inv => {
      const date = new Date(inv.paidAt || inv.createdAt).toLocaleDateString('en-US');
      lines.push(`TRNS\tPAYMENT\t${date}\tMonero Revenue\t${inv.description}\t${inv.fiatAmount.toFixed(2)}\tInv ${inv.id} - ${inv.xmrAmount.toFixed(6)} XMR`);
      lines.push(`SPL\tPAYMENT\t${date}\tAccounts Receivable\t${inv.description}\t-${inv.fiatAmount.toFixed(2)}\t`);
      lines.push('ENDTRNS');
    });
    return lines.join('\n');
  };

  const generateXeroCSV = (invoiceList: typeof paidInvoices): string => {
    const headers = ['*ContactName', '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'Description', '*UnitAmount', 'AccountCode', 'TaxType', 'Currency'];
    const rows = invoiceList.map(inv => [
      `"MoneroFlow Payment"`, inv.id,
      new Date(inv.createdAt).toISOString().split('T')[0], new Date(inv.createdAt).toISOString().split('T')[0],
      `"${inv.description.replace(/"/g, '""')} (${inv.xmrAmount.toFixed(6)} XMR)"`,
      inv.fiatAmount.toFixed(2), '200', 'Tax Exempt', cur,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const generatePdfReport = (invoiceList: typeof paidInvoices, range: string, filename: string) => {
    const totalXmr = invoiceList.reduce((s, i) => s + i.xmrAmount, 0);
    const totalFiat = invoiceList.reduce((s, i) => s + i.fiatAmount, 0);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const orange: [number, number, number] = [255, 102, 0];
    const ink: [number, number, number] = [24, 24, 27];
    const muted: [number, number, number] = [113, 113, 122];
    const line: [number, number, number] = [215, 215, 220];
    const rowHeight = 32;
    let y = 0;

    const truncate = (text: string, maxWidth: number) => {
      if (doc.getTextWidth(text) <= maxWidth) return text;
      let trimmed = text;
      while (trimmed.length > 0 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
        trimmed = trimmed.slice(0, -1);
      }
      return `${trimmed}…`;
    };

    const drawHeader = () => {
      doc.setFillColor(...orange);
      doc.rect(0, 0, pageWidth, 90, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('MoneroFlow Payout Statement', margin, 38);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Export range: ${range}`, margin, 58);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 74);
      doc.text(merchant.name || 'MoneroFlow Merchant', pageWidth - margin, 58, { align: 'right' });
    };

    const cardHeight = 70;
    const cardGap = 14;
    const cardTop = 104;

    const drawSummaryCard = (x: number, w: number, title: string, value: string, subtitle: string) => {
      doc.setDrawColor(...line);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, cardTop, w, cardHeight, 10, 10, 'FD');
      doc.setTextColor(...muted);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(title, x + 14, cardTop + 20);
      doc.setTextColor(...ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(value, x + 14, cardTop + 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(subtitle, x + 14, cardTop + 58);
    };

    const colDate = margin + 12;
    const colInvoice = margin + 90;
    const colDesc = margin + 170;
    const colFiat = pageWidth - margin - 100;
    const colXmr = pageWidth - margin - 12;

    const drawTableHeader = () => {
      doc.setFillColor(240, 240, 242);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 6, 6, 'F');
      doc.setTextColor(...muted);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Date', colDate, y + 18);
      doc.text('Invoice', colInvoice, y + 18);
      doc.text('Description', colDesc, y + 18);
      doc.text(cur, colFiat, y + 18, { align: 'right' });
      doc.text('XMR', colXmr, y + 18, { align: 'right' });
      y += 40;
    };

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - 50) return;
      doc.addPage();
      drawHeader();
      y = cardTop + cardHeight + 30;
      drawTableHeader();
    };

    drawHeader();
    const contentWidth = pageWidth - margin * 2;
    const cardW = (contentWidth - cardGap * 2) / 3;
    drawSummaryCard(margin, cardW, 'Total revenue', formatFiat(totalFiat, sym, cur), `${invoiceList.length} transaction(s)`);
    drawSummaryCard(margin + cardW + cardGap, cardW, 'Total XMR', formatXMR(totalXmr), 'Confirmed incoming only');
    drawSummaryCard(margin + (cardW + cardGap) * 2, cardW, 'Reference rate', `$${XMR_USD_RATE.toFixed(2)}`, 'XMR / USD snapshot');

    y = cardTop + cardHeight + 24;
    drawTableHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    invoiceList.forEach((inv) => {
      ensureSpace(rowHeight);
      doc.setTextColor(...ink);
      doc.text(new Date(inv.paidAt || inv.createdAt).toLocaleDateString(), colDate, y + 4);
      doc.setFontSize(8);
      doc.text(inv.id, colInvoice, y + 4);
      doc.setFontSize(9);
      doc.text(truncate(inv.description, colFiat - colDesc - 20), colDesc, y + 4);
      doc.text(formatFiat(inv.fiatAmount, sym, cur), colFiat, y + 4, { align: 'right' });
      doc.setFontSize(8);
      doc.text(formatXMR(inv.xmrAmount), colXmr, y + 4, { align: 'right' });
      doc.setFontSize(9);
      // draw separator below text
      doc.setDrawColor(...line);
      doc.line(margin + 8, y + 18, pageWidth - margin - 8, y + 18);
      y += rowHeight;
    });

    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Generated by MoneroFlow for accounting and reconciliation purposes.', margin, pageHeight - 28);
    doc.save(filename);
  };

  const filterByRange = (range: string) => {
    const now = new Date();
    return paidInvoices.filter(inv => {
      const d = new Date(inv.paidAt || inv.createdAt);
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (range === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
      }
      if (range === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: string) => {
    if (!isPro) { toast.error('Upgrade to Pro to export data'); return; }
    const filtered = filterByRange(exportRange);
    if (filtered.length === 0) { toast.error('No paid invoices found for the selected period.'); return; }
    const rangeLabel = exportRange === 'month' ? 'monthly' : exportRange === 'quarter' ? 'quarterly' : exportRange === 'year' ? 'yearly' : 'all-time';
    const dateSuffix = new Date().toISOString().split('T')[0];
    switch (format) {
      case 'csv':
        downloadFile(generateCSV(filtered), `moneroflow-${rangeLabel}-${dateSuffix}.csv`, 'text/csv');
        toast.success(`CSV exported — ${filtered.length} transactions`);
        break;
      case 'quickbooks':
        downloadFile(generateQuickBooksIIF(filtered), `moneroflow-${rangeLabel}-${dateSuffix}.iif`, 'text/plain');
        toast.success(`QuickBooks IIF exported — ${filtered.length} transactions`);
        break;
      case 'xero':
        downloadFile(generateXeroCSV(filtered), `moneroflow-xero-${rangeLabel}-${dateSuffix}.csv`, 'text/csv');
        toast.success(`Xero CSV exported — ${filtered.length} transactions`);
        break;
      case 'pdf':
        generatePdfReport(filtered, rangeLabel, `moneroflow-report-${rangeLabel}-${dateSuffix}.pdf`);
        toast.success(`PDF exported — ${filtered.length} transactions`);
        break;
    }
  };

  const exportFormats = [
    { id: 'csv', name: 'CSV', desc: 'Universal spreadsheet format' },
    { id: 'quickbooks', name: 'QuickBooks (IIF)', desc: 'Import directly into QuickBooks' },
    { id: 'xero', name: 'Xero (CSV)', desc: 'Xero-compatible transaction export' },
    { id: 'pdf', name: 'PDF Report', desc: 'Styled reconciliation statement' },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground">Payouts & Accounting
          
                <HelpTooltip
                  title="Payouts & Accounting"
                  text="Export your transaction history for tax reporting. Supports CSV, QuickBooks IIF, Xero CSV, and PDF reports. Pro feature."
                />
        </h1>
        <p className="text-muted-foreground text-sm">Settlements and accounting exports</p>
      </FadeIn>

      {/* Summary Cards */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-5 rounded-xl bg-card border border-border">
            <p className="text-xs text-muted-foreground">Total Received</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatXMR(totalXmr)}</p>
            <p className="text-sm text-muted-foreground">{formatFiat(totalFiat, sym, cur)}</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <p className="text-xs text-muted-foreground">Paid Invoices</p>
            <p className="text-2xl font-bold text-foreground mt-1">{paidInvoices.length}</p>
            <p className="text-sm text-muted-foreground">transactions</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <p className="text-xs text-muted-foreground">XMR/USD Rate</p>
            <p className="text-2xl font-bold text-primary mt-1">${XMR_USD_RATE.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">current rate</p>
          </div>
        </div>
      </FadeIn>


      {/* Accounting Export */}
      <FadeIn delay={0.1}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Accounting Export</h2>
            {!isPro && <ProLock />}
          </div>
          <p className="text-xs text-muted-foreground">Export transactions with cost basis for tax reporting.</p>

          <div className="space-y-2">
            <Label className="text-foreground">Export Range</Label>
            <Select value={exportRange} onValueChange={setExportRange}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {exportFormats.map(fmt => (
              <button
                key={fmt.id}
                onClick={() => handleExport(fmt.id)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 bg-muted/10 transition-colors text-left"
              >
                <Download className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{fmt.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                </div>
                {!isPro && <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Recent Paid Invoices */}
      <FadeIn delay={0.12}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Recent Paid Invoices</h2>
          </div>
          {paidInvoices.length === 0 ? (
            <div className="p-4 rounded-lg bg-muted/20 border border-border text-center">
              <p className="text-sm text-muted-foreground">No paid invoices yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paidInvoices.slice(0, 10).map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatFiat(inv.fiatAmount, sym, cur)}</p>
                      <p className="text-xs text-muted-foreground">{inv.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-primary">{formatXMR(inv.xmrAmount)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(inv.paidAt || inv.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
