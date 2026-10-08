import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Layers, 
  Sliders, 
  Play, 
  Square, 
  Tag, 
  Type, 
  ToggleLeft, 
  Bell, 
  FileText, 
  Database,
  BarChart,
  Eye,
  Code,
  GraduationCap,
  ShoppingBag,
  Award,
  Truck,
  ShieldCheck,
  Star,
  CheckCircle2,
  Bookmark,
  FileCheck,
  Building,
  Lock,
  RotateCcw,
  Calendar as CalendarIcon
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Card, { CardHeader, CardContent, CardFooter } from '../ui/Card';
import StatCard from '../ui/StatCard';
import Input, { SearchInput, Textarea } from '../ui/Input';
import Switch from '../ui/Switch';
import Tabs from '../ui/Tabs';
import Avatar, { AvatarGroup } from '../ui/Avatar';
import ProgressBar, { CircularGauge } from '../ui/ProgressBar';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import Skeleton, { SkeletonCard } from '../ui/Skeleton';
import Dropdown from '../ui/Dropdown';
import Modal from '../ui/Modal';
import Drawer from '../ui/Drawer';
import CourseCard from '../learning/CourseCard';
import ProductCard from '../ecommerce/ProductCard';
import ErpWorkflowStepper from '../erp/ErpWorkflowStepper';
import CalendarWidget from '../edutech/CalendarWidget';
import { sampleCourses, sampleProducts } from '../../data/learningAndEcommerceData';
import { sampleErpDocuments } from '../../data/erpData';
import { sampleCalendarEvents } from '../../data/edutechData';

interface ComponentShowcaseViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
}

