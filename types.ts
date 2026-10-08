export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  initials: string;
  role: string;
  plan: string;
  planDescription?: string;
  streakDays?: number;
  streakTarget?: number;
  userType?: string;
  company?: string;
  department?: string;
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  plan: string;
  isCurrent: boolean;
  avatarColor?: string;
  membersCount?: number;
}

export interface MetricData {
  id: string;
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  period: string;
  iconName?: string;
  sparkline?: number[];
  color?: 'indigo' | 'emerald' | 'amber' | 'purple' | 'blue' | 'rose';
}

export interface TransactionRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed' | 'Refunded';
  date: string;
  category: string;
  paymentMethod: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: 'Backlog' | 'In Progress' | 'Review' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignee: {
    name: string;
    avatar?: string;
    initials: string;
  };
  dueDate: string;
  commentsCount: number;
  attachmentsCount: number;
  progress: number;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
    avatar?: string;
  };
  action: string;
  target: string;
  status: 'success' | 'warning' | 'error' | 'info';
  ipAddress: string;
}

export interface ChartDataPoint {
  name: string;
  revenue: number;
  expenses: number;
  users: number;
  requests: number;
}

// Learning Platform Types
export interface CourseLesson {
  id: string;
  title: string;
  duration: string; // e.g. "12:45"
  durationSeconds: number;
  type: 'video' | 'quiz' | 'article' | 'exercise';
  videoUrl?: string;
  isCompleted?: boolean;
  isFreePreview?: boolean;
  notes?: string;
  resources?: {
    id: string;
    title: string;
    type: 'pdf' | 'zip' | 'link' | 'code';
    size?: string;
    url: string;
  }[];
}

export interface CourseSection {
  id: string;
  title: string;
  description?: string;
  lessons: CourseLesson[];
}

export interface CourseReview {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  date: string;
  comment: string;
}

export interface CourseNote {
  id: string;
  lessonId: string;
  lessonTitle: string;
  timestamp: string; // e.g. "04:32"
  timestampSeconds: number;
  text: string;
  createdAt: string;
}

export interface CourseDiscussion {
  id: string;
  lessonId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  title: string;
  content: string;
  timestamp: string;
  upvotes: number;
  repliesCount: number;
  hasInstructorReply?: boolean;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  instructor: {
    id: string;
    name: string;
    avatar: string;
    title: string;
    bio: string;
    rating: number;
    studentsCount: number;
    coursesCount: number;
  };
  category: string;
  level: 'All Levels' | 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  reviewsCount: number;
  enrolledStudentsCount: number;
  lastUpdated: string;
  language: string;
  hasCertificate: boolean;
  totalDuration: string; // e.g. "18.5 total hours"
  totalLectures: number;
  price: number;
  originalPrice?: number;
  badge?: 'Bestseller' | 'Highest Rated' | 'Hot & New' | 'Featured';
  isEnrolled?: boolean;
  progressPercentage?: number;
  completedLessonsCount?: number;
  whatYouWillLearn: string[];
  requirements: string[];
  sections: CourseSection[];
}

// E-Commerce Platform Types
export interface ProductVariant {
  id: string;
  name: string;
  type: 'color' | 'size' | 'edition' | 'storage';
  value: string;
  inStock?: boolean;
}

export interface ProductReview {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  category: string;
  inStock: boolean;
  stockCount: number;
  isFeatured?: boolean;
  badge?: 'Sale' | 'New' | 'Bestseller' | 'Limited Edition';
  images: string[];
  features: string[];
  specifications: Record<string, string>;
  colors?: { name: string; hex: string }[];
  sizes?: string[];
  ratingBreakdown?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface OrderTrackingStep {
  id: string;
  title: string;
  description: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'upcoming';
}

// ERP Document Management & Procurement Types
export type ErpDocumentType = 
  | 'Purchase Requisition'
  | 'Purchase Order'
  | 'Goods Received Note'
  | 'Purchase Voucher'
  | 'Request for Quotation';

export type ErpDocumentStatus = 
  | 'Draft'
  | 'Under Verification'
  | 'Pending Approval'
  | 'Approved'
  | 'Revision Requested'
  | 'Rejected'
  | 'Fulfilled'
  | 'Closed';

export type ErpPriority = 'Standard' | 'Medium' | 'Urgent' | 'High Value';

export interface ErpLineItem {
  id: string;
  itemCode: string;
  description: string;
  category: string;
  quantity: number;
  unit: string; // e.g. 'Units', 'Pcs', 'Sets', 'Boxes', 'Hrs'
  unitPrice: number;
  taxRate: number; // e.g. 0.08 for 8%
  totalAmount: number;
  receivedQuantity?: number;
  glAccountCode?: string;
}

export interface ErpApprovalStep {
  id: string;
  stepNumber: number;
  stepName: string;
  requiredRole: string;
  assignedApprover: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    initials: string;
  };
  status: 'approved' | 'current' | 'pending' | 'rejected' | 'revision_requested' | 'skipped';
  actionDate?: string;
  actionComment?: string;
  signatureHash?: string;
  slaDeadline?: string;
  isOverdue?: boolean;
}

