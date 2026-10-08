import { Course, Product } from '../types';

export const sampleCourses: Course[] = [
  {
    id: 'course-1',
    title: 'Complete Modern React & Full-Stack Cloud Architecture 2026',
    slug: 'modern-react-cloud-architecture',
    subtitle: 'Master React 19, Next.js App Router, TypeScript, Microservices, and Cloud Deployment from Scratch to Production.',
    description: 'Learn modern full-stack web development with deep industry practices. Build scalable client applications, serverless API backends, real-time WebSockets, and deploy microservices with automated CI/CD pipelines on Google Cloud and Docker containers.',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80',
    instructor: {
      id: 'inst-1',
      name: 'Dr. Alex Vance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      title: 'Principal Cloud Architect & Author',
      bio: 'Ex-Google Staff Engineer with 12+ years of distributed systems and frontend architecture experience. Passionate about empowering 250k+ engineers globally.',
      rating: 4.9,
      studentsCount: 142800,
      coursesCount: 8,
    },
    category: 'Web Development',
    level: 'All Levels',
    rating: 4.9,
    reviewsCount: 18450,
    enrolledStudentsCount: 68420,
    lastUpdated: 'August 2026',
    language: 'English (US)',
    hasCertificate: true,
    totalDuration: '28.5 total hours',
    totalLectures: 34,
    price: 84.99,
    originalPrice: 199.99,
    badge: 'Bestseller',
    isEnrolled: true,
    progressPercentage: 42,
    completedLessonsCount: 6,
    whatYouWillLearn: [
      'Architect enterprise-grade React applications using TypeScript and Next.js App Router',
      'Build performant state machines, concurrent rendering, and server components',
      'Deploy containerized Docker microservices to Kubernetes & Google Cloud Run',
      'Implement real-time WebSocket communication and secure OAuth2 & JWT flows',
      'Perform end-to-end automated testing with Playwright, Vitest, and Jest',
      'Optimize Web Vitals, tree-shaking, memory leaks, and lighthouse scores'
    ],
    requirements: [
      'Basic familiarity with JavaScript syntax (ES6+)',
      'A computer (macOS, Windows, or Linux) with Node.js 20+ installed',
      'No prior React or cloud engineering experience needed — starts from foundations'
    ],
    sections: [
      {
        id: 'sec-1',
        title: 'Section 1: Foundations of Modern React & TypeScript Engine',
        description: 'Understand the virtual DOM reconciliation loop, fibers, concurrent transitions, and strict type constraints.',
        lessons: [
          {
            id: 'l-1',
            title: '1. Welcome & Course Blueprint Overview',
            duration: '06:12',
            durationSeconds: 372,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            isCompleted: true,
            isFreePreview: true,
            notes: 'High-level roadmap and repository setup guide.',
            resources: [
              { id: 'r1', title: 'Curriculum Roadmap PDF', type: 'pdf', size: '2.4 MB', url: '#' },
              { id: 'r2', title: 'Starter GitHub Repository', type: 'code', size: 'Github', url: 'https://github.com' }
            ]
          },
          {
            id: 'l-2',
            title: '2. React 19 Compiler, Server Actions, & Hook Paradigms',
            duration: '14:45',
            durationSeconds: 885,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            isCompleted: true,
            isFreePreview: true,
            notes: 'Understanding compiler optimizations and memo elimination.',
            resources: [
              { id: 'r3', title: 'React 19 Cheat Sheet', type: 'pdf', size: '1.1 MB', url: '#' }
            ]
          },
          {
            id: 'l-3',
            title: '3. Deep Dive into TypeScript Strict Mode & Generics in JSX',
            duration: '18:20',
            durationSeconds: 1100,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            isCompleted: true,
            isFreePreview: false,
            notes: 'Utility types: Partial, Record, Infer, and Discriminated Unions.'
          },
          {
            id: 'l-4',
            title: '4. Knowledge Check: Component Lifecycles & Type Guard Quiz',
            duration: '10:00',
            durationSeconds: 600,
            type: 'quiz',
            isCompleted: true,
            isFreePreview: false
          }
        ]
      },
      {
        id: 'sec-2',
        title: 'Section 2: High-Performance State Architecture & Data Fetching',
        description: 'Server components vs client components, optimistic updates, query caching, and cache revalidation.',
        lessons: [
          {
            id: 'l-5',
            title: '5. Server Actions & Cache Invalidation Strategies',
            duration: '16:30',
            durationSeconds: 990,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            isCompleted: true,
            isFreePreview: false,
            notes: 'revalidateTag and revalidatePath in real apps.'
          },
          {
            id: 'l-6',
            title: '6. Optimistic UI Updates with useOptimistic & Pending Transitions',
            duration: '15:10',
            durationSeconds: 910,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            isCompleted: true,
            isFreePreview: false,
            notes: 'Building instantaneous interactive mutation rollbacks.'
          },
          {
            id: 'l-7',
            title: '7. Building a Custom Reactive Event Bus & Real-Time Sync',
            duration: '21:05',
            durationSeconds: 1265,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
            isCompleted: false,
            isFreePreview: false,
            notes: 'Connecting SSE and WebSockets to custom React Hooks.'
          },
          {
            id: 'l-8',
            title: '8. Hands-On Exercise: Implement Infinite Scrolling Virtualizer',
            duration: '25:00',
            durationSeconds: 1500,
            type: 'exercise',
            isCompleted: false,
            isFreePreview: false
          }
        ]
      },
      {
        id: 'sec-3',
        title: 'Section 3: Cloud Microservices, Docker, & Kubernetes Clusters',
        description: 'Containerizing fullstack applications, configuring environment secrets, and autoscaling workloads.',
        lessons: [
          {
            id: 'l-9',
            title: '9. Multi-Stage Docker Builds for Node & React SPAs',
            duration: '19:40',
            durationSeconds: 1180,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
            isCompleted: false,
            isFreePreview: false
          },
          {
            id: 'l-10',
            title: '10. Cloud Run & Nginx Reverse Proxy Orchestration',
            duration: '24:15',
            durationSeconds: 1455,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
            isCompleted: false,
            isFreePreview: false
          },
          {
            id: 'l-11',
            title: '11. Zero-Downtime Deployment & Canary Rollouts',
            duration: '22:50',
            durationSeconds: 1370,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
            isCompleted: false,
            isFreePreview: false
          }
        ]
      },
      {
        id: 'sec-4',
        title: 'Section 4: Production Security, OAuth2, & Final Capstone Project',
        description: 'Audit logs, rate-limiting, CSP headers, automated vulnerability scans, and certificate issuance.',
        lessons: [
          {
            id: 'l-12',
            title: '12. Hardening API Routes with Rate Limiting & CSRF Protection',
            duration: '17:35',
            durationSeconds: 1055,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            isCompleted: false,
            isFreePreview: false
          },
          {
            id: 'l-13',
            title: '13. Final Capstone Project Submission & Peer Review',
            duration: '35:00',
            durationSeconds: 2100,
            type: 'exercise',
            isCompleted: false,
            isFreePreview: false
          },
          {
            id: 'l-14',
            title: '14. Certification Exam & Next Steps',
            duration: '15:00',
            durationSeconds: 900,
            type: 'quiz',
            isCompleted: false,
            isFreePreview: false
          }
        ]
      }
    ]
  },
  {
    id: 'course-2',
    title: 'Generative AI & Agentic Systems Engineering with Gemini 2.5',
    slug: 'generative-ai-agentic-systems',
    subtitle: 'Build Autonomous AI Agents, RAG Pipelines, Multi-Modal Tool Calling, and Enterprise LLM Workflows.',
    description: 'A comprehensive, hands-on masterclass in constructing autonomous reasoning agents, vector database indexing, dynamic tool execution, function calling, and grounding with real-time web knowledge.',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    instructor: {
      id: 'inst-2',
      name: 'Dr. Marcus Thorne',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      title: 'AI Research Director & Google Developer Expert',
      bio: 'Pioneering multimodal research and agent evaluation frameworks for enterprise fintech & health systems.',
      rating: 4.95,
      studentsCount: 98400,
      coursesCount: 5,
    },
    category: 'AI & Machine Learning',
    level: 'Intermediate',
    rating: 4.95,
    reviewsCount: 12300,
    enrolledStudentsCount: 41200,
    lastUpdated: 'August 2026',
    language: 'English (US)',
    hasCertificate: true,
    totalDuration: '22.0 total hours',
    totalLectures: 28,
    price: 94.99,
    originalPrice: 189.99,
    badge: 'Hot & New',
    isEnrolled: false,
    whatYouWillLearn: [
      'Build autonomous multi-step agents with Gemini 2.5 Flash & Pro models',
      'Implement Structured Outputs, schema constraints, and automatic JSON repair',
      'Engineer hybrid vector search with Pinecone, pgvector, and BM25 indexing',
      'Design tool-calling functions for SQL query generation, web search, and CRM integrations',
      'Mitigate hallucination with deterministic verification layers and confidence scoring'
    ],
    requirements: [
      'Intermediate Python or TypeScript programming knowledge',
      'Understanding of REST APIs and async await patterns'
    ],
    sections: [
      {
        id: 'ai-sec-1',
        title: 'Section 1: Multimodal Foundation Models & Prompt Architecture',
        lessons: [
          {
            id: 'ai-l-1',
            title: '1. Model Selection: Flash vs Pro vs Ultra Architectures',
            duration: '11:20',
            durationSeconds: 680,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            isCompleted: false,
            isFreePreview: true
          },
          {
            id: 'ai-l-2',
            title: '2. Structured JSON Generation & Schema Validation',
            duration: '16:40',
            durationSeconds: 1000,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            isCompleted: false,
            isFreePreview: true
          }
        ]
      }
    ]
  },
  {
    id: 'course-3',
    title: 'UI/UX Design Systems & Design-to-Code Mastery',
    slug: 'ui-ux-design-systems-mastery',
    subtitle: 'From Figma Tokens & Variables to Production Tailwind CSS & Radix UI Component Kits.',
    description: 'Transform interface design into mathematically sound, accessible design systems. Learn typography scales, optical spacing, dark mode color science, and component token pipelines.',
    thumbnail: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80',
    instructor: {
      id: 'inst-3',
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      title: 'Design Director at Studio Zenith',
      bio: 'Leading product design for 10+ Fortune 500 apps. Advocate for anti-slop typography and optical micro-interactions.',
      rating: 4.88,
      studentsCount: 76000,
      coursesCount: 4,
    },
    category: 'UI/UX Design',
    level: 'All Levels',
    rating: 4.88,
    reviewsCount: 9450,
    enrolledStudentsCount: 32900,
    lastUpdated: 'July 2026',
    language: 'English (US)',
    hasCertificate: true,
    totalDuration: '16.0 total hours',
    totalLectures: 22,
    price: 69.99,
    originalPrice: 149.99,
    badge: 'Featured',
    isEnrolled: false,
    whatYouWillLearn: [
      'Establish robust design token systems with fluid typography and optical padding',
      'Master dark mode contrast ratios (WCAG AA & AAA compliant)',
      'Convert Figma components directly to production React & Tailwind CSS',
      'Design accessible modals, dropdowns, data grids, and keyboard focus states'
    ],
    requirements: [
      'Free Figma account',
      'Basic understanding of HTML & CSS'
    ],
    sections: [
      {
        id: 'ux-sec-1',
        title: 'Section 1: The Mathematics of Optical Layout & Spatial Rhythm',
        lessons: [
          {
            id: 'ux-l-1',
            title: '1. Modular Scale Typography & Line-Height Calculations',
            duration: '14:15',
            durationSeconds: 855,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            isCompleted: false,
            isFreePreview: true
          }
        ]
      }
    ]
  },
  {
    id: 'course-4',
    title: 'High-Throughput Distributed Microservices with Go & Kafka',
    slug: 'golang-kafka-distributed-systems',
    subtitle: 'Event-Driven Architecture, gRPC streaming, Raft Consensus, and Zero-Copy I/O.',
    description: 'Build enterprise microservice backends processing over 500,000 transactions per second with low latency and bulletproof consistency.',
    thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    instructor: {
      id: 'inst-4',
      name: 'Kenji Sato',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      title: 'Infrastructure Architect at ByteScale',
      bio: 'Specialist in distributed databases, message queues, and high-frequency financial ledgers.',
      rating: 4.92,
      studentsCount: 52000,
      coursesCount: 3,
    },
    category: 'Backend & Cloud',
    level: 'Advanced',
    rating: 4.92,
    reviewsCount: 7100,
    enrolledStudentsCount: 24800,
    lastUpdated: 'August 2026',
    language: 'English (US)',
    hasCertificate: true,
    totalDuration: '24.0 total hours',
    totalLectures: 30,
    price: 89.99,
    originalPrice: 179.99,
    badge: 'Highest Rated',
    isEnrolled: false,
    whatYouWillLearn: [
      'Design high-throughput event sourcing pipelines with Apache Kafka and Go',
      'Implement gRPC bidirectional streaming microservices',
      'Manage distributed transactions with Sagas and two-phase commits',
      'Achieve sub-millisecond p99 latencies using Go runtime profiler & pprof'
    ],
    requirements: [
      'Basic Go syntax proficiency',
      'Comfortable with Docker containers and Linux CLI'
    ],
    sections: [
      {
        id: 'go-sec-1',
        title: 'Section 1: High-Performance Go Concurrency Patterns',
        lessons: [
          {
            id: 'go-l-1',
            title: '1. Channels, Mutexes, and Goroutine Pool Mechanics',
            duration: '17:50',
            durationSeconds: 1070,
            type: 'video',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
            isCompleted: false,
            isFreePreview: true
          }
        ]
      }
    ]
  }
];

