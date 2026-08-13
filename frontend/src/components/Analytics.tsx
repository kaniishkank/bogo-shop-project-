import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Percent, AlertCircle, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type Range = 'day' | 'week' | 'month' | 'year' | 'all';

interface SummaryData {
  total_revenue: number;
  cogs: number;
  net_profit: number;
  profit_margin: number;
}

interface TimeSeriesItem {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface ProductBreakdownItem {
  name: string;
  units_sold: number;
  gross_revenue: number;
  estimated_cost: number;
  total_profit: number;
  margin_percent: number;
}

interface AnalyticsData {
  summary: SummaryData;
  timeSeries: TimeSeriesItem[];
  productsBreakdown: ProductBreakdownItem[];
}

export default function Analytics() {
  const [selectedRange, setSelectedRange] = useState<Range>('all');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/analytics/financials?range=${selectedRange}`);
      if (!res.ok) {
        throw new Error('Failed to fetch financial analytics.');
      }
      const jsonData = await res.json();
      setData(jsonData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Connection failure to analytics server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
    // Live auto-sync interval (every 5 seconds) to ensure checkout triggers update instantly
    const interval = setInterval(fetchFinancials, 5000);
    return () => clearInterval(interval);
  }, [selectedRange]);

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const revenue = payload[0]?.value || 0;
      const profit = payload[1]?.value || 0;
      const cost = revenue - profit;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return (
        <div className="bg-[#151D30]/95 border border-[#23304D] p-3.5 rounded-xl shadow-xl backdrop-blur-md">
          <p className="text-[11px] font-semibold text-slate-400 mb-1.5">{label}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Revenue:</span>
              <span className="font-mono font-bold text-violet-400">${revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Cost (COGS):</span>
              <span className="font-mono font-bold text-amber-500">${cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-6 border-t border-slate-700/50 pt-1 mt-1">
              <span className="text-slate-400">Net Profit:</span>
              <span className={`font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${profit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Profit Margin:</span>
              <span className={`font-semibold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {margin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      
      {/* Top Header Bar & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-violet-400" />
            Financials & Sales Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track real profit, margins, and sales aggregations computed directly from inventory cargo.
          </p>
        </div>

        {/* Time Window Filters */}
        <div className="flex bg-[#151D30]/65 border border-[#23304D]/50 p-1 rounded-xl self-start md:self-auto">
          {(['day', 'week', 'month', 'year', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                selectedRange === r
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'day' ? 'Today' : r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : r === 'year' ? 'This Year' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-950/30 border border-red-900/50 rounded-2xl text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Revenue</span>
            <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {loading && !data ? (
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            ) : (
              <span className="text-2xl font-extrabold text-white font-mono">
                ${data?.summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </span>
            )}
            <span className="text-[10px] text-slate-500 block mt-1">Total revenue collected from completed checkouts</span>
          </div>
        </div>

        {/* Card 2: Cost of Goods Sold */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cost of Goods Sold (COGS)</span>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {loading && !data ? (
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            ) : (
              <span className="text-2xl font-extrabold text-slate-300 font-mono">
                ${data?.summary.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </span>
            )}
            <span className="text-[10px] text-slate-500 block mt-1">Aggregated cost of cargo intake shipments sold</span>
          </div>
        </div>

        {/* Card 3: Net Profit */}
        {(() => {
          const profit = data?.summary.net_profit || 0;
          const isPositive = profit >= 0;
          return (
            <div className={`glass-panel rounded-2xl p-5 relative overflow-hidden border-t-4 ${
              isPositive ? 'border-t-emerald-500' : 'border-t-red-500'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Profit</span>
                <div className={`p-2 rounded-xl border ${
                  isPositive 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
              </div>
              <div className="mt-4">
                {loading && !data ? (
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                ) : (
                  <span className={`text-2xl font-extrabold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
                <span className="text-[10px] text-slate-500 block mt-1">Earnings after deducting intake unit costs</span>
              </div>
            </div>
          );
        })()}

        {/* Card 4: Profit Margin */}
        {(() => {
          const margin = data?.summary.profit_margin || 0;
          const isPositive = margin >= 0;
          return (
            <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profit Margin</span>
                <div className={`p-2 rounded-xl border ${
                  isPositive 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                {loading && !data ? (
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                ) : (
                  <span className={`text-2xl font-extrabold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {margin.toFixed(1)}%
                  </span>
                )}
                <span className="text-[10px] text-slate-500 block mt-1">Percentage margins retained from sales</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Main Charts & Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Chart (Left, 2 cols wide) */}
        <div className="glass-panel glow-card-violet rounded-2xl p-6 lg:col-span-2 flex flex-col min-h-[420px]">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              Revenue & Net Profit Trends
            </h3>
            <p className="text-xs text-slate-400">
              Visualizes gross sales areas mapped against net profit curves.
            </p>
          </div>

          <div className="flex-1 w-full min-h-[300px]">
            {loading && !data ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
            ) : data && data.timeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#23304D" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#64748B" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748B" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    formatter={(v) => <span className="text-xs font-semibold text-slate-400 capitalize">{v}</span>}
                  />
                  <Area 
                    type="monotone" 
                    name="revenue" 
                    dataKey="revenue" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                  <Line 
                    type="monotone" 
                    name="profit" 
                    dataKey="profit" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <span>No transaction data available for this range.</span>
              </div>
            )}
          </div>
        </div>

        {/* Product Profitability Breakdown Table (Right, 1 col wide) */}
        <div className="glass-panel glow-card-blue rounded-2xl p-6 flex flex-col min-h-[420px]">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Top SKU Performance</h3>
            <p className="text-xs text-slate-400">SKUs ranked by total net profit contribution.</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loading && !data ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : data && data.productsBreakdown.length > 0 ? (
              <div className="space-y-4">
                {data.productsBreakdown.map((item, idx) => (
                  <div 
                    key={item.name} 
                    className="p-3.5 bg-[#151D30]/40 border border-[#23304D]/60 rounded-xl flex items-center justify-between hover:bg-[#151D30]/65 transition-colors"
                  >
                    <div className="space-y-0.5 max-w-[60%]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          #{idx + 1}
                        </span>
                        <h4 className="font-extrabold text-xs text-slate-200 truncate">{item.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {item.units_sold} units sold | Margin: <span className="font-semibold text-emerald-400">{item.margin_percent.toFixed(1)}%</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Net Profit</span>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        +${item.total_profit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <span>No sales logged yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
