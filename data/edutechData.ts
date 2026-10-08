import {
  CalendarEvent,
  TimetablePeriod,
  AttendanceSession,
  StudentProfile,
  EduAssignment
} from '../types';

export const timetablePeriods: TimetablePeriod[] = [
  { periodNumber: 1, label: 'Period 1', startTime: '08:30', endTime: '09:45' },
  { periodNumber: 2, label: 'Period 2', startTime: '10:00', endTime: '11:15' },
  { periodNumber: 3, label: 'Period 3', startTime: '11:30', endTime: '12:45' },
  { periodNumber: 4, label: 'Period 4', startTime: '13:30', endTime: '14:45' },
  { periodNumber: 5, label: 'Period 5', startTime: '15:00', endTime: '16:15' },
  { periodNumber: 6, label: 'Period 6 (Labs/Seminars)', startTime: '16:30', endTime: '18:00' },
];

export const connectedCalendarUsers = [
  { id: 'user-self', name: 'Alex Thompson (You)', role: 'Student / Lead Scholar', connectionType: 'Self', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80', initials: 'AT', color: '#6366f1' },
  { id: 'user-dr-thorne', name: 'Dr. Aris Thorne', role: 'Lead Professor (CS & AI)', connectionType: 'My Instructor', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80', initials: 'AT', color: '#3b82f6' },
  { id: 'user-prof-vance', name: 'Prof. Elena Vance', role: 'Academic Dean & Advisor', connectionType: 'My Advisor', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&fit=crop&q=80', initials: 'EV', color: '#ec4899' },
  { id: 'user-maya-lin', name: 'Maya Lin', role: 'Peer Tutor & Lab Lead', connectionType: 'Study Group Peer', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&fit=crop&q=80', initials: 'ML', color: '#10b981' },
  { id: 'user-james-p', name: 'James Peterson', role: 'Senior Teaching Assistant', connectionType: 'Classmate', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&fit=crop&q=80', initials: 'JP', color: '#f59e0b' },
  { id: 'user-dept-head', name: 'Dr. Marcus Holloway', role: 'Head of Engineering', connectionType: 'Department Head', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&fit=crop&q=80', initials: 'MH', color: '#8b5cf6' }
];

// Helper to get relative dates formatted as YYYY-MM-DD
export const getCalendarDate = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

export const sampleCalendarEvents: CalendarEvent[] = [
  {
    id: 'evt-101',
    title: 'CS 301: Advanced Distributed Systems Lecture',
    description: 'Raft consensus algorithm, Paxos quorum protocols, and partitioned database replication architectures.',
    type: 'lecture',
    priority: 'high',
    startDate: getCalendarDate(0),
    endDate: getCalendarDate(0),
    startTime: '08:30',
    endTime: '09:45',
    courseId: 'crs-1',
    courseCode: 'CS-301',
    courseName: 'Distributed Systems & Cloud Orchestration',
    location: 'Turing Hall • Aud-102 & Live Stream',
    roomNumber: 'AUD-102',
    color: '#6366f1',
    isMandatory: true,
    hasAttendanceCheck: true,
    creator: {
      id: 'user-dr-thorne',
      name: 'Dr. Aris Thorne',
      role: 'Instructor',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80',
      initials: 'AT',
      connectionType: 'My Instructor'
    },
    attendeesCount: 48,
    maxCapacity: 60,
    connectedUsers: [
      { id: 'user-dr-thorne', name: 'Dr. Aris Thorne', role: 'Instructor', status: 'Accepted' },
      { id: 'user-self', name: 'Alex Thompson', role: 'Student', status: 'Accepted' },
      { id: 'user-maya-lin', name: 'Maya Lin', role: 'Student', status: 'Accepted' },
      { id: 'user-james-p', name: 'James Peterson', role: 'TA', status: 'Accepted' }
    ],
    tags: ['Distributed Systems', 'Mandatory', 'Attendance Required', 'Recording Enabled'],
    meetingUrl: 'https://campus.meet/cs301-aud102'
  },
  {
    id: 'evt-102',
    title: 'AI-504: Neural Architecture & Transformer Hands-On Lab',
    description: 'Fine-tuning Llama-3 & Gemma weights using LoRA and flash-attention v2 on Nvidia H100 cluster.',
    type: 'lab',
    priority: 'critical',
    startDate: getCalendarDate(0),
    endDate: getCalendarDate(0),
    startTime: '10:00',
    endTime: '12:45',
    courseId: 'crs-2',
    courseCode: 'AI-504',
    courseName: 'Deep Learning & LLM Architectures',
    location: 'Silicon Supercomputing Lab 4B',
    roomNumber: 'LAB-4B',
    color: '#3b82f6',
    isMandatory: true,
    hasAttendanceCheck: true,
    creator: {
      id: 'user-dr-thorne',
      name: 'Dr. Aris Thorne',
      role: 'Instructor',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80',
      initials: 'AT',
      connectionType: 'My Instructor'
    },
    attendeesCount: 32,
    maxCapacity: 35,
    connectedUsers: [
      { id: 'user-dr-thorne', name: 'Dr. Aris Thorne', role: 'Instructor', status: 'Accepted' },
      { id: 'user-self', name: 'Alex Thompson', role: 'Student', status: 'Accepted' },
      { id: 'user-maya-lin', name: 'Maya Lin', role: 'TA Lead', status: 'Accepted' }
    ],
    tags: ['GPU Cluster', 'Weights & Biases', 'Graded Lab'],
    meetingUrl: 'https://campus.meet/lab-ai504'
  },
  {
    id: 'evt-103',
    title: 'Academic Progress & Capstone Thesis Advising',
    description: '1-on-1 thesis consultation with Dean Vance regarding peer-reviewed paper submission to NeurIPS.',
    type: 'office_hours',
    priority: 'high',
    startDate: getCalendarDate(0),
    endDate: getCalendarDate(0),
    startTime: '14:00',
    endTime: '14:45',
    courseId: 'crs-thesis',
    courseCode: 'THESIS-690',
    courseName: 'Graduate Research Thesis',
    location: 'Dean\'s Office • Tower West 804',
    roomNumber: 'TW-804',
    color: '#ec4899',
    isMandatory: false,
    hasAttendanceCheck: false,
    creator: {
      id: 'user-prof-vance',
      name: 'Prof. Elena Vance',
      role: 'Academic Advisor',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&fit=crop&q=80',
      initials: 'EV',
      connectionType: 'My Advisor'
    },
    attendeesCount: 2,
    connectedUsers: [
      { id: 'user-prof-vance', name: 'Prof. Elena Vance', role: 'Advisor', status: 'Accepted' },
      { id: 'user-self', name: 'Alex Thompson', role: 'Student', status: 'Accepted' }
    ],
    tags: ['Advising', 'NeurIPS', 'Thesis Review']
  },
  {
    id: 'evt-104',
    title: 'Quantum Computing Peer Study Group & Whiteboarding',
    description: 'Simulating Shor\'s and Grover\'s algorithms using Qiskit statevectors for upcoming midterm test.',
    type: 'workshop',
    priority: 'normal',
    startDate: getCalendarDate(0),
    endDate: getCalendarDate(0),
    startTime: '16:30',
    endTime: '18:00',
    courseId: 'crs-qc',
    courseCode: 'QC-210',
    courseName: 'Quantum Information Science',
    location: 'Library Collaboration Pod 3C',
    roomNumber: 'LIB-3C',
    color: '#10b981',
    isMandatory: false,
    hasAttendanceCheck: false,
    creator: {
      id: 'user-maya-lin',
      name: 'Maya Lin',
      role: 'Student',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&fit=crop&q=80',
      initials: 'ML',
      connectionType: 'Study Group Peer'
    },
    attendeesCount: 8,
    maxCapacity: 12,
    connectedUsers: [
      { id: 'user-maya-lin', name: 'Maya Lin', role: 'Peer Leader', status: 'Accepted' },
      { id: 'user-self', name: 'Alex Thompson', role: 'Member', status: 'Accepted' },
      { id: 'user-james-p', name: 'James Peterson', role: 'Member', status: 'Accepted' }
    ],
    tags: ['Study Group', 'Qiskit', 'Whiteboard Session']
  },
  {
    id: 'evt-105',
    title: 'Midterm Examination: Cyber Security & Zero Trust Architecture',
    description: 'Proctored 90-minute closed-book examination covering PKI, TLS 1.3 handshakes, and eBPF kernel exploit detection.',
    type: 'exam',
    priority: 'critical',
    startDate: getCalendarDate(1),
    endDate: getCalendarDate(1),
    startTime: '09:00',
    endTime: '11:00',
    courseId: 'crs-sec',
    courseCode: 'SEC-402',
    courseName: 'Offensive & Defensive Cyber Security',
    location: 'Main Examination Hall A • Ground Floor',
    roomNumber: 'EXAM-A',
    color: '#ef4444',
    isMandatory: true,
    hasAttendanceCheck: true,
    creator: {
      id: 'user-dept-head',
      name: 'Dr. Marcus Holloway',
      role: 'Dept Head',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&fit=crop&q=80',
      initials: 'MH',
      connectionType: 'Department Head'
    },
    attendeesCount: 95,
    maxCapacity: 100,
    connectedUsers: [
      { id: 'user-dept-head', name: 'Dr. Marcus Holloway', role: 'Lead Examiner', status: 'Accepted' },
      { id: 'user-self', name: 'Alex Thompson', role: 'Student', status: 'Mandatory' }
    ],
    tags: ['Exam', 'Proctored', 'Strict Attendance', 'Grade Weight 30%']
  },
  {
    id: 'evt-106',
    title: 'Assignment Deadline: Cloud Native Microservices Project',
    description: 'Final GitHub repository commit and Helm chart deployment to Kubernetes staging cluster.',
    type: 'assignment',
    priority: 'high',
    startDate: getCalendarDate(2),
    endDate: getCalendarDate(2),
    startTime: '23:59',
    endTime: '23:59',
    courseId: 'crs-1',
    courseCode: 'CS-301',
    courseName: 'Distributed Systems & Cloud Orchestration',
    location: 'Online Canvas Portal & GitHub Classroom',
    color: '#f59e0b',
    isMandatory: true,
    hasAttendanceCheck: false,
    creator: {
      id: 'user-dr-thorne',
      name: 'Dr. Aris Thorne',
      role: 'Instructor',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80',
      initials: 'AT',
      connectionType: 'My Instructor'
    },
    connectedUsers: [
      { id: 'user-self', name: 'Alex Thompson', role: 'Student', status: 'Accepted' }
    ],
    tags: ['Assignment Deadline', 'GitHub Classroom', 'Automated Grading']
  },
  {
    id: 'evt-107',
    title: 'Annual Robotics & Autonomous Drones Hackathon',
    description: '48-hour hardware sprint building LIDAR-guided micro-quadcopters with obstacle avoidance AI.',
    type: 'extracurricular',
    priority: 'normal',
    startDate: getCalendarDate(4),
    endDate: getCalendarDate(5),
    startTime: '09:00',
    endTime: '18:00',
    location: 'Innovation Atrium & Drone Cage',
    roomNumber: 'ATR-1',
    color: '#8b5cf6',
    isMandatory: false,
    hasAttendanceCheck: false,
    creator: {
      id: 'user-maya-lin',
      name: 'Maya Lin',
      role: 'Student',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&fit=crop&q=80',
      initials: 'ML',
      connectionType: 'Study Group Peer'
    },
    attendeesCount: 120,
    maxCapacity: 150,
    connectedUsers: [
      { id: 'user-maya-lin', name: 'Maya Lin', role: 'Organizer', status: 'Accepted' },
      { id: 'user-self', name: 'Alex Thompson', role: 'Competitor', status: 'Accepted' },
      { id: 'user-james-p', name: 'James Peterson', role: 'Mentor', status: 'Accepted' }
    ],
    tags: ['Hackathon', 'Autonomous AI', 'Prizes $10k']
  }
];

export const sampleStudents: StudentProfile[] = [
  {
    id: 'stu-001',
    name: 'Alex Thompson',
    email: 'a.thompson@campus.edu',
    rollNumber: 'CS-2026-088',
    gradeLevel: 'Senior (4th Year)',
    cohort: 'Computer Science & AI Honours',
    gpa: 3.94,
    overallAttendance: 97.8,
    guardianName: 'Robert Thompson',
    guardianPhone: '+1 (555) 234-5678',
    guardianEmail: 'r.thompson@family.org',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
    status: 'Honors',
    enrolledCourses: ['CS-301', 'AI-504', 'SEC-402', 'QC-210'],
    academicBadges: ['Dean\'s List', '100% On-Time Submission', 'Lab Star']
  },
  {
    id: 'stu-002',
    name: 'Maya Lin',
    email: 'm.lin@campus.edu',
    rollNumber: 'CS-2026-042',
    gradeLevel: 'Senior (4th Year)',
    cohort: 'Computer Science & Robotics',
    gpa: 3.88,
    overallAttendance: 95.2,
    guardianName: 'Grace Lin',
    guardianPhone: '+1 (555) 345-6789',
    guardianEmail: 'glin@enterprise.com',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&fit=crop&q=80',
    status: 'Honors',
    enrolledCourses: ['CS-301', 'AI-504', 'ROB-310'],
    academicBadges: ['Hackathon Finalist', 'Peer Tutor']
  },
  {
    id: 'stu-003',
    name: 'Marcus Brody',
    email: 'm.brody@campus.edu',
    rollNumber: 'CS-2026-105',
    gradeLevel: 'Senior (4th Year)',
    cohort: 'Computer Science',
    gpa: 3.42,
    overallAttendance: 84.1,
    guardianName: 'Sarah Brody',
    guardianPhone: '+1 (555) 890-1234',
    guardianEmail: 'sbrody@mail.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80',
    status: 'Active',
    enrolledCourses: ['CS-301', 'AI-504', 'SEC-402'],
    academicBadges: ['Perfect Attendance Feb']
  },
  {
    id: 'stu-004',
    name: 'Chloe Chevalier',
    email: 'c.chevalier@campus.edu',
    rollNumber: 'CS-2026-019',
    gradeLevel: 'Senior (4th Year)',
    cohort: 'Software Engineering',
    gpa: 3.75,
    overallAttendance: 92.6,
    guardianName: 'Antoine Chevalier',
    guardianPhone: '+1 (555) 912-3456',
    guardianEmail: 'achevalier@corp.fr',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80',
    status: 'Active',
    enrolledCourses: ['CS-301', 'SEC-402'],
    academicBadges: ['Code Sprint Winner']
  },
  {
    id: 'stu-005',
    name: 'Devon Vance',
    email: 'd.vance@campus.edu',
    rollNumber: 'CS-2026-067',
    gradeLevel: 'Senior (4th Year)',
    cohort: 'Data Science & Analytics',
    gpa: 3.20,
    overallAttendance: 76.5,
    guardianName: 'Arthur Vance',
    guardianPhone: '+1 (555) 678-9012',
    guardianEmail: 'avance@lawfirm.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&fit=crop&q=80',
    status: 'Academic Probation',
    enrolledCourses: ['CS-301', 'AI-504'],
    academicBadges: ['Comeback Scholar']
  },
  {
    id: 'stu-006',
    name: 'Zoe Zhang',
    email: 'z.zhang@campus.edu',
    rollNumber: 'CS-2026-093',
    gradeLevel: 'Senior (4th Year)',
    cohort: 'AI & Computational Biology',
    gpa: 3.98,
    overallAttendance: 99.1,
    guardianName: 'Li Zhang',
    guardianPhone: '+1 (555) 789-0123',
    guardianEmail: 'lzhang@biotech.org',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
    status: 'Honors',
    enrolledCourses: ['CS-301', 'AI-504', 'QC-210'],
    academicBadges: ['Valedictorian Candidate', 'Research Fellow']
  }
];

export const sampleAttendanceSessions: AttendanceSession[] = [
  {
    id: 'att-session-active',
    date: getCalendarDate(0),
    startTime: '08:30',
    endTime: '09:45',
    courseId: 'crs-1',
    courseCode: 'CS-301',
    courseName: 'Distributed Systems & Cloud Orchestration',
    section: 'Section Alpha • Lecture 18',
    instructorName: 'Dr. Aris Thorne',
    instructorId: 'user-dr-thorne',
    room: 'Turing Hall • Aud-102',
    totalStudents: 6,
    presentCount: 4,
    absentCount: 1,
    lateCount: 1,
    excusedCount: 0,
    isFinalized: false,
    automatedVerification: true,
    qrCodeToken: 'CAMPUS-ATT-CS301-2026-TOKEN-9X87F',
    topicCovered: 'Consensus protocols & Raft Leader Election State Machine',
    records: [
      {
        studentId: 'stu-001',
        studentName: 'Alex Thompson',
        studentRollNo: 'CS-2026-088',
        studentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
        status: 'present',
        checkInTime: '08:28 AM',
        method: 'qr_scan',
        historicalAttendanceRate: 97.8,
        presentStreak: 14,
        remarks: 'Scanned digital badge at room door terminal.'
      },
      {
        studentId: 'stu-002',
        studentName: 'Maya Lin',
        studentRollNo: 'CS-2026-042',
        studentAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&fit=crop&q=80',
        status: 'present',
        checkInTime: '08:29 AM',
        method: 'face_ai',
        historicalAttendanceRate: 95.2,
        presentStreak: 9,
        remarks: 'Automated facial recognition verification.'
      },
      {
        studentId: 'stu-003',
        studentName: 'Marcus Brody',
        studentRollNo: 'CS-2026-105',
        studentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80',
        status: 'late',
        tardyMinutes: 12,
        checkInTime: '08:42 AM',
        method: 'manual',
        historicalAttendanceRate: 84.1,
        presentStreak: 1,
        remarks: 'Campus shuttle transit delay.'
      },
      {
        studentId: 'stu-004',
        studentName: 'Chloe Chevalier',
        studentRollNo: 'CS-2026-019',
        studentAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80',
        status: 'present',
        checkInTime: '08:31 AM',
        method: 'nfc_badge',
        historicalAttendanceRate: 92.6,
        presentStreak: 5,
        remarks: 'NFC Student Card Tap.'
      },
      {
        studentId: 'stu-005',
        studentName: 'Devon Vance',
        studentRollNo: 'CS-2026-067',
        studentAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&fit=crop&q=80',
        status: 'absent',
        method: 'manual',
        historicalAttendanceRate: 76.5,
        presentStreak: 0,
        parentNotified: true,
        remarks: 'Unexcused absence. Auto-notification dispatched to guardian.'
      },
      {
        studentId: 'stu-006',
        studentName: 'Zoe Zhang',
        studentRollNo: 'CS-2026-093',
        studentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
        status: 'present',
        checkInTime: '08:25 AM',
        method: 'qr_scan',
        historicalAttendanceRate: 99.1,
        presentStreak: 26,
        remarks: 'Early check-in verified.'
      }
    ]
  },
  {
    id: 'att-session-prev-1',
    date: getCalendarDate(-2),
    startTime: '10:00',
    endTime: '12:45',
    courseId: 'crs-2',
    courseCode: 'AI-504',
    courseName: 'Deep Learning & LLM Architectures',
    section: 'Section B • Lab 12',
    instructorName: 'Dr. Aris Thorne',
    instructorId: 'user-dr-thorne',
    room: 'Silicon Supercomputing Lab 4B',
    totalStudents: 6,
    presentCount: 5,
    absentCount: 0,
    lateCount: 0,
    excusedCount: 1,
    isFinalized: true,
    automatedVerification: true,
    topicCovered: 'LoRA fine-tuning and mixed precision FP8 quantization',
    records: [
      { studentId: 'stu-001', studentName: 'Alex Thompson', studentRollNo: 'CS-2026-088', status: 'present', checkInTime: '09:55 AM', method: 'qr_scan', historicalAttendanceRate: 97.8, presentStreak: 14 },
      { studentId: 'stu-002', studentName: 'Maya Lin', studentRollNo: 'CS-2026-042', status: 'present', checkInTime: '09:58 AM', method: 'qr_scan', historicalAttendanceRate: 95.2, presentStreak: 9 },
      { studentId: 'stu-003', studentName: 'Marcus Brody', studentRollNo: 'CS-2026-105', status: 'present', checkInTime: '10:00 AM', method: 'nfc_badge', historicalAttendanceRate: 84.1, presentStreak: 1 },
      { studentId: 'stu-004', studentName: 'Chloe Chevalier', studentRollNo: 'CS-2026-019', status: 'present', checkInTime: '09:57 AM', method: 'face_ai', historicalAttendanceRate: 92.6, presentStreak: 5 },
      { studentId: 'stu-005', studentName: 'Devon Vance', studentRollNo: 'CS-2026-067', status: 'excused', remarks: 'Medical appointment note on file.', method: 'manual', historicalAttendanceRate: 76.5, presentStreak: 0 },
      { studentId: 'stu-006', studentName: 'Zoe Zhang', studentRollNo: 'CS-2026-093', status: 'present', checkInTime: '09:50 AM', method: 'qr_scan', historicalAttendanceRate: 99.1, presentStreak: 26 }
    ]
  }
];

export const sampleEduAssignments: EduAssignment[] = [
  {
    id: 'asg-01',
    title: 'Raft Distributed Consensus Implementation in Rust',
    courseCode: 'CS-301',
    courseName: 'Distributed Systems',
    dueDate: getCalendarDate(3),
    totalPoints: 100,
    submissionType: 'Online Code',
    submissionsCount: 42,
    gradedCount: 38,
    averageScore: 91.5,
    status: 'Grading'
  },
  {
    id: 'asg-02',
    title: 'Transformer Attention Visualizer & Attention Sinks Essay',
    courseCode: 'AI-504',
    courseName: 'Deep Learning & LLMs',
    dueDate: getCalendarDate(6),
    totalPoints: 50,
    submissionType: 'PDF Essay',
    submissionsCount: 28,
    gradedCount: 15,
    averageScore: 46.2,
    status: 'Published'
  },
  {
    id: 'asg-03',
    title: 'Zero Trust Network Segmentation Lab Protocol',
    courseCode: 'SEC-402',
    courseName: 'Cyber Security',
    dueDate: getCalendarDate(10),
    totalPoints: 75,
    submissionType: 'Lab Report',
    submissionsCount: 0,
    gradedCount: 0,
    averageScore: 0,
    status: 'Published'
  }
];
