import React from 'react';
import { 
  X, 
  CheckCircle2, 
  Package, 
  Truck, 
  Home, 
  Clock, 
  Download, 
  Share2, 
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { CartItem } from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  items: CartItem[];
  discountAmount: number;
  promoCode?: string;
  showToast: (msg: string) => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  orderId,
  items,
  discountAmount,
  promoCode,
  showToast,
}) => {
  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const shipping = subtotal >= 200 ? 0 : 15;
  const tax = (subtotal - discountAmount) * 0.08;
  const total = Math.max(0, subtotal - discountAmount + shipping + tax);

  const steps = [
    { title: 'Order Confirmed', time: 'Aug 22, 12:15 PM', desc: 'Payment verified & order recorded', status: 'completed' },
    { title: 'Processing & Packed', time: 'Aug 22, 02:40 PM', desc: 'Securely packaged at Central Hub', status: 'completed' },
    { title: 'In Transit', time: 'Estimated Aug 23', desc: 'Carrier: FedEx Express Air', status: 'current' },
    { title: 'Out for Delivery', time: 'Estimated Aug 24', desc: 'Local courier dispatch', status: 'upcoming' },
    { title: 'Delivered', time: 'Estimated Aug 24, 04:00 PM', desc: 'Direct to your door', status: 'upcoming' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto select-none">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in"
          onClick={onClose}
        />

        {/* Modal Window */}
        <div className="relative transform overflow-hidden rounded-3xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-left shadow-2xl transition-all w-full max-w-2xl animate-in zoom-in-95 duration-200 z-10 p-6 md:p-8 space-y-6">
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          {/* Top Banner Confirmation */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Thank you! Order #{orderId} Confirmed
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              A confirmation email and tracking receipt have been dispatched to your primary account email.
            </p>
          </div>

          {/* Shipment Stepper Timeline */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Truck size={14} className="text-indigo-600 dark:text-indigo-400" />
                Live Shipment Tracking
              </span>
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-semibold">
                Tracking: FX-998241042-US
              </span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
              {steps.map((step, idx) => (
                <div key={idx} className="relative flex items-start justify-between gap-4">
                  {/* Step Dot Icon */}
                  <div className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    step.status === 'completed'
                      ? 'bg-emerald-500 text-white'
                      : step.status === 'current'
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 animate-pulse'
                        : 'bg-slate-200 dark:bg-zinc-800 text-transparent'
                  }`}>
                    {step.status === 'completed' && <CheckCircle2 size={10} />}
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold ${
                      step.status === 'current' 
                        ? 'text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      {step.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {step.desc}
                    </p>
                  </div>

                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">
                    {step.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Purchased Items Receipt */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Items in this shipment ({items.reduce((a, b) => a + b.quantity, 0)})
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-40 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={item.product.images[0]} 
                      alt={item.product.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h5 className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {item.product.name}
                      </h5>
                      <p className="text-[10px] text-slate-400">
                        Qty: {item.quantity} {item.selectedColor ? `• ${item.selectedColor}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total summary */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-zinc-400">
                Paid with Stripe Card (•••• 4242) {promoCode ? `[Coupon: ${promoCode}]` : ''}
              </span>
              <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => showToast('PDF Receipt & Invoice downloaded!')}
            >
              Download PDF Invoice
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
            >
              Done & Return to Store
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OrderTrackingModal;
