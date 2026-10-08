import React, { useState } from 'react';
import { 
  X, 
  Star, 
  ShoppingCart, 
  Check, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Plus, 
  Minus, 
  Heart,
  Share2,
  Sparkles
} from 'lucide-react';
import { Product } from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

interface ProductQuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, selectedColor?: string) => void;
  showToast: (msg: string) => void;
}

export const ProductQuickViewModal: React.FC<ProductQuickViewModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  showToast,
}) => {
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product?.colors?.[0]?.name
  );
  const [activeTab, setActiveTab] = useState<'features' | 'specs' | 'reviews'>('features');

  if (!isOpen || !product) return null;

  const handleAdd = () => {
    onAddToCart(product, quantity, selectedColor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto select-none">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in"
          onClick={onClose}
        />

        {/* Modal Window */}
        <div className="relative transform overflow-hidden rounded-3xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-left shadow-2xl transition-all w-full max-w-3xl animate-in zoom-in-95 duration-200 z-10">
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors z-20"
          >
            <X size={18} />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left Column: Image Gallery */}
            <div className="p-6 bg-slate-50 dark:bg-zinc-900/60 border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/10 flex flex-col justify-between space-y-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center">
                <img 
                  src={product.images[selectedImgIdx] || product.images[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Thumbnails list */}
              {product.images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImgIdx(idx)}
                      className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                        selectedImgIdx === idx 
                          ? 'border-indigo-600 scale-105' 
                          : 'border-slate-200 dark:border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="thumb" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-white/5 text-[10px] text-center text-slate-500 dark:text-zinc-400">
                <div className="flex flex-col items-center gap-1">
                  <Truck size={14} className="text-indigo-500" />
                  <span>Free Express</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>2-Yr Warranty</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <RotateCcw size={14} className="text-purple-500" />
                  <span>30-Day Return</span>
                </div>
              </div>
            </div>

            {/* Right Column: Product Info & Purchase Controls */}
            <div className="p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                    {product.category}
                  </span>
                  {product.badge && (
                    <Badge variant="amber" size="sm">
                      {product.badge}
                    </Badge>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {product.name}
                </h2>

                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  {product.tagline}
                </p>

                {/* Rating & Reviews */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center text-amber-400">
                    <Star size={13} className="fill-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    {product.rating.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    ({product.reviewsCount} customer reviews)
                  </span>
                </div>

                {/* Price block */}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-slate-400 line-through">
                      ${product.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Color Variant picker */}
                {product.colors && product.colors.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Color Variant: <span className="font-normal text-indigo-600 dark:text-indigo-400">{selectedColor || product.colors[0].name}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {product.colors.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setSelectedColor(c.name)}
                          style={{ backgroundColor: c.hex }}
                          className={`w-6 h-6 rounded-full border transition-all ${
                            (selectedColor || product.colors?.[0].name) === c.name 
                              ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 border-white' 
                              : 'border-slate-300 dark:border-white/20 opacity-80 hover:opacity-100'
                          }`}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Details Tab Switcher */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-1 text-xs">
                    <button 
                      onClick={() => setActiveTab('features')}
                      className={`pb-1 font-semibold transition-colors ${activeTab === 'features' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                    >
                      Key Features
                    </button>
                    <button 
                      onClick={() => setActiveTab('specs')}
                      className={`pb-1 font-semibold transition-colors ${activeTab === 'specs' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                    >
                      Specifications
                    </button>
                  </div>

                  <div className="pt-2 text-xs text-slate-600 dark:text-zinc-400 max-h-28 overflow-y-auto">
                    {activeTab === 'features' && (
                      <ul className="space-y-1">
                        {product.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {activeTab === 'specs' && (
                      <div className="space-y-1">
                        {Object.entries(product.specifications).map(([key, val]) => (
                          <div key={key} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-white/5">
                            <span className="font-medium text-slate-500">{key}:</span>
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity & Action Buttons */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Qty:</span>
                  <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-slate-50 dark:bg-zinc-900">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="px-3 text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <span className="text-xs font-bold text-slate-900 dark:text-white ml-auto">
                    Total: ${(product.price * quantity).toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-1 justify-center"
                    icon={<ShoppingCart size={15} />}
                    onClick={handleAdd}
                  >
                    Add {quantity} to Cart
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      showToast('Product link copied');
                    }}
                  >
                    <Share2 size={15} />
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductQuickViewModal;