export interface ErpDocumentAttachment {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'png' | 'jpg' | 'zip';
  fileSize: string;
  category: 
    | 'Vendor Quotation'
    | 'Proforma Invoice'
    | 'Technical Specification'
    | 'Quality Inspection Sheet'
    | 'Bill of Lading'
    | 'Contract Agreement'
    | 'Delivery Challan'
    | 'Tax Exemption Certificate';
  uploadedBy: {
    name: string;
    avatar?: string;
  };
  uploadedAt: string;
  isVerified: boolean;
  checksum: string;
  downloadUrl?: string;
}

export interface ErpDocumentAuditLog {
  id: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
    initials: string;
  };
  action: 
    | 'Created Document'
    | 'Submitted for Verification'
    | 'Verified Line Items'
    | 'Approved Stage'
    | 'Digitally Signed'
    | 'Requested Revision'
    | 'Rejected Document'
    | 'Uploaded Supporting File'
    | 'Dispatched to Vendor'
    | 'Recorded Goods Receipt'
    | 'Exported PDF Copy';
  details: string;
  previousStatus?: ErpDocumentStatus;
  newStatus?: ErpDocumentStatus;
  ipAddress: string;
  digitalFingerprint?: string;
}

export interface ErpDocument {
  id: string;
  documentNumber: string; // e.g. 'PR-2026-089', 'PO-2026-042', 'GRN-2026-118', 'PV-2026-031'
  type: ErpDocumentType;
  title: string;
  description: string;
  status: ErpDocumentStatus;
  priority: ErpPriority;
  department: string;
  costCenter: string;
  
  // Requester
  requester: {
    id: string;
    name: string;
    email: string;
    department: string;
    avatar?: string;
    initials: string;
  };

  // Vendor / Supplier details (for POs, RFQs, Vouchers)
  vendor?: {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    taxId: string;
    paymentTerms: string; // e.g. 'Net 30', 'Immediate', '50% Advance'
    address: string;
  };

  // Related Document Reference (e.g. PO referencing a PR, GRN referencing a PO)
  referenceDocNumber?: string;

  // Financial figures
  currency: string;
  subtotal: number;
  taxAmount: number;
  shippingHandling: number;
  totalAmount: number;

  // Timestamps
  createdDate: string;
  requiredByDate: string;
  targetDeliveryDate?: string;
  lastUpdated: string;

  // Items
  lineItems: ErpLineItem[];

  // Workflow Pipeline
  currentStepIndex: number; // 0-based index of which step is currently pending
  workflowSteps: ErpApprovalStep[];

  // Attachments
  attachments: ErpDocumentAttachment[];

  // Audit Logs
  auditTrail: ErpDocumentAuditLog[];

  // Notes & terms
  deliveryLocation: string;
  termsAndConditions?: string[];
  pdfVerificationSeal?: {
    verifiedBy: string;
    timestamp: string;
    hash: string;
    certificateNumber: string;
  };
}

// ==========================================
// EDUTECH & SCHOOL MANAGEMENT TYPES
// ==========================================

export type CalendarEventType =
  | 'lecture'
  | 'lab'
  | 'exam'
  | 'assignment'
  | 'workshop'
  | 'office_hours'
  | 'extracurricular'
  | 'meeting'
  | 'faculty_board';

export type CalendarEventPriority = 'low' | 'normal' | 'high' | 'critical';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'timetable' | 'agenda';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface CalendarEventCreator {
  id: string;
  name: string;
  role: 'Instructor' | 'Student' | 'Administrator' | 'TA' | 'Academic Advisor' | 'Dept Head';
  avatar?: string;
  initials: string;
  connectionType: 'Self' | 'My Instructor' | 'My Advisor' | 'Classmate' | 'Department Head' | 'Study Group Peer';
}

export interface CalendarConnectedUser {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  status: 'Accepted' | 'Declined' | 'Tentative' | 'Mandatory';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  type: CalendarEventType;
  priority?: CalendarEventPriority;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "10:30"
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  location: string;
  roomNumber?: string;
  color: string;
  creator: CalendarEventCreator;
  attendeesCount?: number;
  maxCapacity?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  isMandatory?: boolean;
  hasAttendanceCheck?: boolean;
  connectedUsers: CalendarConnectedUser[];
  tags: string[];
  meetingUrl?: string;
}

export interface TimetablePeriod {
  periodNumber: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  studentRollNo: string;
  studentAvatar?: string;
  status: AttendanceStatus;
  tardyMinutes?: number;
  checkInTime?: string;
  method: 'manual' | 'qr_scan' | 'nfc_badge' | 'face_ai' | 'pin_code';
  remarks?: string;
  parentNotified?: boolean;
  historicalAttendanceRate: number; // percentage (e.g. 95.4)
  presentStreak: number;
}

export interface AttendanceSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  section: string;
  instructorName: string;
  instructorId: string;
  room: string;
  records: AttendanceRecord[];
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  isFinalized: boolean;
  qrCodeToken?: string;
  automatedVerification: boolean;
  topicCovered?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  gradeLevel: string;
  cohort: string;
  gpa: number;
  overallAttendance: number;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  avatar?: string;
  status: 'Active' | 'On Leave' | 'Academic Probation' | 'Honors';
  enrolledCourses: string[];
  academicBadges: string[];
}

export interface EduAssignment {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  dueDate: string;
  totalPoints: number;
  submissionType: 'Online Code' | 'PDF Essay' | 'Quiz' | 'Lab Report' | 'Project Archive';
  submissionsCount: number;
  gradedCount: number;
  averageScore: number;
  status: 'Published' | 'Draft' | 'Grading' | 'Closed';
}

