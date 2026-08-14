import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, AlertCircle, Receipt, QrCode, Camera, Printer, Download } from 'lucide-react';
import { Product } from '../App';
import CameraScannerModal from './CameraScannerModal';
import { jsPDF } from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface PosBillingProps {
  products: Product[];
  refreshData: () => Promise<void>;
}

interface CartItem {
  product: Product;
  quantity_sold: number;
}

interface Invoice {
  id: number;
  total_amount: string;
  payment_method: string;
  status: string;
  created_at: string;
  items: Array<{
    product_id: number;
    name: string;
    quantity_sold: number;
    unit_price: number;
  }>;
}

export default function PosBilling({ products, refreshData }: PosBillingProps) {
  const [scanQuery, setScanQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE'>('CASH');
  
  // Camera & Scan states
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // UI states
  const [loading, setLoading] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper for safe JSON parsing to prevent "unexpected character" crashes
  const safeParseJson = async (res: Response) => {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch (err) {
        console.error('JSON parsing failed:', err);
      }
    }
    const text = await res.text();
    return { error: text || `HTTP Error ${res.status}: ${res.statusText}` };
  };

  const downloadReceiptPdf = (invoice: Invoice) => {
    const element = document.getElementById('receipt-print-area');
    if (!element) return;

    // Estimate document height based on items list
    const calculatedHeight = 135 + invoice.items.length * 10;

    const doc = new jsPDF({
      unit: 'mm',
      format: [80, calculatedHeight],
      orientation: 'portrait'
    });

    doc.html(element, {
      callback: function (pdf) {
        pdf.save(`Receipt-INV-TX-100${invoice.id}.pdf`);
      },
      x: 0,
      y: 0,
      width: 80,
      windowWidth: 340 // Fits text layout correctly into the 80mm page width
    });
  };

  // Focus scan box on mount and bind click refocus listener
  useEffect(() => {
    barcodeInputRef.current?.focus();

    const handleGlobalClick = () => {
      const activeEl = document.activeElement;
      const searchInput = document.getElementById('search_query');
      if (activeEl !== searchInput && activeEl !== barcodeInputRef.current) {
        barcodeInputRef.current?.focus();
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Filter products based on search query (Name and SKU only)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Lightning-fast O(1) local cache map of products by SKU/barcode (UPPERCASE)
  const productsByBarcode = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.sku) {
        map.set(p.sku.trim().toUpperCase(), p);
      }
    });
    return map;
  }, [products]);

  // Play synthesized beep using browser's AudioContext
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep (A5)
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); // Keep volume at 5%

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1); // Beep for 100ms
    } catch (e) {
      console.warn('Web Audio Context not supported or blocked by browser settings:', e);
    }
  };

  const addToCart = (product: Product) => {
    setErrorMsg(null);
    setSuccessInvoice(null);

    if (product.current_stock <= 0) {
      setErrorMsg(`Product "${product.name}" is completely out of stock.`);
      barcodeInputRef.current?.focus();
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity_sold;
      if (currentQty >= product.current_stock) {
        setErrorMsg(`Cannot add more. Available stock for "${product.name}" is capped at ${product.current_stock} units.`);
        barcodeInputRef.current?.focus();
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity_sold += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product, quantity_sold: 1 }]);
    }

    // Auto-focus after adding manually
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInvoice(null);

    const code = scanQuery.trim();
    if (!code) return;

    // Zero-latency check from memory cache first
    const cachedProduct = productsByBarcode.get(code.toUpperCase());
    if (cachedProduct) {
      if (cachedProduct.current_stock <= 0) {
        setErrorMsg(`Product '${cachedProduct.name}' is out of stock.`);
        setScanQuery('');
        barcodeInputRef.current?.focus();
        return;
      }
      playBeep();
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 300);
      addToCart(cachedProduct);
      setScanQuery('');
      // Silent sync update in the background
      refreshData();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/products/scan/${code}`);
      const data = await safeParseJson(response);

      if (!response.ok) {
        throw new Error(data.error || `Barcode '${code}' not found in the catalog.`);
      }

      // Play beep feedback
      playBeep();

      // Trigger green outline flash feedback
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 300);

      // Add scanned product to cart
      addToCart(data);
      setScanQuery(''); // Clear the input field for next scan
    } catch (err: any) {
      console.error('Scan lookup failed:', err);
      setErrorMsg(err.message || 'Scanned barcode not registered.');
      setScanQuery(''); // Clear field so they can try again
    } finally {
      setLoading(false);
      // Ensure cursor returns to scan input
      barcodeInputRef.current?.focus();
    }
  };

  const handleCameraScanSuccess = async (decodedText: string) => {
    setCameraModalOpen(false);
    const code = decodedText.trim();
    try {
      playBeep();
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 300);

      // Zero-latency check from memory cache first
      const cachedProduct = productsByBarcode.get(code.toUpperCase());
      if (cachedProduct) {
        if (cachedProduct.current_stock <= 0) {
          setErrorMsg(`Product '${cachedProduct.name}' is out of stock.`);
          barcodeInputRef.current?.focus();
          return;
        }
        addToCart(cachedProduct);
        refreshData();
        return;
      }

      setLoading(true);
      const response = await fetch(`${API_URL}/api/products/scan/${code}`);
      const data = await safeParseJson(response);

      if (!response.ok) {
        throw new Error(data.error || `Barcode '${decodedText}' not found in the catalog.`);
      }

      addToCart(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Scanned barcode not registered.');
    } finally {
      setLoading(false);
      barcodeInputRef.current?.focus();
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setErrorMsg(null);
    const index = cart.findIndex(item => item.product.id === productId);
    if (index === -1) return;

    const item = cart[index];
    const newQty = item.quantity_sold + delta;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > item.product.current_stock) {
      setErrorMsg(`Cannot increase quantity. Max available stock for "${item.product.name}" is ${item.product.current_stock}.`);
      return;
    }

    const updatedCart = [...cart];
    updatedCart[index].quantity_sold = newQty;
    setCart(updatedCart);
    barcodeInputRef.current?.focus();
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
    barcodeInputRef.current?.focus();
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity_sold * parseFloat(item.product.price)), 0);
  const cartTax = cartSubtotal * 0.08; // 8% sales tax estimate
  const cartTotal = cartSubtotal + cartTax;

  const handleCheckout = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSuccessInvoice(null);

    if (cart.length === 0) {
      setErrorMsg('Your shopping cart is empty.');
      return;
    }

    setLoading(true);

    const itemsPayload = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity_sold
    }));

    try {
      const response = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: itemsPayload,
          payment_method: paymentMethod
        })
      });

      const data = await safeParseJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Checkout transaction failed.');
      }

      // Success
      setSuccessInvoice({
        id: data.transaction.id,
        total_amount: data.transaction.total_amount,
        payment_method: data.transaction.payment_method,
        status: data.transaction.status,
        created_at: data.transaction.created_at,
        items: data.items
      });

      // Clear Cart
      setCart([]);

      // Trigger global state refresh immediately
      await refreshData();

      // Show success toast
      setSuccessMsg("Checkout Completed Successfully!");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'Server error occurred during checkout.');
    } finally {
      setLoading(false);
      barcodeInputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-violet-400" />
          Cashier POS Billing Terminal
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Scan barcodes or search products to bill, verify real-time stock levels, and checkout.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-900/30 border border-emerald-500/50 rounded-xl text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Products Search & Selection Grid (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Barcode Scanner Box */}
            <form onSubmit={handleBarcodeScanSubmit} className="relative flex items-center">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                <QrCode className={`w-5 h-5 transition-colors ${scanSuccess ? 'text-emerald-400' : 'text-violet-400 animate-pulse'}`} />
              </span>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / SKU (Press Enter)..."
                value={scanQuery}
                onChange={(e) => setScanQuery(e.target.value)}
                className={`w-full bg-[#151D30] border text-slate-100 pl-12 pr-12 py-3.5 rounded-2xl outline-none transition-all shadow-inner text-sm font-mono placeholder:text-slate-500 ${
                  scanSuccess 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/20' 
                    : 'border-violet-500/40 focus:border-violet-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setCameraModalOpen(true)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-violet-400 transition-colors"
                title="Scan with webcam camera"
              >
                <Camera className="w-5 h-5" />
              </button>
            </form>

            {/* Keyword Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <Search className="w-5 h-5" />
              </span>
              <input
                id="search_query"
                type="text"
                placeholder="Search products by SKU or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#151D30] border border-slate-700/80 focus:border-violet-500 text-slate-100 pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-colors shadow-inner text-sm placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Products List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 bg-[#151D30]/35 border border-slate-800 rounded-2xl">
                No matching products found.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const cartQty = cart.find(item => item.product.id === p.id)?.quantity_sold || 0;
                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    cartQty={cartQty}
                    onAdd={addToCart}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Cashier Invoice Cart Panel (Col Span 1) */}
        <div className="glass-panel glow-card-violet rounded-2xl p-6 flex flex-col justify-between min-h-[500px]">
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-800/60 pb-3">
              <ShoppingCart className="w-5 h-5 text-violet-400" />
              Customer Cart
            </h3>

            {/* Cart Items list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm space-y-2">
                  <ShoppingCart className="w-12 h-12 text-slate-600 stroke-[1.5]" />
                  <span>Scan or select items to bill</span>
                </div>
              ) : (
                cart.map((item) => (
                  <CartItemRow
                    key={item.product.id}
                    item={item}
                    onUpdateQty={updateQuantity}
                    onRemove={removeFromCart}
                  />
                ))
              )}
            </div>
          </div>

          {/* Payment Method & Checkout */}
          <div className="mt-4 pt-4 border-t border-slate-700/60 space-y-4">
            
            {/* Payment Method Selector */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-3 gap-2 bg-[#0B0F19] p-1 rounded-xl border border-slate-800">
                  {(['CASH', 'CARD', 'MOBILE'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        paymentMethod === method
                          ? 'bg-violet-600 text-white shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            )}


            <div className="space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax (8%)</span>
                <span>${cartTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800 font-sans">
                <span>Grand Total</span>
                <span className="font-mono text-emerald-400">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Checkout Sale
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* Invoice Receipt Modal Success Notification */}
      {successInvoice && (() => {
        const grandTotal = parseFloat(successInvoice.total_amount);
        const subtotal = grandTotal / 1.05;
        const gst = grandTotal - subtotal;

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Dynamic Print Styles for thermal 80mm printing */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                  background: none !important;
                  box-shadow: none !important;
                }
                #receipt-print-area, #receipt-print-area * {
                  visibility: visible;
                }
                #receipt-print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 80mm !important;
                  margin: 0 !important;
                  padding: 4mm !important;
                  background: white !important;
                  color: black !important;
                  font-family: 'Courier New', Courier, monospace !important;
                  border: none !important;
                  box-shadow: none !important;
                }
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
              }
            `}</style>
            
            <div className="glass-panel glow-card-violet rounded-2xl w-full max-w-md p-6 relative flex flex-col justify-between max-h-[85vh] overflow-hidden my-auto animate-scaleUp">
              
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-2 shrink-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-400" />
                  Grocery Receipt Issued
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadReceiptPdf(successInvoice)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-900/20"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Receipt
                  </button>
                </div>
              </div>

              {/* Thermal Paper Receipt Layout Preview Container */}
              <div 
                id="receipt-print-area"
                className="bg-white text-black p-6 rounded-xl font-mono text-[11px] leading-relaxed w-full max-w-sm mx-auto shadow-inner border border-slate-200 overflow-y-auto flex-1 my-3 scrollbar-thin"
              >
                {/* Header */}
                <div className="text-center space-y-0.5 mb-4">
                  <h4 className="font-bold text-sm tracking-tight text-black">SARAWANAS SUPERMARKET</h4>
                  <p className="text-[9px] text-slate-600">123, Main Bazaar, Kovilpatti</p>
                  <p className="text-[9px] text-slate-600">GSTIN: 33AACCS2026A1Z3</p>
                  <p className="text-[9px] text-slate-600">Phone: +91 98765 43210</p>
                  <p className="text-slate-400 text-[9px] mt-2">----------------------------------------</p>
                </div>

                {/* Metadata */}
                <div className="space-y-1 mb-3 text-slate-700 text-[10px]">
                  <div className="flex justify-between">
                    <span>INV #: TX-100{successInvoice.id}</span>
                    <span>Date: {new Date(successInvoice.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>Time: {new Date(successInvoice.created_at).toLocaleTimeString()}</div>
                  <div>Cashier: sarawanas</div>
                  <div>Payment Method: {successInvoice.payment_method}</div>
                  <p className="text-slate-400 text-[9px] mt-1">----------------------------------------</p>
                </div>

                {/* Table Header */}
                <div className="flex justify-between font-bold text-black border-b border-slate-300 pb-1 mb-2 text-[10px]">
                  <span>Item description</span>
                  <span>Total</span>
                </div>

                {/* Table Items */}
                <div className="space-y-2 mb-4 text-[10px] text-slate-800">
                  {successInvoice.items.map((item, idx) => (
                    <div key={idx}>
                      <div className="font-semibold text-black truncate max-w-[280px]">{item.name}</div>
                      <div className="flex justify-between text-slate-600 text-[9px] mt-0.5">
                        <span>{item.quantity_sold} x ${parseFloat(item.unit_price.toString()).toFixed(2)}</span>
                        <span className="font-mono text-black font-semibold">${(item.quantity_sold * parseFloat(item.unit_price.toString())).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-slate-400 text-[9px] pt-1">----------------------------------------</p>
                </div>

                {/* Totals Section */}
                <div className="space-y-1 text-slate-700 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5% Incl.)</span>
                    <span>${gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-black font-extrabold border-t border-slate-300 pt-1.5 text-xs">
                    <span>GRAND TOTAL</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer Notes */}
                <div className="text-center space-y-1 mt-6 text-slate-500 text-[9px]">
                  <p className="text-slate-400 text-[9px]">----------------------------------------</p>
                  <p className="font-medium text-slate-700 mt-2">Thank you for shopping with us!</p>
                  <p className="font-medium text-slate-700">Visit again.</p>
                  {/* Mock Barcode */}
                  <div className="text-[16px] text-black font-sans tracking-[3px] select-none mt-4 font-bold">
                    ||||| |||| || | |||| ||
                  </div>
                  <span className="text-[8px] tracking-[1px] block mt-0.5 text-slate-400">TX-100{successInvoice.id}</span>
                </div>
              </div>

              {/* Reset POS and start next sale action */}
              <button
                onClick={() => {
                  setSuccessInvoice(null);
                  barcodeInputRef.current?.focus();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] text-sm mt-4 flex items-center justify-center gap-2 shrink-0"
              >
                <CheckCircle2 className="w-5 h-5" />
                Start New Sale
              </button>

            </div>
          </div>
        );
      })()}

      {/* Reusable Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onScanSuccess={handleCameraScanSuccess}
        onScanError={(msg) => setErrorMsg(msg)}
      />
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  cartQty: number;
  onAdd: (product: Product) => void;
}

const ProductCard = React.memo(({ product, cartQty, onAdd }: ProductCardProps) => {
  const isOutOfStock = product.current_stock <= 0;
  const isLowStock = product.current_stock <= product.min_threshold;
  const isCartCapped = cartQty >= product.current_stock;

  return (
    <div 
      onClick={() => !isOutOfStock && onAdd(product)}
      className={`glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] hover:bg-slate-800/20 active:scale-[0.99] group ${
        isOutOfStock ? 'opacity-55 cursor-not-allowed border-slate-800/80' : 
        isLowStock ? 'border-orange-500/30' : 'border-slate-700/50'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Supplier: {product.supplier_name}</span>
            <h4 className="font-bold text-white group-hover:text-violet-400 transition-colors text-sm line-clamp-1">{product.name}</h4>
          </div>
          {/* Live Stock Badge */}
          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border shrink-0 ${
            isOutOfStock ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            isLowStock ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
            'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            {isOutOfStock ? 'Out of stock' : `${product.current_stock} left`}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 font-bold">{product.sku}</span>
          {cartQty > 0 && (
            <span className="text-violet-400 font-extrabold bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/25">
              {cartQty} in cart
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
        <span className="text-lg font-extrabold text-white font-mono">
          ${parseFloat(product.price).toFixed(2)}
        </span>
        <button 
          disabled={isOutOfStock || isCartCapped}
          className={`p-2 rounded-xl transition-all ${
            isOutOfStock ? 'bg-slate-800 text-slate-600' :
            isCartCapped ? 'bg-slate-800 text-slate-500' :
            'bg-violet-600 hover:bg-violet-500 text-white shadow-md'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(product);
          }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

interface CartItemRowProps {
  item: CartItem;
  onUpdateQty: (productId: number, diff: number) => void;
  onRemove: (productId: number) => void;
}

const CartItemRow = React.memo(({ item, onUpdateQty, onRemove }: CartItemRowProps) => {
  return (
    <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl flex items-center justify-between">
      <div className="min-w-0 flex-1 pr-3">
        <h5 className="font-bold text-white text-xs truncate">{item.product.name}</h5>
        <span className="text-[10px] text-slate-400 block font-mono">{item.product.sku}</span>
        <span className="text-xs font-semibold text-slate-300 font-mono">
          ${parseFloat(item.product.price).toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <button 
          onClick={() => onUpdateQty(item.product.id, -1)}
          className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold text-white font-mono w-4 text-center">
          {item.quantity_sold}
        </span>
        <button 
          onClick={() => onUpdateQty(item.product.id, 1)}
          className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        
        <button 
          onClick={() => onRemove(item.product.id)}
          className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-md transition-colors ml-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
