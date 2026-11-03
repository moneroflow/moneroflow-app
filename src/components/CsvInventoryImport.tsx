import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import type { PosQuickButton } from '@/lib/mock-data';

type PosField = 'name' | 'price' | 'category' | 'quantity' | 'skip';

interface ColumnMapping {
  header: string;
  field: PosField;
}

interface ParsedRow {
  [key: string]: string;
}

interface ProcessedItem {
  label: string;
  price: number;
  category: string;
  stock?: number;
  valid: boolean;
  warnings: string[];
}

const COLORS = [
  'bg-orange-500/20 text-orange-300',
  'bg-blue-500/20 text-blue-300',
  'bg-green-500/20 text-green-300',
  'bg-purple-500/20 text-purple-300',
  'bg-pink-500/20 text-pink-300',
  'bg-yellow-500/20 text-yellow-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-red-500/20 text-red-300',
];

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });

  return { headers, rows };
}

function autoMapField(header: string): PosField {
  const h = header.toLowerCase().trim();
  if (/^(name|item|product|title|label|description)$/i.test(h)) return 'name';
  if (/^(price|cost|amount|unit.?price|retail)$/i.test(h)) return 'price';
  if (/^(category|cat|type|group|department|dept)$/i.test(h)) return 'category';
  if (/^(qty|quantity|stock|count|inventory|units|on.?hand)$/i.test(h)) return 'quantity';
  return 'skip';
}