export const sampleProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'Zenith Pro Split Mechanical Keyboard',
    slug: 'zenith-pro-split-keyboard',
    tagline: 'Ergonomic Ortholinear Wireless Mechanical Keyboard with Hot-Swap PCB',
    description: 'Engineered for software developers and power typists. Features anodized aluminum unibody housing, OLED macro status displays, programmable QMK/VIA firmware, and 2.4GHz ultra-low latency wireless connectivity.',
    price: 249.00,
    originalPrice: 319.00,
    rating: 4.9,
    reviewsCount: 428,
    category: 'Hardware & Electronics',
    inStock: true,
    stockCount: 18,
    isFeatured: true,
    badge: 'Bestseller',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Gateron Oil King linear factory-lubed switches',
      'Dual high-resolution 128x64 OLED display screens',
      'Gasket mount dampening with Poron acoustic foams',
      'Multi-device pairing: Bluetooth 5.3 + 2.4GHz + USB-C',
      '4000mAh battery providing up to 240 hours continuous typing'
    ],
    specifications: {
      'Layout': '65% Ortholinear Split Columnar',
      'Connectivity': 'Tri-mode (Type-C, 2.4Ghz Dongle, BT 5.3)',
      'Battery Life': '240 Hours (RGB Off) / 48 Hours (RGB On)',
      'Weight': '1.35 kg (Anodized CNC Aluminum)',
      'Firmware': 'QMK / VIA / ZMK Open Source'
    },
    colors: [
      { name: 'Matte Space Gray', hex: '#4b5563' },
      { name: 'Midnight Obsidian', hex: '#18181b' },
      { name: 'Moonlight Silver', hex: '#e2e8f0' }
    ],
    ratingBreakdown: { 5: 380, 4: 38, 3: 8, 2: 2, 1: 0 }
  },
  {
    id: 'prod-2',
    name: 'AcousticPure Active Noise-Canceling Studio Headphones',
    slug: 'acousticpure-anc-studio-headphones',
    tagline: 'Lossless Spatial Audio with Adaptive Hybrid Transparency',
    description: 'Immerse yourself into deep focus coding sessions. 40mm custom beryllium dynamic drivers deliver reference-grade acoustic fidelity with up to 45dB active noise reduction.',
    price: 329.00,
    originalPrice: 399.00,
    rating: 4.85,
    reviewsCount: 312,
    category: 'Audio & Workspace',
    inStock: true,
    stockCount: 24,
    isFeatured: true,
    badge: 'Sale',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Beryllium 40mm tuned acoustic transducer diaphragms',
      'Adaptive Hybrid ANC canceling 99.2% background ambient chatter',
      'Memory foam ear cushions wrapped in breathable protein leather',
      'USB-C Lossless 24-bit/192kHz DAC built-in audio passthrough',
      'Multipoint automatic fast switching between laptop and phone'
    ],
    specifications: {
      'Driver Size': '40mm Custom Beryllium Driver',
      'Frequency Response': '10Hz - 45,000Hz',
      'Impedance': '32 Ohms',
      'Battery Capacity': '60 Hours ANC On',
      'Charging Time': '15 min charge = 8 hours playback'
    },
    colors: [
      { name: 'Obsidian Black', hex: '#171717' },
      { name: 'Glacier Silver', hex: '#d4d4d8' },
      { name: 'Desert Sand', hex: '#d6c7b2' }
    ],
    ratingBreakdown: { 5: 275, 4: 28, 3: 6, 2: 2, 1: 1 }
  },
  {
    id: 'prod-3',
    name: 'UltraWide 38-inch Nano IPS Curved Developer Display',
    slug: 'ultrawide-38-nano-ips-display',
    tagline: '3840x1600 WQHD+ 144Hz Monitor with 90W USB-C Power Delivery',
    description: 'The ultimate screen real estate for multi-pane code editors, terminals, and live browser inspectors. Features 98% DCI-P3 color gamut with factory calibration certificate.',
    price: 899.00,
    originalPrice: 1099.00,
    rating: 4.95,
    reviewsCount: 189,
    category: 'Hardware & Electronics',
    inStock: true,
    stockCount: 7,
    isFeatured: true,
    badge: 'Limited Edition',
    images: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      '3840 x 1600 WQHD+ 21:9 Ultrawide immersive 2300R curvature',
      '90W single-cable USB-C power delivery & KVM switch built-in',
      'HDR600 certified with 98% DCI-P3 professional cinematic color',
      'Integrated ambient backlighting and dual 10W stereo speakers'
    ],
    specifications: {
      'Screen Size': '38 inches (21:9 aspect ratio)',
      'Resolution': '3840 x 1600 (WQHD+)',
      'Refresh Rate': '144Hz (AMD FreeSync Premium Pro)',
      'Ports': '1x USB-C 90W, 2x HDMI 2.1, 1x DP 1.4, 4x USB 3.2',
      'Mounting': 'VESA 100x100mm compatible'
    },
    colors: [
      { name: 'Dark Titanium', hex: '#334155' }
    ],
    ratingBreakdown: { 5: 180, 4: 8, 3: 1, 2: 0, 1: 0 }
  },
  {
    id: 'prod-4',
    name: 'Modular Hydro Ceramic Smart Mug 2.0',
    slug: 'modular-hydro-ceramic-smart-mug',
    tagline: 'Precision Temperature Control for Coffee & Tea with Wireless Qi Dock',
    description: 'Keep your brew at your exact customized drinking temperature (120°F - 145°F) for up to 3 hours off-coaster or all day on the charging base. iOS/Android companion sync.',
    price: 119.00,
    originalPrice: 139.00,
    rating: 4.78,
    reviewsCount: 520,
    category: 'Developer Merch',
    inStock: true,
    stockCount: 45,
    badge: 'New',
    images: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      '14 oz (414 ml) scratch-resistant ceramic coating',
      'Digital LED touch target indicating live liquid temperature',
      'Submersible waterproof IPX7 rating for easy sink washing',
      'Intelligent sleep auto-detect sensor when empty'
    ],
    specifications: {
      'Volume': '14 oz (414 ml)',
      'Temperature Range': '50°C - 62.5°C (120°F - 145°F)',
      'Battery': '3 Hours standalone, Infinite on Charging Coaster',
      'Material': 'Stainless steel core with dual ceramic enamel'
    },
    colors: [
      { name: 'Matte Charcoal', hex: '#262626' },
      { name: 'Arctic White', hex: '#f8fafc' },
      { name: 'Sage Forest', hex: '#4d7c0f' }
    ],
    ratingBreakdown: { 5: 410, 4: 80, 3: 22, 2: 6, 1: 2 }
  },
  {
    id: 'prod-5',
    name: 'Cloud System Architecture Flashcard & Blueprint Deck',
    slug: 'cloud-system-architecture-deck',
    tagline: '75 Visual Microservice & Distributed System Pattern Reference Cards',
    description: 'A physical collectible boxed set of 75 high-grade matte laminated cards covering Consensus Algorithms, Sharding, CAP Theorem tradeoffs, Caching, and Fault Tolerance.',
    price: 45.00,
    originalPrice: 59.00,
    rating: 4.96,
    reviewsCount: 680,
    category: 'Books & Guides',
    inStock: true,
    stockCount: 82,
    badge: 'Bestseller',
    images: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      '75 heavy 350 GSM matte cards with silver foil stamped box',
      'Includes digital companion app with interactive 3D architecture models',
      'Covers System Design interview patterns, database trade-offs, and failure recoveries',
      'Designed by principal infrastructure engineers'
    ],
    specifications: {
      'Card Count': '75 Cards + 12 Cheat Sheets',
      'Dimensions': '3.5 x 5.5 inches (Tarot Size)',
      'Paper': '350 GSM FSC-Certified Silk Laminated Core',
      'Box': 'Magnetic clasp hardshell box'
    },
    ratingBreakdown: { 5: 640, 4: 35, 3: 5, 2: 0, 1: 0 }
  },
  {
    id: 'prod-6',
    name: 'Ergonomic Dynamic Lumbar Carbon Mesh Task Chair',
    slug: 'ergonomic-carbon-mesh-task-chair',
    tagline: 'Auto-Adjusting Posture Alignment with 4D Armrests and Aluminum Base',
    description: 'Designed for 12+ hour intense productive sprint sessions. Self-balancing synchro-tilt mechanism, breathable German elastomer mesh, and pneumatic height gas lift.',
    price: 549.00,
    originalPrice: 699.00,
    rating: 4.88,
    reviewsCount: 245,
    category: 'Audio & Workspace',
    inStock: true,
    stockCount: 12,
    badge: 'Sale',
    images: [
      'https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1589384267710-7a25be247596?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Dynamic responsive lumbar support tracking spine curvature',
      'Self-calibrating 135° recline with 4-position tension lock',
      '4D multidirectional adjustable armrests (Height, Angle, Width, Depth)',
      'Heavy-duty class 4 nitrogen gas piston tested to 350 lbs'
    ],
    specifications: {
      'Weight Capacity': '350 lbs (158 kg)',
      'Recline Angle': '90° to 135° Multi-Lock',
      'Mesh Material': 'German K+R High-Tension Elastomer',
      'Base': 'Cast Polished Aluminum Alloy'
    },
    colors: [
      { name: 'Graphite Black', hex: '#1c1917' },
      { name: 'Onyx Silver', hex: '#64748b' }
    ],
    ratingBreakdown: { 5: 215, 4: 25, 3: 4, 2: 1, 1: 0 }
  }
];
