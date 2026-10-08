import React, { useState } from 'react';
import { 
  Star, 
  ShoppingCart, 
  Eye, 
  Heart, 
  Check, 
  Sparkles,
  Zap
} from 'lucide-react';
import { Product } from '../../types';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, selectedColor?: string) => void;
  onQuickView: (product: Product) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onQuickView,
  isWishlisted = false,
  onToggleWishlist,
}) => {
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product.colors?.[0]?.name
  );
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const getBadgeVariant = (badge?: string) => {
    switch (badge) {
      case 'Sale': return 'rose';
      case 'Bestseller': return 'amber';
      case 'New': return 'emerald';
      case 'Limited Edition': return 'purple';
      default: return 'indigo';
    }
  };

  const discountPercent = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="group rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex flex-col justify-between overflow-hidden select-none">
      
      {/* Product Image Area */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-zinc-800/60 flex items-center justify-center">
        <img 
          src={product.images[activeImageIdx] || product.images[0]} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />

        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.badge && (
            <Badge variant={getBadgeVariant(product.badge)} size="sm">
              {product.badge}
            </Badge>
          )}
          {discountPercent > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
              -{discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Top Right Actions (Wishlist & Quick View) */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {onToggleWishlist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(product.id);
              }}
              className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                isWishlisted
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-white/80 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-300 hover:text-rose-500 hover:bg-white'
              }`}
              aria-label="Wishlist product"
            >
              <Heart size={15} className={isWishlisted ? "fill-white" : ""} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="p-2 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-white transition-all shadow-sm"
            title="Quick view product specs"
            aria-label="Quick view"
          >
            <Eye size={15} />
          </button>
        </div>

        {/* Image preview dots if multiple */}
        {product.images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {product.images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  activeImageIdx === idx ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`View image ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 mb-1">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px]">
              {product.category}
            </span>
            {product.stockCount <= 10 ? (
              <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                <Zap size={11} /> Only {product.stockCount} left
              </span>
            ) : (
              <span className="text-[10px] text-emerald-500 font-semibold">In Stock</span>
            )}
          </div>

          <h3 
            onClick={() => onQuickView(product)}
            className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 cursor-pointer"
          >
            {product.name}
          </h3>

          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
            {product.tagline}
          </p>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex items-center text-amber-400">
              <Star size={12} className="fill-amber-400" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              {product.rating.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              ({product.reviewsCount})
            </span>
          </div>

          {/* Color variant options if present */}
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">Color:</span>
              <div className="flex items-center gap-1.5">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedColor(c.name)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-4 h-4 rounded-full border transition-all ${
                      selectedColor === c.name 
                        ? 'ring-2 ring-indigo-500 scale-110 border-white' 
                        : 'border-slate-300 dark:border-white/20 opacity-80 hover:opacity-100'
                    }`}
                    title={c.name}
                    aria-label={`Select color ${c.name}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pricing & Add to Cart Button */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-slate-900 dark:text-white">
                ${product.price.toFixed(2)}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-slate-400 line-through font-medium">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onAddToCart(product, selectedColor)}
            icon={<ShoppingCart size={13} />}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
