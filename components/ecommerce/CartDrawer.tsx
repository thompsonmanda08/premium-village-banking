import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  Check, 
  Truck, 
  ShieldCheck, 
  Sparkles
} from 'lucide-react';
import { CartItem } from '../../types';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, newQty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: (discountAmount: number, promoCode: string) => void;
  showToast: (msg: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  showToast,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountRate: number } | null>({
    code: 'DEV20',
    discountRate: 0.2
  });

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const discount = appliedCoupon ? subtotal * appliedCoupon.discountRate : 0;
  const freeShippingThreshold = 200;
  const isFreeShipping = subtotal >= freeShippingThreshold;
  const shippingFee = items.length === 0 || isFreeShipping ? 0 : 15;
  const estimatedTax = (subtotal - discount) * 0.08;
  const grandTotal = Math.max(0, subtotal - discount + shippingFee + estimatedTax);
  const freeShippingPct = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === 'DEV20' || code === 'SUMMER20') {
      setAppliedCoupon({ code, discountRate: 0.2 });
      showToast('Coupon applied: 20% Discount!');
      setCouponCode('');
    } else if (code === 'VIP50') {
      setAppliedCoupon({ code, discountRate: 0.5 });
      showToast('VIP Coupon applied: 50% Discount!');
      setCouponCode('');
    } else {
      showToast('Invalid promo code. Try DEV20 or VIP50');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    showToast('Promo code removed');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-zinc-950 shadow-2xl border-l border-slate-200 dark:border-white/10 flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Top Header */}
          <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Your Shopping Cart
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {items.reduce((a, b) => a + b.quantity, 0)} item{items.length === 1 ? '' : 's'} selected
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-500/10 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                <Truck size={13} className="text-indigo-600 dark:text-indigo-400" />
                {isFreeShipping ? (
                  <strong className="text-emerald-600 dark:text-emerald-400">You unlocked Free Express Shipping!</strong>
                ) : (
                  <span>Add <strong>${(freeShippingThreshold - subtotal).toFixed(2)}</strong> more for Free Shipping</span>
                )}
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px]">{freeShippingPct}%</span>
            </div>
            <ProgressBar value={freeShippingPct} variant={isFreeShipping ? "emerald" : "indigo"} size="sm" />
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-white/5 space-y-3">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-slate-400">
                  <ShoppingBag size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Your cart is empty
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
                  Browse our developer store and add hardware, tools, or merchandise to start shopping.
                </p>
                <Button variant="primary" size="sm" onClick={onClose}>
                  Explore Products
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="pt-3 first:pt-0 flex gap-3">
                  <img 
                    src={item.product.images[0]} 
                    alt={item.product.name}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-white/10 shrink-0 bg-slate-100 dark:bg-zinc-800"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-0.5"
                          aria-label="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {item.selectedColor && (
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          Variant: <strong className="font-semibold text-slate-700 dark:text-zinc-300">{item.selectedColor}</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </span>

                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden bg-slate-50 dark:bg-zinc-900">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="px-2 text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Checkout & Financial Breakdown */}
          {items.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-zinc-900/60 space-y-3">
              
              {/* Promo Coupon Form */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Tag size={13} /> Code: {appliedCoupon.code} (-{(appliedCoupon.discountRate * 100)}%)
                  </span>
                  <button 
                    onClick={handleRemoveCoupon}
                    className="text-[10px] font-bold text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Promo code (e.g. DEV20)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Apply
                  </Button>
                </form>
              )}

              {/* Financial Calculation Lines */}
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 pt-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900 dark:text-white">${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-semibold">-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="font-semibold">
                    {shippingFee === 0 ? <strong className="text-emerald-600 dark:text-emerald-400">FREE</strong> : `$${shippingFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax (8%)</span>
                  <span className="font-semibold text-slate-900 dark:text-white">${estimatedTax.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total Amount</span>
                  <span className="text-indigo-600 dark:text-indigo-400">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
                icon={<ArrowRight size={15} />}
                onClick={() => onProceedToCheckout(discount, appliedCoupon?.code || '')}
              >
                Proceed to Checkout (${grandTotal.toFixed(2)})
              </Button>

              <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500 flex items-center justify-center gap-1">
                <ShieldCheck size={12} className="text-emerald-500" /> 256-bit Encrypted SSL Checkout & 30-Day Returns
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
