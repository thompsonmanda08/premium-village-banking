import { ErpDocument } from '../types';

export const sampleErpDocuments: ErpDocument[] = [
  {
    id: 'doc-pr-089',
    documentNumber: 'PR-2026-089',
    type: 'Purchase Requisition',
    title: 'NVIDIA H100 GPU Server Cluster Expansion',
    description: 'Procurement of 4x HGX H100 80GB SXM5 compute nodes and Mellanox Quantum-2 InfiniBand switches for the Core ML Training Cluster.',
    status: 'Pending Approval',
    priority: 'High Value',
    department: 'AI & Data Infrastructure',
    costCenter: 'CC-4010-ML-INFRA',
    requester: {
      id: 'req-01',
      name: 'Alexandre Dubois',
      email: 'a.dubois@enterprise.io',
      department: 'AI Systems Engineering',
      initials: 'AD',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
    },
    vendor: {
      id: 'v-901',
      name: 'Supermicro Global Systems Inc.',
      contactPerson: 'Elena Rostova',
      email: 'enterprise-sales@supermicro.com',
      phone: '+1 (408) 555-0199',
      taxId: 'US-EIN-94-2819022',
      paymentTerms: 'Net 45 upon delivery',
      address: '980 Rock Ave, San Jose, CA 95131, USA'
    },
    referenceDocNumber: 'BUDGET-Q3-2026-CAPEX',
    currency: 'USD',
    subtotal: 184500.00,
    taxAmount: 14760.00,
    shippingHandling: 2200.00,
    totalAmount: 201460.00,
    createdDate: '2026-08-18 09:30 AM',
    requiredByDate: '2026-09-15',
    targetDeliveryDate: '2026-09-10',
    lastUpdated: '2026-08-22 02:15 PM',
    deliveryLocation: 'Data Center Building 4, Rack Bay 12-14, 400 Tech Hub Way, Austin TX',
    termsAndConditions: [
      '3-Year Direct Manufacturer On-Site 24x7 Mission-Critical Support included.',
      'Equipment must pass incoming QA diagnostic and burn-in testing before final payment release.',
      'Firmware must be pre-flashed to certified firmware build 26.4.1.'
    ],
    lineItems: [
      {
        id: 'li-01',
        itemCode: 'SYS-821GE-TNHR',
        description: 'Supermicro 8U Dual Xeon 4x HGX H100 80GB SXM5 GPU Node, 1TB ECC DDR5',
        category: 'Hardware & Compute',
        quantity: 2,
        unit: 'Units',
        unitPrice: 78500.00,
        taxRate: 0.08,
        totalAmount: 157000.00,
        receivedQuantity: 0,
        glAccountCode: 'GL-1520-CAPEX-HW'
      },
      {
        id: 'li-02',
        itemCode: 'QM9700-NDR',
        description: 'NVIDIA Quantum-2 64-Port 400Gbps NDR InfiniBand Switch w/ Redundant PSUs',
        category: 'Networking',
        quantity: 2,
        unit: 'Units',
        unitPrice: 11500.00,
        taxRate: 0.08,
        totalAmount: 23000.00,
        receivedQuantity: 0,
        glAccountCode: 'GL-1525-NET-HW'
      },
      {
        id: 'li-03',
        itemCode: 'CAB-MMS1V00-WM',
        description: 'Active Optical Cable 400Gbps NDR QSFP112 5M Direct Attach Fiber Cable',
        category: 'Cabling & Accessories',
        quantity: 15,
        unit: 'Pcs',
        unitPrice: 300.00,
        taxRate: 0.08,
        totalAmount: 4500.00,
        receivedQuantity: 0,
        glAccountCode: 'GL-1530-CABLES'
      }
    ],
    currentStepIndex: 2, // Step 3 pending (Financial Controller)
    workflowSteps: [
      {
        id: 'step-1',
        stepNumber: 1,
        stepName: 'Technical Architecture & Sizing Verification',
        requiredRole: 'Lead Systems Architect',
        assignedApprover: {
          id: 'app-01',
          name: 'Marcus Vance',
          email: 'm.vance@enterprise.io',
          role: 'Principal Cloud Architect',
          initials: 'MV',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
        },
        status: 'approved',
        actionDate: '2026-08-18 11:45 AM',
        actionComment: 'Technical specs, power rack envelopes (18kW/rack), and cooling verified against DC4 capacity. Approved for procurement.',
        signatureHash: 'SIG-SHA256-4b89f2a9910cde4',
        slaDeadline: '2026-08-19 05:00 PM'
      },
      {
        id: 'step-2',
        stepNumber: 2,
        stepName: 'Procurement & Vendor Compliance Review',
        requiredRole: 'Head of Strategic Sourcing',
        assignedApprover: {
          id: 'app-02',
          name: 'Sara Lin',
          email: 's.lin@enterprise.io',
          role: 'Head of Sourcing & Vendor Mgmt',
          initials: 'SL',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
        },
        status: 'approved',
        actionDate: '2026-08-20 03:20 PM',
        actionComment: 'Checked 3 vendor competitive quotes. Supermicro pricing is 12% below market average with guaranteed 3-week fulfillment.',
        signatureHash: 'SIG-SHA256-8e12ac4901f44b2',
        slaDeadline: '2026-08-21 05:00 PM'
      },
      {
        id: 'step-3',
        stepNumber: 3,
        stepName: 'Financial Controller CapEx Approval',
        requiredRole: 'Director of Corporate Finance',
        assignedApprover: {
          id: 'app-03',
          name: 'David Sterling',
          email: 'd.sterling@enterprise.io',
          role: 'Corporate Finance Controller',
          initials: 'DS',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80'
        },
        status: 'current',
        slaDeadline: '2026-08-23 05:00 PM',
        isOverdue: false
      },
      {
        id: 'step-4',
        stepNumber: 4,
        stepName: 'Executive Officer (CFO / CEO) Sign-Off',
        requiredRole: 'Chief Financial Officer',
        assignedApprover: {
          id: 'app-04',
          name: 'Victoria Hawthorne',
          email: 'v.hawthorne@enterprise.io',
          role: 'Chief Financial Officer',
          initials: 'VH',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
        },
        status: 'pending',
        slaDeadline: '2026-08-25 05:00 PM'
      }
    ],
    attachments: [
      {
        id: 'att-01',
        fileName: 'Supermicro_Quote_SM-99402_H100.pdf',
        fileType: 'pdf',
        fileSize: '3.4 MB',
        category: 'Vendor Quotation',
        uploadedBy: {
          name: 'Sara Lin',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
        },
        uploadedAt: '2026-08-19 02:10 PM',
        isVerified: true,
        checksum: 'sha256:4a08bc93f01948ba98c',
        downloadUrl: '#'
      },
      {
        id: 'att-02',
        fileName: 'DataCenter_RackPower_Load_Calculation.xlsx',
        fileType: 'xlsx',
        fileSize: '1.2 MB',
        category: 'Technical Specification',
        uploadedBy: {
          name: 'Marcus Vance',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
        },
        uploadedAt: '2026-08-18 10:20 AM',
        isVerified: true,
        checksum: 'sha256:190ac478201fa55b991',
        downloadUrl: '#'
      },
      {
        id: 'att-03',
        fileName: 'Tax_Exemption_Certificate_State_TX.pdf',
        fileType: 'pdf',
        fileSize: '820 KB',
        category: 'Tax Exemption Certificate',
        uploadedBy: {
          name: 'Alexandre Dubois'
        },
        uploadedAt: '2026-08-18 09:35 AM',
        isVerified: true,
        checksum: 'sha256:77bc40194aeb9120938',
        downloadUrl: '#'
      }
    ],
    auditTrail: [
      {
        id: 'audit-01',
        timestamp: '2026-08-18 09:30 AM',
        actor: {
          name: 'Alexandre Dubois',
          email: 'a.dubois@enterprise.io',
          role: 'Requester',
          initials: 'AD'
        },
        action: 'Created Document',
        details: 'Initial Purchase Requisition PR-2026-089 created with 3 items totaling $201,460.00 USD.',
        previousStatus: 'Draft',
        newStatus: 'Under Verification',
        ipAddress: '192.168.10.45',
        digitalFingerprint: 'TX-DOC-20260818-093044'
      },
      {
        id: 'audit-02',
        timestamp: '2026-08-18 11:45 AM',
        actor: {
          name: 'Marcus Vance',
          email: 'm.vance@enterprise.io',
          role: 'Principal Cloud Architect',
          initials: 'MV'
        },
        action: 'Approved Stage',
        details: 'Step 1 Approved: Technical Architecture & Sizing verified.',
        previousStatus: 'Under Verification',
        newStatus: 'Pending Approval',
        ipAddress: '10.0.4.192',
        digitalFingerprint: 'SIG-SHA256-4b89f2a9910cde4'
      },
      {
        id: 'audit-03',
        timestamp: '2026-08-19 02:10 PM',
        actor: {
          name: 'Sara Lin',
          email: 's.lin@enterprise.io',
          role: 'Head of Sourcing',
          initials: 'SL'
        },
        action: 'Uploaded Supporting File',
        details: 'Uploaded "Supermicro_Quote_SM-99402_H100.pdf" with competitive vendor matrix.',
        ipAddress: '10.0.12.80',
        digitalFingerprint: 'FILE-SHA256-4a08bc93f01948ba'
      },
      {
        id: 'audit-04',
        timestamp: '2026-08-20 03:20 PM',
        actor: {
          name: 'Sara Lin',
          email: 's.lin@enterprise.io',
          role: 'Head of Sourcing',
          initials: 'SL'
        },
        action: 'Approved Stage',
        details: 'Step 2 Approved: Commercial terms and pricing discounts locked at 12% off MSRP.',
        previousStatus: 'Pending Approval',
        newStatus: 'Pending Approval',
        ipAddress: '10.0.12.80',
        digitalFingerprint: 'SIG-SHA256-8e12ac4901f44b2'
      }
    ]
  },
  {
    id: 'doc-po-042',
    documentNumber: 'PO-2026-042',
    type: 'Purchase Order',
    title: 'Enterprise High-Density Fiber Optic Network Backbone',
    description: 'Official procurement order for Corning SMF-28 Ultra optical fibers, MTP/MPO patch panels, and fusion splice cassettes.',
    status: 'Approved',
    priority: 'Standard',
    department: 'Network Operations',
    costCenter: 'CC-3020-NETOPS',
    requester: {
      id: 'req-02',
      name: 'Kavita Patel',
      email: 'k.patel@enterprise.io',
      department: 'Network Operations',
      initials: 'KP',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80'
    },
    vendor: {
      id: 'v-802',
      name: 'Corning Optical Communications LLC',
      contactPerson: 'Gerald Briggs',
      email: 'orders@corning.com',
      phone: '+1 (800) 743-2675',
      taxId: 'US-EIN-16-0393410',
      paymentTerms: 'Net 30 EOM',
      address: '800 17th St NW, Hickory, NC 28601, USA'
    },
    referenceDocNumber: 'PR-2026-064',
    currency: 'USD',
    subtotal: 42800.00,
    taxAmount: 3424.00,
    shippingHandling: 650.00,
    totalAmount: 46874.00,
    createdDate: '2026-08-10 10:00 AM',
    requiredByDate: '2026-08-30',
    targetDeliveryDate: '2026-08-28',
    lastUpdated: '2026-08-15 04:45 PM',
    deliveryLocation: 'Enterprise Campus East, Warehouse Bay 3, Logistics Receiving, Seattle WA',
    termsAndConditions: [
      'Goods must strictly comply with Corning Optical Telcordia GR-326-CORE specifications.',
      'Delivery Challan and Inspection Test Certificates must accompany physical shipment.',
      'Defective batch returns accepted within 60 days without restocking surcharge.'
    ],
    pdfVerificationSeal: {
      verifiedBy: 'Victoria Hawthorne (CFO)',
      timestamp: '2026-08-15 04:45 PM UTC',
      hash: '0x9E7A8109F2B488C9130D71BEE450A9F2',
      certificateNumber: 'CERT-ERP-SIG-2026-0429'
    },
    lineItems: [
      {
        id: 'li-11',
        itemCode: 'COR-SMF28U-144',
        description: 'Corning SMF-28 Ultra 144-Fiber Armored Outdoor Plenum Cable (1000m Drum)',
        category: 'Optical Cable',
        quantity: 4,
        unit: 'Drums',
        unitPrice: 6200.00,
        taxRate: 0.08,
        totalAmount: 24800.00,
        receivedQuantity: 4,
        glAccountCode: 'GL-1410-FIBER'
      },
      {
        id: 'li-12',
        itemCode: 'COR-EDGE-01U-SP',
        description: 'EDGE HD 1U Housing with 4x MTP-to-LC 24-Fiber Cassettes OM4 Ultra Low Loss',
        category: 'Distribution Panels',
        quantity: 12,
        unit: 'Units',
        unitPrice: 1250.00,
        taxRate: 0.08,
        totalAmount: 15000.00,
        receivedQuantity: 12,
        glAccountCode: 'GL-1420-PANELS'
      },
      {
        id: 'li-13',
        itemCode: 'COR-SPL-FUS-KIT',
        description: 'Micro Splice Protection Sleeves 40mm & Fusion Cleaning Kit (Pack of 500)',
        category: 'Consumables',
        quantity: 6,
        unit: 'Boxes',
        unitPrice: 500.00,
        taxRate: 0.08,
        totalAmount: 3000.00,
        receivedQuantity: 6,
        glAccountCode: 'GL-1430-CONSUM'
      }
    ],
    currentStepIndex: 3,
    workflowSteps: [
      {
        id: 'step-po-1',
        stepNumber: 1,
        stepName: 'Technical Validation',
        requiredRole: 'Lead Network Engineer',
        assignedApprover: {
          id: 'app-05',
          name: 'Kavita Patel',
          email: 'k.patel@enterprise.io',
          role: 'Network Lead',
          initials: 'KP'
        },
        status: 'approved',
        actionDate: '2026-08-11 09:15 AM',
        actionComment: 'Optical power budget and connector polarization compatibility confirmed.',
        signatureHash: 'SIG-KP-990142'
      },
      {
        id: 'step-po-2',
        stepNumber: 2,
        stepName: 'Procurement Commercial Verification',
        requiredRole: 'Procurement Manager',
        assignedApprover: {
          id: 'app-02',
          name: 'Sara Lin',
          email: 's.lin@enterprise.io',
          role: 'Head of Sourcing',
          initials: 'SL'
        },
        status: 'approved',
        actionDate: '2026-08-12 02:00 PM',
        actionComment: 'Matched master enterprise supply agreement discount tier 3.',
        signatureHash: 'SIG-SL-881290'
      },
      {
        id: 'step-po-3',
        stepNumber: 3,
        stepName: 'CFO Final Authorization & Digital Signing',
        requiredRole: 'Chief Financial Officer',
        assignedApprover: {
          id: 'app-04',
          name: 'Victoria Hawthorne',
          email: 'v.hawthorne@enterprise.io',
          role: 'Chief Financial Officer',
          initials: 'VH',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
        },
        status: 'approved',
        actionDate: '2026-08-15 04:45 PM',
        actionComment: 'PO digitally certified, sealed, and transmitted via EDI to Corning Logistics.',
        signatureHash: 'SIG-VH-774129-EXEC'
      }
    ],
    attachments: [
      {
        id: 'att-po-1',
        fileName: 'PO_2026_042_Corning_Signed_Official.pdf',
        fileType: 'pdf',
        fileSize: '2.1 MB',
        category: 'Contract Agreement',
        uploadedBy: {
          name: 'Victoria Hawthorne'
        },
        uploadedAt: '2026-08-15 04:46 PM',
        isVerified: true,
        checksum: 'sha256:9e7a8109f2b488c9130',
        downloadUrl: '#'
      },
      {
        id: 'att-po-2',
        fileName: 'Corning_Master_Services_Agreement_2026.pdf',
        fileType: 'pdf',
        fileSize: '5.8 MB',
        category: 'Contract Agreement',
        uploadedBy: {
          name: 'Sara Lin'
        },
        uploadedAt: '2026-08-11 11:20 AM',
        isVerified: true,
        checksum: 'sha256:3901bc772091ea0284b',
        downloadUrl: '#'
      }
    ],
    auditTrail: [
      {
        id: 'audit-po-1',
        timestamp: '2026-08-10 10:00 AM',
        actor: {
          name: 'Kavita Patel',
          email: 'k.patel@enterprise.io',
          role: 'Requester',
          initials: 'KP'
        },
        action: 'Created Document',
        details: 'Generated Purchase Order PO-2026-042 from approved Requisition PR-2026-064.',
        previousStatus: 'Draft',
        newStatus: 'Under Verification',
        ipAddress: '10.0.8.21'
      },
      {
        id: 'audit-po-2',
        timestamp: '2026-08-15 04:45 PM',
        actor: {
          name: 'Victoria Hawthorne',
          email: 'v.hawthorne@enterprise.io',
          role: 'CFO',
          initials: 'VH'
        },
        action: 'Digitally Signed',
        details: 'Document officially signed and cryptographic seal embedded.',
        previousStatus: 'Pending Approval',
        newStatus: 'Approved',
        ipAddress: '10.0.1.5',
        digitalFingerprint: '0x9E7A8109F2B488C9130D71BEE450A9F2'
      },
      {
        id: 'audit-po-3',
        timestamp: '2026-08-15 04:50 PM',
        actor: {
          name: 'System EDI Gateway',
          email: 'edi-robot@enterprise.io',
          role: 'Automated Service',
          initials: 'EDI'
        },
        action: 'Dispatched to Vendor',
        details: 'AS2 encrypted transport dispatched to orders@corning.com with ACK response received.',
        ipAddress: '10.100.0.1'
      }
    ]
  },
  {
    id: 'doc-grn-118',
    documentNumber: 'GRN-2026-118',
    type: 'Goods Received Note',
    title: 'Receiving & Inspection: 50x Herman Miller Embody Ergonomic Chairs',
    description: 'Physical intake, barcode tagging, and QA inspection for engineering floor workstation seating upgrade.',
    status: 'Fulfilled',
    priority: 'Standard',
    department: 'Facilities & Workplace',
    costCenter: 'CC-1050-FACILITIES',
    requester: {
      id: 'req-03',
      name: 'Darren Zhao',
      email: 'd.zhao@enterprise.io',
      department: 'Logistics & Receiving Hub',
      initials: 'DZ',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
    },
    vendor: {
      id: 'v-703',
      name: 'MillerKnoll Commercial Direct',
      contactPerson: 'Rachel Adams',
      email: 'enterprise@hermanmiller.com',
      phone: '+1 (888) 798-0202',
      taxId: 'US-EIN-38-0837560',
      paymentTerms: 'Net 30',
      address: '855 East Main Ave, Zeeland, MI 49464, USA'
    },
    referenceDocNumber: 'PO-2026-033',
    currency: 'USD',
    subtotal: 74500.00,
    taxAmount: 5960.00,
    shippingHandling: 0.00,
    totalAmount: 80460.00,
    createdDate: '2026-08-19 01:15 PM',
    requiredByDate: '2026-08-20',
    targetDeliveryDate: '2026-08-19',
    lastUpdated: '2026-08-21 11:30 AM',
    deliveryLocation: 'Central Receiving Dock 2, Tech Park HQ, San Francisco CA',
    lineItems: [
      {
        id: 'li-21',
        itemCode: 'HM-EMB-CYN-BLK',
        description: 'Herman Miller Embody Chair - Black Sync Fabric / Graphite Frame & Translucent Castors',
        category: 'Furniture & Fixtures',
        quantity: 50,
        unit: 'Units',
        unitPrice: 1490.00,
        taxRate: 0.08,
        totalAmount: 74500.00,
        receivedQuantity: 50,
        glAccountCode: 'GL-1610-FURNITURE'
      }
    ],
    currentStepIndex: 2,
    workflowSteps: [
      {
        id: 'step-grn-1',
        stepNumber: 1,
        stepName: 'Dock Intake & Quantity Count',
        requiredRole: 'Logistics Receiving Inspector',
        assignedApprover: {
          id: 'app-06',
          name: 'Darren Zhao',
          email: 'd.zhao@enterprise.io',
          role: 'Logistics Supervisor',
          initials: 'DZ'
        },
        status: 'approved',
        actionDate: '2026-08-19 02:30 PM',
        actionComment: 'Received 50/50 intact boxes on 10 pallets. Carrier Bill of Lading stamped and signed.',
        signatureHash: 'SIG-DZ-RECEIVE-50UNITS'
      },
      {
        id: 'step-grn-2',
        stepNumber: 2,
        stepName: 'Quality Assurance & Serial Barcode Scanning',
        requiredRole: 'QA & Asset Tagging Specialist',
        assignedApprover: {
          id: 'app-07',
          name: 'Chloe Bennett',
          email: 'c.bennett@enterprise.io',
          role: 'Asset Management Lead',
          initials: 'CB',
          avatar: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=120&auto=format&fit=crop&q=80'
        },
        status: 'approved',
        actionDate: '2026-08-20 10:45 AM',
        actionComment: '100% sample visual check complete. 50 RFID asset tags applied (TAG-26-8001 through 8050). Zero transit defects.',
        signatureHash: 'SIG-CB-QA-PASSED'
      },
      {
        id: 'step-grn-3',
        stepNumber: 3,
        stepName: 'Facilities Lead Final Sign-Off',
        requiredRole: 'Facilities Director',
        assignedApprover: {
          id: 'app-08',
          name: 'Robert Morales',
          email: 'r.morales@enterprise.io',
          role: 'Director of Workplace',
          initials: 'RM'
        },
        status: 'approved',
        actionDate: '2026-08-21 11:30 AM',
        actionComment: 'Chairs placed across Floors 4 & 5. Released for AP 3-way invoice matching.',
        signatureHash: 'SIG-RM-FACILITIES-CLEAR'
      }
    ],
    attachments: [
      {
        id: 'att-grn-1',
        fileName: 'Carrier_BillOfLading_BOL-99214.pdf',
        fileType: 'pdf',
        fileSize: '1.4 MB',
        category: 'Bill of Lading',
        uploadedBy: {
          name: 'Darren Zhao'
        },
        uploadedAt: '2026-08-19 02:35 PM',
        isVerified: true,
        checksum: 'sha256:88bc49210aa39021',
        downloadUrl: '#'
      },
      {
        id: 'att-grn-2',
        fileName: 'QA_Asset_Barcode_Scanning_Report.xlsx',
        fileType: 'xlsx',
        fileSize: '480 KB',
        category: 'Quality Inspection Sheet',
        uploadedBy: {
          name: 'Chloe Bennett'
        },
        uploadedAt: '2026-08-20 10:50 AM',
        isVerified: true,
        checksum: 'sha256:99201ba472910fa',
        downloadUrl: '#'
      }
    ],
    auditTrail: [
      {
        id: 'audit-grn-1',
        timestamp: '2026-08-19 01:15 PM',
        actor: {
          name: 'Darren Zhao',
          email: 'd.zhao@enterprise.io',
          role: 'Logistics Supervisor',
          initials: 'DZ'
        },
        action: 'Created Document',
        details: 'Initiated Goods Received Note GRN-2026-118 referencing PO-2026-033.',
        previousStatus: 'Draft',
        newStatus: 'Under Verification',
        ipAddress: '10.0.14.9'
      },
      {
        id: 'audit-grn-2',
        timestamp: '2026-08-20 10:45 AM',
        actor: {
          name: 'Chloe Bennett',
          email: 'c.bennett@enterprise.io',
          role: 'Asset Lead',
          initials: 'CB'
        },
        action: 'Recorded Goods Receipt',
        details: 'All 50 units accepted with zero rejection rate.',
        ipAddress: '10.0.14.22'
      }
    ]
  },
  {
    id: 'doc-pv-031',
    documentNumber: 'PV-2026-031',
    type: 'Purchase Voucher',
    title: 'Accounts Payable Disbursement Voucher - Cloudflare Enterprise Plan',
    description: '3-Way matched payment voucher for annual Cloudflare DDoS, Zero Trust, and Workers paid compute agreement.',
    status: 'Pending Approval',
    priority: 'High Value',
    department: 'Information Security & Cloud',
    costCenter: 'CC-2040-SEC-OPS',
    requester: {
      id: 'req-04',
      name: 'Samantha Gomez',
      email: 's.gomez@enterprise.io',
      department: 'Finance & AP Operations',
      initials: 'SG',
      avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=120&auto=format&fit=crop&q=80'
    },
    vendor: {
      id: 'v-604',
      name: 'Cloudflare Inc.',
      contactPerson: 'Finance Receivables Dept',
      email: 'ar@cloudflare.com',
      phone: '+1 (888) 993-5273',
      taxId: 'US-EIN-27-0536410',
      paymentTerms: 'Wire Transfer / Net 30',
      address: '101 Townsend St, San Francisco, CA 94107, USA'
    },
    referenceDocNumber: 'PO-2026-019 / INV-CF-994821',
    currency: 'USD',
    subtotal: 96000.00,
    taxAmount: 7680.00,
    shippingHandling: 0.00,
    totalAmount: 103680.00,
    createdDate: '2026-08-21 09:00 AM',
    requiredByDate: '2026-08-28',
    targetDeliveryDate: '2026-08-28',
    lastUpdated: '2026-08-22 01:00 PM',
    deliveryLocation: 'Electronic SaaS Provisioning / Global Edge Network',
    lineItems: [
      {
        id: 'li-31',
        itemCode: 'CF-ENT-EDGE-ANNUAL',
        description: 'Cloudflare Enterprise 12-Month Plan: 100Tbps DDoS Mitigation, Magic Transit & WAF',
        category: 'SaaS Software',
        quantity: 1,
        unit: 'Annual',
        unitPrice: 72000.00,
        taxRate: 0.08,
        totalAmount: 72000.00,
        receivedQuantity: 1,
        glAccountCode: 'GL-6100-SAAS'
      },
      {
        id: 'li-32',
        itemCode: 'CF-ZT-SEATS-500',
        description: 'Cloudflare Access & Gateway Zero Trust 500 Named User Enterprise Tier',
        category: 'SaaS Software',
        quantity: 1,
        unit: 'Annual',
        unitPrice: 24000.00,
        taxRate: 0.08,
        totalAmount: 24000.00,
        receivedQuantity: 1,
        glAccountCode: 'GL-6110-ZT-SEATS'
      }
    ],
    currentStepIndex: 1, // Step 2 (CFO) pending
    workflowSteps: [
      {
        id: 'step-pv-1',
        stepNumber: 1,
        stepName: 'AP 3-Way Match & Tax Audit',
        requiredRole: 'Accounts Payable Specialist',
        assignedApprover: {
          id: 'app-09',
          name: 'Samantha Gomez',
          email: 's.gomez@enterprise.io',
          role: 'Senior AP Accountant',
          initials: 'SG'
        },
        status: 'approved',
        actionDate: '2026-08-21 11:30 AM',
        actionComment: 'Line items, PO-2026-019 balance, and Cloudflare Tax Form W-9 verified. Zero variances detected.',
        signatureHash: 'SIG-SG-APMATCH-PASSED'
      },
      {
        id: 'step-pv-2',
        stepNumber: 2,
        stepName: 'CFO Wire Disbursement Sign-Off',
        requiredRole: 'Chief Financial Officer',
        assignedApprover: {
          id: 'app-04',
          name: 'Victoria Hawthorne',
          email: 'v.hawthorne@enterprise.io',
          role: 'Chief Financial Officer',
          initials: 'VH',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
        },
        status: 'current',
        slaDeadline: '2026-08-24 05:00 PM',
        isOverdue: false
      }
    ],
    attachments: [
      {
        id: 'att-pv-1',
        fileName: 'Cloudflare_Tax_Invoice_CF994821.pdf',
        fileType: 'pdf',
        fileSize: '1.8 MB',
        category: 'Proforma Invoice',
        uploadedBy: {
          name: 'Samantha Gomez'
        },
        uploadedAt: '2026-08-21 09:05 AM',
        isVerified: true,
        checksum: 'sha256:88190fabc2918820',
        downloadUrl: '#'
      },
      {
        id: 'att-pv-2',
        fileName: 'AP_3Way_Match_Validation_Summary.pdf',
        fileType: 'pdf',
        fileSize: '750 KB',
        category: 'Quality Inspection Sheet',
        uploadedBy: {
          name: 'Samantha Gomez'
        },
        uploadedAt: '2026-08-21 11:32 AM',
        isVerified: true,
        checksum: 'sha256:7721890fa2198c',
        downloadUrl: '#'
      }
    ],
    auditTrail: [
      {
        id: 'audit-pv-1',
        timestamp: '2026-08-21 09:00 AM',
        actor: {
          name: 'Samantha Gomez',
          email: 's.gomez@enterprise.io',
          role: 'Senior AP Accountant',
          initials: 'SG'
        },
        action: 'Created Document',
        details: 'Generated Purchase Voucher PV-2026-031 for wire release.',
        previousStatus: 'Draft',
        newStatus: 'Under Verification',
        ipAddress: '10.0.6.14'
      },
      {
        id: 'audit-pv-2',
        timestamp: '2026-08-21 11:30 AM',
        actor: {
          name: 'Samantha Gomez',
          email: 's.gomez@enterprise.io',
          role: 'Senior AP Accountant',
          initials: 'SG'
        },
        action: 'Approved Stage',
        details: 'Step 1 Approved: 3-way match verified against PO-2026-019.',
        previousStatus: 'Under Verification',
        newStatus: 'Pending Approval',
        ipAddress: '10.0.6.14',
        digitalFingerprint: 'SIG-SG-APMATCH-PASSED'
      }
    ]
  },
  {
    id: 'doc-rfq-077',
    documentNumber: 'RFQ-2026-077',
    type: 'Request for Quotation',
    title: 'Tier-1 Internet Peering & Dark Fiber Transit Contract (3-Year RFP)',
    description: 'Competitive sealed bid solicitation for 100Gbps redundant internet transit connecting Chicago, Ashburn, and Frankfurt data hubs.',
    status: 'Under Verification',
    priority: 'Urgent',
    department: 'Global Infrastructure & Network',
    costCenter: 'CC-3010-WAN-TRANSIT',
    requester: {
      id: 'req-05',
      name: 'Jean-Luc Picard',
      email: 'jl.picard@enterprise.io',
      department: 'Global WAN Infrastructure',
      initials: 'JP',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80'
    },
    currency: 'USD',
    subtotal: 312000.00,
    taxAmount: 0.00,
    shippingHandling: 0.00,
    totalAmount: 312000.00,
    createdDate: '2026-08-22 08:30 AM',
    requiredByDate: '2026-09-30',
    lastUpdated: '2026-08-22 01:45 PM',
    deliveryLocation: 'Multi-Region (ORD1, IAD2, FRA3 Equinix Interconnection Exchanges)',
    lineItems: [
      {
        id: 'li-41',
        itemCode: 'WAN-100G-TRANSIT-ORD',
        description: '100Gbps Dedicated BGP IP Transit Port w/ 99.999% SLA (Chicago Equinix CH3)',
        category: 'Telecom & Transit',
        quantity: 36,
        unit: 'Months',
        unitPrice: 3200.00,
        taxRate: 0.00,
        totalAmount: 115200.00,
        glAccountCode: 'GL-1710-WAN'
      },
      {
        id: 'li-42',
        itemCode: 'WAN-100G-TRANSIT-IAD',
        description: '100Gbps Dedicated BGP IP Transit Port w/ 99.999% SLA (Ashburn Equinix DC2)',
        category: 'Telecom & Transit',
        quantity: 36,
        unit: 'Months',
        unitPrice: 3200.00,
        taxRate: 0.00,
        totalAmount: 115200.00,
        glAccountCode: 'GL-1710-WAN'
      },
      {
        id: 'li-43',
        itemCode: 'WAN-100G-TRANSIT-FRA',
        description: '100Gbps Dedicated BGP IP Transit Port w/ 99.999% SLA (Frankfurt Equinix FR5)',
        category: 'Telecom & Transit',
        quantity: 36,
        unit: 'Months',
        unitPrice: 2266.66,
        taxRate: 0.00,
        totalAmount: 81600.00,
        glAccountCode: 'GL-1710-WAN'
      }
    ],
    currentStepIndex: 0,
    workflowSteps: [
      {
        id: 'step-rfq-1',
        stepNumber: 1,
        stepName: 'SOW & SLA Requirement Scope Sign-Off',
        requiredRole: 'VP of Global Engineering',
        assignedApprover: {
          id: 'app-10',
          name: 'Jean-Luc Picard',
          email: 'jl.picard@enterprise.io',
          role: 'VP Infrastructure',
          initials: 'JP'
        },
        status: 'current',
        slaDeadline: '2026-08-24 12:00 PM',
        isOverdue: false
      },
      {
        id: 'step-rfq-2',
        stepNumber: 2,
        stepName: 'Legal & Regulatory Compliance Check',
        requiredRole: 'General Counsel / Legal',
        assignedApprover: {
          id: 'app-11',
          name: 'Helena Vance',
          email: 'h.vance@enterprise.io',
          role: 'Senior Corporate Counsel',
          initials: 'HV'
        },
        status: 'pending',
        slaDeadline: '2026-08-26 05:00 PM'
      },
      {
        id: 'step-rfq-3',
        stepNumber: 3,
        stepName: 'Procurement Sealed Bid Release',
        requiredRole: 'Head of Strategic Sourcing',
        assignedApprover: {
          id: 'app-02',
          name: 'Sara Lin',
          email: 's.lin@enterprise.io',
          role: 'Head of Sourcing',
          initials: 'SL'
        },
        status: 'pending',
        slaDeadline: '2026-08-28 05:00 PM'
      }
    ],
    attachments: [
      {
        id: 'att-rfq-1',
        fileName: 'RFP_2026_077_Global_Network_Transit_SOW.pdf',
        fileType: 'pdf',
        fileSize: '4.6 MB',
        category: 'Technical Specification',
        uploadedBy: {
          name: 'Jean-Luc Picard'
        },
        uploadedAt: '2026-08-22 08:35 AM',
        isVerified: true,
        checksum: 'sha256:1190bcfa772019488a',
        downloadUrl: '#'
      }
    ],
    auditTrail: [
      {
        id: 'audit-rfq-1',
        timestamp: '2026-08-22 08:30 AM',
        actor: {
          name: 'Jean-Luc Picard',
          email: 'jl.picard@enterprise.io',
          role: 'VP Infrastructure',
          initials: 'JP'
        },
        action: 'Created Document',
        details: 'Created Request for Quotation RFQ-2026-077.',
        previousStatus: 'Draft',
        newStatus: 'Under Verification',
        ipAddress: '10.0.18.2'
      }
    ]
  }
];