export default function CsvInventoryImport() {
  const { merchant, updateMerchant } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Step state
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [mergeMode, setMergeMode] = useState(true); // true = merge, false = replace

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text) {
          toast.error('File appears to be empty');
          return;
        }
        const { headers: h, rows: r } = parseCSV(text);
        if (h.length === 0) {
          toast.error('Could not parse CSV — no headers found');
          return;
        }
        setHeaders(h);
        setRows(r);
        setMappings(h.map(header => ({ header, field: autoMapField(header) })));
        setStep('map');
        toast.success(`Detected ${h.length} columns, ${r.length} rows`);
      } catch (err) {
        console.error('CSV parse error:', err);
        toast.error('Failed to parse CSV file. Check the file format and try again.');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const updateMapping = (index: number, field: PosField) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, field } : m));
  };

  const hasRequiredMappings = () => {
    const mapped = mappings.map(m => m.field);
    return mapped.includes('name') && mapped.includes('price');
  };

  const processRows = () => {
    const nameCol = mappings.find(m => m.field === 'name')?.header;
    const priceCol = mappings.find(m => m.field === 'price')?.header;
    const catCol = mappings.find(m => m.field === 'category')?.header;
    const qtyCol = mappings.find(m => m.field === 'quantity')?.header;

    const items: ProcessedItem[] = rows.map(row => {
      const warnings: string[] = [];
      const label = nameCol ? row[nameCol]?.trim() : '';
      const priceStr = priceCol ? row[priceCol]?.replace(/[^0-9.,\-]/g, '') : '';
      const price = parseFloat(priceStr) || 0;
      const category = catCol ? row[catCol]?.trim() || 'Uncategorized' : 'Uncategorized';
      const stockStr = qtyCol ? row[qtyCol]?.replace(/[^0-9]/g, '') : '';
      const stock = stockStr ? parseInt(stockStr, 10) : undefined;

      if (!label) warnings.push('Missing name');
      if (price <= 0) warnings.push('Invalid price');

      return { label, price, category, stock, valid: !!label && price > 0, warnings };
    });

    setProcessedItems(items);
    setStep('preview');
  };

  const validItems = processedItems.filter(i => i.valid);
  const invalidItems = processedItems.filter(i => !i.valid);
  const categories = [...new Set(validItems.map(i => i.category))];

  const handleImport = () => {
    const newButtons: PosQuickButton[] = validItems.map((item, idx) => ({
      id: crypto.randomUUID(),
      label: item.label,
      price: item.price,
      category: item.category,
      color: COLORS[idx % COLORS.length],
      stock: item.stock,
    }));

    const newCategories = [...new Set([
      ...(mergeMode ? merchant.posCategories : []),
      ...categories,
    ])];

    const existingButtons = mergeMode ? merchant.posQuickButtons : [];
    updateMerchant({
      posQuickButtons: [...existingButtons, ...newButtons],
      posCategories: newCategories,
    });

    toast.success(`Imported ${validItems.length} items into POS inventory`);
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setProcessedItems([]);
    setMergeMode(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <div>
            <span className="font-medium text-foreground">POS Inventory Import</span>
            <p className="text-xs text-muted-foreground">Import items from a CSV file into your POS terminal</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Step indicators */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(['upload', 'map', 'preview'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ArrowRight className="h-3 w-3" />}
                <Badge variant={step === s ? 'default' : step === 'done' || (['map', 'preview'].indexOf(step) > ['map', 'preview'].indexOf(s)) ? 'secondary' : 'outline'} className="text-xs">
                  {i + 1}. {s === 'upload' ? 'Upload' : s === 'map' ? 'Map Columns' : 'Preview'}
                </Badge>
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center gap-3 py-6 border border-dashed border-border rounded-lg">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a CSV file with your inventory</p>
              <p className="text-xs text-muted-foreground">Columns can be in any order — you'll map them in the next step</p>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="max-w-xs"
              />
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map each CSV column to a POS field. <span className="text-primary">Name</span> and <span className="text-primary">Price</span> are required.
              </p>
              <div className="space-y-2">
                {mappings.map((m, i) => (
                  <div key={m.header} className="flex items-center gap-3 rounded-md bg-muted/30 p-2">
                    <span className="text-sm font-mono text-foreground min-w-[120px] truncate" title={m.header}>
                      {m.header}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Select value={m.field} onValueChange={(v) => updateMapping(i, v as PosField)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="quantity">Quantity</SelectItem>
                        <SelectItem value="skip">Skip</SelectItem>
                      </SelectContent>
                    </Select>
                    {m.field !== 'skip' && (
                      <Badge variant="secondary" className="text-xs">{m.field}</Badge>
                    )}
                  </div>
                ))}
              </div>

              {!hasRequiredMappings() && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Map at least a Name and Price column to continue
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
                <Button size="sm" disabled={!hasRequiredMappings()} onClick={processRows}>
                  Preview Import <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" /> {validItems.length} valid
                </Badge>
                {invalidItems.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <X className="h-3 w-3" /> {invalidItems.length} skipped
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  {categories.length} categories
                </Badge>
              </div>

              {/* Preview table */}
              <div className="max-h-[300px] overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedItems.slice(0, 20).map((item, i) => (
                      <TableRow key={i} className={!item.valid ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{item.label || '—'}</TableCell>
                        <TableCell>{item.price > 0 ? `${merchant.fiatSymbol}${item.price.toFixed(2)}` : '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                        <TableCell>{item.stock !== undefined ? item.stock : '—'}</TableCell>
                        <TableCell>
                          {item.valid ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <span className="text-xs text-destructive">{item.warnings.join(', ')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {processedItems.length > 20 && (
                <p className="text-xs text-muted-foreground">Showing first 20 of {processedItems.length} rows</p>
              )}

              {/* Merge vs Replace */}
              <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
                <Switch checked={mergeMode} onCheckedChange={setMergeMode} id="merge-mode" />
                <Label htmlFor="merge-mode" className="text-sm cursor-pointer">
                  {mergeMode ? 'Merge with existing inventory' : 'Replace all existing inventory'}
                </Label>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep('map')}>Back</Button>
                <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
                <Button size="sm" onClick={handleImport} disabled={validItems.length === 0}>
                  Import {validItems.length} items <Check className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Check className="h-8 w-8 text-green-400" />
              <p className="text-sm text-foreground">Successfully imported {validItems.length} items</p>
              <p className="text-xs text-muted-foreground">Items are now available in your POS terminal</p>
              <Button variant="outline" size="sm" onClick={reset}>Import Another File</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
