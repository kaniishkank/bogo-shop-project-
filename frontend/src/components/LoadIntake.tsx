import React, { useEffect, useState, useRef } from 'react';
import { Truck, Search, PlusCircle, ArrowUpRight, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { Product } from '../App';
import CameraScannerModal from './CameraScannerModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface LoadIntakeProps {
  products: Product[];
  refreshData: () => Promise<void>;
}

interface LoadLog {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity_added: number;
  supplier_name: string;
  created_at: string;
}

export default function LoadIntake({ products, refreshData }: LoadIntakeProps) {
  const [loads, setLoads] = useState<LoadLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [minThreshold, setMinThreshold] = useState('5');

  // Camera & Scan states
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // Autocomplete UI state
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExisting, setIsExisting] = useState(false);

  // Status indicators
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Input refs for autofocus logic
  const productNameInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/inventory/loads`);
      if (response.ok) {
        const data = await response.json();
        setLoads(data);
      }
    } catch (err) {
      console.error('Error fetching loads history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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

  // Filter matches based on text input
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(productName.toLowerCase())
  );

  const handleBarcodeChange = (val: string) => {
    setBarcode(val);
    const exactMatch = products.find(p => p.sku.toLowerCase() === val.trim().toLowerCase());
    if (exactMatch) {
      setProductName(exactMatch.name);
      setUnitPrice(exactMatch.price);
      setCostPrice(exactMatch.cost_price);
      setMinThreshold(exactMatch.min_threshold.toString());
      setSupplierName(exactMatch.supplier_name);
      setIsExisting(true);
      setErrorMsg(null);
    } else {
      setIsExisting(false);
    }
  };

  const handleSelectProduct = (selected: Product) => {
    setBarcode(selected.sku);
    setProductName(selected.name);
    setUnitPrice(selected.price);
    setCostPrice(selected.cost_price);
    setMinThreshold(selected.min_threshold.toString());
    setSupplierName(selected.supplier_name);
    setIsExisting(true);
    setShowDropdown(false);
    setErrorMsg(null);
  };

  const handleNameChange = (val: string) => {
    setProductName(val);
    setShowDropdown(true);

    // Check if typed name exactly matches an existing product (case-insensitive)
    const exactMatch = products.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
    if (exactMatch) {
      setBarcode(exactMatch.sku);
      setUnitPrice(exactMatch.price);
      setCostPrice(exactMatch.cost_price);
      setMinThreshold(exactMatch.min_threshold.toString());
      setSupplierName(exactMatch.supplier_name);
      setIsExisting(true);
    } else {
      setIsExisting(false);
    }
  };

  const handleCameraScanSuccess = async (decodedText: string) => {
    setCameraModalOpen(false);
    playBeep();

    setBarcode(decodedText);
    
    const exactMatch = products.find(p => p.sku.toLowerCase() === decodedText.trim().toLowerCase());
    if (exactMatch) {
      setProductName(exactMatch.name);
      setUnitPrice(exactMatch.price);
      setCostPrice(exactMatch.cost_price);
      setMinThreshold(exactMatch.min_threshold.toString());
      setSupplierName(exactMatch.supplier_name);
      setIsExisting(true);
      setErrorMsg(null);

      // Autofocus quantity input box for existing items
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 100);
    } else {
      setProductName('');
      setUnitPrice('');
      setCostPrice('');
      setMinThreshold('5');
      setIsExisting(false);

      // Autofocus product name input box for new registrations
      setTimeout(() => {
        productNameInputRef.current?.focus();
      }, 100);
    }
  };

  const handleResetForm = () => {
    setBarcode('');
    setProductName('');
    setQuantity('');
    setSupplierName('');
    setUnitPrice('');
    setCostPrice('');
    setMinThreshold('5');
    setIsExisting(false);
    setShowDropdown(false);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!barcode.trim() || !productName.trim() || !quantity || !supplierName.trim()) {
      setErrorMsg('Please fill in Barcode, Product Name, Quantity, and Supplier Name.');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Quantity must be a positive integer.');
      return;
    }

    const priceFloat = parseFloat(unitPrice);
    const costPriceFloat = parseFloat(costPrice);
    const thresholdInt = parseInt(minThreshold);

    if (!isExisting) {
      if (isNaN(priceFloat) || priceFloat < 0) {
        setErrorMsg('New products require a valid unit price.');
        return;
      }
      if (isNaN(costPriceFloat) || costPriceFloat < 0) {
        setErrorMsg('New products require a valid unit cost.');
        return;
      }
      if (isNaN(thresholdInt) || thresholdInt < 0) {
        setErrorMsg('New products require a valid min threshold.');
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: barcode.trim(),
          name: productName.trim(),
          current_stock: qty,
          supplier_name: supplierName.trim(),
          price: isExisting ? undefined : priceFloat,
          cost_price: isExisting ? undefined : costPriceFloat,
          min_threshold: isExisting ? undefined : thresholdInt
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit product intake');
      }

      setSuccessMsg(
        isExisting 
          ? `Stock incremented! Added ${qty} units to existing SKU "${data.name}"`
          : `New SKU cataloged successfully! Registered "${data.name}" with initial stock of ${qty} units.`
      );

      // Clean up fields (except supplier for convenience)
      setBarcode('');
      setProductName('');
      setQuantity('');
      setUnitPrice('');
      setCostPrice('');
      setMinThreshold('5');
      setIsExisting(false);
      
      // Update global React products state
      await refreshData();
      // Update local history feed
      await fetchHistory();
    } catch (err: any) {
      console.error('Shipment load failed:', err);
      setErrorMsg(err.message || 'Server connection issue logging intake cargo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <Truck className="w-8 h-8 text-blue-400" />
          Cargo Shipment Load Intake
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Add stock to existing products or define new SKU parameters in a single unified entry flow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Unified Load Intake Form */}
        <div className="glass-panel glow-card-blue rounded-2xl p-6 h-fit lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-400" />
              Cargo Intake Form
            </h3>
            <button 
              type="button" 
              onClick={handleResetForm}
              className="text-xs text-slate-500 hover:text-slate-300 font-semibold"
            >
              Clear Form
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Barcode/SKU Input */}
            <div>
              <label htmlFor="barcode" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Barcode / SKU *</label>
              <div className="relative flex items-center">
                <input
                  id="barcode"
                  type="text"
                  placeholder="Scan or type barcode (e.g. SKU-HEAD-7492)"
                  value={barcode}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-700 focus:border-blue-500 text-slate-100 pl-4 pr-12 py-2.5 rounded-xl outline-none transition-colors font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraModalOpen(true)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                  title="Scan barcode with camera"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Product Name Autocomplete Input */}
            <div className="relative">
              <label htmlFor="prod_name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Product Name *</label>
              <input
                id="prod_name"
                ref={productNameInputRef}
                type="text"
                autoComplete="off"
                placeholder="e.g. Ergonomic Office Chair"
                value={productName}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                className="w-full bg-[#0b0f19] border border-slate-700 focus:border-blue-500 text-slate-100 px-4 py-2.5 rounded-xl outline-none transition-colors"
                required
              />

              {/* Status Badge */}
              {barcode.trim() !== '' && (
                <div className="absolute right-3 top-9">
                  {isExisting ? (
                    <span className="text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">
                      Existing SKU
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md">
                      New SKU
                    </span>
                  )}
                </div>
              )}

              {/* Autocomplete Dropdown Search Results */}
              {showDropdown && productName.trim() !== '' && matches.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-[#151D30] border border-slate-700/80 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-800/40">
                  {matches.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="px-4 py-2.5 hover:bg-slate-800/40 cursor-pointer transition-colors text-sm flex justify-between items-center"
                    >
                      <span className="text-white font-medium">{p.name}</span>
                      <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity Added */}
            <div>
              <label htmlFor="qty_added" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quantity Added *</label>
              <input
                id="qty_added"
                ref={quantityInputRef}
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 focus:border-blue-500 text-slate-100 px-4 py-2.5 rounded-xl outline-none transition-colors font-mono"
                required
              />
            </div>

            {/* Supplier Name */}
            <div>
              <label htmlFor="supplier" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Supplier Name *</label>
              <input
                id="supplier"
                type="text"
                placeholder="e.g. Zenith Logistics Ltd"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 focus:border-blue-500 text-slate-100 px-4 py-2.5 rounded-xl outline-none transition-colors"
                required
              />
            </div>

            {/* Parameter Fields (Editable for New Product, locked/hinted for existing) */}
            <div className="border-t border-slate-800/80 pt-4 mt-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {isExisting ? 'Catalog specifications (Auto-filled)' : 'New Product SKU specifications'}
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-xs text-slate-500 mb-1.5">Unit Price ($) *</label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => {
                      setUnitPrice(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && !costPrice) {
                        setCostPrice((val * 0.60).toFixed(2));
                      }
                    }}
                    disabled={isExisting}
                    className="w-full bg-[#0b0f19] border border-slate-700 disabled:opacity-55 disabled:text-slate-400 text-slate-100 px-4 py-2.5 rounded-xl outline-none font-mono text-sm focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="costPrice" className="block text-xs text-slate-500 mb-1.5">Unit Cost (COGS) ($) *</label>
                  <input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    disabled={isExisting}
                    className="w-full bg-[#0b0f19] border border-slate-700 disabled:opacity-55 disabled:text-slate-400 text-slate-100 px-4 py-2.5 rounded-xl outline-none font-mono text-sm focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="threshold" className="block text-xs text-slate-500 mb-1.5">Min Warning threshold *</label>
                <input
                  id="threshold"
                  type="number"
                  min="0"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  disabled={isExisting}
                  className="w-full bg-[#0b0f19] border border-slate-700 disabled:opacity-55 disabled:text-slate-400 text-slate-100 px-4 py-2.5 rounded-xl outline-none font-mono text-sm focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/35 rounded-xl text-emerald-400 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/35 rounded-xl text-red-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5" />
                  {isExisting ? 'Load Incoming Stock' : 'Create & Load New SKU'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Shipment History Feed */}
        <div className="glass-panel glow-card-blue rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-400" />
            Live Shipment Feed (Last 100 Receipts)
          </h3>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700/60 text-slate-400 sticky top-0 bg-[#151D30] z-10">
                  <th className="py-3 px-4 font-semibold">Product Name / SKU</th>
                  <th className="py-3 px-4 font-semibold text-center">Qty Added</th>
                  <th className="py-3 px-4 font-semibold">Supplier Name</th>
                  <th className="py-3 px-4 font-semibold">Arrival Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No incoming shipment loads recorded yet.
                    </td>
                  </tr>
                ) : (
                  loads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">{l.product_name}</span>
                        <span className="text-xs text-slate-400 font-mono">{l.product_sku}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-md font-mono">
                          +{l.quantity_added}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-300">
                        {l.supplier_name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs font-mono">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
