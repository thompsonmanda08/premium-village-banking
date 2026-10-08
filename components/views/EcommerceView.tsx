import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  SlidersHorizontal, 
  Sparkles, 
  Heart, 
  Truck, 
  ShieldCheck, 
  Zap,
  ArrowUpDown,
  Tag
} from 'lucide-react';
import { Product, CartItem } from '../../types';
import { sampleProducts } from '../../data/learningAndEcommerceData';
import ProductCard from '../ecommerce/ProductCard';
import CartDrawer from '../ecommerce/CartDrawer';
import ProductQuickViewModal from '../ecommerce/ProductQuickViewModal';
import OrderTrackingModal from '../ecommerce/OrderTrackingModal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

interface EcommerceViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
}

export const EcommerceView: React.FC<EcommerceViewProps> = ({
  theme,
  showToast,
}) => {
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set(['prod-1', 'prod-3']));
  
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: 'cart-1',
      product: sampleProducts[0],
      quantity: 1,
      selectedColor: 'Matte Space Gray'
    },
    {
      id: 'cart-2',
      product: sampleProducts[4],
      quantity: 2
    }
  ]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Modals state
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState('ORD-88219-X');
  const [lastCheckoutDiscount, setLastCheckoutDiscount] = useState(0);
  const [lastCheckoutPromo, setLastCheckoutPromo] = useState('');

  const categories = [
    'All', 
    'Hardware & Electronics', 
    'Audio & Workspace', 
    'Developer Merch', 
    'Books & Guides'
  ];

  const handleAddToCart = (product: Product, selectedColor?: string) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.selectedColor === selectedColor);
      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        const newItem: CartItem = {
          id: `cart-${Date.now()}`,
          product,
          quantity: 1,
          selectedColor
        };
        return [...prev, newItem];
      }
    });
    showToast(`Added "${product.name}" to cart! 🛒`);
  };

  const handleAddToCartWithQty = (product: Product, qty: number, selectedColor?: string) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.selectedColor === selectedColor);
      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + qty } : item);
      } else {
        const newItem: CartItem = {
          id: `cart-${Date.now()}`,
          product,
          quantity: qty,
          selectedColor
        };
        return [...prev, newItem];
      }
    });
    showToast(`Added ${qty}x "${product.name}" to cart!`);
  };

  const handleUpdateCartQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(id);
    } else {
      setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
    }
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    showToast('Item removed from cart');
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
        showToast('Removed from wishlist');
      } else {
        next.add(productId);
        showToast('Saved to your wishlist! ❤️');
      }
      return next;
    });
  };

  const handleProceedToCheckout = (discountAmount: number, promoCode: string) => {
    const orderNum = `ORD-${Math.floor(10000 + Math.random() * 90000)}-X`;
    setConfirmedOrderId(orderNum);
    setLastCheckoutDiscount(discountAmount);
    setLastCheckoutPromo(promoCode);
    setIsCartOpen(false);
    setIsOrderTrackingOpen(true);
    showToast('Payment confirmed! Processing your order shipment.');
  };

  // Filter and sort products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0; // featured default
  });

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Hero Storefront Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-zinc-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 border border-white/10 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-indigo-300 text-xs font-semibold">
              <Sparkles size={12} className="text-amber-300" />
              <span>Premium Developer Hardware & Merch</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Curated Gear for Power Developers
            </h1>

            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              Ergonomic split keyboards, reference architecture flashcard decks, high-fidelity ANC studio monitors, and precision deskware.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Truck size={14} className="text-emerald-400" /> Free Global Express on Orders $200+
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-indigo-400" /> 2-Year Full Replacement Warranty
              </span>
            </div>
          </div>

          {/* Quick Floating Cart & Wishlist Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
            >
              <div className="relative">
                <ShoppingBag size={18} />
                {totalCartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-400 text-slate-900 font-extrabold text-[9px] flex items-center justify-center">
                    {totalCartCount}
                  </span>
                )}
              </div>
              <span>View Cart ({totalCartCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Search & Filters Header */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Store Catalog
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Showing {filteredProducts.length} verified products with direct worldwide dispatch
            </p>
          </div>

          {/* Search bar & Sorting */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, gear, specs..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 shrink-0">
                <ArrowUpDown size={12} /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="featured">Featured Picks</option>
                <option value="rating">Highest Customer Rating</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-white/10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              onAddToCart={handleAddToCart}
              onQuickView={(p) => setQuickViewProduct(p)}
              isWishlisted={wishlistIds.has(prod.id)}
              onToggleWishlist={handleToggleWishlist}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-12 text-center border border-dashed rounded-3xl border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-900/20">
            <ShoppingBag size={36} className="mx-auto text-slate-400 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No products found
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Try adjusting your search keywords or switching category filters.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Slide-out Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCartItems([])}
        onProceedToCheckout={handleProceedToCheckout}
        showToast={showToast}
      />

      {/* Product Quick View Modal */}
      <ProductQuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddToCartWithQty}
        showToast={showToast}
      />

      {/* Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={isOrderTrackingOpen}
        onClose={() => setIsOrderTrackingOpen(false)}
        orderId={confirmedOrderId}
        items={cartItems}
        discountAmount={lastCheckoutDiscount}
        promoCode={lastCheckoutPromo}
        showToast={showToast}
      />

    </div>
  );
};

export default EcommerceView;
