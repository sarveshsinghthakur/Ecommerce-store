import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, CreditCard, BarChart, Plus, Trash2, Gift, Menu, X, Tag, Users, Trash, Eye, EyeOff, UserPlus, Moon, Sun, Settings, Home } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
}

interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  discountApplied: number;
  discountCode?: string;
  timestamp: number;
}

interface DiscountCode {
  code: string;
  percentage: number;
  isUsed: boolean;
  generatedForOrderIndex: number;
}

interface StoreStats {
  totalItemsPurchased: number;
  totalRevenue: number;
  discountCodesGenerated: number;
  totalDiscountsGiven: number;
  totalOrders: number;
}

interface UserStats {
  userId: string;
  ordersCount: number;
  totalSpent: number;
  lastOrder?: number;
}

interface UserData {
  id: string;
  name: string;
  createdAt: number;
  isActive: boolean;
}

class Database {
  products: Product[] = [
    { id: 'p1', name: 'Ergonomic Keyboard', price: 150 },
    { id: 'p2', name: 'Wireless Mouse', price: 50 },
    { id: 'p3', name: 'HD Monitor', price: 300 },
    { id: 'p4', name: 'USB-C Hub', price: 40 },
    { id: 'p5', name: 'Laptop Stand', price: 45 },
    { id: 'p6', name: 'Noise Cancelling Headphones', price: 200 },
  ];

  carts: Map<string, CartItem[]> = new Map();
  orders: Order[] = [];
  discounts: Map<string, DiscountCode> = new Map();
  users: Map<string, UserData> = new Map();
  
  config = {
    n: 3,
    discountPercent: 10
  };

  constructor() {
    // Initialize with default users
    this.addUser('User_A', 'User A');
    this.addUser('User_B', 'User B');
    this.addUser('User_C', 'User C');
    this.addUser('User_D', 'User D');
  }

  addUser(id: string, name: string) {
    this.users.set(id, { 
      id, 
      name, 
      createdAt: Date.now(),
      isActive: true 
    });
  }

  removeUser(id: string) {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, isActive: false });
      this.carts.delete(id);
    }
  }

  getActiveUsers(): UserData[] {
    return Array.from(this.users.values()).filter(user => user.isActive);
  }

  getAllUsers(): UserData[] {
    return Array.from(this.users.values());
  }
}

const db = new Database();

