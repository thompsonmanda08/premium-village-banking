import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Paperclip, 
  FileCheck, 
  RotateCcw, 
  Eye, 
  UploadCloud, 
  Lock, 
  QrCode, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  Calendar,
  Layers,
  FileSignature
} from 'lucide-react';
import { ErpDocument, ErpDocumentAttachment, ErpDocumentAuditLog } from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ErpWorkflowStepper from './ErpWorkflowStepper';

interface DocumentPdfViewerModalProps {
  document: ErpDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (docId: string, comments: string) => void;
  onReject: (docId: string, reason: string) => void;
  onRequestRevision: (docId: string, feedback: string) => void;
  onUploadAttachment: (docId: string, file: File, category: string) => void;
  showToast: (msg: string) => void;
}

export const DocumentPdfViewerModal: React.FC<DocumentPdfViewerModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestRevision,
  onUploadAttachment,
  showToast,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages] = useState<number>(3);
  const [watermark, setWatermark] = useState<boolean>(true);
  const [activeSideTab, setActiveSideTab] = useState<'workflow' | 'attachments' | 'audit'>('workflow');
  const [actionComment, setActionComment] = useState<string>('');
  const [showSignDialog, setShowSignDialog] = useState<boolean>(false);
  const [signaturePin, setSignaturePin] = useState<string>('9942');
  const [attachmentCategory, setAttachmentCategory] = useState<string>('Vendor Quotation');

  if (!isOpen || !doc) return null;

  const currentStep = doc.workflowSteps[doc.currentStepIndex];
  const isFullyApproved = doc.status === 'Approved' || doc.status === 'Fulfilled';

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 15, 150));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 15, 70));

  const handlePrint = () => {
    showToast(`Sending ${doc.documentNumber} to secure PDF printer spool...`);
    window.print();
  };

  const handleDownload = () => {
    showToast(`Downloading certified PDF: ${doc.documentNumber}.pdf`);
  };

  const handleSignAndApprove = () => {
    onApprove(doc.id, actionComment || 'Approved and digitally certified after verification.');
    setShowSignDialog(false);
    setActionComment('');
  };

  const handleTriggerRevision = () => {
    if (!actionComment.trim()) {
      showToast('Please enter revision feedback comments');
      return;
    }
    onRequestRevision(doc.id, actionComment);
    setActionComment('');
  };

  const handleTriggerReject = () => {
    if (!actionComment.trim()) {
      showToast('Please provide a rejection rationale');
      return;
    }
    onReject(doc.id, actionComment);
    setActionComment('');
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onUploadAttachment(doc.id, file, attachmentCategory);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Main Full-Scale PDF Viewer Interface */}
      <div className="fixed inset-2 md:inset-4 bg-slate-900 rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Top Control Toolbar */}
        <div className="h-16 px-4 md:px-6 bg-slate-950/90 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          
          {/* Left: Document Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  {doc.documentNumber}
                </span>
                <Badge variant={getStatusBadgeVariant(doc.status)} size="xs">
                  {doc.status}
                </Badge>
                <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                  • {doc.type}
                </span>
              </div>
              <h3 className="text-xs text-slate-300 truncate max-w-sm">
                {doc.title}
              </h3>
            </div>
          </div>

          {/* Center: PDF Page & Zoom Controls */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <button 
              onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
              disabled={activePage === 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-[11px] px-1">
              Page {activePage} of {totalPages}
            </span>
            <button 
              onClick={() => setActivePage(prev => Math.min(totalPages, prev + 1))}
              disabled={activePage === totalPages}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>

            <div className="w-px h-4 bg-white/10 mx-1" />

            <button 
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-white/10" 
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="font-mono text-[11px] w-10 text-center">
              {zoomLevel}%
            </span>
            <button 
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-white/10" 
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>

            <div className="w-px h-4 bg-white/10 mx-1" />

            <button
              onClick={() => setWatermark(!watermark)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                watermark ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Watermark {watermark ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Right: Actions & Close */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              icon={<Printer size={14} />}
              className="hidden sm:inline-flex"
            >
              Print
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              icon={<Download size={14} />}
            >
              Export PDF
            </Button>

            {!isFullyApproved && currentStep?.status === 'current' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSignDialog(true)}
                icon={<FileSignature size={14} />}
              >
                Sign & Approve
              </Button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-2"
              title="Close Viewer"
            >
              <X size={18} />
            </button>
          </div>

        </div>

        {/* Content Workspace: Split into PDF Sheet Canvas and Inspector Panel */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: PDF Paper Canvas */}
          <div className="flex-1 bg-slate-950 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
            
            {/* The A4 Scaled Document Paper Sheet */}
            <div 
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="relative w-full max-w-3xl bg-white text-slate-900 rounded-lg shadow-2xl p-8 md:p-12 transition-transform duration-200 border border-slate-300 min-h-[1050px] flex flex-col justify-between"
            >
              
              {/* Optional Security Watermark Overlay */}
              {watermark && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-5 select-none z-0">
                  <span className="text-8xl font-black tracking-widest text-slate-900 -rotate-45 uppercase">
                    {doc.status === 'Approved' ? 'CERTIFIED' : doc.status}
                  </span>
                </div>
              )}

              {/* PAGE 1: Core Document & Financial Line Items */}
              {activePage === 1 && (
                <div className="space-y-6 relative z-10">
                  
                  {/* Document Header & Company Branding */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                          EP
                        </div>
                        <span className="text-xl font-black tracking-tight text-slate-900">
                          ENTERPRISE ERP PLATFORM
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Global Operations & Procurement Headquarters • Austin TX, USA
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <h2 className="text-lg font-black uppercase text-indigo-700">
                        {doc.type}
                      </h2>
                      <p className="font-mono text-sm font-bold text-slate-800">
                        {doc.documentNumber}
                      </p>
                      <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-500 font-mono">
                        <span>Barcode:</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">||| |||| || ||||||</span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Date Issued</span>
                      <span className="font-semibold text-slate-800">{doc.createdDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                      <span className="font-semibold text-slate-800">{doc.department}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Center</span>
                      <span className="font-mono font-semibold text-slate-800">{doc.costCenter}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Priority / SLA</span>
                      <span className="font-bold text-indigo-600">{doc.priority}</span>
                    </div>
                  </div>

                  {/* Parties Block (Requester & Vendor) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Initiating Requester
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {doc.requester.name}
                      </h4>
                      <p className="text-slate-600">{doc.requester.department}</p>
                      <p className="text-slate-500 font-mono text-[11px]">{doc.requester.email}</p>
                    </div>

                    {doc.vendor ? (
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                          Designated Vendor / Supplier
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {doc.vendor.name}
                        </h4>
                        <p className="text-slate-600 text-[11px]">{doc.vendor.address}</p>
                        <div className="text-[10px] text-slate-500 font-mono flex justify-between pt-1">
                          <span>Tax ID: {doc.vendor.taxId}</span>
                          <span>Terms: {doc.vendor.paymentTerms}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs italic">
                        Internal Corporate Requisition (Multi-Vendor Bid Stage)
                      </div>
                    )}
                  </div>

                  {/* Line Items Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Procurement Line Items Specification
                    </h4>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-2.5 w-12 text-center">#</th>
                            <th className="p-2.5">Item Code & Description</th>
                            <th className="p-2.5 text-center">Qty / Unit</th>
                            <th className="p-2.5 text-right">Unit Price</th>
                            <th className="p-2.5 text-right">Tax</th>
                            <th className="p-2.5 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800">
                          {doc.lineItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-2.5">
                                <span className="font-mono font-bold text-[11px] text-indigo-700 block">
                                  {item.itemCode}
                                </span>
                                <span className="text-slate-700">{item.description}</span>
                                {item.glAccountCode && (
                                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                    GL: {item.glAccountCode}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono font-semibold">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="p-2.5 text-right font-mono">
                                ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-500">
                                {(item.taxRate * 100)}%
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                ${item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Summary Calculation */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ${doc.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax Amount</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ${doc.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {doc.shippingHandling > 0 && (
                        <div className="flex justify-between">
                          <span>Freight / Logistics</span>
                          <span className="font-mono font-semibold text-slate-900">
                            ${doc.shippingHandling.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-black text-slate-900">
                        <span>Total Authorization</span>
                        <span className="text-indigo-700">
                          ${doc.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery instructions */}
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs space-y-1">
                    <span className="font-bold text-indigo-900 text-[11px] block">
                      Delivery & Intake Logistics:
                    </span>
                    <p className="text-slate-700 text-[11px]">
                      {doc.deliveryLocation}
                    </p>
                  </div>

                </div>
              )}

              {/* PAGE 2: Terms of Supply & Commercial Clauses */}
              {activePage === 2 && (
                <div className="space-y-6 relative z-10">
                  <div className="border-b border-slate-900 pb-4 flex justify-between items-center">
                    <h3 className="text-base font-black uppercase text-slate-900">
                      General Terms & Commercial Compliance Clauses
                    </h3>
                    <span className="text-xs font-mono text-slate-500">{doc.documentNumber} • Page 2</span>
                  </div>

                  <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        1. Acceptance & Inspection Protocol
                      </h4>
                      <p>
                        The goods or services detailed in this document are subject to receiving inspection, barcode tagging, and quality assurance sign-off within 5 business days of physical delivery. Non-conforming batches will be flagged and held at vendor risk.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        2. 3-Way Match Payment Terms
                      </h4>
                      <p>
                        Disbursements will be scheduled following successful 3-way reconciliation between the Purchase Order, Goods Received Note (GRN), and Vendor Tax Invoice. Payment will follow {doc.vendor?.paymentTerms || 'Standard Net 30'} terms.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        3. Specific Purchase Conditions
                      </h4>
                      <ul className="list-disc pl-4 space-y-1">
                        {doc.termsAndConditions?.map((term, i) => (
                          <li key={i}>{term}</li>
                        )) || (
                          <li>Standard enterprise procurement guidelines apply.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE 3: Multi-Party Authorization & Signatures Block */}
              {activePage === 3 && (
                <div className="space-y-6 relative z-10">
                  <div className="border-b border-slate-900 pb-4 flex justify-between items-center">
                    <h3 className="text-base font-black uppercase text-slate-900">
                      Verification Certification & Digital Signatures
                    </h3>
                    <span className="text-xs font-mono text-slate-500">{doc.documentNumber} • Page 3</span>
                  </div>

                  <p className="text-xs text-slate-600">
                    This document represents an authorized enterprise expenditure. The cryptographic digital signatures below verify sequential approval by all designated corporate authorities in accordance with Enterprise Financial Policy.
                  </p>

                  {/* Multi-Party Signature Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {doc.workflowSteps.map((step) => {
                      const isSigned = step.status === 'approved';
                      return (
                        <div 
                          key={step.id} 
                          className={`p-4 rounded-2xl border ${
                            isSigned 
                              ? 'bg-emerald-50/40 border-emerald-300' 
                              : 'bg-slate-50 border-dashed border-slate-300'
                          } space-y-2 text-xs`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800 text-[11px]">
                              Stage {step.stepNumber}: {step.requiredRole}
                            </span>
                            <Badge variant={isSigned ? 'emerald' : 'slate'} size="xs">
                              {isSigned ? 'Signed & Verified' : 'Pending'}
                            </Badge>
                          </div>

                          <div className="h-16 flex flex-col justify-center items-center border-b border-slate-200 pb-2">
                            {isSigned ? (
                              <div className="text-center">
                                <span className="font-serif italic text-lg font-bold text-indigo-900 block">
                                  {step.assignedApprover.name}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500">
                                  Digitally Signed: {step.actionDate}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Awaiting Authorization
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                            <span>Hash: {step.signatureHash ? step.signatureHash.slice(0, 16) + '...' : 'NONE'}</span>
                            <span>SLA: {step.slaDeadline || '24h'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Official Cryptographic Certificate Seal */}
                  {doc.pdfVerificationSeal && (
                    <div className="p-4 rounded-2xl bg-indigo-950 text-white flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                        <Lock size={24} />
                      </div>
                      <div className="text-xs space-y-0.5">
                        <h5 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                          Cryptographic Blockchain Integrity Stamp
                        </h5>
                        <p className="text-slate-300 text-[11px]">
                          Certificate #{doc.pdfVerificationSeal.certificateNumber} • Certified by {doc.pdfVerificationSeal.verifiedBy}
                        </p>
                        <p className="text-[10px] font-mono text-indigo-300 truncate max-w-md">
                          SHA256: {doc.pdfVerificationSeal.hash}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Document Footer & Verification Bar */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-mono gap-2">
                <span>Enterprise ERP Engine • Doc ID: {doc.id}</span>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  <span>256-Bit Encrypted Immutable Document</span>
                </div>
                <span>Page {activePage} of {totalPages}</span>
              </div>

            </div>

          </div>

          {/* RIGHT: Document Inspector & Approver Side Drawer */}
          <div className="w-80 md:w-96 bg-slate-900 border-l border-white/10 flex flex-col justify-between shrink-0">
            
            {/* Side Tabs Switcher */}
            <div className="p-3 border-b border-white/10 flex gap-1 bg-slate-950/60">
              <button
                onClick={() => setActiveSideTab('workflow')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeSideTab === 'workflow'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers size={13} /> Workflow
              </button>
              <button
                onClick={() => setActiveSideTab('attachments')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeSideTab === 'attachments'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Paperclip size={13} /> Files ({doc.attachments.length})
              </button>
              <button
                onClick={() => setActiveSideTab('audit')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeSideTab === 'audit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Clock size={13} /> Audit Log
              </button>
            </div>

            {/* Side Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* TAB 1: WORKFLOW & ACTIONS */}
              {activeSideTab === 'workflow' && (
                <div className="space-y-4">
                  <ErpWorkflowStepper
                    steps={doc.workflowSteps}
                    currentStepIndex={doc.currentStepIndex}
                    onApproveStep={() => setShowSignDialog(true)}
                    onRequestRevision={() => handleTriggerRevision()}
                    canCurrentUserAct={!isFullyApproved}
                  />

                  {/* Active Decision Box */}
                  {!isFullyApproved && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                      <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <FileSignature size={14} className="text-indigo-400" />
                        Approver Feedback & Notes
                      </h5>
                      <textarea
                        value={actionComment}
                        onChange={(e) => setActionComment(e.target.value)}
                        placeholder="Enter comments, audit notes, or modification requests..."
                        className="w-full h-20 p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={handleTriggerRevision}
                          icon={<RotateCcw size={11} />}
                          className="justify-center"
                        >
                          Request Revision
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={handleTriggerReject}
                          icon={<AlertCircle size={11} />}
                          className="justify-center"
                        >
                          Reject Doc
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SUPPORTING ATTACHMENTS */}
              {activeSideTab === 'attachments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white">
                      Attached Documents ({doc.attachments.length})
                    </h5>
                    <span className="text-[10px] text-slate-400">All Verified</span>
                  </div>

                  {/* Upload Drop Box */}
                  <div className="p-4 rounded-2xl border-2 border-dashed border-white/15 bg-white/5 text-center space-y-2">
                    <UploadCloud size={24} className="mx-auto text-indigo-400" />
                    <div className="text-xs text-slate-300">
                      <label className="font-semibold text-indigo-400 hover:underline cursor-pointer">
                        Click to upload
                        <input type="file" onChange={handleFileDrop} className="hidden" />
                      </label>
                      <span className="text-slate-500"> or drag file here</span>
                    </div>

                    <select
                      value={attachmentCategory}
                      onChange={(e) => setAttachmentCategory(e.target.value)}
                      className="w-full text-[11px] p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-300"
                    >
                      <option value="Vendor Quotation">Vendor Quotation</option>
                      <option value="Proforma Invoice">Proforma Invoice</option>
                      <option value="Technical Specification">Technical Specification</option>
                      <option value="Quality Inspection Sheet">Quality Inspection Sheet</option>
                      <option value="Bill of Lading">Bill of Lading</option>
                      <option value="Contract Agreement">Contract Agreement</option>
                      <option value="Tax Exemption Certificate">Tax Exemption Certificate</option>
                    </select>
                  </div>

                  {/* Attachments List */}
                  <div className="space-y-2">
                    {doc.attachments.map((att) => (
                      <div 
                        key={att.id}
                        className="p-3 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2 hover:border-indigo-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 uppercase">
                            {att.fileType}
                          </div>
                          <div className="min-w-0">
                            <h6 className="text-xs font-semibold text-white truncate">
                              {att.fileName}
                            </h6>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                              <span>{att.fileSize}</span>
                              <span>•</span>
                              <span className="text-indigo-400">{att.category}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => showToast(`Opening ${att.fileName}...`)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white"
                          title="Download / View"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: IMMUTABLE AUDIT LOG */}
              {activeSideTab === 'audit' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Lock size={12} className="text-emerald-400" />
                      Immutable Action Log
                    </h5>
                    <span className="text-[10px] font-mono text-slate-500">{doc.auditTrail.length} events</span>
                  </div>

                  <div className="relative pl-4 space-y-3 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                    {doc.auditTrail.map((log) => (
                      <div key={log.id} className="relative space-y-1 text-xs">
                        <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-indigo-500" />
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{log.timestamp}</span>
                          <span>{log.ipAddress}</span>
                        </div>
                        <p className="font-semibold text-white text-[11px]">
                          {log.actor.name} <span className="font-normal text-indigo-400">({log.action})</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {log.details}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Panel Status Banner */}
            <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                <div>
                  <span className="font-bold text-white text-xs block">ERP Security Compliance</span>
                  <span className="text-[10px] text-slate-400">SOC2 Type II & ISO 27001</span>
                </div>
              </div>
              <Badge variant="emerald" size="xs">Audit Green</Badge>
            </div>

          </div>

        </div>

      </div>

      {/* Digital Signature Pin Dialog */}
      {showSignDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignDialog(false)} />
          <div className="relative bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl z-10 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
              <FileSignature size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">
                Authorize & Digitally Sign
              </h3>
              <p className="text-xs text-slate-400">
                You are authorizing Stage {currentStep?.stepNumber || 1}: {currentStep?.stepName}.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Document:</span>
                <span className="font-mono font-bold text-white">{doc.documentNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Value:</span>
                <span className="font-mono font-bold text-indigo-400">
                  ${doc.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Signer:</span>
                <span className="font-bold text-white">{currentStep?.assignedApprover.name || 'Executive User'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Security Authorization PIN
              </label>
              <input
                type="password"
                value={signaturePin}
                onChange={(e) => setSignaturePin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-center text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1 justify-center"
                onClick={() => setShowSignDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1 justify-center"
                onClick={handleSignAndApprove}
                icon={<CheckCircle2 size={15} />}
              >
                Confirm & Seal
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentPdfViewerModal;
