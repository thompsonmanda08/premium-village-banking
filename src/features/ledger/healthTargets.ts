/**
 * What "on track" means for the group, in one place so it is easy to change. Green is at or better than `good`, amber at or better than
 * `watch`, red otherwise. Where lower is better (balances at risk, members behind, the largest saver's share) the percentages are strict
 * ("under 5%") and the member count is inclusive ("at most 2").
 */
export const TARGETS = {
  poolWorking: { good: 0.7, watch: 0.5, text: '70% or more owed back, not idle' },
  minimumsMet: { good: 0.85, watch: 0.65, text: '85% or more' },
  atRisk: { good: 0.05, watch: 0.15, text: 'Under 5% of the pool' },
  savers: { good: 0.9, watch: 0.75, text: '90% or more' },
  behind: { good: 2, watch: 5, text: 'At most 2 members behind' },
  concentration: { good: 0.3, watch: 0.45, text: 'Under 30% of the pool' },
} as const;