class StoreService {
  private calculateCartTotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }

  async getProducts(): Promise<Product[]> {
    return [...db.products];
  }

  async addProduct(name: string, price: number): Promise<Product> {
    const newProduct: Product = {
      id: `p${Date.now()}`,
      name,
      price
    };
    db.products.push(newProduct);
    return newProduct;
  }

  async removeProduct(productId: string): Promise<void> {
    db.products = db.products.filter(p => p.id !== productId);
    // Also remove from all carts
    db.carts.forEach((cart, userId) => {
      db.carts.set(userId, cart.filter(item => item.productId !== productId));
    });
  }

  async getCart(userId: string): Promise<CartItem[]> {
    return db.carts.get(userId) || [];
  }

  async addToCart(userId: string, productId: string): Promise<CartItem[]> {
    const currentCart = db.carts.get(userId) || [];
    const existingItem = currentCart.find(i => i.productId === productId);
    const product = db.products.find(p => p.id === productId);

    if (!product) throw new Error("Product not found");

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      currentCart.push({ productId, quantity: 1, product });
    }

    db.carts.set(userId, currentCart);
    return currentCart;
  }

  async removeFromCart(userId: string, productId: string): Promise<void> {
    const currentCart = db.carts.get(userId) || [];
    const filteredCart = currentCart.filter(item => item.productId !== productId);
    db.carts.set(userId, filteredCart);
  }

  async updateCartItemQuantity(userId: string, productId: string, quantity: number): Promise<void> {
    const currentCart = db.carts.get(userId) || [];
    const item = currentCart.find(i => i.productId === productId);
    if (item) {
      if (quantity <= 0) {
        await this.removeFromCart(userId, productId);
      } else {
        item.quantity = quantity;
      }
    }
  }

  async clearCart(userId: string): Promise<void> {
    db.carts.set(userId, []);
  }

  async checkout(userId: string, discountCode?: string): Promise<Order> {
    const cart = db.carts.get(userId) || [];
    if (cart.length === 0) throw new Error("Cart is empty");

    let subtotal = this.calculateCartTotal(cart);
    let discountAmount = 0;

    if (discountCode) {
      const codeData = db.discounts.get(discountCode);
      
      if (!codeData) {
        throw new Error("Invalid discount code");
      }
      if (codeData.isUsed) {
        throw new Error("Discount code has already been used");
      }

      discountAmount = subtotal * (codeData.percentage / 100);
      codeData.isUsed = true;
    }

    const finalTotal = subtotal - discountAmount;

    const newOrder: Order = {
      id: `ORD-${db.orders.length + 1}`,
      userId,
      items: [...cart],
      totalAmount: finalTotal,
      discountApplied: discountAmount,
      discountCode: discountCode,
      timestamp: Date.now()
    };

    db.orders.push(newOrder);
    db.carts.set(userId, []);

    return newOrder;
  }

  async generateDiscountCode(): Promise<string | null> {
    const totalOrders = db.orders.length;
    const { n, discountPercent } = db.config;

    if (totalOrders > 0 && totalOrders % n === 0) {
      const existing = Array.from(db.discounts.values()).find(d => d.generatedForOrderIndex === totalOrders);
      if (existing) {
        throw new Error(`Code already generated for order #${totalOrders}`);
      }

      const code = `WINNER-${Math.floor(Math.random() * 10000)}`;
      db.discounts.set(code, {
        code,
        percentage: discountPercent,
        isUsed: false,
        generatedForOrderIndex: totalOrders
      });
      return code;
    }

    return null;
  }

  async getStats(): Promise<StoreStats> {
    const totalOrders = db.orders.length;
    const totalRevenue = db.orders.reduce((acc, ord) => acc + ord.totalAmount, 0);
    const totalDiscountsGiven = db.orders.reduce((acc, ord) => acc + ord.discountApplied, 0);
    const totalItemsPurchased = db.orders.reduce((acc, ord) => acc + ord.items.reduce((s, i) => s + i.quantity, 0), 0);
    const discountCodesGenerated = db.discounts.size;

    return {
      totalItemsPurchased,
      totalRevenue,
      discountCodesGenerated,
      totalDiscountsGiven,
      totalOrders
    };
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const userOrders = db.orders.filter(o => o.userId === userId);
    const ordersCount = userOrders.length;
    const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const lastOrder = userOrders.length > 0 ? userOrders[userOrders.length - 1].timestamp : undefined;

    return {
      userId,
      ordersCount,
      totalSpent,
      lastOrder
    };
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return db.orders.filter(o => o.userId === userId);
  }
}

const api = new StoreService();

