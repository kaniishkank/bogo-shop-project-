import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import LoadIntake from './components/LoadIntake';
import PosBilling from './components/PosBilling';
import Catalog from './components/Catalog';
import Analytics from './components/Analytics';
import { Package, TrendingUp, Truck, ShoppingCart, ClipboardList, AlertCircle, BarChart3, User, Lock, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type View = 'dashboard' | 'pos-billing' | 'load-intake' | 'catalog' | 'analytics';

export interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  cost_price: string;
  current_stock: number;
  min_threshold: number;
  supplier_name: string;
  last_sold_at: string | null;
  created_at: string;
  updated_at: string;
  days_since_last_sale?: number;
}

export interface AlertData {
  low_stock_items: Product[];
  dead_stock_90_days_items: Product[];
}

export interface Transaction {
  id: number;
  total_amount: string;
  status: string;
  created_at: string;
  total_items_count: number;
}

export interface DashboardStats {
  catalog_skus: number;
  gross_revenue: number;
  low_stock_skus: number;
  dead_stock_skus: number;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    sessionStorage.getItem('isAuthenticated') === 'true'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<View>('dashboard');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'sarawanas' && password === '123') {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthenticated', 'true');
      setLoginError(null);
    } else {
      setLoginError('Invalid username or password. Please try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated');
    setUsername('');
    setPassword('');
  };
  
  // Lifted Global States
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<AlertData>({ low_stock_items: [], dead_stock_90_days_items: [] });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    catalog_skus: 0,
    gross_revenue: 0,
    low_stock_skus: 0,
    dead_stock_skus: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    try {
      const [productsRes, alertsRes, transRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/products`),
        fetch(`${API_URL}/api/inventory/alerts`),
        fetch(`${API_URL}/api/pos/transactions`),
        fetch(`${API_URL}/api/inventory/stats`)
      ]);

      if (!productsRes.ok || !alertsRes.ok || !transRes.ok || !statsRes.ok) {
        throw new Error('Server returned an error response during sync.');
      }

      const pData = await productsRes.json();
      const aData = await alertsRes.json();
      const tData = await transRes.json();
      const sData = await statsRes.json();

      setProducts(pData);
      setAlerts(aData);
      setTransactions(tData);
      setStats(sData);
      setError(null);
    } catch (err: any) {
      console.error('Error synchronizing database metrics:', err);
      setError('Connection failure. Check if the backend container is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    // Background polling for multi-user synchronization (every 10 seconds)
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            products={products} 
            alerts={alerts} 
            transactions={transactions} 
            stats={stats}
            refreshData={refreshData}
            loading={loading}
          />
        );
      case 'pos-billing':
        return (
          <PosBilling 
            products={products} 
            refreshData={refreshData} 
          />
        );
      case 'load-intake':
        return (
          <LoadIntake 
            products={products} 
            refreshData={refreshData} 
          />
        );
      case 'catalog':
        return (
          <Catalog 
            products={products} 
            refreshData={refreshData} 
            loading={loading}
          />
        );
      case 'analytics':
        return (
          <Analytics />
        );
      default:
        return (
          <Dashboard 
            products={products} 
            alerts={alerts} 
            transactions={transactions} 
            stats={stats}
            refreshData={refreshData}
            loading={loading}
          />
        );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0B0F19] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.18),rgba(255,255,255,0))] flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel glow-card-violet rounded-2xl p-8 relative animate-scaleUp">
          <div className="flex flex-col items-center text-center space-y-3 mb-8">
            <div className="p-3 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-2xl shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent tracking-tight">
                SARAWANAS
              </h2>
              <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-1">Store Management Terminal</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="p-3.5 bg-red-950/25 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#151D30] border border-slate-800/80 focus:border-violet-500 text-slate-100 pl-10 pr-4 py-3 rounded-xl outline-none transition-colors text-sm shadow-inner placeholder:text-slate-600 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#151D30] border border-slate-800/80 focus:border-violet-500 text-slate-100 pl-10 pr-4 py-3 rounded-xl outline-none transition-colors text-sm shadow-inner placeholder:text-slate-600 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-violet-600/25 flex items-center justify-center gap-2 text-sm mt-2 hover:scale-[1.01] active:scale-[0.99]"
            >
              Sign In to Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.18),rgba(255,255,255,0))] pb-16">
      
      {/* Premium Header Bar (Glassmorphic) */}
      <header className="sticky top-0 z-40 w-full border-b border-[#23304D]/60 bg-[#0B0F19]/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setCurrentView('dashboard')}>
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-xl shadow-md group-hover:scale-105 transition-transform duration-300">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent tracking-tight">
              SARAWANAS
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation Links */}
            <nav className="flex items-center gap-1.5 md:gap-3 bg-[#151D30]/65 border border-[#23304D]/50 p-1.5 rounded-xl">
            
            {/* Dashboard Button */}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Telemetry</span> Dashboard
            </button>

            {/* POS Billing Button */}
            <button
              onClick={() => setCurrentView('pos-billing')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                currentView === 'pos-billing'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              POS Billing
            </button>

            {/* Load Intake Button */}
            <button
              onClick={() => setCurrentView('load-intake')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                currentView === 'load-intake'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Truck className="w-4 h-4" />
              Load Intake
            </button>

            {/* Catalog Button */}
            <button
              onClick={() => setCurrentView('catalog')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                currentView === 'catalog'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              SKU Catalog
            </button>

            {/* Financials Button */}
            <button
              onClick={() => setCurrentView('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                currentView === 'analytics'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Financials
            </button>

            </nav>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center p-2 border border-slate-800 text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 rounded-xl transition-all shrink-0"
              title="Lock Terminal / Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Connection Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main View Render Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {renderView()}
      </main>

    </div>
  );
}
