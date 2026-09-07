'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TableInfo = { name: string; columns: string[] };
type CellValue = string | number | boolean | null;
type TablePage = {
  table: string;
  columns: string[];
  rows: Record<string, CellValue>[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const pageSizes = [25, 50, 100, 200];

function formatCell(value: CellValue) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-[#99a4b6]">—</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
          value
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {value ? 'True' : 'False'}
      </span>
    );
  }
  return String(value);
}

export default function DatabasePage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [table, setTable] = useState('');
  const [data, setData] = useState<TablePage | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    async function loadTables() {
      setLoading(true);
      try {
        const response = await fetch('/api/database/tables', { cache: 'no-store' });
        const body = (await response.json()) as TableInfo[] | { detail?: string };
        if (!response.ok) {
          throw new Error(!Array.isArray(body) && body.detail ? body.detail : 'Unable to load tables.');
        }
        if (!cancelled) {
          const tableList = body as TableInfo[];
          setTables(tableList);
          setTable((current) => current || tableList[0]?.name || '');
          setError('');
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load tables.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadTables();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!table) return;
    let cancelled = false;
    async function loadRows() {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
      }
      try {
        const response = await fetch(`/api/database/${encodeURIComponent(table)}?${params}`, {
          cache: 'no-store',
        });
        const body = (await response.json()) as TablePage | { detail?: string };
        if (!response.ok) {
          throw new Error('detail' in body && body.detail ? body.detail : 'Unable to load table data.');
        }
        if (!cancelled) setData(body as TablePage);
      } catch (requestError) {
        if (!cancelled) {
          setData(null);
          setError(requestError instanceof Error ? requestError.message : 'Unable to load table data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, refreshKey, search, sortBy, sortOrder, table]);

  const selectedInfo = useMemo(
    () => tables.find((item) => item.name === table),
    [table, tables],
  );

  function selectTable(value: string | null) {
    if (!value) return;
    setTable(value);
    setPage(1);
    setSortBy('');
    setSortOrder('asc');
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }

  return (
    <main className="min-h-dvh bg-[#eef3f9] text-[#13213c]">
      <header className="border-b border-[#d7e0ec] bg-[#0b245f] text-white">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-white/10">
              <Database className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-blue-200">
                Internal data explorer
              </p>
              <h1 className="text-xl font-bold">PSIP Fabric database</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-sm font-semibold text-emerald-100">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Read-only
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-4 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="rounded-2xl border border-[#d7e0ec] bg-white p-3 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
          <div className="flex items-center gap-2 px-2 pb-3 pt-1">
            <Table2 className="size-4 text-[#2366dc]" aria-hidden="true" />
            <h2 className="text-sm font-bold">Tables</h2>
            <span className="ml-auto rounded-full bg-[#eaf1fd] px-2 py-0.5 text-xs font-bold text-[#1854bd]">
              {tables.length}
            </span>
          </div>
          <nav aria-label="Database tables" className="space-y-1">
            {tables.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => selectTable(item.name)}
                aria-current={table === item.name ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#1854bd] ${
                  table === item.name
                    ? 'bg-[#1854bd] text-white'
                    : 'text-[#44516a] hover:bg-[#eef4fc]'
                }`}
              >
                <span className="truncate">{item.name}</span>
                <span className={table === item.name ? 'text-blue-100' : 'text-[#8a96a9]'}>
                  {item.columns.length}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[210px] flex-1">
                <label htmlFor="table-select" className="mb-1.5 block text-xs font-bold uppercase tracking-[.1em] text-[#647089]">
                  Active table
                </label>
                <Select value={table} onValueChange={selectTable}>
                  <SelectTrigger id="table-select" className="h-11 w-full bg-white md:max-w-sm">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {tables.map((item) => (
                      <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[240px] flex-[2]">
                <label htmlFor="database-search" className="mb-1.5 block text-xs font-bold uppercase tracking-[.1em] text-[#647089]">
                  Search all columns
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78859a]" aria-hidden="true" />
                  <Input
                    id="database-search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search values in this table…"
                    className="h-11 bg-white pl-9"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 px-4"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading}
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#d7e0ec] bg-white shadow-[0_8px_24px_rgba(21,48,93,.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e7f0] px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#2366dc]">Fabric entity</p>
                <h2 className="mt-1 text-xl font-bold">{table || 'Database tables'}</h2>
                <p className="mt-1 text-sm text-[#647089]">
                  {data ? `${data.total.toLocaleString()} matching rows · ${data.columns.length} columns` : `${selectedInfo?.columns.length || 0} columns`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="page-size" className="text-sm font-medium text-[#647089]">Rows</label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    if (!value) return;
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="page-size" className="h-9 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {pageSizes.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error ? (
              <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-bold">Database explorer unavailable</p>
                <p className="mt-1">{error}</p>
              </div>
            ) : loading && !data ? (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <RefreshCw className="mx-auto size-7 animate-spin text-[#1854bd]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">Loading Fabric data…</p>
                </div>
              </div>
            ) : data && data.rows.length ? (
              <div className="max-h-[calc(100dvh-330px)] overflow-auto">
                <table className="w-max min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#f4f7fb]">
                    <tr>
                      <th className="sticky left-0 z-20 border-b border-r bg-[#f4f7fb] px-3 py-3 text-right text-xs font-bold text-[#68758a]">#</th>
                      {data.columns.map((column) => (
                        <th key={column} className="border-b px-3 py-2 text-left font-bold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 focus-visible:outline-2 focus-visible:outline-[#1854bd]"
                            aria-label={`Sort by ${column}`}
                          >
                            {column}
                            {sortBy !== column ? <ArrowUpDown className="size-3 text-[#8b97a9]" aria-hidden="true" /> : sortOrder === 'asc' ? <ArrowUp className="size-3 text-[#1854bd]" aria-hidden="true" /> : <ArrowDown className="size-3 text-[#1854bd]" aria-hidden="true" />}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, rowIndex) => (
                      <tr key={`${data.page}-${rowIndex}`} className="border-b border-[#e7ecf3] hover:bg-[#f8faff]">
                        <td className="sticky left-0 border-r bg-white px-3 py-2 text-right text-xs tabular-nums text-[#8b97a9]">
                          {(data.page - 1) * data.pageSize + rowIndex + 1}
                        </td>
                        {data.columns.map((column) => (
                          <td key={column} className="max-w-[360px] px-3 py-2 font-mono text-xs whitespace-nowrap text-[#33415c]">
                            <span className="block overflow-hidden text-ellipsis" title={row[column] == null ? '' : String(row[column])}>
                              {formatCell(row[column])}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : data ? (
              <div className="grid min-h-80 place-items-center p-8 text-center">
                <div>
                  <Table2 className="mx-auto size-9 text-[#8a96a9]" aria-hidden="true" />
                  <h3 className="mt-3 font-bold">No rows found</h3>
                  <p className="mt-1 text-sm text-[#647089]">Try a different search or select another table.</p>
                </div>
              </div>
            ) : null}

            {data && !error && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e7f0] px-4 py-3">
                <p className="text-sm text-[#647089]">Page <b className="text-[#22304b]">{data.page}</b> of <b className="text-[#22304b]">{data.pages}</b></p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="lg" disabled={data.page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    <ArrowLeft aria-hidden="true" /> Previous
                  </Button>
                  <Button type="button" variant="outline" size="lg" disabled={data.page >= data.pages || loading} onClick={() => setPage((value) => Math.min(data.pages, value + 1))}>
                    Next <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
              </footer>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
