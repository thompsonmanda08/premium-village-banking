import React, { useState } from 'react';
import { 
  Plus, 
  Download, 
  Filter, 
  Trash2, 
  MoreHorizontal, 
  Eye, 
  FileSpreadsheet, 
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import DataTable, { ColumnDef } from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import Modal from '../ui/Modal';
import Drawer from '../ui/Drawer';
import Input, { Textarea } from '../ui/Input';
import { sampleTransactions } from '../../data/dashboardData';
import { TransactionRecord } from '../../types';

interface DataRecordsViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
}

export const DataRecordsView: React.FC<DataRecordsViewProps> = ({
  theme,
  showToast,
}) => {
  const [records, setRecords] = useState<TransactionRecord[]>(sampleTransactions);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [activeRecord, setActiveRecord] = useState<TransactionRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'Pending' | 'Failed' | 'Refunded'>('All');

  // Form fields for new record
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Pro Monthly');

  const filteredRecords = statusFilter === 'All'
    ? records
    : records.filter((r) => r.status === statusFilter);

  const handleAddRecord = () => {
    if (!newCustomerName || !newAmount) {
      showToast('Please fill all required fields');
      return;
    }

    const newTx: TransactionRecord = {
      id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: newCustomerName,
      customerEmail: newCustomerEmail || `${newCustomerName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      amount: parseFloat(newAmount) || 0,
      status: 'Completed',
      date: new Date().toISOString().split('T')[0],
      category: newCategory,
      paymentMethod: 'Credit Card (**** 9921)',
    };

    setRecords([newTx, ...records]);
    setIsAddModalOpen(false);
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewAmount('');
    showToast(`Record ${newTx.id} added successfully!`);
  };

  const handleDeleteSelected = () => {
    setRecords(records.filter((r) => !selectedKeys.includes(r.id)));
    showToast(`Deleted ${selectedKeys.length} records`);
    setSelectedKeys([]);
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["ID,Customer,Email,Amount,Status,Date,Category,PaymentMethod"]
        .concat(records.map(r => `${r.id},"${r.customerName}",${r.customerEmail},${r.amount},${r.status},${r.date},"${r.category}","${r.paymentMethod}"`))
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dashboard_records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV downloaded successfully!');
  };

  const columns: ColumnDef<TransactionRecord>[] = [
    {
      key: 'id',
      header: 'Record ID',
      width: '120px',
      render: (item) => (
        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
          {item.id}
        </span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={item.customerAvatar} name={item.customerName} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white truncate">{item.customerName}</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{item.customerEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Tier / Product',
      render: (item) => (
        <span className="text-slate-600 dark:text-zinc-300 font-medium">{item.category}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (item) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (item) => {
        const variants: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
          Completed: 'success',
          Pending: 'warning',
          Failed: 'danger',
          Refunded: 'info',
        };
        return (
          <Badge variant={variants[item.status] || 'neutral'} size="sm" dot>
            {item.status}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      header: 'Timestamp',
      align: 'right',
      render: (item) => (
        <span className="text-slate-400 dark:text-zinc-500">{item.date}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sortable: false,
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveRecord(item);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          title="Inspect details"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Data Ledger & Customer Records
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage transactions, account ledger entries, and customer subscriptions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedKeys.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSelected}
              leftIcon={<Trash2 size={14} />}
            >
              Delete ({selectedKeys.length})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download size={14} />}
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus size={14} />}
          >
            Add Record
          </Button>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
          <Filter size={12} /> Status:
        </span>
        {(['All', 'Completed', 'Pending', 'Failed', 'Refunded'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 text-xs font-semibold rounded-xl border transition-all ${
              statusFilter === st
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Main DataTable Component */}
      <DataTable
        data={filteredRecords}
        columns={columns}
        keyExtractor={(item) => item.id}
        selectable={true}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={5}
        searchPlaceholder="Search customer, email, category..."
        onRowClick={(item) => setActiveRecord(item)}
      />

      {/* Add Record Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Transaction Record"
        description="Create a new customer subscription or manual billing ledger entry."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddRecord}>
              Create Record
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Input
            label="Customer Name"
            placeholder="e.g. Jordan Miller"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />

          <Input
            label="Customer Email (Optional)"
            placeholder="e.g. jordan@company.com"
            value={newCustomerEmail}
            onChange={(e) => setNewCustomerEmail(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount ($ USD)"
              type="number"
              placeholder="299.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 tracking-tight mb-1.5">
                Plan Tier
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-sm p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Pro Monthly">Pro Monthly ($299)</option>
                <option value="Enterprise License">Enterprise License ($1,250)</option>
                <option value="Annual Custom Plan">Annual Custom Plan ($4,999)</option>
                <option value="API Tier Upgrade">API Tier Upgrade ($890)</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Record Inspector Drawer */}
      <Drawer
        isOpen={Boolean(activeRecord)}
        onClose={() => setActiveRecord(null)}
        title="Transaction Ledger Details"
        subtitle={activeRecord?.id}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                showToast(`Receipt for ${activeRecord?.id} re-sent`);
                setActiveRecord(null);
              }}
            >
              Send Receipt
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveRecord(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {activeRecord && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-500">Status</span>
                <Badge variant={activeRecord.status === 'Completed' ? 'success' : activeRecord.status === 'Pending' ? 'warning' : 'danger'} size="sm" dot>
                  {activeRecord.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-500">Total Billed</span>
                <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                  ${activeRecord.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-500">Payment Gateway</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{activeRecord.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-500">Processed On</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{activeRecord.date}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">Customer Profile</h4>
              <div className="flex items-center gap-3 pt-1">
                <Avatar src={activeRecord.customerAvatar} name={activeRecord.customerName} size="md" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{activeRecord.customerName}</p>
                  <p className="text-slate-400 dark:text-zinc-400">{activeRecord.customerEmail}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

    </div>
  );
};

export default DataRecordsView;