export default function App() {
  const [activeTab, setActiveTab] = useState<'store' | 'admin'>('store');
  const [currentUser, setCurrentUser] = useState('User_A');
  const [darkMode, setDarkMode] = useState(false);
  
  // Store Data
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [discountInput, setDiscountInput] = useState('');
  const [checkoutStatus, setCheckoutStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Admin Data
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [adminMsg, setAdminMsg] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Add Product Form State
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  
  // Users Management
  const [users, setUsers] = useState<UserData[]>(() => db.getActiveUsers());
  const [newUserName, setNewUserName] = useState('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [showUserStats, setShowUserStats] = useState(false);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Load initial data
  useEffect(() => {
    loadStoreData();
    loadStats();
  }, []);

  // Load user-specific data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      loadUserStats();
      loadUserOrders();
    }
  }, [currentUser]);

  // Load store data when switching to store tab
  useEffect(() => {
    if (activeTab === 'store') {
      loadStoreData();
      loadUserStats();
    } else if (activeTab === 'admin') {
      loadStats();
      // Refresh users list
      setUsers(db.getActiveUsers());
    }
  }, [activeTab]);

  const loadStoreData = async () => {
    const prods = await api.getProducts();
    setProducts(prods);
    const userCart = await api.getCart(currentUser);
    setCart(userCart);
    updateTotal(userCart);
  };

  const loadStats = async () => {
    const s = await api.getStats();
    setStats(s);
  };

  const loadUserStats = async () => {
    if (!currentUser) return;
    const stats = await api.getUserStats(currentUser);
    setUserStats(stats);
  };

  const loadUserOrders = async () => {
    if (!currentUser) return;
    const orders = await api.getUserOrders(currentUser);
    setUserOrders(orders);
  };

  const updateTotal = (currentCart: CartItem[]) => {
    const total = currentCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    setCartTotal(total);
  };

  const handleAddToCart = async (prodId: string) => {
    try {
      const newCart = await api.addToCart(currentUser, prodId);
      setCart(newCart);
      updateTotal(newCart);
      setCheckoutStatus(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFromCart = async (productId: string) => {
    try {
      await api.removeFromCart(currentUser, productId);
      const newCart = await api.getCart(currentUser);
      setCart(newCart);
      updateTotal(newCart);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearCart = async () => {
    await api.clearCart(currentUser);
    setCart([]);
    setCartTotal(0);
  };

  const handleCheckout = async () => {
    try {
      const order = await api.checkout(currentUser, discountInput || undefined);
      setCheckoutStatus({ 
        msg: `Order Placed! ID: ${order.id}. Paid: $${order.totalAmount.toFixed(2)}. Discount: $${order.discountApplied.toFixed(2)}`, 
        type: 'success' 
      });
      setCart([]);
      setCartTotal(0);
      setDiscountInput('');
      loadStats();
      loadUserStats();
      loadUserOrders();
    } catch (err: any) {
      setCheckoutStatus({ msg: err.message, type: 'error' });
    }
  };

  const handleGenerateCode = async () => {
    try {
      const code = await api.generateDiscountCode();
      if (code) {
        setGeneratedCode(code);
        setAdminMsg("New code generated based on order count!");
      } else {
        setAdminMsg("Condition not met (Total orders is not a multiple of N)");
      }
      loadStats();
    } catch (err: any) {
      setAdminMsg(err.message);
    }
  };

  const handleAddProduct = async () => {
    if (!newProdName || !newProdPrice) return;
    try {
        await api.addProduct(newProdName, parseFloat(newProdPrice));
        setNewProdName('');
        setNewProdPrice('');
        setAdminMsg(`Product "${newProdName}" added to inventory!`);
        // Refresh products in both views
        const prods = await api.getProducts();
        setProducts(prods);
    } catch (e) {
        console.error(e);
    }
  };

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    
    // Generate unique user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userName = newUserName.trim();
    
    db.addUser(userId, userName);
    setUsers(db.getActiveUsers());
    setCurrentUser(userId);
    setNewUserName('');
    setAdminMsg(`User "${userName}" added successfully!`);
    
    // Switch to store view to see new user in action
    setActiveTab('store');
  };

  const handleDeleteUser = (userId: string) => {
    // Don't delete if it's the last active user
    const activeUsers = db.getActiveUsers();
    if (activeUsers.length <= 1) {
      setAdminMsg("Cannot delete the last active user!");
      return;
    }
    
    if (userId === currentUser) {
      const remainingUsers = activeUsers.filter(u => u.id !== userId);
      if (remainingUsers.length > 0) {
        setCurrentUser(remainingUsers[0].id);
      }
    }
    
    db.removeUser(userId);
    setUsers(db.getActiveUsers());
    setAdminMsg(`User deleted successfully!`);
  };

  return (
    <div className={`app-container ${darkMode ? 'dark' : ''}`}>
      <style>{`
        :root {
          --max-width: 1200px;
          --transition: all 0.3s ease;
          
          /* Light Theme Colors */
          --bg-primary: #f8fafc;
          --bg-secondary: #ffffff;
          --bg-tertiary: #f1f5f9;
          --text-primary: #1e293b;
          --text-secondary: #475569;
          --text-tertiary: #64748b;
          --border-color: #e2e8f0;
          --accent-primary: #3b82f6;
          --accent-secondary: #8b5cf6;
          --accent-success: #10b981;
          --accent-danger: #ef4444;
          --accent-warning: #f59e0b;
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .dark {
          /* Dark Theme Colors */
          --bg-primary: #0f172a;
          --bg-secondary: #1e293b;
          --bg-tertiary: #334155;
          --text-primary: #f1f5f9;
          --text-secondary: #cbd5e1;
          --text-tertiary: #94a3b8;
          --border-color: #475569;
          --accent-primary: #60a5fa;
          --accent-secondary: #a78bfa;
          --accent-success: #34d399;
          --accent-danger: #f87171;
          --accent-warning: #fbbf24;
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html {
          font-size: 16px;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          transition: var(--transition);
          min-height: 100vh;
        }

        .app-container {
          min-height: 100vh;
          transition: var(--transition);
        }

        /* Navigation */
        .nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
          transition: var(--transition);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 700;
          font-size: 1.25rem;
          color: var(--accent-primary);
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .nav-tabs {
          display: none;
          gap: 0.5rem;
        }

        .menu-toggle {
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.375rem;
          transition: var(--transition);
        }

        .menu-toggle:hover {
          background: var(--bg-tertiary);
        }

        .nav-tabs-mobile {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          padding: 1rem;
          box-shadow: var(--shadow-md);
          z-index: 99;
        }

        .nav-tabs-mobile.open {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-weight: 600;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: var(--transition);
          width: 100%;
        }

        .nav-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .nav-btn.active {
          background: var(--accent-primary);
          color: white;
        }

        .nav-btn .icon {
          width: 20px;
          height: 20px;
        }

        /* Theme Toggle */
        .theme-toggle {
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.375rem;
          transition: var(--transition);
        }

        .theme-toggle:hover {
          background: var(--bg-tertiary);
        }

        /* Main Content */
        .main {
          max-width: var(--max-width);
          margin: 0 auto;
          padding: 1.5rem;
        }

        /* Store Layout */
        .store-layout {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Cards */
        .card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
          transition: var(--transition);
        }

        .card:hover {
          box-shadow: var(--shadow-md);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 600;
          font-size: 1.125rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }

        .card-header .icon {
          width: 20px;
          height: 20px;
          color: var(--accent-primary);
        }

        /* Products Grid */
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1.25rem;
        }

        .product-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.25rem;
          transition: var(--transition);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .product-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--accent-primary);
        }

        .product-img {
          width: 100%;
          height: 160px;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.875rem;
        }

        .product-details h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 0.75rem;
        }

        .price {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--accent-primary);
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          font-size: 0.875rem;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
        }

        .btn-primary {
          background: var(--accent-primary);
          color: white;
        }

        .btn-primary:hover {
          background: var(--accent-primary);
          opacity: 0.9;
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .btn-success {
          background: var(--accent-success);
          color: white;
        }

        .btn-danger {
          background: var(--accent-danger);
          color: white;
        }

        .btn-purple {
          background: var(--accent-secondary);
          color: white;
        }

        .btn-outline {
          background: transparent;
          border: 2px solid var(--border-color);
          color: var(--text-primary);
        }

        .btn-outline:hover {
          border-color: var(--accent-primary);
        }

        /* Cart */
        .cart-sticky {
          position: sticky;
          top: 6rem;
        }

        .cart-list {
          list-style: none;
          margin-bottom: 1.5rem;
        }

        .cart-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .cart-item:last-child {
          border-bottom: none;
        }

        .cart-item-details {
          flex: 1;
        }

        .cart-item-name {
          font-weight: 500;
          color: var(--text-primary);
        }

        .cart-item-price {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .cart-item-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cart-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1.25rem;
          font-weight: 700;
          padding: 1rem 0;
          margin: 1rem 0;
          border-top: 2px solid var(--border-color);
          border-bottom: 2px solid var(--border-color);
        }

        /* Inputs */
        .input-group {
          margin-bottom: 1.25rem;
        }

        .input-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .text-input,
        .select-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.875rem;
          transition: var(--transition);
        }

        .text-input:focus,
        .select-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* Status Messages */
        .status-msg {
          padding: 1rem;
          border-radius: 0.5rem;
          margin-top: 1rem;
          font-size: 0.875rem;
        }

        .status-success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--accent-success);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .status-error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--accent-danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        /* Admin Grid */
        .admin-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1.5rem;
        }

        .admin-header {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          color: white;
          padding: 2rem;
          border-radius: 1rem;
          grid-column: 1 / -1;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .stat-item {
          background: var(--bg-tertiary);
          padding: 1.25rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border-color);
        }

        .stat-val {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Rule Box */
        .rule-box {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .code-success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin-top: 1.5rem;
        }

        .code-display {
          display: inline-block;
          background: var(--accent-success);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-family: monospace;
          font-weight: 600;
          margin-top: 0.5rem;
          font-size: 1.125rem;
        }

        /* User Management */
        .user-list {
          max-height: 300px;
          overflow-y: auto;
          margin-top: 1rem;
        }

        .user-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background: var(--bg-tertiary);
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          border: 1px solid var(--border-color);
        }

        .user-item.active {
          border-color: var(--accent-primary);
          background: rgba(59, 130, 246, 0.1);
        }

        /* Debug Panel */
        .debug-panel {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 1.5rem;
          border-radius: 0.75rem;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          grid-column: 1 / -1;
        }

        .debug-title {
          display: block;
          font-weight: 600;
          color: var(--accent-warning);
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .debug-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .debug-section-title {
          color: var(--accent-primary);
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        /* Responsive */
        @media (min-width: 768px) {
          .nav-tabs {
            display: flex;
          }

          .menu-toggle {
            display: none;
          }

          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .admin-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .store-layout {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: 2rem;
          }

          .admin-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* Dark mode specific fixes */
        .dark .icon {
          color: inherit;
        }

        .dark .card-header .icon {
          color: var(--accent-primary);
        }

        .dark .nav-btn .icon {
          color: inherit;
        }

        .dark .nav-btn.active .icon {
          color: white;
        }
      `}</style>
      
      <nav className="nav">
        <div className="nav-brand">
          <Package className="icon" />
          <span>NthOrder Store</span>
        </div>

        {/* Desktop Tabs - ALWAYS VISIBLE */}
        <div className="nav-tabs">
          <button 
            onClick={() => setActiveTab('store')}
            className={`nav-btn ${activeTab === 'store' ? 'active' : ''}`}
          >
            <Home className="icon" size={20} />
            <span>Customer View</span>
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
          >
            <BarChart className="icon" size={20} />
            <span>Admin Dashboard</span>
          </button>
        </div>

        <div className="nav-actions">
          <button 
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <button 
            className="menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Tabs Dropdown */}
        <div className={`nav-tabs-mobile ${mobileMenuOpen ? 'open' : ''}`}>
          <button 
            onClick={() => { setActiveTab('store'); setMobileMenuOpen(false); }}
            className={`nav-btn ${activeTab === 'store' ? 'active' : ''}`}
          >
            <Home className="icon" size={20} />
            <span>Customer View</span>
          </button>
          <button 
            onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
          >
            <BarChart className="icon" size={20} />
            <span>Admin Dashboard</span>
          </button>
        </div>
      </nav>

      <main className="main">
        
        {activeTab === 'store' && (
          <div className="store-layout">
            
            <div className="user-section">
              <div className="card">
                <div className="card-header">
                  <Users className="icon" />
                  <span>Current User</span>
                </div>
                <div className="user-select">
                  <div className="input-group">
                    <label className="input-label">Select Customer</label>
                    <select 
                      value={currentUser} 
                      onChange={(e) => setCurrentUser(e.target.value)}
                      className="select-input"
                    >
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {userStats && (
                    <div className="rule-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span><strong>Orders:</strong> {userStats.ordersCount}</span>
                        <span><strong>Total Spent:</strong> ${userStats.totalSpent.toFixed(2)}</span>
                      </div>
                      {userStats.lastOrder && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                          Last Order: {new Date(userStats.lastOrder).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="products-section">
              <div className="card">
                <div className="card-header">
                  <Package className="icon" />
                  <span>Products</span>
                </div>
                <div className="products-grid">
                  {products.map(p => (
                    <div key={p.id} className="product-card">
                      <div className="product-img">
                        Product Image
                      </div>
                      <div className="product-details">
                        <h3>{p.name}</h3>
                        <div className="price-row">
                          <span className="price">${p.price.toFixed(2)}</span>
                          <button 
                            onClick={() => handleAddToCart(p.id)}
                            className="btn btn-primary btn-sm"
                          >
                            <Plus size={16} /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="cart-section">
              <div className="card cart-sticky">
                <div className="card-header">
                  <ShoppingCart className="icon" />
                  <span>Your Cart</span>
                </div>
                
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-tertiary)' }}>
                    <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <ul className="cart-list">
                      {cart.map((item, idx) => (
                        <li key={idx} className="cart-item">
                          <div className="cart-item-details">
                            <div className="cart-item-name">
                              {item.quantity}x {item.product.name}
                            </div>
                            <div className="cart-item-price">
                              ${(item.product.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                          <div className="cart-item-actions">
                            <button
                              onClick={() => handleRemoveFromCart(item.productId)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="cart-total">
                      <span>Total</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Discount Code</label>
                      <input 
                        type="text" 
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        placeholder="Enter code..."
                        className="text-input"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button 
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className="btn btn-success"
                      >
                        <CreditCard size={18} /> Checkout
                      </button>
                      <button onClick={handleClearCart} className="btn btn-outline">
                        <Trash2 size={14} /> Clear Cart
                      </button>
                    </div>
                  </>
                )}

                {checkoutStatus && (
                  <div className={`status-msg ${checkoutStatus.type === 'success' ? 'status-success' : 'status-error'}`}>
                    {checkoutStatus.msg}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="admin-grid">
            <div className="admin-header">
              <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Admin Dashboard</h1>
              <p style={{ opacity: 0.9 }}>Manage store operations, users, and inventory</p>
            </div>
              
            <div className="card">
              <div className="card-header">
                <BarChart className="icon" />
                <span>Analytics</span>
              </div>
              
              {stats && (
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-val">{stats.totalOrders}</div>
                    <div className="stat-label">Total Orders</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-val">${stats.totalRevenue.toFixed(2)}</div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-val">{stats.totalItemsPurchased}</div>
                    <div className="stat-label">Items Sold</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-val" style={{ color: 'var(--accent-success)' }}>
                      ${stats.totalDiscountsGiven.toFixed(2)}
                    </div>
                    <div className="stat-label">Discounts Given</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <Gift className="icon" />
                <span>Discount System</span>
              </div>
              
              <div className="rule-box">
                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Rule: Every {db.config.n}rd order gets a {db.config.discountPercent}% discount.
                </p>
                <p style={{ margin: 0 }}>Current Order Count: <strong>{stats?.totalOrders || 0}</strong></p>
              </div>

              <button 
                onClick={handleGenerateCode}
                className="btn btn-purple"
                style={{ marginBottom: '1rem' }}
              >
                Check & Generate Code
              </button>

              {generatedCode && (
                <div className="code-success">
                  <p style={{ color: 'var(--accent-success)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Success! Share this code:
                  </p>
                  <span className="code-display">{generatedCode}</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    This code provides {db.config.discountPercent}% discount on next purchase
                  </p>
                </div>
              )}

              {adminMsg && !generatedCode && (
                <div style={{ 
                  textAlign: 'center', 
                  fontSize: '0.875rem', 
                  color: 'var(--text-tertiary)', 
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '0.5rem'
                }}>
                  {adminMsg}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <UserPlus className="icon" />
                <span>User Management</span>
              </div>
              
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                Add unlimited users to the system. Current active users: <strong>{users.length}</strong>
              </p>

              <div className="input-group">
                <label className="input-label">New User Name</label>
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="e.g. John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
                />
              </div>

              <button onClick={handleAddUser} className="btn btn-success" style={{ marginBottom: '1.5rem' }}>
                <Plus size={16} /> Add User
              </button>

              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Active Users ({users.length}):
                </p>
                <div className="user-list">
                  {users.map(user => (
                    <div 
                      key={user.id} 
                      className={`user-item ${currentUser === user.id ? 'active' : ''}`}
                    >
                      <div>
                        <div style={{ 
                          fontWeight: currentUser === user.id ? 600 : 500, 
                          color: currentUser === user.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                          marginBottom: '2px'
                        }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          ID: {user.id.substring(0, 12)}...
                        </div>
                      </div>
                      {users.length > 1 && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-danger)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            borderRadius: '0.25rem',
                            transition: 'var(--transition)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--accent-danger)';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = 'var(--accent-danger)';
                          }}
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <Tag className="icon" />
                <span>Inventory Management</span>
              </div>
              
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                Add new products to the store. Current products: <strong>{products.length}</strong>
              </p>

              <div className="input-group">
                <label className="input-label">Product Name</label>
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="e.g. Gaming Chair"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                />
              </div>
              
              <div className="input-group">
                <label className="input-label">Price ($)</label>
                <input 
                  type="number" 
                  className="text-input" 
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                />
              </div>

              <button onClick={handleAddProduct} className="btn btn-success">
                <Plus size={16} /> Add Product
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <ShoppingCart className="icon" />
                <span>User Order History</span>
              </div>
              
              <div className="input-group">
                <label className="input-label">View Orders For</label>
                <select 
                  value={currentUser} 
                  onChange={(e) => setCurrentUser(e.target.value)}
                  className="text-input"
                  style={{ cursor: 'pointer' }}
                >
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              {userOrders.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '1rem', padding: '2rem 0' }}>
                  <CreditCard size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p>No orders yet for this user</p>
                </div>
              ) : (
                <div style={{ marginTop: '1rem' }}>
                  {userOrders.map((order, idx) => (
                    <div key={order.id} style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Order #{idx + 1}: {order.id}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {new Date(order.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Items: {order.items.length} | Total: <strong>${order.totalAmount.toFixed(2)}</strong>
                      </div>
                      {order.discountApplied > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-success)' }}>
                          Discount: ${order.discountApplied.toFixed(2)} (Code: {order.discountCode})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="debug-panel">
              <span className="debug-title">In-Memory Database State (Debug)</span>
              <div className="debug-grid">
                <div>
                  <span className="debug-section-title">Recent Orders</span>
                  {db.orders.slice(-3).map(o => (
                    <div key={o.id} style={{ marginBottom: '4px', opacity: 0.8 }}>
                      [{o.id}] User:{o.userId} (${o.totalAmount.toFixed(2)})
                    </div>
                  ))}
                  {db.orders.length === 0 && <span style={{ opacity: 0.5 }}>No orders yet</span>}
                </div>
                <div>
                  <span className="debug-section-title">Active Discount Codes</span>
                  {Array.from(db.discounts.values()).map(d => (
                    <div key={d.code} style={{ marginBottom: '4px', opacity: 0.8 }}>
                      {d.code}: {d.isUsed ? 'USED' : 'ACTIVE'} ({d.percentage}%)
                    </div>
                  ))}
                  {db.discounts.size === 0 && <span style={{ opacity: 0.5 }}>No codes generated</span>}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}