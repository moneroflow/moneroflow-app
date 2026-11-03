import { useState, useCallback, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { formatFiat, formatXMR, usdToXmr as usdToXmrMock, PosQuickButton, CartItem, ParkedOrder } from '@/lib/mock-data';
import { useRates } from '@/hooks/use-rates';
import { fiatToXmr, xmrToFiat, getUsdtPrice, usdtToFiat, fiatToUsdt } from '@/lib/currency-service';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Delete, Check, Loader2, Lock, Plus, X, Tag, ShoppingBag,
  Search, Star, Clock, ParkingCircle, Percent, StickyNote,
  Receipt, ChevronRight, Minus, Package, Sparkles, Zap, Settings, Trash2, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoneroFeeInfo } from '@/components/MoneroFeeInfo';
import { TrxQRCode } from '@/components/TrxQRCode';
import { TrxPaymentProgress } from '@/components/TrxPaymentProgress';
import { PaymentProgress } from '@/components/PaymentProgress';
import { HelpTooltip } from '@/components/HelpTooltip';

function ProLock({ label = 'Unlock Pro Sub' }: { label?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="bg-card border-border text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProBadge() {
  return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[9px] px-1.5 py-0">PRO</Badge>;
}

export default function PosPage() {
  const createInvoice = useStore(s => s.createInvoice);
  const createTrxInvoice = useStore(s => s.createTrxInvoice);
  const pollInvoicePayment = useStore(s => s.pollInvoicePayment);
  const invoices = useStore(s => s.invoices);
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);
  const posXmrMode = useStore(s => s.posXmrMode);
  const posSelectedChain = useStore(s => s.posSelectedChain);
  const setPosXmrMode = useStore(s => s.setPosXmrMode);
  const setPosSelectedChain = useStore(s => s.setPosSelectedChain);
  const { rates } = useRates();
  const isPro = merchant.plan === 'pro';
  const sym = merchant.fiatSymbol || '$';
  const cur = merchant.fiatCurrency || 'USD';

  const toXmr = useCallback((amount: number) =>
    rates ? fiatToXmr(amount, cur, rates) : usdToXmrMock(amount),
  [rates, cur]);
  const users = merchant.posUsers || [];
  const activeUserId = merchant.activePosUser || 'admin';
  const activeUserName = activeUserId === 'admin' ? 'Admin' : (users.find(u => u.id === activeUserId)?.name || 'Unknown');

  const handleSwitchUser = (userId: string) => {
    updateMerchant({ activePosUser: userId === 'admin' ? '' : userId });
    const name = userId === 'admin' ? 'Admin' : (users.find(u => u.id === userId)?.name || 'Unknown');
    toast.success(`Switched to ${name}`);
  };

  const [input, setInput] = useState('0');
  const [displayMode, setDisplayMode] = useState<'fiat' | 'crypto'>('fiat');
  const selectedChain = posSelectedChain;
  const xmrMode = posXmrMode;

  // Reset to fiat display when switching chains
  useEffect(() => {
    setPosXmrMode(false);
    setDisplayMode('fiat');
  }, [selectedChain]);

  // Helper function to format price display based on USDT mode
  // Must come after xmrMode and selectedChain declarations to avoid hoisting issues
  const formatPrice = useCallback((price: number, isUsdtPrice = false): string => {
    if (selectedChain === 'trx') {
      if (isUsdtPrice) {
        // Price is already in USDT, just format with USDT label
        return `${price.toFixed(2)} USDT`;
      } else {
        // Price is in fiat, convert to USDT for display
        const usdtPrice = cur === 'USD' ? price : (price / (rates?.fiatRates[cur] || 1));
        return `${usdtPrice.toFixed(2)} USDT`;
      }
    }
    return `${sym}${price.toFixed(2)}`;
  }, [selectedChain, sym, cur, rates]);

  const [activeInvoice, setActiveInvoice] = useState<{ id: string; fiatAmount: number; xmrAmount: number; trxAmount: number; subaddress: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [newBtnLabel, setNewBtnLabel] = useState('');

  useEffect(() => {
    const root = document.documentElement;

    if (selectedChain === 'trx') {
      // Save current theme before applying TRON - use the global theme system
      const currentTheme = localStorage.getItem('mf-theme') || 'dark';
      localStorage.setItem('mf-previous-theme', currentTheme);
      root.classList.remove('dark', 'theme-light', 'theme-rose', 'theme-lavender', 'theme-mint', 'theme-peach');
      root.classList.add('theme-tron');
    } else {
      // Restore the theme that was active before TRON - use the global theme system
      const previousTheme = localStorage.getItem('mf-previous-theme') || 'dark';
      root.classList.remove('theme-tron');
      
      // Update the global theme system to match the restored theme
      localStorage.setItem('mf-theme', previousTheme);
      
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      } else if (previousTheme.startsWith('theme-')) {
        root.classList.add(previousTheme);
      }
    }
  }, [selectedChain]);
  const [newBtnPrice, setNewBtnPrice] = useState('');
  const [newBtnCategory, setNewBtnCategory] = useState('Products');
  const [newBtnStock, setNewBtnStock] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Cart state (Pro)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showModifiers, setShowModifiers] = useState<{ item: PosQuickButton } | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [showOrderNote, setShowOrderNote] = useState(false);
  const [showParkDialog, setShowParkDialog] = useState(false);
  const [parkLabel, setParkLabel] = useState('');
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ type: 'percent' | 'fixed'; value: number } | null>(null);

  // Category management state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<string | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);

  const quickButtons = merchant.posQuickButtons || [];
  const categories = merchant.posCategories || ['Food', 'Drinks', 'Services', 'Products'];
  const modifiers = merchant.posModifiers || [];
  const combos = merchant.posCombos || [];
  const parkedOrders = merchant.parkedOrders || [];

  // FREE plan limits
  const MAX_FREE_ITEMS = 30;
  const defaultCategories = ['All', 'Food', 'Drinks', 'Services', 'Products'];
  const hasReachedItemLimit = !isPro && quickButtons.length >= MAX_FREE_ITEMS;

  const invoice = invoices.find(i => i.id === activeInvoice?.id);
  const paid = invoice?.status === 'paid';

  // Top sellers from recent invoices
  const topSellers = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.description && inv.description !== 'PoS Sale') {
        counts[inv.description] = (counts[inv.description] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [invoices]);

  // Recent sales (last 6 unique items sold today)
  const recentSales = useMemo(() => {
    const today = new Date().toDateString();
    const seen = new Set<string>();
    const recent: { desc: string; amount: number }[] = [];
    for (const inv of invoices) {
      if (new Date(inv.createdAt).toDateString() === today && inv.description !== 'PoS Sale') {
        if (!seen.has(inv.description)) {
          seen.add(inv.description);
          recent.push({ desc: inv.description, amount: inv.fiatAmount });
          if (recent.length >= 6) break;
        }
      }
    }
    return recent;
  }, [invoices]);

  // Favorites (auto-populated from most sold or manually pinned)
  const favorites = useMemo(() => {
    const pinned = merchant.posFavorites || [];
    const pinnedButtons = quickButtons.filter(b => pinned.includes(b.id));
    if (pinnedButtons.length >= 8) return pinnedButtons.slice(0, 8);
    // Fill remaining with top sellers
    const remaining = quickButtons
      .filter(b => !pinned.includes(b.id))
      .sort((a, b) => {
        const aCount = invoices.filter(i => i.description === a.label).length;
        const bCount = invoices.filter(i => i.description === b.label).length;
        return bCount - aCount;
      });
    return [...pinnedButtons, ...remaining].slice(0, 8);
  }, [quickButtons, merchant.posFavorites, invoices]);

  useEffect(() => {
    if (!activeInvoice || paid) return;
    const interval = setInterval(() => {
      pollInvoicePayment(activeInvoice.id);
    }, 12000);
    return () => clearInterval(interval);
  }, [activeInvoice, paid, pollInvoicePayment]);

  // Migrate existing cart items to have originalFiatPrice for backward compatibility
  useEffect(() => {
    if (cart.length > 0 && cart.some(item => item.originalFiatPrice === undefined)) {
      setCart(prev => prev.map(item => ({
        ...item,
        originalFiatPrice: item.originalFiatPrice || item.price
      })));
    }
  }, [cart.length]);

  // Calculate display price based on current chain mode
  const getDisplayPrice = useCallback((originalFiatPrice: number) => {
    if (selectedChain === 'trx') {
      if (rates) {
        // Convert fiat → USDT for display
        return fiatToUsdt(originalFiatPrice, cur, rates) || originalFiatPrice;
      }
      // Fallback: show fiat price if rates not available
      return originalFiatPrice;
    }
    // Default: show fiat price
    return originalFiatPrice;
  }, [selectedChain, rates, cur]);

  // Cart total - ALWAYS in local fiat currency for consistency
  const cartSubtotal = cart.reduce((sum, item) => {
    const fiatPrice = item.originalFiatPrice || item.price;
    return sum + (fiatPrice + (item.modifierTotal || 0)) * item.qty;
  }, 0);
  const discountAmount = appliedDiscount
    ? appliedDiscount.type === 'percent'
      ? cartSubtotal * (appliedDiscount.value / 100)
      : appliedDiscount.value
    : 0;
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);

  const handleKey = useCallback((key: string) => {
    if (activeInvoice) return;
    const maxDecimals = xmrMode ? (selectedChain === 'trx' ? 2 : 6) : 2;
    setInput(prev => {
      if (key === 'C') return '0';
      if (key === '⌫') return prev.length <= 1 ? '0' : prev.slice(0, -1);
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      if (prev.includes('.') && prev.split('.')[1].length >= maxDecimals) return prev;
      return prev + key;
    });
  }, [activeInvoice, xmrMode]);

  const handleCharge = async () => {
    let fiatAmount: number; // Amount in local fiat currency (e.g. AUD)
    let usdAmount: number;  // Amount in USD (for USDT invoices, 1:1 with USDT)
    
    if (cart.length > 0) {
      // Cart mode: cartTotal is in local fiat currency
      fiatAmount = cartTotal;
      usdAmount = rates ? fiatToUsdt(fiatAmount, cur, rates) : fiatAmount;
    } else if (xmrMode && rates) {
      if (selectedChain === 'trx') {
        // USDT mode with XMR toggle active: input is USDT amount
        // Convert USDT to local fiat for display, USDT = USD so usdAmount = input
        const usdtVal = parseFloat(input) || 0;
        fiatAmount = usdtVal * (rates?.fiatRates[cur] || 1);
        usdAmount = usdtVal;
      } else {
        // XMR mode: input is XMR amount, convert to fiat
        fiatAmount = xmrToFiat(parseFloat(input) || 0, cur, rates);
        usdAmount = fiatAmount / (rates?.fiatRates[cur] || 1);
      }
    } else if (selectedChain === 'trx') {
      // USDT mode without XMR toggle: input is in local fiat currency (e.g. AUD)
      fiatAmount = parseFloat(input) || 0;
      usdAmount = rates ? fiatToUsdt(fiatAmount, cur, rates) : fiatAmount;
    } else {
      // XMR mode normal: input is in local fiat currency
      fiatAmount = parseFloat(input) || 0;
      usdAmount = fiatAmount / (rates?.fiatRates[cur] || 1);
    }
    if (!fiatAmount || fiatAmount <= 0) return;
    setCreating(true);
    const desc = cart.length > 0
      ? cart.map(i => `${i.qty}x ${i.name} (${formatPrice((i.price + (i.modifierTotal || 0)) * i.qty, selectedChain === 'trx')})`).join(', ')
      : 'PoS Sale';
    const note = orderNote ? ` [Note: ${orderNote}]` : '';
    try {
      if (selectedChain === 'trx') {
        // Pass USD amount to createTrxInvoice (USDT is 1:1 with USD), also pass local fiat amount for display
        const inv = await createTrxInvoice(desc + note, usdAmount, fiatAmount);
        setActiveInvoice({ id: inv.id, fiatAmount: fiatAmount, xmrAmount: 0, trxAmount: inv.trxAmount || 0, subaddress: inv.trxAddress || '' });
      } else {
        const inv = await createInvoice(desc + note, fiatAmount);
        setActiveInvoice({ id: inv.id, fiatAmount: inv.fiatAmount, xmrAmount: inv.xmrAmount, trxAmount: 0, subaddress: inv.subaddress });
      }
    } catch (e) {
      toast.error((e as Error).message || 'Failed to create invoice.');
    }
    setCreating(false);
  };

  const handleNewSale = () => {
    setActiveInvoice(null);
    setInput('0');
    // Preserve xmrMode - let user keep their USDT/XMR toggle preference
    setCart([]);
    setOrderNote('');
    setAppliedDiscount(null);
  };

  const addToCart = (btn: PosQuickButton, mods?: string[]) => {
    const modTotal = mods
      ? mods.reduce((sum, m) => {
          for (const mod of modifiers) {
            const opt = mod.options.find(o => o.label === m);
            if (opt) return sum + opt.priceAdj;
          }
          return sum;
        }, 0)
      : 0;

    setCart(prev => {
      const existing = prev.find(i => i.name === btn.label && (i.modifiers?.sort().join(',') || '') === (mods?.sort().join(',') || ''));
      
      // Always store original fiat price
      const originalFiatPrice = btn.price;
      
      if (existing) {
        return prev.map(i => i.id === existing.id ? { 
          ...i, 
          qty: i.qty + 1,
        } : i);
      }
      return [...prev, {
        id: 'ci_' + Math.random().toString(36).slice(2, 6),
        name: btn.label,
        originalFiatPrice: originalFiatPrice,
        price: originalFiatPrice, // Always in local fiat
        qty: 1,
        modifiers: mods,
        modifierTotal: modTotal, // Always in local fiat
      }];
    });

    // Decrement stock
    if (btn.stock !== undefined && btn.stock > 0) {
      updateMerchant({
        posQuickButtons: quickButtons.map(b =>
          b.id === btn.id ? { ...b, stock: (b.stock || 0) - 1 } : b
        ),
      });
    }

    toast.success(`${btn.label} added`);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? i : { ...i, qty: newQty };
    }).filter(i => i.qty > 0));
  };

  const handleQuickButton = (btn: PosQuickButton) => {
    // Check if item has modifiers
    if (modifiers.length > 0) {
      if (!isPro) { toast.error('Custom modifiers are available in the Pro Plan'); return; }
      setShowModifiers({ item: btn });
      setSelectedModifiers([]);
      return;
    }
    addToCart(btn);
  };

  const handleAddQuickButton = () => {
    if (hasReachedItemLimit) {
      toast.error(`FREE plan limit: Maximum ${MAX_FREE_ITEMS} items. Upgrade to Pro for unlimited items.`);
      return;
    }
    if (!newBtnLabel || !newBtnPrice) return;
    const btn: PosQuickButton = {
      id: 'qb_' + Math.random().toString(36).slice(2, 6),
      label: newBtnLabel,
      price: parseFloat(newBtnPrice),
      category: newBtnCategory,
      color: ['bg-primary/20', 'bg-success/20', 'bg-warning/20', 'bg-blue-500/20'][Math.floor(Math.random() * 4)],
      stock: newBtnStock ? parseInt(newBtnStock) : undefined,
    };
    updateMerchant({ posQuickButtons: [...quickButtons, btn] });
    setNewBtnLabel('');
    setNewBtnPrice('');
    setNewBtnStock('');
    setShowAddButton(false);
    toast.success(`"${btn.label}" added! (${quickButtons.length + 1}/${isPro ? '∞' : MAX_FREE_ITEMS} items)`);
  };

  const handleRemoveButton = (id: string) => {
    if (merchant.adminPasswordHash) {
      setPendingDeleteItemId(id);
      setAdminPasswordInput('');
    } else {
      updateMerchant({ posQuickButtons: quickButtons.filter(b => b.id !== id) });
      toast.success('Button removed');
    }
  };

  const hashPassword = (pw: string) => {
    let hash = 0;
    for (let i = 0; i < pw.length; i++) {
      const chr = pw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  };

  const confirmAdminDelete = () => {
    if (!merchant.adminPasswordHash || hashPassword(adminPasswordInput) === merchant.adminPasswordHash) {
      if (pendingDeleteItemId) {
        updateMerchant({ posQuickButtons: quickButtons.filter(b => b.id !== pendingDeleteItemId) });
        toast.success('Item removed');
        setPendingDeleteItemId(null);
      }
      if (pendingDeleteCategory) {
        const updated = categories.filter(c => c !== pendingDeleteCategory);
        const orphaned = quickButtons.filter(b => b.category === pendingDeleteCategory);
        const fallback = updated[0] || 'Products';
        const updatedButtons = quickButtons.map(b =>
          b.category === pendingDeleteCategory ? { ...b, category: fallback } : b
        );
        updateMerchant({ posCategories: updated, posQuickButtons: updatedButtons });
        if (selectedCategory === pendingDeleteCategory) setSelectedCategory('All');
        toast.success(`Category "${pendingDeleteCategory}" removed. ${orphaned.length} items moved to "${fallback}".`);
        setPendingDeleteCategory(null);
      }
      setAdminPasswordInput('');
    } else {
      toast.error('Incorrect admin password');
    }
  };

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.includes(name)) { toast.error('Category already exists'); return; }
    updateMerchant({ posCategories: [...categories, name] });
    setNewCategoryName('');
    toast.success(`Category "${name}" added`);
  };

  const handleDeleteCategory = (cat: string) => {
    if (merchant.adminPasswordHash) {
      setPendingDeleteCategory(cat);
      setAdminPasswordInput('');
    } else {
      const updated = categories.filter(c => c !== cat);
      const orphaned = quickButtons.filter(b => b.category === cat);
      const fallback = updated[0] || 'Products';
      const updatedButtons = quickButtons.map(b =>
        b.category === cat ? { ...b, category: fallback } : b
      );
      updateMerchant({ posCategories: updated, posQuickButtons: updatedButtons });
      if (selectedCategory === cat) setSelectedCategory('All');
      toast.success(`Category "${cat}" removed. ${orphaned.length} items moved to "${fallback}".`);
    }
  };

  const handleHoldStart = (btn: PosQuickButton) => {
    if (!isPro) return;
    const timer = setTimeout(() => {
      const val = parseFloat(input);
      if (val > 0) {
        updateMerchant({
          posQuickButtons: quickButtons.map(b =>
            b.id === btn.id ? { ...b, price: val } : b
          ),
        });
        toast.success(`"${btn.label}" price updated to ${sym}${val.toFixed(2)}`);
      }
    }, 800);
    setHoldTimer(timer);
  };

  const handleHoldEnd = () => {
    if (holdTimer) { clearTimeout(holdTimer); setHoldTimer(null); }
  };

  const handleParkOrder = () => {
    if (cart.length === 0) return;
    const order: ParkedOrder = {
      id: 'po_' + Math.random().toString(36).slice(2, 6),
      label: parkLabel || `Order #${(parkedOrders.length + 1)}`,
      items: cart.map(i => ({ name: i.name, price: i.price, qty: i.qty, modifiers: i.modifiers })),
      total: cartTotal,
      parkedAt: new Date().toISOString(),
    };
    updateMerchant({ parkedOrders: [...parkedOrders, order] });
    setCart([]);
    setOrderNote('');
    setAppliedDiscount(null);
    setParkLabel('');
    setShowParkDialog(false);
    toast.success(`Order parked: ${order.label}`);
  };

  const handleRecallOrder = (order: ParkedOrder) => {
    setCart(order.items.map(i => {
      return {
        id: 'ci_' + Math.random().toString(36).slice(2, 6),
        name: i.name,
        price: i.price, // Always in local fiat
        originalFiatPrice: i.price,
        qty: i.qty,
        modifiers: i.modifiers,
        modifierTotal: 0,
      };
    }));
    updateMerchant({ parkedOrders: parkedOrders.filter(o => o.id !== order.id) });
    setShowParkedOrders(false);
    toast.success(`Order recalled: ${order.label}`);
  };

  const handleApplyDiscount = () => {
    const val = parseFloat(discountValue);
    if (!val || val <= 0) return;
    setAppliedDiscount({ type: discountType, value: val });
    setShowDiscountDialog(false);
    setDiscountValue('');
    toast.success(`Discount applied: ${discountType === 'percent' ? `${val}%` : `${sym}${val.toFixed(2)}`}`);
  };

  const handleCombo = (combo: typeof combos[0]) => {
    if (!isPro) return;
    const items = combo.itemIds.map(id => quickButtons.find(b => b.id === id)).filter(Boolean) as PosQuickButton[];
    items.forEach(item => addToCart(item));
    if (combo.discount > 0) {
      setAppliedDiscount({ type: 'fixed', value: combo.discount });
    }
    toast.success(`Combo "${combo.name}" added!`);
  };

  const filteredButtons = useMemo(() => {
    let btns = selectedCategory === 'All' ? quickButtons : quickButtons.filter(b => b.category === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      btns = btns.filter(b => b.label.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));
    }
    return btns;
  }, [quickButtons, selectedCategory, searchQuery, defaultCategories]);

  const toggleFavorite = (id: string) => {
    const favs = merchant.posFavorites || [];
    if (favs.includes(id)) {
      updateMerchant({ posFavorites: favs.filter(f => f !== id) });
    } else {
      updateMerchant({ posFavorites: [...favs, id] });
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  // ── Payment confirmed ──
  if ((paid || invoice?.status === 'paid') && activeInvoice) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-6 max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto">
            <Check className="w-12 h-12 text-success" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{formatFiat(activeInvoice.fiatAmount, sym, cur)}</h2>
            <p className="text-muted-foreground mt-1">Payment Confirmed</p>
            {invoice?.txid && (
              <p className="text-xs font-mono text-muted-foreground mt-2 break-all max-w-xs mx-auto">TX: {invoice.txid.slice(0, 16)}...</p>
            )}
          </div>
          <Button onClick={handleNewSale} className="bg-gradient-orange hover:opacity-90 px-8 py-3 text-lg">New Sale</Button>
        </div>
      </div>
    );
  }

  // ── QR code screen with smart confirmation ──
  if (activeInvoice) {
    const isTrxInvoice = activeInvoice.trxAmount > 0;
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-5 max-w-sm w-full">
          <div>
            <p className="text-muted-foreground text-sm mb-1">Customer owes</p>
            <h2 className="text-4xl font-bold text-foreground">{formatFiat(activeInvoice.fiatAmount, sym, cur)}</h2>
            <p className={`font-mono mt-1 ${isTrxInvoice ? 'text-orange-500' : 'text-primary'}`}>
              {isTrxInvoice ? `${activeInvoice.trxAmount.toFixed(2)} USDT` : formatXMR(activeInvoice.xmrAmount)}
            </p>
          </div>
          {isTrxInvoice ? (
            <TrxQRCode address={activeInvoice.trxAddress || activeInvoice.subaddress} amount={activeInvoice.trxAmount} />
          ) : (
            <div className="bg-white rounded-2xl p-6 inline-block">
              <QRCodeSVG value={`monero:${activeInvoice.subaddress}?tx_amount=${activeInvoice.xmrAmount.toFixed(6)}`} size={220} />
            </div>
          )}
          <p className="text-muted-foreground text-xs font-mono break-all px-4">
            {isTrxInvoice
              ? (activeInvoice.trxAddress || activeInvoice.subaddress).slice(0, 20) + '...' + (activeInvoice.trxAddress || activeInvoice.subaddress).slice(-10)
              : activeInvoice.subaddress.slice(0, 20) + '...' + activeInvoice.subaddress.slice(-10)
            }
          </p>

          {isTrxInvoice ? (
            <TrxPaymentProgress invoiceId={activeInvoice.id} fiatAmount={activeInvoice.fiatAmount} trxAmount={activeInvoice.trxAmount || 0} address={activeInvoice.trxAddress || activeInvoice.subaddress} />
          ) : (
            <>
              <MoneroFeeInfo compact />
              <PaymentProgress invoiceId={activeInvoice.id} fiatAmount={activeInvoice.fiatAmount} xmrAmount={activeInvoice.xmrAmount} subaddress={activeInvoice.subaddress} />
            </>
          )}

          <Button variant="outline" onClick={handleNewSale} className="border-border">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── Main PoS Layout ──
  return (
    <div className="space-y-3">
      {/* ═══ User Selector Bar ═══ */}
      {users.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">Cashier:</span>
            <Select value={activeUserId} onValueChange={handleSwitchUser}>
              <SelectTrigger className="h-7 w-[140px] bg-background border-border text-xs">
                <SelectValue placeholder="Admin" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="admin">Admin</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1.5 py-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {activeUserName}
          </Badge>
        </div>
      )}
      {/* ═══ Payment Chain Toggle ═══ */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2 w-auto">
        <span className={`text-xs font-medium ${selectedChain === 'xmr' ? 'text-primary' : 'text-muted-foreground'}`}>XMR</span>
        <Switch
          checked={selectedChain === 'trx'}
          onCheckedChange={(checked) => setPosSelectedChain(checked ? 'trx' : 'xmr')}
          className="bg-muted data-[state=checked]:bg-orange-500"
        />
        <span className={`text-xs font-medium ${selectedChain === 'trx' ? 'text-orange-500' : 'text-muted-foreground'}`}>TRX/USDT</span>
      </div>
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center min-h-[70vh] gap-4 lg:gap-6">
      {/* ═══ LEFT: Product Grid ═══ */}
      {(
      <div className="hidden lg:flex flex-col w-72 space-y-3 pt-2 max-h-[80vh] overflow-hidden">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="pl-9 h-9 bg-background border-border text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Items</span>
            <span className="text-[10px] text-muted-foreground">({quickButtons.length}/{isPro ? '∞' : MAX_FREE_ITEMS})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (hasReachedItemLimit) {
                toast.error(`FREE plan limit: Maximum ${MAX_FREE_ITEMS} items. Upgrade to Pro for unlimited items.`);
              } else {
                setShowAddButton(true);
              }
            }}
            className={`h-7 w-7 p-0 ${hasReachedItemLimit ? 'text-muted-foreground cursor-not-allowed' : 'text-muted-foreground hover:text-primary'}`}
            disabled={hasReachedItemLimit}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap items-center">
          {defaultCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                selectedCategory === cat
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80'
              } cursor-pointer`}
            >
              {cat}
            </button>
          ))}
          {isPro && categories.filter(c => !defaultCategories.includes(c)).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                selectedCategory === cat
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80'
              } cursor-pointer`}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => {
              if (isPro) {
                setShowCategoryManager(true);
              } else {
                toast.error('Editing or adding Categories is available in the Pro Plan');
              }
            }}
            className={`text-muted-foreground transition-colors ml-1 ${isPro ? 'hover:text-primary' : 'cursor-pointer'}`}
            title={isPro ? "Manage categories" : "Category management is Pro only"}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Favorites bar */}
        {favorites.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-yellow-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Favorites</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {favorites.slice(0, 4).map(btn => (
                <button
                  key={btn.id}
                  onClick={() => handleQuickButton(btn)}
                  className="p-2 rounded-lg border border-primary/20 bg-primary/5 text-xs hover:bg-primary/10 active:scale-95 transition-all text-left"
                >
                  <span className="text-foreground font-medium truncate block">{btn.label}</span>
                  <span className="text-primary font-mono text-[10px]">{formatPrice(getDisplayPrice(btn.price), selectedChain === 'trx')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick button grid */}
        <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
          {filteredButtons.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchQuery ? 'No items match your search.' : 'No items yet. Click + to add.'}
            </p>
          )}
          {filteredButtons.map(btn => {
            const isFav = (merchant.posFavorites || []).includes(btn.id);
            const lowStock = btn.stock !== undefined && btn.stock <= 5;
            const outOfStock = btn.stock !== undefined && btn.stock <= 0;
            return (
              <div
                key={btn.id}
                className={`group relative flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                  outOfStock ? 'border-destructive/20 bg-destructive/5 opacity-60 cursor-not-allowed' :
                  'border-border bg-card hover:border-primary/30 active:scale-[0.98] cursor-pointer'
                }`}
                onClick={() => !outOfStock && handleQuickButton(btn)}
                onMouseDown={() => isPro && handleHoldStart(btn)}
                onMouseUp={handleHoldEnd}
                onMouseLeave={handleHoldEnd}
                onTouchStart={() => isPro && handleHoldStart(btn)}
                onTouchEnd={handleHoldEnd}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Tag className="w-3 h-3 text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground truncate block">{btn.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">≈ {formatXMR(toXmr(btn.price)).slice(0, 8)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {lowStock && !outOfStock && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-warning/10 text-warning">{btn.stock} left</span>
                  )}
                  {outOfStock && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/10 text-destructive">Out</span>
                  )}
                  <span className="text-xs font-mono text-primary">{formatPrice(getDisplayPrice(btn.price), selectedChain === 'trx')}</span>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                    {isPro && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleFavorite(btn.id); }}
                        className={`${isFav ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                      >
                        <Star className="w-3 h-3" fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleRemoveButton(btn.id); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Combos */}
        {isPro && combos.length > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            <div className="flex items-center gap-1.5">
              <Package className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Combos</span>
            </div>
            {combos.map(combo => (
              <button
                key={combo.id}
                onClick={() => handleCombo(combo)}
                className="w-full p-2 rounded-lg border border-primary/20 bg-primary/5 text-left hover:bg-primary/10 active:scale-[0.98] transition-all"
              >
                <span className="text-xs font-medium text-foreground">{combo.name}</span>
                <span className="text-[10px] text-primary font-mono ml-2">{sym}{combo.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {quickButtons.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            {isPro ? 'Hold a button to update its price' : `FREE plan: ${quickButtons.length}/${MAX_FREE_ITEMS} items · Tap item to set price`}
          </p>
        )}
      </div>
      )}

      {/* ═══ CENTER: Keypad ═══ */}
      <div className="flex-1 flex justify-center">
      <div className="w-full max-w-xs space-y-4">
        <div className="text-center">
          <div className="mb-3">
            <Badge variant="outline" className="text-primary border-primary/20 mr-2">PoS Terminal</Badge>
            <HelpTooltip
              title="PoS Terminal"
              text="Point-of-Sale terminal for in-person payments. Enter an amount, tap Charge, and show the QR code to the customer. Tap the amount display to switch between fiat and XMR input."
            />
          </div>
          <button
            onClick={() => {
              if (cart.length > 0) {
                // When cart exists: toggle between fiat display and crypto display
                setDisplayMode(m => m === 'fiat' ? 'crypto' : 'fiat');
              } else {
                // No cart: toggle between fiat and crypto input mode
                setPosXmrMode(!xmrMode);
                setInput('0');
              }
            }}
            className="group cursor-pointer block mx-auto"
            title={cart.length > 0 ? "Tap to toggle between fiat and crypto display" : selectedChain === 'trx' ? "Tap to toggle between fiat and USDT input" : "Tap to toggle between fiat and XMR input"}
          >
            <div className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight tabular-nums">
              {cart.length > 0
                ? displayMode === 'fiat'
                  ? `${sym}${cartTotal.toFixed(2)}`
                  : selectedChain === 'trx'
                    ? `${rates ? fiatToUsdt(cartTotal, cur, rates).toFixed(2) : cartTotal.toFixed(2)} USDT`
                    : `${rates ? fiatToXmr(cartTotal, cur, rates).toFixed(4) : cartTotal.toFixed(2)} XMR`
                : selectedChain === 'trx'
                  ? xmrMode
                    ? `${parseFloat(input).toFixed(Math.min(6, (input.split('.')[1] || '').length || 0))} USDT`
                    : `${sym}${input}`
                  : xmrMode
                    ? `${parseFloat(input).toFixed(Math.min(6, (input.split('.')[1] || '').length || 0))} XMR`
                    : `${sym}${input}`
              }
            </div>
            <p className="text-muted-foreground text-sm mt-1.5 font-mono">
              {isPro && cart.length > 0
                ? selectedChain === 'trx'
                  ? displayMode === 'fiat'
                    ? `≈ ${rates ? fiatToUsdt(cartTotal, cur, rates).toFixed(2) : '—'} USDT`
                    : `≈ ${sym}${cartTotal.toFixed(2)}`
                  : displayMode === 'fiat'
                    ? `≈ ${formatXMR(toXmr(cartTotal))}`
                    : `≈ ${sym}${cartTotal.toFixed(2)}`
                : selectedChain === 'trx'
                  ? xmrMode
                    ? `≈ ${sym}${rates ? (parseFloat(input) * (rates?.fiatRates[cur] || 1)).toFixed(2) : '—'}`
                    : `≈ ${rates ? fiatToUsdt(parseFloat(input) || 0, cur, rates).toFixed(2) : '—'} USDT`
                  : xmrMode
                    ? `≈ ${sym}${rates ? xmrToFiat(parseFloat(input) || 0, cur, rates).toFixed(2) : '—'}`
                    : `≈ ${formatXMR(toXmr(parseFloat(input) || 0))}`
              }
            </p>
            {!(isPro && cart.length > 0) && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <ArrowUpDown className="w-3 h-3" /> tap to switch
              </span>
            )}
          </button>
          {appliedDiscount && (
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                -{appliedDiscount.type === 'percent' ? `${appliedDiscount.value}%` : `${sym}${appliedDiscount.value.toFixed(2)}`}
              </Badge>
              <button onClick={() => setAppliedDiscount(null)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {keys.map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-14 sm:h-14 rounded-xl bg-card border border-border text-foreground text-xl sm:text-xl font-medium hover:bg-muted/30 hover:border-primary/30 active:scale-95 transition-all touch-manipulation"
            >
              {key === '⌫' ? <Delete className="w-5 h-5 mx-auto" /> : key}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleKey('C')} className="h-12 rounded-xl bg-muted/30 border border-border text-muted-foreground font-medium hover:bg-muted/50 transition-all">
            Clear
          </button>
          <button
            onClick={handleCharge}
            disabled={(!parseFloat(input) && cart.length === 0) || creating}
            className="h-12 rounded-xl bg-gradient-orange text-white font-bold hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {creating ? 'Creating...' : 'Charge'}
          </button>
        </div>

        {/* Pro power buttons row */}
        {/* Power buttons row - Discount/Note for all, Park/Recall for Pro */}
        <div className="grid grid-cols-4 gap-1.5">
          {isPro ? (
            <>
              <button
                onClick={() => setShowDiscountDialog(true)}
                className="h-10 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1 text-[10px] font-medium"
              >
                <Percent className="w-3 h-3" /> Discount
              </button>
              <button
                onClick={() => setShowOrderNote(true)}
                className="h-10 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1 text-[10px] font-medium"
              >
                <StickyNote className="w-3 h-3" /> Note
              </button>
              <button
                onClick={() => cart.length > 0 ? setShowParkDialog(true) : toast.info('Add items to cart first')}
                className="h-10 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1 text-[10px] font-medium"
              >
                <ParkingCircle className="w-3 h-3" /> Park
              </button>
              <button
                onClick={() => setShowParkedOrders(true)}
                className="relative h-10 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1 text-[10px] font-medium"
              >
                <Receipt className="w-3 h-3" /> Recall
                {parkedOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center">{parkedOrders.length}</span>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDiscountDialog(true)}
                className="h-10 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1 text-[10px] font-medium"
              >
                <Percent className="w-3 h-3" /> Discount
              </button>
              <button
                onClick={() => setShowOrderNote(true)}
                className="h-10 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1 text-[10px] font-medium"
              >
                <StickyNote className="w-3 h-3" /> Note
              </button>
              <div className="h-10 rounded-lg border border-border bg-card opacity-50 flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground">
                <ParkingCircle className="w-3 h-3" />
                Park
                <Lock className="w-2.5 h-2.5 text-yellow-500" />
              </div>
              <div className="h-10 rounded-lg border border-border bg-card opacity-50 flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Receipt className="w-3 h-3" />
                Recall
                <Lock className="w-2.5 h-2.5 text-yellow-500" />
              </div>
            </>
          )}
        </div>

        {/* Recent sales row */}
        {recentSales.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Recent Today</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {recentSales.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s.amount.toFixed(2))}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg border border-border bg-card text-[10px] hover:border-primary/30 active:scale-95 transition-all"
                >
                  <span className="text-foreground">{s.desc}</span>
                  <span className="text-primary font-mono ml-1">{sym}{s.amount.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile quick buttons */}
        <div className="lg:hidden">
          {quickButtons.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Quick Items</span>
                <span className="text-[10px] text-muted-foreground">({quickButtons.length}/{isPro ? '∞' : MAX_FREE_ITEMS})</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {quickButtons.slice(0, 8).map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => handleQuickButton(btn)}
                    className="shrink-0 px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/30 active:scale-95 transition-all"
                  >
                    <span className="text-foreground font-medium">{btn.label}</span>
                    <span className="text-primary font-mono ml-1">{formatPrice(getDisplayPrice(btn.price), selectedChain === 'trx')}</span>
                  </button>
                ))}
                {!hasReachedItemLimit && (
                  <button
                    onClick={() => setShowAddButton(true)}
                    className="shrink-0 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/30 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* ═══ RIGHT: Cart ═══ */}
      {(
        <div className="flex flex-col w-72 pt-2 space-y-3 max-h-[80vh]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Cart</span>
              {cart.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/20">{cart.reduce((s, i) => s + i.qty, 0)} items</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={() => { setCart([]); setAppliedDiscount(null); }} className="text-[10px] text-muted-foreground hover:text-destructive">
                Clear All
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Tap items to add to cart</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate">+ {item.modifiers.join(', ')}</p>
                    )}
                    <p className="text-[10px] text-primary font-mono">{formatPrice((getDisplayPrice(item.originalFiatPrice || item.price) + (item.modifierTotal || 0)) * item.qty, selectedChain === 'trx')}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono w-6 text-center text-foreground">{item.qty}</span>
                    <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {orderNote && (
            <div className="p-2 rounded-lg bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground"><StickyNote className="w-3 h-3 inline mr-1" />{orderNote}</p>
            </div>
          )}

          {cart.length > 0 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{formatPrice(cartSubtotal, selectedChain === 'trx')}</span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between text-xs text-success">
                  <span>Discount</span>
                  <span className="font-mono">-{sym}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground">
                <span>Total</span>
                <span className="font-mono text-primary">{formatPrice(cartTotal, selectedChain === 'trx')}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono text-right">
                {selectedChain === 'trx' ? '' : `≈ ${formatXMR(toXmr(cartTotal))}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}

      {/* Add Quick Button */}
      <Dialog open={showAddButton} onOpenChange={setShowAddButton}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Add Quick Item</DialogTitle></DialogHeader>
          {!isPro && (
            <p className="text-xs text-muted-foreground">
              FREE plan: Maximum {MAX_FREE_ITEMS} items allowed. Current: {quickButtons.length}/{MAX_FREE_ITEMS}
            </p>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-foreground font-medium">Item Name</label>
              <Input value={newBtnLabel} onChange={e => setNewBtnLabel(e.target.value)} className="bg-background border-border" placeholder="e.g. Coffee" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-foreground font-medium">Price ({cur})</label>
                <Input type="number" value={newBtnPrice} onChange={e => setNewBtnPrice(e.target.value)} className="bg-background border-border font-mono" placeholder="4.50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground font-medium">Stock (optional)</label>
                <Input type="number" value={newBtnStock} onChange={e => setNewBtnStock(e.target.value)} className="bg-background border-border font-mono" placeholder="∞" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-foreground font-medium">Category</label>
              <Select value={newBtnCategory} onValueChange={setNewBtnCategory}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {defaultCategories.filter(c => c !== 'All').map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  {isPro && categories.filter(c => !defaultCategories.includes(c)).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddQuickButton} className="w-full bg-gradient-orange hover:opacity-90" disabled={!newBtnLabel || !newBtnPrice || hasReachedItemLimit}>
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modifiers Dialog */}
      <Dialog open={!!showModifiers} onOpenChange={() => setShowModifiers(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {showModifiers?.item.label} — Customize
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {modifiers.map(mod => (
              <div key={mod.id} className="space-y-1.5">
                <label className="text-xs text-foreground font-semibold">{mod.name}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {mod.options.map(opt => {
                    const selected = selectedModifiers.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setSelectedModifiers(prev =>
                          selected ? prev.filter(m => m !== opt.label) : [...prev, opt.label]
                        )}
                        className={`p-2 rounded-lg border text-xs transition-all ${
                          selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:border-primary/30'
                        }`}
                      >
                        {opt.label}
                        {opt.priceAdj > 0 && <span className="text-muted-foreground ml-1">+{sym}{opt.priceAdj.toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <Button
              onClick={() => {
                if (showModifiers) {
                  addToCart(showModifiers.item, selectedModifiers);
                  setShowModifiers(null);
                }
              }}
              className="w-full bg-gradient-orange hover:opacity-90"
            >
              Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Note Dialog */}
      <Dialog open={showOrderNote} onOpenChange={setShowOrderNote}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Order Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <textarea
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              className="w-full h-24 rounded-lg bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
              placeholder="Special instructions, customer name, table number..."
            />
            <Button onClick={() => { setShowOrderNote(false); toast.success('Note saved'); }} className="w-full bg-gradient-orange hover:opacity-90">
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Park Order Dialog */}
      <Dialog open={showParkDialog} onOpenChange={setShowParkDialog}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Park Order</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Save this order for later. Give it a name (e.g. "Table 5").</p>
          <div className="space-y-3">
            <Input
              value={parkLabel}
              onChange={e => setParkLabel(e.target.value)}
              className="bg-background border-border"
              placeholder="Table 5 / John's order"
            />
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-foreground font-medium">{cart.length} items · {formatPrice(cartTotal, selectedChain === 'trx')}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{cart.map(i => `${i.qty}x ${i.name} (${formatPrice((i.price + (i.modifierTotal || 0)) * i.qty, selectedChain === 'trx')})`).join(', ')}</p>
            </div>
            <Button onClick={handleParkOrder} className="w-full bg-gradient-orange hover:opacity-90">
              <ParkingCircle className="w-4 h-4 mr-2" /> Park Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recall Parked Orders */}
      <Dialog open={showParkedOrders} onOpenChange={setShowParkedOrders}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">Parked Orders</DialogTitle></DialogHeader>
          {parkedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No parked orders</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {parkedOrders.map(order => (
                <div key={order.id} className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {order.items.length} items · Parked {new Date(order.parkedAt).toLocaleTimeString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary font-mono">{sym}{order.total.toFixed(2)}</span>
                      <Button size="sm" onClick={() => handleRecallOrder(order)} className="bg-gradient-orange hover:opacity-90 h-8 text-xs">
                        Recall
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Apply Discount</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(['percent', 'fixed'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setDiscountType(type)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    discountType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground'
                  }`}
                >
                  {type === 'percent' ? '% Percentage' : `${sym} Fixed Amount`}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              className="bg-background border-border font-mono"
              placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 5.00'}
            />
            <div className="grid grid-cols-3 gap-1.5">
              {(discountType === 'percent' ? [10, 15, 20] : [2, 5, 10]).map(v => (
                <button
                  key={v}
                  onClick={() => setDiscountValue(v.toString())}
                  className="h-10 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-primary/30 transition-all"
                >
                  {discountType === 'percent' ? `${v}%` : `${sym}${v}`}
                </button>
              ))}
            </div>
            <Button onClick={handleApplyDiscount} className="w-full bg-gradient-orange hover:opacity-90" disabled={!discountValue}>
              Apply Discount
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Manager Dialog */}
      <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Manage Categories</DialogTitle></DialogHeader>
          {!isPro && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-sm text-foreground font-medium">Editing or adding Categories is available in the Pro Plan</p>
              <p className="text-xs text-warning mt-1">Upgrade to Pro to create custom categories and manage your inventory more efficiently.</p>
            </div>
          )}
          <div className="space-y-4">
            {isPro && (
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="bg-background border-border text-sm flex-1"
                  placeholder="New category name..."
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory} size="sm" className="bg-gradient-orange hover:opacity-90" disabled={!newCategoryName.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Existing categories */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {defaultCategories.filter(c => c !== 'All').map(cat => {
                const itemCount = quickButtons.filter(b => b.category === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">{cat}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">({itemCount} items)</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">Default</Badge>
                    </div>
                  </div>
                );
              })}
              {isPro && categories.filter(c => !defaultCategories.includes(c)).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No custom categories yet</p>
              )}
              {isPro && categories.filter(c => !defaultCategories.includes(c)).map(cat => {
                const itemCount = quickButtons.filter(b => b.category === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-sm text-foreground truncate">{cat}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">({itemCount} items)</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2"
                      title="Delete category (requires admin password)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Password Confirmation Dialog */}
      <Dialog open={!!(pendingDeleteCategory || pendingDeleteItemId)} onOpenChange={(open) => {
        if (!open) { setPendingDeleteCategory(null); setPendingDeleteItemId(null); setAdminPasswordInput(''); }
      }}>
        <DialogContent className="bg-card border-border max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" />
              Admin Password Required
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {pendingDeleteCategory
              ? `Delete category "${pendingDeleteCategory}"? Items will be moved to another category.`
              : 'Delete this item? This action cannot be undone.'}
          </p>
          <div className="space-y-3">
            <Input
              type="password"
              value={adminPasswordInput}
              onChange={e => setAdminPasswordInput(e.target.value)}
              className="bg-background border-border"
              placeholder="Enter admin password"
              onKeyDown={e => e.key === 'Enter' && confirmAdminDelete()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPendingDeleteCategory(null); setPendingDeleteItemId(null); setAdminPasswordInput(''); }} className="flex-1 border-border">
                Cancel
              </Button>
              <Button onClick={confirmAdminDelete} variant="destructive" className="flex-1" disabled={!adminPasswordInput}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
