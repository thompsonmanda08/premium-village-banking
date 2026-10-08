import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileCheck, 
  RotateCcw, 
  Eye, 
  Download, 
  Layers, 
  ArrowUpDown, 
  Sparkles, 
  Building2, 
  DollarSign, 
  SlidersHorizontal,
  ChevronRight,
  Printer,
  Trash2,
  Lock,
  Paperclip,
  CheckSquare,
  Square
} from 'lucide-react';
import { ErpDocument, ErpDocumentType, ErpDocumentStatus, ErpPriority } from '../../types';
import { sampleErpDocuments } from '../../data/erpData';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ErpWorkflowStepper from '../erp/ErpWorkflowStepper';
import DocumentPdfViewerModal from '../erp/DocumentPdfViewerModal';
import CreateDocumentModal from '../erp/CreateDocumentModal';

interface ErpWorkflowViewProps {
  theme: string;
  showToast: (msg: string) => void;
}

export const ErpWorkflowView: React.FC<ErpWorkflowViewProps> = ({
  theme,
  showToast,
}) => {
  const [documents, setDocuments] = useState<ErpDocument[]>(sampleErpDocuments);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  
  // Modals
  const [viewingDoc, setViewingDoc] = useState<ErpDocument | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof ErpDocument>('createdDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Metrics calculation
  const metrics = useMemo(() => {
    const pendingMyApproval = documents.filter(d => d.status === 'Pending Approval' || d.status === 'Under Verification');
    const totalPipelineValue = documents.reduce((acc, d) => acc + d.totalAmount, 0);
    const approvedDocs = documents.filter(d => d.status === 'Approved' || d.status === 'Fulfilled');
    
    return {
      pendingCount: pendingMyApproval.length,
      pendingValue: pendingMyApproval.reduce((acc, d) => acc + d.totalAmount, 0),
      totalValue: totalPipelineValue,
      approvedCount: approvedDocs.length,
      avgSlaHours: 16.4
    };
  }, [documents]);

  // Filtering logic
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Type filter
      if (activeTypeFilter !== 'all') {
        const typeMap: Record<string, ErpDocumentType> = {
          'pr': 'Purchase Requisition',
          'po': 'Purchase Order',
          'grn': 'Goods Received Note',
          'pv': 'Purchase Voucher',
          'rfq': 'Request for Quotation'
        };
        if (doc.type !== typeMap[activeTypeFilter]) return false;
      }

      // Status filter
      if (activeStatusFilter !== 'all') {
        if (activeStatusFilter === 'action_needed') {
          if (doc.status !== 'Pending Approval' && doc.status !== 'Under Verification') return false;
        } else if (doc.status !== activeStatusFilter) {
          return false;
        }
      }

      // Priority filter
      if (priorityFilter !== 'all' && doc.priority !== priorityFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = doc.documentNumber.toLowerCase().includes(q);
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchDept = doc.department.toLowerCase().includes(q);
        const matchRequester = doc.requester.name.toLowerCase().includes(q);
        const matchVendor = doc.vendor?.name.toLowerCase().includes(q);
        const matchItems = doc.lineItems.some(i => i.itemCode.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
        if (!matchNumber && !matchTitle && !matchDept && !matchRequester && !matchVendor && !matchItems) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [documents, activeTypeFilter, activeStatusFilter, priorityFilter, searchQuery, sortField, sortAsc]);

  // Handlers
  const handleOpenPdf = (doc: ErpDocument) => {
    setViewingDoc(doc);
    setIsPdfModalOpen(true);
  };

  const handleApproveDocument = (docId: string, comments: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        const nextStepIndex = doc.currentStepIndex + 1;
        const isFinalStep = nextStepIndex >= doc.workflowSteps.length;
        
        const updatedSteps = doc.workflowSteps.map((step, idx) => {
          if (idx === doc.currentStepIndex) {
            return {
              ...step,
              status: 'approved' as const,
              actionDate: '2026-08-22 03:15 PM',
              actionComment: comments,
              signatureHash: `SIG-${Math.random().toString(36).substring(2, 10).toUpperCase()}-PASSED`
            };
          }
          if (idx === nextStepIndex) {
            return {
              ...step,
              status: 'current' as const
            };
          }
          return step;
        });

        const newStatus: ErpDocumentStatus = isFinalStep ? 'Approved' : 'Pending Approval';

        return {
          ...doc,
          status: newStatus,
          currentStepIndex: nextStepIndex,
          workflowSteps: updatedSteps,
          lastUpdated: '2026-08-22 03:15 PM',
          pdfVerificationSeal: isFinalStep ? {
            verifiedBy: 'Corporate Authorization Authority',
            timestamp: '2026-08-22 03:15 PM UTC',
            hash: '0x' + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase(),
            certificateNumber: `CERT-ERP-SIG-2026-${Math.floor(1000 + Math.random()*9000)}`
          } : doc.pdfVerificationSeal,
          auditTrail: [
            ...doc.auditTrail,
            {
              id: `audit-${Date.now()}`,
              timestamp: '2026-08-22 03:15 PM',
              actor: {
                name: 'Authorized Executive',
                email: 'approver@enterprise.io',
                role: 'Signer',
                initials: 'AE'
              },
              action: isFinalStep ? 'Digitally Signed' : 'Approved Stage',
              details: `Stage ${doc.currentStepIndex + 1} authorized: "${comments}"`,
              previousStatus: doc.status,
              newStatus,
              ipAddress: '10.0.4.15'
            }
          ]
        };
      }
      return doc;
    }));

    showToast(`Document ${docId} approved and advanced to next stage!`);
    
    // update active viewer doc
    if (viewingDoc && viewingDoc.id === docId) {
      setViewingDoc(prev => {
        if (!prev) return null;
        const nextStepIndex = prev.currentStepIndex + 1;
        const isFinal = nextStepIndex >= prev.workflowSteps.length;
        return {
          ...prev,
          status: isFinal ? 'Approved' : 'Pending Approval',
          currentStepIndex: nextStepIndex,
          workflowSteps: prev.workflowSteps.map((s, i) => i === prev.currentStepIndex ? { ...s, status: 'approved' as const, actionComment: comments } : i === nextStepIndex ? { ...s, status: 'current' as const } : s)
        };
      });
    }
  };

  const handleRejectDocument = (docId: string, reason: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        return {
          ...doc,
          status: 'Rejected',
          lastUpdated: '2026-08-22 03:20 PM',
          workflowSteps: doc.workflowSteps.map((s, i) => i === doc.currentStepIndex ? { ...s, status: 'rejected' as const, actionComment: reason } : s),
          auditTrail: [
            ...doc.auditTrail,
            {
              id: `audit-${Date.now()}`,
              timestamp: '2026-08-22 03:20 PM',
              actor: {
                name: 'Auditing Officer',
                email: 'compliance@enterprise.io',
                role: 'Auditor',
                initials: 'AO'
              },
              action: 'Rejected Document',
              details: `Document rejected at Stage ${doc.currentStepIndex + 1}: "${reason}"`,
              previousStatus: doc.status,
              newStatus: 'Rejected',
              ipAddress: '10.0.4.15'
            }
          ]
        };
      }
      return doc;
    }));
    showToast(`Document ${docId} marked as Rejected.`);
  };

  const handleRequestRevision = (docId: string, feedback: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        return {
          ...doc,
          status: 'Revision Requested',
          lastUpdated: '2026-08-22 03:25 PM',
          workflowSteps: doc.workflowSteps.map((s, i) => i === doc.currentStepIndex ? { ...s, status: 'revision_requested' as const, actionComment: feedback } : s),
          auditTrail: [
            ...doc.auditTrail,
            {
              id: `audit-${Date.now()}`,
              timestamp: '2026-08-22 03:25 PM',
              actor: {
                name: 'Reviewer',
                email: 'reviewer@enterprise.io',
                role: 'Inspector',
                initials: 'RV'
              },
              action: 'Requested Revision',
              details: `Revision requested: "${feedback}"`,
              previousStatus: doc.status,
              newStatus: 'Revision Requested',
              ipAddress: '10.0.4.15'
            }
          ]
        };
      }
      return doc;
    }));
    showToast(`Revision request dispatched to requester for ${docId}.`);
  };

  const handleUploadAttachment = (docId: string, file: File, category: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        const newAtt = {
          id: `att-${Date.now()}`,
          fileName: file.name,
          fileType: (file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.xlsx') ? 'xlsx' : 'docx') as any,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          category: category as any,
          uploadedBy: { name: 'Current User' },
          uploadedAt: '2026-08-22 03:30 PM',
          isVerified: true,
          checksum: 'sha256:' + Math.random().toString(36).substring(2, 10)
        };
        return {
          ...doc,
          attachments: [...doc.attachments, newAtt],
          auditTrail: [
            ...doc.auditTrail,
            {
              id: `audit-${Date.now()}`,
              timestamp: '2026-08-22 03:30 PM',
              actor: {
                name: 'Current User',
                email: 'user@enterprise.io',
                role: 'Uploader',
                initials: 'CU'
              },
              action: 'Uploaded Supporting File',
              details: `Attached "${file.name}" under category "${category}".`,
              ipAddress: '10.0.12.90'
            }
          ]
        };
      }
      return doc;
    }));
    showToast(`Uploaded ${file.name} to document repository.`);
  };

  const handleCreateDocument = (newDoc: ErpDocument) => {
    setDocuments(prev => [newDoc, ...prev]);
  };

  const handleSelectAll = () => {
    if (selectedDocIds.length === filteredDocuments.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocuments.map(d => d.id));
    }
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = () => {
    if (selectedDocIds.length === 0) return;
    selectedDocIds.forEach(id => {
      handleApproveDocument(id, 'Bulk approved via ERP batch operations center.');
    });
    showToast(`Bulk approved ${selectedDocIds.length} documents.`);
    setSelectedDocIds([]);
  };

  const getStatusBadgeVariant = (status: ErpDocumentStatus) => {
    switch (status) {
      case 'Approved':
      case 'Fulfilled':
        return 'emerald';
      case 'Pending Approval':
      case 'Under Verification':
        return 'indigo';
      case 'Revision Requested':
        return 'amber';
      case 'Rejected':
        return 'rose';
      default:
        return 'slate';
    }
  };

  const getTypeBadgeVariant = (type: ErpDocumentType) => {
    switch (type) {
      case 'Purchase Order':
        return 'emerald';
      case 'Purchase Requisition':
        return 'indigo';
      case 'Goods Received Note':
        return 'blue';
      case 'Purchase Voucher':
        return 'purple';
      case 'Request for Quotation':
        return 'amber';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold tracking-wide uppercase">
              Enterprise Resource Planning (ERP)
            </span>
            <span className="text-xs text-slate-400 font-mono">• Document Verification & Workflows</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Procurement & Document Approval Pipeline
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Multi-tier sequential approvals, 256-bit certified PDF preview, and immutable audit logs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => showToast('Exporting ERP procurement ledger as CSV...')}
            icon={<Download size={14} />}
          >
            Export Ledger
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus size={15} />}
          >
            New ERP Document
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Awaiting Authorization
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.pendingCount}
            </span>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              ${(metrics.pendingValue / 1000).toFixed(1)}k value
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <AlertCircle size={12} /> 2 documents near 24h SLA threshold
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Active Pipeline Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              ${(metrics.totalValue / 1000).toFixed(1)}k
            </span>
            <span className="text-xs text-slate-400">USD</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Across {documents.length} procurement records
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Verified & Signed
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.approvedCount}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              100% Sealed
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Cryptographically certified & dispatched
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Avg Approval Velocity
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.avgSlaHours}h
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              -3.2h vs benchmark
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            98.4% within target SLA window
          </div>
        </div>

      </div>

      {/* Filter Tabs Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
        
        {/* Process Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 dark:border-white/5">
          {[
            { id: 'all', label: 'All Documents', count: documents.length },
            { id: 'pr', label: 'Purchase Requisitions (PR)', count: documents.filter(d => d.type === 'Purchase Requisition').length },
            { id: 'po', label: 'Purchase Orders (PO)', count: documents.filter(d => d.type === 'Purchase Order').length },
            { id: 'grn', label: 'Goods Received (GRN)', count: documents.filter(d => d.type === 'Goods Received Note').length },
            { id: 'pv', label: 'Purchase Vouchers (PV)', count: documents.filter(d => d.type === 'Purchase Voucher').length },
            { id: 'rfq', label: 'Requests for Quote (RFQ)', count: documents.filter(d => d.type === 'Request for Quotation').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTypeFilter(tab.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTypeFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTypeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Secondary Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search doc #, vendor, requester, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {/* Status Quick Filter */}
            <select
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="all">Status: All Statuses</option>
              <option value="action_needed">⚠️ Action Needed (My Queue)</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Under Verification">Under Verification</option>
              <option value="Approved">Approved</option>
              <option value="Revision Requested">Revision Requested</option>
              <option value="Fulfilled">Fulfilled</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="all">Priority: All</option>
              <option value="High Value">High Value (&gt;$50k)</option>
              <option value="Urgent">Urgent SLA</option>
              <option value="Standard">Standard</option>
            </select>
          </div>

        </div>

      </div>

      {/* Bulk Operations Toolbar (when items selected) */}
      {selectedDocIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-indigo-900 text-white flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckSquare size={16} className="text-indigo-300" />
            <span>{selectedDocIds.length} documents selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={handleBulkApprove}
              icon={<CheckCircle2 size={12} />}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
            >
              Batch Approve
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => showToast(`Generating batch PDF zip for ${selectedDocIds.length} files...`)}
              icon={<Download size={12} />}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
            >
              Batch Export
            </Button>
            <button
              onClick={() => setSelectedDocIds([])}
              className="text-xs text-indigo-300 hover:text-white px-2"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main ERP Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            
            <thead className="bg-slate-50/80 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200 dark:border-white/10 text-[11px]">
              <tr>
                <th className="p-4 w-12 text-center">
                  <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                    {selectedDocIds.length === filteredDocuments.length && filteredDocuments.length > 0 ? (
                      <CheckSquare size={15} className="text-indigo-600" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </th>
                <th className="p-4 w-36">Document No</th>
                <th className="p-4">Process & Description</th>
                <th className="p-4 w-36">Department</th>
                <th className="p-4 w-32 text-right">Value (USD)</th>
                <th className="p-4 w-44">Workflow Pipeline</th>
                <th className="p-4 w-32 text-center">Status</th>
                <th className="p-4 w-28 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-800 dark:text-zinc-200">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-sm">No ERP documents match your filter criteria</p>
                    <p className="text-xs text-slate-500 mt-1">Try clearing your search query or reset status filters</p>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  const isPendingMyAction = doc.status === 'Pending Approval' || doc.status === 'Under Verification';

                  return (
                    <tr 
                      key={doc.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 text-center">
                        <button onClick={() => handleToggleSelectDoc(doc.id)} className="text-slate-400 hover:text-indigo-600">
                          {isSelected ? (
                            <CheckSquare size={15} className="text-indigo-600" />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                      </td>

                      {/* Doc No & Type */}
                      <td className="p-4">
                        <div className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          {doc.documentNumber}
                        </div>
                        <Badge variant={getTypeBadgeVariant(doc.type)} size="xs" className="mt-1">
                          {doc.type}
                        </Badge>
                      </td>

                      {/* Title, Requester, & Vendor */}
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs max-w-sm truncate">
                          {doc.title}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            Req: <span className="font-medium text-slate-700 dark:text-zinc-300">{doc.requester.name}</span>
                          </span>
                          {doc.vendor && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 truncate max-w-[150px]">
                                <Building2 size={11} className="shrink-0" />
                                {doc.vendor.name}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Paperclip size={11} /> {doc.attachments.length}
                          </span>
                        </div>
                      </td>

                      {/* Department & Cost Center */}
                      <td className="p-4">
                        <div className="text-slate-900 dark:text-white font-medium text-xs">
                          {doc.department}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {doc.costCenter}
                        </div>
                      </td>

                      {/* Financial Value */}
                      <td className="p-4 text-right">
                        <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          ${doc.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {doc.lineItems.length} items • {doc.currency}
                        </div>
                      </td>

                      {/* Workflow Stepper Mini Progress */}
                      <td className="p-4">
                        <ErpWorkflowStepper
                          steps={doc.workflowSteps}
                          currentStepIndex={doc.currentStepIndex}
                          compact={true}
                        />
                        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                          <span>Stage {doc.currentStepIndex + 1} of {doc.workflowSteps.length}</span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {doc.workflowSteps[doc.currentStepIndex]?.requiredRole || 'Complete'}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-4 text-center">
                        <Badge variant={getStatusBadgeVariant(doc.status)} size="xs">
                          {doc.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenPdf(doc)}
                            className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
                            title="Open 256-Bit PDF Preview & Verification"
                          >
                            <Eye size={14} />
                          </button>

                          {isPendingMyAction && (
                            <button
                              onClick={() => handleApproveDocument(doc.id, 'Quick approved from ERP table view.')}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                              title="Quick Verify & Approve"
                            >
                              <FileCheck size={14} />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Footer Statistics */}
        <div className="p-4 bg-slate-50/80 dark:bg-zinc-800/40 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 dark:text-zinc-400 gap-2">
          <span>
            Showing {filteredDocuments.length} of {documents.length} registered ERP documents
          </span>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              All records cryptographically hashed
            </span>
          </div>
        </div>

      </div>

      {/* Embedded Full-Scale PDF Document Viewer Modal */}
      <DocumentPdfViewerModal
        document={viewingDoc}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onApprove={handleApproveDocument}
        onReject={handleRejectDocument}
        onRequestRevision={handleRequestRevision}
        onUploadAttachment={handleUploadAttachment}
        showToast={showToast}
      />

      {/* Embedded Create ERP Document Modal */}
      <CreateDocumentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateDocument={handleCreateDocument}
        showToast={showToast}
      />

    </div>
  );
};

export default ErpWorkflowView;
