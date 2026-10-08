import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Zap, 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  ArrowRight,
  Star
} from 'lucide-react';
import { UserProfile } from '../../types';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSelectPlan?: (planName: string, description: string) => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  onSelectPlan 
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  if (!isOpen) return null;

  const currentPlanName = (user.plan || 'Pro plan').toLowerCase();

  const plans = [
    {
      id: 'free',
      name: 'Starter Learner',
      badge: 'Free Forever',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Essential study tools for independent learners starting out.',
      features: [
        'Access to public study modules',
        'Up to 3 practice quizzes per day',
        'Standard learning dashboard',
        'Community Q&A access'
      ],
      isPopular: false,
      ctaText: 'Current Free Tier',
      ctaDisabled: currentPlanName.includes('starter') || currentPlanName.includes('hobby') || currentPlanName.includes('free'),
    },
    {
      id: 'pro',
      name: 'Pro Creator & Scholar',
      badge: 'Most Popular',
      priceMonthly: 19,
      priceAnnual: 15,
      description: 'Full-power learning engine, AI course builder, and unlimited quizzing.',
      features: [
        'Unlimited AI-powered practice quizzes',
        'Full-access Study & Course Builder',
        'Custom interactive quizzing engine',
        'SyncUp live video room rooms',
        'Priority 24/7 creator support',
        'Verifiable completion certificates'
      ],
      isPopular: true,
      ctaText: currentPlanName.includes('pro') ? 'Current Plan' : 'Upgrade to Pro',
      ctaDisabled: currentPlanName.includes('pro'),
    },
    {
      id: 'team',
      name: 'Enterprise Team',
      badge: 'For Organizations',
      priceMonthly: 49,
      priceAnnual: 39,
      description: 'Advanced workspace management, team analytics, and dedicated support.',
      features: [
        'Everything in Pro Creator',
        'Unlimited learner & admin profiles',
        'Advanced team progress analytics',
        'Custom domain & white-labeling',
        'Dedicated success manager',
        'SAML SSO & SLA uptime guarantee'
      ],
      isPopular: false,
      ctaText: currentPlanName.includes('enterprise') || currentPlanName.includes('team') ? 'Current Plan' : 'Get Team Plan',
      ctaDisabled: currentPlanName.includes('enterprise') || currentPlanName.includes('team'),
    }
  ];

  const handleChoosePlan = (planName: string, desc: string) => {
    if (onSelectPlan) {
      onSelectPlan(planName, desc);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(99,102,241,0.2)] overflow-hidden relative text-zinc-100 font-sans max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glowing Background Elements */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-white/10 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-indigo-400">
                <Crown size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Upgrade Your Plan</h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full flex items-center gap-1">
                  <Sparkles size={10} /> Pro Access
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Unlock full course creation, AI quizzing engines, and team analytics
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center">
            <div className="bg-zinc-900 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-zinc-800 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[9px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-extrabold border border-emerald-400/30">
                  SAVE 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {plans.map((plan) => {
              const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    plan.isPopular
                      ? 'bg-gradient-to-b from-indigo-950/60 via-purple-950/30 to-zinc-950 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10'
                      : 'bg-zinc-900/50 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Badge */}
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-black uppercase rounded-full tracking-wider shadow-md flex items-center gap-1">
                      <Star size={10} className="fill-white" /> {plan.badge}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-white tracking-tight">{plan.name}</h3>
                      {!plan.isPopular && (
                        <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md border border-white/5 font-medium">
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="my-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white tracking-tight">
                        ${price}
                      </span>
                      <span className="text-xs text-zinc-400 font-medium">
                        / month {billingCycle === 'annual' && price > 0 ? '(billed annually)' : ''}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed mb-4 min-h-[36px]">
                      {plan.description}
                    </p>

                    {/* Divider */}
                    <div className="border-t border-white/5 my-4" />

                    {/* Feature list */}
                    <div className="space-y-2.5 mb-6">
                      <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Features included:</p>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            plan.isPopular 
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' 
                              : 'bg-zinc-800 text-zinc-400 border border-white/10'
                          }`}>
                            <Check size={11} />
                          </div>
                          <span className="leading-tight">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    disabled={plan.ctaDisabled}
                    onClick={() => handleChoosePlan(plan.name, plan.description)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      plan.ctaDisabled
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                        : plan.isPopular
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30 active:scale-98'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 active:scale-98'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    {!plan.ctaDisabled && <ArrowRight size={14} />}
                  </button>

                </div>
              );
            })}
          </div>

          {/* Trust Banner Footer */}
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
              <span>30-day money-back guarantee. Cancel or switch plans anytime with one click.</span>
            </div>
            <span className="text-[11px] text-indigo-400 font-semibold shrink-0">Need custom invoices? Contact Support</span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/40 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500">
            Current account: <strong className="text-zinc-300">{user.email}</strong>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default UpgradeModal;
