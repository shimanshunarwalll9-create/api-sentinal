import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Shield,
  CheckCircle,
  LogIn,
  LogOut,
  User,
  Plus,
  Trash2,
  AlertCircle,
  Activity,
  CreditCard,
} from 'lucide-react';
import type { Product, Order } from '../types/sentinel';

interface StorefrontTabProps {
  onRefreshAll: () => void;
}

export const StorefrontTab: React.FC<StorefrontTabProps> = ({ onRefreshAll }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  // Login form modal state
  const [loginEmail, setLoginEmail] = useState('alex@example.com');
  const [loginPassword, setLoginPassword] = useState('securePass123!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Sentinel gateway headers from the latest storefront request
  const [lastGatewayMeta, setLastGatewayMeta] = useState<{
    endpoint: string;
    status: number;
    riskScore: string;
    action: string;
    latency: string;
  } | null>(null);

  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Fetch products through Sentinel gateway
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/protected/products', {
        headers: { 'X-Client-ID': user?.email || 'storefront-shopper-01' },
      });

      setLastGatewayMeta({
        endpoint: '/api/protected/products',
        status: res.status,
        riskScore: res.headers.get('X-Sentinel-Risk-Score') || '10',
        action: res.headers.get('X-Sentinel-Action') || 'ALLOW',
        latency: res.headers.get('X-Sentinel-Latency') || '14ms',
      });

      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
      onRefreshAll();
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/protected/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': loginEmail || 'storefront-shopper-01',
        },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      setLastGatewayMeta({
        endpoint: '/api/protected/auth/login',
        status: res.status,
        riskScore: res.headers.get('X-Sentinel-Risk-Score') || '0',
        action: res.headers.get('X-Sentinel-Action') || 'ALLOW',
        latency: res.headers.get('X-Sentinel-Latency') || '18ms',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Authentication rejected by Sentinel');
      }
    } catch {
      setLoginError('Network error connecting to protected auth');
    } finally {
      setLoginLoading(false);
      onRefreshAll();
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const res = await fetch('/api/protected/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': user?.email || 'storefront-shopper-01',
        },
        body: JSON.stringify({
          clientId: user?.email || 'storefront-shopper-01',
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
            price: c.product.price,
          })),
        }),
      });

      setLastGatewayMeta({
        endpoint: '/api/protected/orders',
        status: res.status,
        riskScore: res.headers.get('X-Sentinel-Risk-Score') || '12',
        action: res.headers.get('X-Sentinel-Action') || 'ALLOW',
        latency: res.headers.get('X-Sentinel-Latency') || '22ms',
      });

      if (res.ok) {
        const data = await res.json();
        setOrderSuccess(`Order #${data.order.orderNumber} placed securely! Total: $${data.order.total}`);
        setCart([]);
        setTimeout(() => setOrderSuccess(null), 5000);
      }
    } catch (e) {
      console.error('Checkout error:', e);
    } finally {
      onRefreshAll();
    }
  };

  const cartTotal = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Sentinel Proxy Live Telemetry Ribbon */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-300 font-semibold">Protected Application:</span>
          <span className="text-cyan-400">Sentinel E-Commerce Shop</span>
        </div>

        {lastGatewayMeta ? (
          <div className="flex flex-wrap items-center gap-3 text-slate-400">
            <span>Last Gateway Probe:</span>
            <span className="text-slate-200">{lastGatewayMeta.endpoint}</span>
            <span>·</span>
            <span className="text-emerald-400 font-bold">HTTP {lastGatewayMeta.status}</span>
            <span>·</span>
            <span className="text-cyan-400">Risk: {lastGatewayMeta.riskScore}/100</span>
            <span>·</span>
            <span className="text-slate-300">Action: {lastGatewayMeta.action}</span>
            <span>·</span>
            <span className="text-slate-500">{lastGatewayMeta.latency}</span>
          </div>
        ) : (
          <span className="text-slate-500">Ready for user interactions</span>
        )}
      </div>

      {orderSuccess && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2 font-mono">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{orderSuccess}</span>
        </div>
      )}

      {/* Main Store View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Product Catalog */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Security Hardware & Cryptographic Vaults
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every API call to browse and order passes through Sentinel inspection
              </p>
            </div>
            <button
              onClick={fetchProducts}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono"
            >
              Refresh Catalog
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs font-mono">
              Loading protected product catalog...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {prod.name}
                      </span>
                      {prod.badge && (
                        <span className="text-[10px] font-mono text-cyan-400">
                          {prod.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {prod.category} · Stock: {prod.stock}
                    </span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {prod.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <span className="text-sm font-bold font-mono text-slate-100">
                      ${prod.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(prod)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (1 col): Customer Auth & Shopping Cart */}
        <div className="space-y-6">
          {/* Customer Authentication Box */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Customer Account
              </h3>
              {user && (
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              )}
            </div>

            {user ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <div className="text-slate-200 font-bold">{user.name}</div>
                  <div className="text-slate-400 text-[11px]">{user.email}</div>
                  <div className="text-emerald-400 text-[11px] mt-1">
                    ✓ Authenticated via /api/protected/auth/login
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3 text-xs font-mono">
                {loginError && (
                  <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-[11px]">
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200"
                  />
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded text-xs transition-colors disabled:opacity-50"
                  >
                    {loginLoading ? 'Authenticating...' : 'Sign In'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginPassword('wrongPassword!');
                    }}
                    className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold rounded text-[11px] transition-colors"
                    title="Populates wrong password to trigger 401 auth anomaly in Sentinel"
                  >
                    Test 401
                  </button>
                </div>
                <div className="text-[10px] text-slate-500">
                  Valid: alex@example.com / securePass123!
                </div>
              </form>
            )}
          </div>

          {/* Cart & Checkout Box */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                Shopping Cart ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-slate-500 hover:text-slate-300 font-mono"
                >
                  Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                Cart is empty. Click "Add to Cart" on any product to prepare an order.
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2 bg-slate-950/60 border border-slate-800 rounded flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <div className="text-slate-200 truncate">{item.product.name}</div>
                        <div className="text-slate-500 text-[11px]">
                          {item.quantity} × ${item.product.price}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-semibold">Total:</span>
                  <span className="text-slate-100 font-bold">${cartTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded transition-colors shadow-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  Place Protected Order
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
