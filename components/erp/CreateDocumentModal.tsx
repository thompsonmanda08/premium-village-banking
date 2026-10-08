import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  UploadCloud, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  Layers, 
  ShieldCheck,
  Building,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  ErpDocument, 
  ErpDocumentType, 
  ErpPriority, 
  ErpLineItem, 
  ErpApprovalStep,
  ErpDocumentAttachment
} from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDocument: (newDoc: ErpDocument) => void;
  showToast: (msg: string) => void;
}

export const CreateDocumentModal: React.FC<CreateDocumentModalProps> = ({
  isOpen,
  onClose,
  onCreateDocument,
  showToast,
}) => {
  const [docType, setDocType] = useState<ErpDocumentType>('Purchase Requisition');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [department, setDepartment] = useState<string>('Engineering & R&D');
  const [costCenter, setCostCenter] = useState<string>('CC-4010-ENG');
  const [priority, setPriority] = useState<ErpPriority>('Standard');
  const [requiredByDate, setRequiredByDate] = useState<string>('2026-09-15');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('Enterprise Campus West, Receiving Dock 4, Austin TX');
  
  // Vendor Info
  const [vendorName, setVendorName] = useState<string>('Dell Technologies Enterprise');
  const [vendorContact, setVendorContact] = useState<string>('accounts@dell.com');
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');

  // Line items
  const [lineItems, setLineItems] = useState<ErpLineItem[]>([
    {
      id: 'li-new-1',
      itemCode: 'HW-SRV-R760',
      description: 'PowerEdge R760 Rack Server 2x Xeon Gold 6430, 256GB RAM, 2x 1.92TB NVMe',
      category: 'Hardware & Compute',
      quantity: 2,
      unit: 'Units',
      unitPrice: 9400.00,
      taxRate: 0.08,
      totalAmount: 18800.00,
      glAccountCode: 'GL-1520-HW'
    }
  ]);

  // Uploaded files
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string; category: string }[]>([
    { name: 'Dell_Custom_BOM_Quotation_Q992.pdf', size: '2.4 MB', category: 'Vendor Quotation' }
  ]);

  if (!isOpen) return null;

  // Calculation helpers
  const subtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const taxAmount = lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice * item.taxRate), 0);
  const shippingHandling = subtotal > 50000 ? 1200 : 350;
  const totalAmount = subtotal + taxAmount + shippingHandling;

  const handleAddLineItem = () => {
    const newItem: ErpLineItem = {
      id: `li-new-${Date.now()}`,
      itemCode: 'ITEM-' + Math.floor(1000 + Math.random() * 9000),
      description: 'New Item or Service Description',
      category: 'Procurement',
      quantity: 1,
      unit: 'Units',
      unitPrice: 1000.00,
      taxRate: 0.08,
      totalAmount: 1000.00,
      glAccountCode: 'GL-1000'
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const handleUpdateLineItem = (id: string, field: keyof ErpLineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
          const qty = field === 'quantity' ? Number(value) : item.quantity;
          const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
          updated.totalAmount = qty * price;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length === 1) {
      showToast('Document must contain at least one line item');
      return;
    }
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a document title or description');
      return;
    }

    const prefixMap: Record<ErpDocumentType, string> = {
      'Purchase Requisition': 'PR',
      'Purchase Order': 'PO',
      'Goods Received Note': 'GRN',
      'Purchase Voucher': 'PV',
      'Request for Quotation': 'RFQ'
    };

    const docNumber = `${prefixMap[docType]}-2026-${Math.floor(100 + Math.random() * 900)}`;

    // Build multi-step approval workflow steps based on document total value
    const workflowSteps: ErpApprovalStep[] = [
      {
        id: `step-${Date.now()}-1`,
        stepNumber: 1,
        stepName: 'Department Head Verification',
        requiredRole: 'Engineering Manager',
        assignedApprover: {
          id: 'app-mgr-1',
          name: 'Marcus Vance',
          email: 'm.vance@enterprise.io',
          role: 'Engineering Director',
          initials: 'MV'
        },
        status: 'current',
        slaDeadline: '2026-08-25 05:00 PM'
      },
      {
        id: `step-${Date.now()}-2`,
        stepNumber: 2,
        stepName: 'Procurement & Vendor Compliance Review',
        requiredRole: 'Head of Strategic Sourcing',
        assignedApprover: {
          id: 'app-proc-1',
          name: 'Sara Lin',
          email: 's.lin@enterprise.io',
          role: 'Head of Sourcing',
          initials: 'SL'
        },
        status: 'pending',
        slaDeadline: '2026-08-27 05:00 PM'
      }
    ];

    if (totalAmount > 25000) {
      workflowSteps.push({
        id: `step-${Date.now()}-3`,
        stepNumber: 3,
        stepName: 'Financial Controller CapEx Authorization',
        requiredRole: 'Director of Corporate Finance',
        assignedApprover: {
          id: 'app-fin-1',
          name: 'David Sterling',
          email: 'd.sterling@enterprise.io',
          role: 'Corporate Controller',
          initials: 'DS'
        },
        status: 'pending',
        slaDeadline: '2026-08-29 05:00 PM'
      });
    }

    if (totalAmount > 75000 || priority === 'High Value') {
      workflowSteps.push({
        id: `step-${Date.now()}-4`,
        stepNumber: 4,
        stepName: 'Executive CFO Sign-Off & Seal',
        requiredRole: 'Chief Financial Officer',
        assignedApprover: {
          id: 'app-cfo-1',
          name: 'Victoria Hawthorne',
          email: 'v.hawthorne@enterprise.io',
          role: 'CFO',
          initials: 'VH'
        },
        status: 'pending',
        slaDeadline: '2026-08-31 05:00 PM'
      });
    }

    const newDoc: ErpDocument = {
      id: `doc-${Date.now()}`,
      documentNumber: docNumber,
      type: docType,
      title,
      description: description || `Official ${docType} generated via Enterprise ERP Portal.`,
      status: 'Under Verification',
      priority,
      department,
      costCenter,
      requester: {
        id: 'req-current',
        name: 'Jordan Hayes',
        email: 'j.hayes@enterprise.io',
        department,
        initials: 'JH'
      },
      vendor: {
        id: 'v-custom',
        name: vendorName,
        contactPerson: 'Sales Team',
        email: vendorContact,
        phone: '+1 (800) 555-0100',
        taxId: 'US-EIN-74-9910245',
        paymentTerms,
        address: 'One Dell Way, Round Rock, TX 78682'
      },
      currency: 'USD',
      subtotal,
      taxAmount,
      shippingHandling,
      totalAmount,
      createdDate: '2026-08-22 03:00 PM',
      requiredByDate,
      lastUpdated: '2026-08-22 03:00 PM',
      deliveryLocation,
      lineItems,
      currentStepIndex: 0,
      workflowSteps,
      attachments: attachedFiles.map((f, i) => ({
        id: `att-${Date.now()}-${i}`,
        fileName: f.name,
        fileType: 'pdf',
        fileSize: f.size,
        category: f.category as any,
        uploadedBy: { name: 'Jordan Hayes' },
        uploadedAt: '2026-08-22 03:00 PM',
        isVerified: true,
        checksum: 'sha256:custom' + Math.random().toString(36).substring(2, 9)
      })),
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: '2026-08-22 03:00 PM',
          actor: {
            name: 'Jordan Hayes',
            email: 'j.hayes@enterprise.io',
            role: 'Requester',
            initials: 'JH'
          },
          action: 'Created Document',
          details: `Generated new ${docType} ${docNumber} with ${lineItems.length} line items totaling $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
          previousStatus: 'Draft',
          newStatus: 'Under Verification',
          ipAddress: '10.0.12.55'
        }
      ]
    };

    onCreateDocument(newDoc);
    showToast(`Successfully created ${docNumber} and initiated workflow pipeline!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl max-w-4xl w-full p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Initiate ERP Procurement Document
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Configure document metadata, line items, and sequential approval routing
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Document Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Document Workflow Process
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['Purchase Requisition', 'Purchase Order', 'Goods Received Note', 'Purchase Voucher', 'Request for Quotation'] as ErpDocumentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocType(type)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      docType === type
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{type}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2 font-mono">
                      {type === 'Purchase Requisition' ? 'PR' : type === 'Purchase Order' ? 'PO' : type === 'Goods Received Note' ? 'GRN' : type === 'Purchase Voucher' ? 'PV' : 'RFQ'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Document Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Document Title / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Server Upgrade, Dell PowerEdge Compute Nodes..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Priority & SLA Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ErpPriority)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Standard">Standard (Within 72h)</option>
                  <option value="Medium">Medium (Within 48h)</option>
                  <option value="Urgent">Urgent (Within 24h)</option>
                  <option value="High Value">High Value (&gt;$50k Executive)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Engineering & R&D">Engineering & R&D</option>
                  <option value="AI & Data Infrastructure">AI & Data Infrastructure</option>
                  <option value="Network Operations">Network Operations</option>
                  <option value="Facilities & Workplace">Facilities & Workplace</option>
                  <option value="Information Security">Information Security</option>
                  <option value="Corporate Finance">Corporate Finance</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Cost Center
                </label>
                <input
                  type="text"
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Required By Date
                </label>
                <input
                  type="date"
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Vendor Details */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200 dark:border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Building size={14} className="text-indigo-600" />
                Vendor & Commercial Terms
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Vendor / Supplier Name</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={vendorContact}
                    onChange={(e) => setVendorContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45 upon delivery">Net 45 upon delivery</option>
                    <option value="50% Advance / 50% Net 30">50% Advance / 50% Net 30</option>
                    <option value="Immediate Wire">Immediate Wire</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Itemized Line Items
                </h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={handleAddLineItem}
                  icon={<Plus size={13} />}
                >
                  Add Item Row
                </Button>
              </div>

              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-white/10 text-[11px]">
                    <tr>
                      <th className="p-3 w-28">Item Code</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 w-20 text-center">Qty</th>
                      <th className="p-3 w-24 text-center">Unit</th>
                      <th className="p-3 w-28 text-right">Unit Price</th>
                      <th className="p-3 w-28 text-right">Total</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.itemCode}
                            onChange={(e) => handleUpdateLineItem(item.id, 'itemCode', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 font-mono text-[11px]"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineItem(item.id, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-center font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.unit}
                            onChange={(e) => handleUpdateLineItem(item.id, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs"
                          >
                            <option value="Units">Units</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Boxes">Boxes</option>
                            <option value="Sets">Sets</option>
                            <option value="Months">Months</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateLineItem(item.id, 'unitPrice', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-right font-mono text-xs"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ${item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Tax (8%):</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      ${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Freight / Shipping:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      ${shippingHandling.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                    <span>Total Cost:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow Routing Auto-Detection Notice */}
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                    Automatic Workflow Routing: {totalAmount > 75000 ? '4-Stage Executive Approval' : totalAmount > 25000 ? '3-Stage Controller Approval' : '2-Stage Standard Approval'}
                  </span>
                  <span className="text-slate-600 dark:text-zinc-400 text-[11px]">
                    Document will be routed sequentially to assigned approvers with SLA countdowns.
                  </span>
                </div>
              </div>
              <Badge variant="indigo" size="xs">Auto-Routed</Badge>
            </div>

            {/* Submit & Cancel */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={<CheckCircle2 size={16} />}
              >
                Submit & Route for Verification
              </Button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
};

export default CreateDocumentModal;
