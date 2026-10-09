import { BookOpen, ClipboardCheck, History, Home, PlusCircle, ScrollText, Settings, TrendingUp, UserCircle, Users, type LucideIcon } from 'lucide-react';

export type NavKey = 'home' | 'passbook' | 'declare' | 'plan' | 'desk' | 'record' | 'group' | 'rules' | 'account' | 'settings';
export type NavItem = { key: NavKey; label: string; to: string; icon: LucideIcon };

export const NAV: Record<NavKey, NavItem> = {
  home: { key: 'home', label: 'Home', to: '/', icon: Home },
  passbook: { key: 'passbook', label: 'Passbook', to: '/passbook', icon: BookOpen },
  declare: { key: 'declare', label: 'Declare', to: '/declare', icon: PlusCircle },
  plan: { key: 'plan', label: 'Plan', to: '/plan', icon: TrendingUp },
  desk: { key: 'desk', label: 'Desk', to: '/desk', icon: ClipboardCheck },
  record: { key: 'record', label: 'My record', to: '/record', icon: History },
  group: { key: 'group', label: 'Group', to: '/group', icon: Users },
  rules: { key: 'rules', label: 'Rules', to: '/rules', icon: ScrollText },
  account: { key: 'account', label: 'Account', to: '/account', icon: UserCircle },
  settings: { key: 'settings', label: 'Group settings', to: '/settings', icon: Settings },
};

const pick = (keys: NavKey[]) => keys.map((k) => NAV[k]);

export const bottomNav = (isAdmin: boolean) => pick(isAdmin ? ['home', 'passbook', 'declare', 'desk'] : ['home', 'passbook', 'declare', 'plan']);
export const moreItems = (isAdmin: boolean) => pick(isAdmin ? ['record', 'group', 'plan', 'rules', 'settings', 'account'] : ['record', 'group', 'rules', 'account']);
// Desktop: these sit in the pill nav; Group settings and Account are the round buttons beside it.
export const topNavItems = (isAdmin: boolean) =>
  pick(isAdmin
    ? ['home', 'passbook', 'declare', 'plan', 'record', 'group', 'desk', 'rules']
    : ['home', 'passbook', 'declare', 'plan', 'record', 'group', 'rules']);
