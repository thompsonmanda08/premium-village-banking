import React, { useState, useMemo } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Filter,
  Download,
  SlidersHorizontal
} from 'lucide-react';
import Button from './Button';
import SearchInput from './Input';
import EmptyState from './EmptyState';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (selected: string[]) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchFilter,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  pageSize = 5,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search filters or add a new record.',
  actions,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Filtered Data
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter((item) => searchFilter(item, searchQuery));
    }
    const lower = searchQuery.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      )
    );
  }, [data, searchQuery, searchFilter]);

  // 2. Sorted Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortKey, sortDirection]);

  // 3. Paginated Data
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((item) => selectedKeys.includes(keyExtractor(item)));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (isAllSelected) {
      const pageKeys = new Set(paginatedData.map(keyExtractor));
      onSelectionChange(selectedKeys.filter((k) => !pageKeys.has(k)));
    } else {
      const newSelected = new Set([...selectedKeys, ...paginatedData.map(keyExtractor)]);
      onSelectionChange(Array.from(newSelected));
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange) return;
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Table Control Bar */}
      {(searchable || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {searchable && (
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <div className="relative -top-6 left-3 text-slate-400 dark:text-zinc-500 pointer-events-none -mb-4">
                <Search size={14} />
              </div>
            </div>
          )}

          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Main Table Wrapper */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/60 shadow-sm backdrop-blur-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/75 dark:bg-zinc-950/40 text-slate-500 dark:text-zinc-400 font-semibold">
              {selectable && (
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                  />
                </th>
              )}

              {columns.map((col) => {
                const isCurrentSort = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`py-3 px-4 tracking-tight select-none ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.sortable !== false ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors' : ''}`}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span className="shrink-0 text-slate-400 dark:text-zinc-500">
                          {isCurrentSort ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp size={13} className="text-indigo-500" />
                            ) : (
                              <ChevronDown size={13} className="text-indigo-500" />
                            )
                          ) : (
                            <ChevronsUpDown size={13} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-8 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    className="border-0 bg-transparent p-4"
                  />
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => {
                const key = keyExtractor(item);
                const isSelected = selectedKeys.includes(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.02]'
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(key)}
                          className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>
                    )}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-3 px-4 text-slate-700 dark:text-zinc-300 font-medium ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(item, index) : item[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span>
            Showing{' '}
            <strong className="text-slate-800 dark:text-white">
              {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800 dark:text-white">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </strong>{' '}
            of <strong className="text-slate-800 dark:text-white">{sortedData.length}</strong> records
          </span>
          {selectedKeys.length > 0 && (
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold pl-2 border-l border-slate-200 dark:border-white/10">
              {selectedKeys.length} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            leftIcon={<ChevronLeft size={13} />}
          >
            Prev
          </Button>

          <div className="flex items-center gap-1 px-1 font-medium">
            <span>Page</span>
            <strong className="text-slate-900 dark:text-white">{currentPage}</strong>
            <span>of</span>
            <span>{totalPages}</span>
          </div>

          <Button
            variant="outline"
            size="xs"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            rightIcon={<ChevronRight size={13} />}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