export const ComponentShowcaseView: React.FC<ComponentShowcaseViewProps> = ({
  theme,
  showToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('learning');
  const [buttonLoading, setButtonLoading] = useState(false);
  const [switchState1, setSwitchState1] = useState(true);
  const [switchState2, setSwitchState2] = useState(false);
  const [sampleInputValue, setSampleInputValue] = useState('Generic Project Alpha');
  const [sampleSearchValue, setSampleSearchValue] = useState('');
  const [progressVal, setProgressVal] = useState(65);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoDrawerOpen, setDemoDrawerOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    showToast('Code snippet copied to clipboard!');
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const categories = [
    { id: 'edutech', label: 'EduTech, Calendar & Attendance', icon: <CalendarIcon size={14} /> },
    { id: 'erp', label: 'ERP & Workflow Approvals', icon: <FileCheck size={14} /> },
    { id: 'learning', label: 'Learning & Video Courses', icon: <GraduationCap size={14} /> },
    { id: 'ecommerce', label: 'E-Commerce & Storefront', icon: <ShoppingBag size={14} /> },
    { id: 'buttons', label: 'Buttons & Actions', icon: <Play size={14} /> },
    { id: 'badges', label: 'Badges & Status', icon: <Tag size={14} /> },
    { id: 'inputs', label: 'Forms & Inputs', icon: <Type size={14} /> },
    { id: 'switches', label: 'Switches & Toggles', icon: <ToggleLeft size={14} /> },
    { id: 'progress', label: 'Progress & Gauges', icon: <Sliders size={14} /> },
    { id: 'avatars', label: 'Avatars & Groups', icon: <Layers size={14} /> },
    { id: 'cards', label: 'Cards & Metrics', icon: <Square size={14} /> },
    { id: 'alerts', label: 'Alerts & Banners', icon: <Bell size={14} /> },
    { id: 'overlays', label: 'Modals & Drawers', icon: <Eye size={14} /> },
    { id: 'skeletons', label: 'Skeletons & Loaders', icon: <Database size={14} /> },
  ];


  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Showcase Header */}
      <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/5 p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Code size={16} />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Reusable Component Library
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl">
              Clean, generic, copyable React components styled with modern Tailwind CSS and full light/dark theme adaptability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
              17 Modular Components
            </span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/5">
          <Tabs
            tabs={categories}
            activeTab={activeCategory}
            onChange={setActiveCategory}
            variant="pill"
            size="sm"
          />
        </div>
      </div>

      {/* Category Content */}
      <div className="space-y-6">

        {/* EDUTECH, CALENDAR & ATTENDANCE SHOWCASE */}
        {activeCategory === 'edutech' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Interactive Calendar & Academic Timetable Widget"
                subtitle="Embeddable dashboard calendar widget with multi-user event tracking, quick day strip, and session indicators"
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => copyCode(`<CalendarWidget events={events} onOpenFullCalendar={() => navigate('edutech')} onSelectEvent={(e) => handleSelect(e)} />`, 'code-cal-widget')}
                    leftIcon={copiedCodeId === 'code-cal-widget' ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedCodeId === 'code-cal-widget' ? 'Copied' : 'Copy JSX'}
                  </Button>
                }
              />
              <CardContent>
                <div className="max-w-md mx-auto">
                  <CalendarWidget
                    events={sampleCalendarEvents}
                    onOpenFullCalendar={() => showToast('Navigating to full calendar view...')}
                    onAddEvent={() => showToast('Add event modal triggered')}
                    onSelectEvent={(e) => showToast(`Selected event: ${e.title}`)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader
                  title="Automated 1-Click Attendance Register Row"
                  subtitle="Rapid status cycling (Present / Late / Absent / Excused) with streak counters"
                  action={
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => copyCode(`<AttendanceStatusBadge status="present" streak={14} method="qr_scan" onCycleStatus={() => cycle()} />`, 'code-att-row')}
                      leftIcon={copiedCodeId === 'code-att-row' ? <Check size={12} /> : <Copy size={12} />}
                    >
                      {copiedCodeId === 'code-att-row' ? 'Copied' : 'Copy JSX'}
                    </Button>
                  }
                />
                <CardContent>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80"
                          alt="Alex"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">Alex Thompson</div>
                          <div className="font-mono text-[10px] text-slate-500">CS-2026-088 • 97.8% Overall</div>
                        </div>
                      </div>
                      <Badge variant="emerald" size="sm">Present (QR Scan)</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60 dark:border-white/5">
                      <span className="text-slate-500 font-mono text-[11px]">Checked in: 08:28 AM</span>
                      <span className="text-amber-500 font-bold text-xs">🔥 14 Class Streak</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Multi-User Connected Academic Attribution"
                  subtitle="Tracks events set by Instructors, Advisors, and Classmates"
                  action={
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => copyCode(`<ConnectedUserTag creator={evt.creator} connectionType="My Instructor" />`, 'code-user-tag')}
                      leftIcon={copiedCodeId === 'code-user-tag' ? <Check size={12} /> : <Copy size={12} />}
                    >
                      {copiedCodeId === 'code-user-tag' ? 'Copied' : 'Copy JSX'}
                    </Button>
                  }
                />
                <CardContent>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80"
                        alt="Dr Thorne"
                        className="w-9 h-9 rounded-full object-cover border border-indigo-400"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Dr. Aris Thorne</div>
                        <div className="text-[10px] text-slate-500">Lead Professor • Connected as <strong className="text-indigo-600 dark:text-indigo-400">My Instructor</strong></div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/40 dark:border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200">
                      Scheduled: <strong>CS 301: Distributed Systems Lecture</strong> • Turing Hall Aud-102
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ERP & WORKFLOW APPROVALS SHOWCASE */}
        {activeCategory === 'erp' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Sequential Multi-Stage Approval Workflow Stepper"
                subtitle="Visual stage progression with approver roles, SLAs, digital signature hashes, and action logs"
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => copyCode(`<ErpWorkflowStepper steps={doc.workflowSteps} currentStepIndex={2} onApproveStep={(id) => handleApprove(id)} />`, 'code-stepper')}
                    leftIcon={copiedCodeId === 'code-stepper' ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedCodeId === 'code-stepper' ? 'Copied' : 'Copy JSX'}
                  </Button>
                }
              />
              <CardContent>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/5">
                  <ErpWorkflowStepper
                    steps={sampleErpDocuments[0].workflowSteps}
                    currentStepIndex={sampleErpDocuments[0].currentStepIndex}
                    canCurrentUserAct={true}
                    onApproveStep={(id) => showToast(`Simulated approval of step ${id}`)}
                    onRequestRevision={(id) => showToast(`Requested revision on step ${id}`)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader
                  title="Cryptographic PDF Verification Seal"
                  subtitle="Enterprise SHA-256 digital stamp certificate block"
                  action={
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => copyCode(`<PdfVerificationSeal certificateNumber="CERT-2026-99" hash="0x9E7A81..." verifiedBy="CFO" />`, 'code-seal')}
                      leftIcon={copiedCodeId === 'code-seal' ? <Check size={12} /> : <Copy size={12} />}
                    >
                      {copiedCodeId === 'code-seal' ? 'Copied' : 'Copy JSX'}
                    </Button>
                  }
                />
                <CardContent>
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 to-zinc-900 border border-indigo-500/30 text-white flex items-center gap-4 shadow-lg">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
                      <Lock size={22} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                          256-Bit Immutable Seal
                        </span>
                        <Badge variant="emerald" size="xs">Verified</Badge>
                      </div>
                      <p className="text-xs text-slate-300">
                        Certified by Victoria Hawthorne (CFO) • CERT-ERP-SIG-2026-0429
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        SHA-256: 0x9E7A8109F2B488C9130D71BEE450A9F2
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="3-Way Match & Procurement Line Item Ledger"
                  subtitle="Itemized quantities, unit pricing, GL codes, and tax sum"
                  action={
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => copyCode(`<ErpLineItemsTable items={lineItems} subtotal={184500} tax={14760} />`, 'code-ledger')}
                      leftIcon={copiedCodeId === 'code-ledger' ? <Check size={12} /> : <Copy size={12} />}
                    >
                      {copiedCodeId === 'code-ledger' ? 'Copied' : 'Copy JSX'}
                    </Button>
                  }
                />
                <CardContent>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-zinc-300">
                      <span>Item Specification</span>
                      <span>Total Value</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-800 dark:text-zinc-200">
                      <div>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">SYS-821GE-TNHR</span>
                        <p className="text-[11px] text-slate-500">Supermicro 4x HGX H100 80GB SXM5 (2x)</p>
                      </div>
                      <span className="font-mono font-bold">$157,000.00</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                      <span>Authorized CapEx Total:</span>
                      <span className="text-indigo-600 dark:text-indigo-400">$201,460.00 USD</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* LEARNING & VIDEO COURSES SHOWCASE */}
        {activeCategory === 'learning' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Course Card Component (Udemy / Coursera Archetype)"
                subtitle="Responsive cards with video duration, lecture count, rating, instructor, and enrollment progress"
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => copyCode(`<CourseCard course={courseData} onSelectCourse={(c) => openClassroom(c)} />`, 'code-course')}
                    leftIcon={copiedCodeId === 'code-course' ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedCodeId === 'code-course' ? 'Copied' : 'Copy JSX'}
                  </Button>
                }
              />
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sampleCourses.slice(0, 3).map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      onSelectCourse={() => showToast(`Selected "${c.title}"`)}
                      onToggleWishlist={() => showToast(`Wishlisted "${c.title}"`)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader
                  title="Video Lecture Scrubber & Note Taker Hook"
                  subtitle="Interactive timestamped note capture with time jumps"
                />
                <CardContent>
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-indigo-300">
                      <span>Live Video Time: 04:32 / 18:20</span>
                      <Badge variant="indigo" size="sm">1080p HD</Badge>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-[28%]" />
                    </div>
                    <div className="p-3 rounded-lg bg-white/10 border border-white/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Bookmark size={14} className="text-amber-400" />
                        <span>"React 19 compiler eliminates manual useMemo hooks"</span>
                      </div>
                      <span className="font-mono text-indigo-300 text-[10px]">04:32</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Official Certificate Badge Component"
                  subtitle="Verifiable accreditation badge with student attribution"
                />
                <CardContent>
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 to-zinc-900 border border-amber-500/30 text-white flex items-center gap-4 shadow-lg">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Award size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Verifiable Certificate</h4>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-white mt-0.5">Full-Stack Cloud Architecture</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">Learner: Thompson Manda • ID: CERT-88219</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* E-COMMERCE & STOREFRONT SHOWCASE */}
        {activeCategory === 'ecommerce' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Product Card with Variant Selector & Quick View"
                subtitle="Retail product card supporting image hovers, discounts, color variants, and instant cart actions"
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => copyCode(`<ProductCard product={productData} onAddToCart={(p, color) => addToCart(p, color)} />`, 'code-prod')}
                    leftIcon={copiedCodeId === 'code-prod' ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedCodeId === 'code-prod' ? 'Copied' : 'Copy JSX'}
                  </Button>
                }
              />
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sampleProducts.slice(0, 3).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAddToCart={(prod, col) => showToast(`Added ${prod.name} (${col || 'Default'}) to cart`)}
                      onQuickView={(prod) => showToast(`Quick view opened for ${prod.name}`)}
                      onToggleWishlist={(id) => showToast(`Toggled wishlist for product ${id}`)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card>
                <CardHeader title="Cart Summary Row" subtitle="Quantity steppers & prices" />
                <CardContent>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white">Zenith Pro Keyboard</h5>
                      <p className="text-[10px] text-slate-400">Qty: 1 • Space Gray</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">$249.00</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Shipping Progress Tracker" subtitle="Gamified free shipping progress" />
                <CardContent>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Truck size={13} /> Free Shipping Unlocked!
                      </span>
                      <span className="font-bold">100%</span>
                    </div>
                    <ProgressBar value={100} variant="emerald" size="sm" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Coupon Voucher Box" subtitle="Discount promo code validation" />
                <CardContent>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Tag size={13} /> Code: DEV20 (-20%)
                    </span>
                    <Badge variant="emerald" size="sm">Applied</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 1. BUTTONS */}
        {activeCategory === 'buttons' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Button Variants"
                subtitle="Primary, secondary, outline, ghost, danger, and success states"
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => copyCode(`<Button variant="primary">Click Me</Button>`, 'btn-1')}
                    leftIcon={copiedCodeId === 'btn-1' ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedCodeId === 'btn-1' ? 'Copied' : 'Copy JSX'}
                  </Button>
                }
              />
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primary Action</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="success">Success</Button>
                  <Button
                    variant="primary"
                    isLoading={buttonLoading}
                    onClick={() => {
                      setButtonLoading(true);
                      setTimeout(() => setButtonLoading(false), 2000);
                    }}
                  >
                    {buttonLoading ? 'Processing...' : 'Click to Load'}
                  </Button>
                  <Button variant="primary" disabled>Disabled</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Button Sizes" subtitle="Sizes ranging from xs to lg" />
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="xs" variant="primary">Extra Small (xs)</Button>
                  <Button size="sm" variant="primary">Small (sm)</Button>
                  <Button size="md" variant="primary">Medium (md)</Button>
                  <Button size="lg" variant="primary">Large (lg)</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 2. BADGES */}
        {activeCategory === 'badges' && (
          <Card>
            <CardHeader
              title="Badge & Status Indicators"
              subtitle="Pills, colored status dots, and removable chips"
              action={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => copyCode(`<Badge variant="success" dot pulse>Active</Badge>`, 'badge-1')}
                  leftIcon={copiedCodeId === 'badge-1' ? <Check size={12} /> : <Copy size={12} />}
                >
                  {copiedCodeId === 'badge-1' ? 'Copied' : 'Copy JSX'}
                </Button>
              }
            />
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="primary">Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="success" dot pulse>Active Live</Badge>
                <Badge variant="warning" dot>Pending Review</Badge>
                <Badge variant="danger" dot>Action Required</Badge>
                <Badge variant="info">Information</Badge>
                <Badge variant="purple">Enterprise</Badge>
                <Badge variant="neutral">Draft</Badge>
                <Badge variant="outline">Outlined</Badge>
                <Badge
                  variant="primary"
                  onRemove={() => showToast('Badge removed!')}
                >
                  Removable Tag
                </Badge>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Badge size="sm" variant="success">Small</Badge>
                <Badge size="md" variant="success">Medium</Badge>
                <Badge size="lg" variant="success">Large</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. INPUTS */}
        {activeCategory === 'inputs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Standard Inputs" subtitle="Text inputs, labels, and error validation" />
              <CardContent className="space-y-4">
                <Input
                  label="Generic Project Name"
                  placeholder="e.g. Acme API Gateway"
                  value={sampleInputValue}
                  onChange={(e) => setSampleInputValue(e.target.value)}
                  helperText="Enter a clean, descriptive project moniker"
                />

                <Input
                  label="Secured Secret Key"
                  type="password"
                  placeholder="Enter secret token"
                  defaultValue="my_super_secret_token_12345"
                />

                <Input
                  label="Validation Error State"
                  defaultValue="invalid_email_format@"
                  errorMessage="Please supply a valid RFC-compliant email address"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Search & Multi-line" subtitle="Shortcut search boxes and text areas" />
              <CardContent className="space-y-4">
                <SearchInput
                  placeholder="Search resources, users, logs..."
                  value={sampleSearchValue}
                  onChange={(e) => setSampleSearchValue(e.target.value)}
                  onClear={() => setSampleSearchValue('')}
                  shortcutHint="⌘K"
                />

                <Textarea
                  label="Entity Description"
                  placeholder="Provide additional details regarding this entity..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4. SWITCHES */}
        {activeCategory === 'switches' && (
          <Card>
            <CardHeader title="Switches & Toggles" subtitle="Interactive binary state toggles" />
            <CardContent className="space-y-4 max-w-xl">
              <Switch
                checked={switchState1}
                onChange={setSwitchState1}
                label="Automatic Database Backup"
                description="Trigger scheduled snapshots every 24 hours at 00:00 UTC."
              />
              <div className="border-t border-slate-100 dark:border-white/5 pt-3" />
              <Switch
                checked={switchState2}
                onChange={setSwitchState2}
                label="Public Access Permitted"
                description="Allow read-only queries from unauthenticated external clients."
              />
              <div className="border-t border-slate-100 dark:border-white/5 pt-3" />
              <Switch
                checked={false}
                onChange={() => {}}
                disabled
                label="Two-Factor Enforced (Disabled Plan)"
                description="Requires Enterprise tier subscription to toggle."
              />
            </CardContent>
          </Card>
        )}

        {/* 5. PROGRESS & GAUGES */}
        {activeCategory === 'progress' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader
                title="Linear Progress Bars"
                subtitle="Animated, striped, and multi-color progress tracks"
              />
              <CardContent className="space-y-4">
                <ProgressBar label="Indigo Standard" value={progressVal} color="indigo" />
                <ProgressBar label="Emerald Success" value={88} color="emerald" />
                <ProgressBar label="Amber Warning" value={45} color="amber" />
                <ProgressBar label="Gradient Multi-stage" value={72} color="gradient" striped />
                
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setProgressVal(Math.max(0, progressVal - 15))}
                  >
                    -15%
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setProgressVal(Math.min(100, progressVal + 15))}
                  >
                    +15%
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Circular Radial Gauges" subtitle="Percentage rings with center values" />
              <CardContent className="flex items-center justify-around py-4">
                <CircularGauge value={75} size={90} label="Storage" color="#6366f1" />
                <CircularGauge value={92} size={90} label="Uptime" color="#10b981" />
                <CircularGauge value={34} size={90} label="Bandwidth" color="#f59e0b" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 6. AVATARS */}
        {activeCategory === 'avatars' && (
          <Card>
            <CardHeader title="Avatars & Avatar Groups" subtitle="Images, fallback initials, presence status, and groups" />
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" size="xs" status="online" />
                <Avatar src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80" size="sm" status="busy" />
                <Avatar src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80" size="md" status="away" />
                <Avatar name="Alex Rivera" size="lg" status="online" />
                <Avatar name="David Chen" size="xl" />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">Stacked Team Groups</p>
                <AvatarGroup
                  avatars={[
                    { name: 'Sarah Jenkins', src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
                    { name: 'David Chen', src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
                    { name: 'Elena Rostova', src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
                    { name: 'Marcus Vance' },
                    { name: 'Amina Al-Mansoor' },
                  ]}
                  max={3}
                  size="md"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 7. CARDS & STATS */}
        {activeCategory === 'cards' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Sample Metric (Positive)"
                value="$45,210"
                change="+18.4%"
                isPositive={true}
                color="emerald"
                sparkline={[20, 30, 45, 40, 60, 75, 80]}
              />
              <StatCard
                label="Sample Metric (Negative)"
                value="1.24s"
                change="-4.2%"
                isPositive={false}
                color="rose"
                sparkline={[80, 75, 70, 65, 50, 45, 30]}
              />
              <StatCard
                label="Sample Metric (Neutral)"
                value="100%"
                change="0.0%"
                neutral={true}
                color="purple"
              />
            </div>
          </div>
        )}

        {/* 8. ALERTS */}
        {activeCategory === 'alerts' && (
          <Card>
            <CardHeader title="Alerts & Notification Banners" subtitle="Info, success, warning, and error messages" />
            <CardContent className="space-y-3">
              <Alert variant="info" title="System Scheduled Maintenance" dismissible>
                Database maintenance is scheduled for Sunday at 02:00 UTC. No downtime expected.
              </Alert>
              <Alert variant="success" title="Deployment Successful" dismissible>
                Version 2.5.0-slim has passed all automated tests and is live in production.
              </Alert>
              <Alert variant="warning" title="Quota Limit Warning" dismissible>
                You have reached 80% of your allocated monthly API bandwidth.
              </Alert>
              <Alert variant="danger" title="Webhook Delivery Failure" dismissible>
                Endpoint https://api.example.com/events returned HTTP 500 Internal Error.
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* 9. OVERLAYS */}
        {activeCategory === 'overlays' && (
          <Card>
            <CardHeader title="Modals & Slide-over Drawers" subtitle="Accessible overlays with smooth animations" />
            <CardContent>
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={() => setDemoModalOpen(true)}>
                  Open Sample Modal
                </Button>
                <Button variant="secondary" onClick={() => setDemoDrawerOpen(true)}>
                  Open Slide-over Drawer
                </Button>
              </div>

              {/* Sample Modal */}
              <Modal
                isOpen={demoModalOpen}
                onClose={() => setDemoModalOpen(false)}
                title="Generic Reusable Modal"
                description="This dialog can be populated with any arbitrary content, forms, or confirmations."
                footer={
                  <>
                    <Button variant="outline" size="sm" onClick={() => setDemoModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => {
                      setDemoModalOpen(false);
                      showToast('Modal action executed!');
                    }}>
                      Confirm Action
                    </Button>
                  </>
                }
              >
                <div className="space-y-3">
                  <Input label="Entity Name" placeholder="e.g. Master Cluster 01" />
                  <Textarea label="Notes & Tags" placeholder="Optional meta descriptions..." />
                </div>
              </Modal>

              {/* Sample Drawer */}
              <Drawer
                isOpen={demoDrawerOpen}
                onClose={() => setDemoDrawerOpen(false)}
                title="Entity Inspector"
                subtitle="Slide-over detail inspector panel"
                footer={
                  <Button variant="primary" size="sm" onClick={() => setDemoDrawerOpen(false)}>
                    Close Inspector
                  </Button>
                }
              >
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-2 text-xs">
                    <p className="text-slate-500 dark:text-zinc-400">Resource ID: <span className="font-mono text-slate-800 dark:text-white">res_891042</span></p>
                    <p className="text-slate-500 dark:text-zinc-400">Created: <span className="text-slate-800 dark:text-white">Aug 17, 2026</span></p>
                    <p className="text-slate-500 dark:text-zinc-400">Status: <Badge variant="success" size="sm">Active</Badge></p>
                  </div>
                  <ProgressBar label="Compute Load" value={54} color="indigo" />
                </div>
              </Drawer>
            </CardContent>
          </Card>
        )}

        {/* 10. SKELETONS */}
        {activeCategory === 'skeletons' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SkeletonCard />
            <Card>
              <CardHeader title="Empty State Component" subtitle="Customizable placeholder when data is blank" />
              <CardContent>
                <EmptyState
                  title="No Records Found"
                  description="There are currently no items matching this criteria."
                  actionText="Create First Record"
                  onAction={() => showToast('Create action triggered!')}
                />
              </CardContent>
            </Card>
          </div>
        )}

      </div>

    </div>
  );
};

export default ComponentShowcaseView;
