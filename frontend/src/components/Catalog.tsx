import React from 'react';
import { ClipboardList, RefreshCw, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { Product } from '../App';

interface CatalogProps {
  products: Product[];
  refreshData: () => Promise<void>;
  loading: boolean;
}

export default function Catalog({ products, refreshData, loading }: CatalogProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-emerald-400" />
            Catalog SKU Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time visual monitoring of registered products, active safety status, and suppliers.
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Legend indicator */}
          <div className="hidden md:flex items-center gap-3 bg-[#151D30]/60 border border-slate-700/50 px-4 py-2 rounded-xl text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-slate-400 font-semibold">Out of Stock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-slate-400 font-semibold">Dead Stock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-400 font-semibold">Low Stock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-400 font-semibold">Healthy</span>
            </div>
          </div>

          <button 
            onClick={refreshData}
            disabled={loading}
            className="p-2.5 bg-[#151D30] hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh SKU List"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SKU Catalog Table */}
      <div className="glass-panel glow-card-blue rounded-2xl p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 text-slate-400">
                <th className="py-3.5 px-5 font-semibold">Product Name / SKU</th>
                <th className="py-3.5 px-4 font-semibold">Supplier Name</th>
                <th className="py-3.5 px-4 font-semibold text-right">Price</th>
                <th className="py-3.5 px-4 font-semibold text-center">Live Stock</th>
                <th className="py-3.5 px-4 font-semibold text-center">Safety Threshold</th>
                <th className="py-3.5 px-4 font-semibold text-center">Telemetry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No products cataloged. Go to the "Load Intake" tab to load a shipment or register a new SKU.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isOutOfStock = p.current_stock <= 0;
                  
                  // Dead stock date calculation
                  const lastSoldDate = p.last_sold_at ? new Date(p.last_sold_at) : null;
                  const ninetyDaysAgo = new Date();
                  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                  const isDeadStock = p.current_stock > 0 && lastSoldDate !== null && lastSoldDate < ninetyDaysAgo;
                  
                  const isLowStock = p.current_stock > 0 && p.current_stock <= p.min_threshold && !isDeadStock;
                  
                  // Styling based on stock status states
                  let rowStyles = "hover:bg-slate-800/10 transition-colors ";
                  let statusLabel = "";
                  let badgeClass = "";
                  let badgeIcon = null;
                  
                  if (isOutOfStock) {
                    // Empty Stock: prominent dark red blinking layout & badge
                    rowStyles += "bg-red-950/80 border-2 border-red-600 text-red-100 animate-strong-blink";
                    statusLabel = "[!] Empty Stock";
                    badgeClass = "bg-red-500/35 border-red-500 text-red-400 animate-strong-blink";
                    badgeIcon = <AlertTriangle className="w-3 h-3 animate-strong-blink" />;
                  } else if (isDeadStock) {
                    // Dead Stock: solid, dark red row & badge (NO blinking)
                    rowStyles += "bg-red-900/40 border border-red-700/80 text-red-100";
                    statusLabel = "Dead Stock";
                    badgeClass = "bg-red-500/20 border-red-500/30 text-red-400";
                    badgeIcon = <AlertTriangle className="w-3 h-3" />;
                  } else if (isLowStock) {
                    // Low Stock: solid amber/orange row & badge (NO blinking)
                    rowStyles += "bg-amber-950/40 border border-amber-700/80 text-amber-200";
                    statusLabel = "Low Stock";
                    badgeClass = "bg-amber-500/20 border-amber-500/30 text-amber-400";
                    badgeIcon = <AlertTriangle className="w-3 h-3" />;
                  } else {
                    // Healthy: solid dark green row & badge (NO blinking)
                    rowStyles += "bg-emerald-950/20 border border-emerald-800/80 text-emerald-200";
                    statusLabel = "Healthy";
                    badgeClass = "bg-emerald-500/20 border-emerald-500/30 text-emerald-400";
                    badgeIcon = <CheckCircle className="w-3 h-3" />;
                  }

                  return (
                    <tr key={p.id} className={rowStyles}>
                      <td className="py-4 px-5">
                        <span className="font-bold block">{p.name}</span>
                        <span className="text-xs font-mono opacity-70 block mt-0.5">{p.sku}</span>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        {p.supplier_name}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold">
                        ${parseFloat(p.price).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold">
                        {p.current_stock}
                      </td>
                      <td className="py-4 px-4 text-center font-mono opacity-80">
                        {p.min_threshold}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md border ${badgeClass}`}>
                          {badgeIcon}
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
