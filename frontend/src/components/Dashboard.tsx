import React from 'react';
import { AlertTriangle, AlertCircle, ShoppingBag, Package, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { Product, AlertData, Transaction, DashboardStats } from '../App';

interface DashboardProps {
  products: Product[];
  alerts: AlertData;
  transactions: Transaction[];
  stats: DashboardStats;
  refreshData: () => Promise<void>;
  loading: boolean;
}

export default function Dashboard({ products, alerts, transactions, stats, refreshData, loading }: DashboardProps) {
  // Summary Metrics calculations (for warning panel reference if needed, though panels use lists)
  const lowStockCount = alerts.low_stock_items.length;
  const deadStockCount = alerts.dead_stock_90_days_items.length;

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome & Refresh Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Inventory & Sales Command Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time warehouse stock analysis, active alerts, and point-of-sale telemetry.
          </p>
        </div>
        <button 
          onClick={refreshData}
          disabled={loading}
          className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold rounded-lg shadow-md shadow-violet-900/20 transition-all flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
        >
          <TrendingUp className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Force Sync Telemetry
        </button>
      </div>

      {/* Grid of 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Catalog Items */}
        <div className="glass-panel glow-card-blue p-6 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Catalog SKUs</span>
            <p className="text-3xl font-bold text-white">{stats.catalog_skus}</p>
          </div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Total Sales Amount */}
        <div className="glass-panel glow-card-violet p-6 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Gross revenue</span>
            <p className="text-3xl font-bold text-white">${stats.gross_revenue.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="glass-panel glow-card-orange p-6 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Low Stock SKUs</span>
            <p className="text-3xl font-bold text-white">{stats.low_stock_skus}</p>
          </div>
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Dead Stock Items */}
        <div className="glass-panel glow-card-red p-6 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Dead Stock</span>
            <p className="text-3xl font-bold text-white">{stats.dead_stock_skus}</p>
          </div>
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Alert Module Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Low Stock Alert Box */}
        <div className="glass-panel glow-card-orange rounded-2xl p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Low Stock Warning Panel</h2>
                <p className="text-xs text-slate-400">Items at or below safety threshold.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded-full">
              {lowStockCount} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
            {alerts.low_stock_items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                <Package className="w-12 h-12 mb-2 text-slate-600" />
                <span>All stocks are healthy!</span>
              </div>
            ) : (
              alerts.low_stock_items.map((item) => {
                const percentage = Math.min((item.current_stock / item.min_threshold) * 100, 100);
                return (
                  <div key={item.id} className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{item.name}</h4>
                        <p className="text-xs text-slate-400">SKU: {item.sku} | Supplier: {item.supplier_name}</p>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-bold bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-md">
                        {item.current_stock} / {item.min_threshold} units
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.current_stock === 0 ? 'bg-red-500' : 'bg-gradient-to-r from-orange-600 to-amber-400'
                        }`}
                        style={{ width: `${item.current_stock === 0 ? 100 : percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dead Stock (90+ Days) Alert Box */}
        <div className="glass-panel glow-card-red bg-red-950/40 border-2 border-red-600/80 shadow-[0_0_20px_rgba(220,38,38,0.4)] rounded-2xl p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Dead Stock Panel (90+ Days)</h2>
                <p className="text-xs text-slate-400">Products with sitting stock and zero sales.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-red-500/15 border border-red-500/30 text-red-400 rounded-full">
              {deadStockCount} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3">
            {alerts.dead_stock_90_days_items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                <ShoppingBag className="w-12 h-12 mb-2 text-slate-600" />
                <span>No dead stock detected.</span>
              </div>
            ) : (
              alerts.dead_stock_90_days_items.map((item) => (
                <div key={item.id} className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    {/* BOLD RED TEXT REQUIREMENT */}
                    <h4 className="font-extrabold text-red-500 text-sm">{item.name}</h4>
                    <p className="text-xs text-slate-400">SKU: {item.sku} | Supplier: {item.supplier_name}</p>
                    <p className="text-xs text-red-400/90 font-bold">
                      NOT SOLD FOR {item.days_since_last_sale} DAYS - Remaining Stock: {item.current_stock}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 block">Asset Value</span>
                    <span className="font-mono text-sm font-semibold text-slate-300">
                      ${(item.current_stock * parseFloat(item.price)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Recent Sales Transactions table */}
      <div className="glass-panel glow-card-violet rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-violet-400" />
          Recent Billed Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 text-slate-400">
                <th className="py-3 px-4 font-semibold">Transaction ID</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Items Sold</th>
                <th className="py-3 px-4 font-semibold text-right">Invoice Total</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No transactions completed today yet.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">#TX-100{t.id}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {t.total_items_count} {t.total_items_count === 1 ? 'item' : 'items'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      ${parseFloat(t.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
