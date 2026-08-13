import React, { useState } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, AlertCircle, Receipt, QrCode } from 'lucide-react';
import { Product } from '../App';

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
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter products based on search query (Name and SKU only)
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setErrorMsg(null);
    setSuccessInvoice(null);

    if (product.current_stock <= 0) {
      setErrorMsg(`Product "${product.name}" is completely out of stock.`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity_sold;
      if (currentQty >= product.current_stock) {
        setErrorMsg(`Cannot add more. Available stock for "${product.name}" is capped at ${product.current_stock} units.`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity_sold += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product, quantity_sold: 1 }]);
    }
  };

  const handleBarcodeScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInvoice(null);

    const code = scanQuery.trim();
    if (!code) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/products/scan/${code}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Barcode '${code}' not found in the catalog.`);
      }

      // Add scanned product to cart
      addToCart(data);
      setScanQuery(''); // Clear the input field for next scan
    } catch (err: any) {
      console.error('Scan lookup failed:', err);
      setErrorMsg(err.message || 'Scanned barcode not registered.');
    } finally {
      setLoading(false);
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
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity_sold * parseFloat(item.product.price)), 0);
  const cartTax = cartSubtotal * 0.08; // 8% sales tax estimate
  const cartTotal = cartSubtotal + cartTax;

  const handleCheckout = async () => {
    setErrorMsg(null);
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

      const data = await response.json();

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
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'Server error occurred during checkout.');
    } finally {
      setLoading(false);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Products Search & Selection Grid (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Barcode Scanner Box */}
            <form onSubmit={handleBarcodeScanSubmit} className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <QrCode className="w-5 h-5 text-violet-400 animate-pulse" />
              </span>
              <input
                type="text"
                placeholder="Scan Barcode / SKU (Press Enter)..."
                value={scanQuery}
                onChange={(e) => setScanQuery(e.target.value)}
                className="w-full bg-[#151D30] border border-violet-500/40 focus:border-violet-500 text-slate-100 pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-colors shadow-inner text-sm font-mono placeholder:text-slate-500"
              />
            </form>

            {/* Keyword Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <Search className="w-5 h-5" />
              </span>
              <input
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
                const isOutOfStock = p.current_stock <= 0;
                const isLowStock = p.current_stock <= p.min_threshold;
                const cartQty = cart.find(item => item.product.id === p.id)?.quantity_sold || 0;
                const isCartCapped = cartQty >= p.current_stock;

                return (
                  <div 
                    key={p.id} 
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] hover:bg-slate-800/20 active:scale-[0.99] group ${
                      isOutOfStock ? 'opacity-55 cursor-not-allowed border-slate-800/80' : 
                      isLowStock ? 'border-orange-500/30' : 'border-slate-700/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Supplier: {p.supplier_name}</span>
                          <h4 className="font-bold text-white group-hover:text-violet-400 transition-colors text-sm line-clamp-1">{p.name}</h4>
                        </div>
                        {/* Live Stock Badge */}
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border shrink-0 ${
                          isOutOfStock ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                          isLowStock ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {isOutOfStock ? 'Out of stock' : `${p.current_stock} left`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 font-bold">{p.sku}</span>
                        {cartQty > 0 && (
                          <span className="text-violet-400 font-extrabold bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/25">
                            {cartQty} in cart
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
                      <span className="text-lg font-extrabold text-white font-mono">
                        ${parseFloat(p.price).toFixed(2)}
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
                          addToCart(p);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
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
                  <div key={item.product.id} className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-3">
                      <h5 className="font-bold text-white text-xs truncate">{item.product.name}</h5>
                      <span className="text-[10px] text-slate-400 block font-mono">{item.product.sku}</span>
                      <span className="text-xs font-semibold text-slate-300 font-mono">
                        ${parseFloat(item.product.price).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold text-white font-mono w-4 text-center">
                        {item.quantity_sold}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      
                      <button 
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-md transition-colors ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
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
      {successInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel glow-card-violet rounded-2xl w-full max-w-md p-6 relative animate-scaleUp">
            
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                <Receipt className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Invoice Receipt Issued</h3>
                <p className="text-xs text-emerald-400 font-semibold font-mono mt-0.5">Transaction #TX-100{successInvoice.id} COMPLETED</p>
                <p className="text-[10px] text-slate-500 mt-1">{new Date(successInvoice.created_at).toLocaleString()}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-500/10 border border-violet-500/25 text-violet-400 rounded-md inline-block mt-2">
                  Paid via {successInvoice.payment_method}
                </span>
              </div>
            </div>

            <div className="border-t border-b border-slate-700/60 py-4 my-4 max-h-[220px] overflow-y-auto pr-1">
              <div className="space-y-3">
                {successInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{item.name}</span>
                      <span className="text-[10px] text-slate-500 block">Qty: {item.quantity_sold} @ ${parseFloat(item.unit_price.toString()).toFixed(2)}</span>
                    </div>
                    <span className="font-mono text-slate-300 font-semibold">
                      ${(item.quantity_sold * parseFloat(item.unit_price.toString())).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between font-mono text-sm font-extrabold text-white mb-6">
              <span>Amount Paid</span>
              <span className="text-emerald-400 text-lg">${parseFloat(successInvoice.total_amount).toFixed(2)}</span>
            </div>

            <button
              onClick={() => setSuccessInvoice(null)}
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
            >
              Print & Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
