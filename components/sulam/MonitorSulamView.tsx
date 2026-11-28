'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sprout,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  TrendingUp,
  Truck,
  CheckCircle2,
  Clock,
  Layers,
  XCircle,
  Package,
  PieChart as LucidePieChart,
  BarChart3,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const WILAYAH_LIST = ['AW01', 'AW02', 'AW03', 'AW04', 'AW05', 'AW06', 'AW07'];

// Custom Label untuk Nilai Bar: tanpa badge, ketebalan sedang (600), kontras di mode terang & gelap
const renderCustomBarVal = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="#0ea5e9"
      stroke="#0f172a"
      strokeWidth={2}
      strokeLinejoin="round"
      paintOrder="stroke fill"
      textAnchor="middle"
      fontSize={10.5}
      fontWeight="600"
      className="select-none pointer-events-none"
    >
      {value}
    </text>
  );
};

// Custom Label untuk Persentase Line: tanpa badge, ketebalan sedang (600), kontras di mode terang & gelap
const renderCustomLineVal = (props: any) => {
  const { x, y, value } = props;
  if (value === undefined || value === null) return null;
  return (
    <text
      x={x}
      y={y - 8}
      fill="#10b981"
      stroke="#0f172a"
      strokeWidth={2}
      strokeLinejoin="round"
      paintOrder="stroke fill"
      textAnchor="middle"
      fontSize={10.5}
      fontWeight="600"
      className="select-none pointer-events-none"
    >
      {value}%
    </text>
  );
};

export default function MonitorSulamView() {
  const [loading, setLoading] = useState(true);
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Summary & Charts State
  const [summaryCards, setSummaryCards] = useState<any>({
    order: 0,
    drop: 0,
    deviasi: 0,
    sulam: 0,
    pctDrop: 0,
    pctSulam: 0,
  });
  const [wilayahSummary, setWilayahSummary] = useState<any[]>([]);
  const [umurForcingChart, setUmurForcingChart] = useState<any[]>([]);
  const [overallDropVsSulam, setOverallDropVsSulam] = useState<any[]>([]);
  const [sebaranBibitChart, setSebaranBibitChart] = useState<any[]>([]);
  const [prosesList, setProsesList] = useState<string[]>([]);

  // Legend Toggles untuk 4 Grafik (Tombol bersih tanpa badge, redup saat hidden tanpa coret silang)
  const [showWilayahPctDrop, setShowWilayahPctDrop] = useState(true);
  const [showWilayahPctSulam, setShowWilayahPctSulam] = useState(true);
  const [showWilayahDrop, setShowWilayahDrop] = useState(true);
  const [showWilayahOrder, setShowWilayahOrder] = useState(true);
  const [showWilayahSulam, setShowWilayahSulam] = useState(true);

  const [showForcingDrop, setShowForcingDrop] = useState(true);
  const [showForcingSulam, setShowForcingSulam] = useState(true);

  const [showOverallDrop, setShowOverallDrop] = useState(true);
  const [showOverallSulam, setShowOverallSulam] = useState(true);

  const [hiddenDonutItems, setHiddenDonutItems] = useState<Record<string, boolean>>({});

  // Filter Bar
  const [search, setSearch] = useState('');
  const [selectedWilayah, setSelectedWilayah] = useState<string[]>([]);
  const [selectedProses, setSelectedProses] = useState<string>('Proses');
  const [isWilayahOpen, setIsWilayahOpen] = useState(false);
  const [isProsesOpen, setIsProsesOpen] = useState(false);
  const prosesDropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    if (!isProsesOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (prosesDropdownRef.current && !prosesDropdownRef.current.contains(e.target as Node)) {
        setIsProsesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isProsesOpen]);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent && dataRows.length === 0) setLoading(true);
      const wilParam =
        selectedWilayah.length > 0 && selectedWilayah.length < WILAYAH_LIST.length
          ? selectedWilayah.join(',')
          : '';
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });
      if (search) params.set('search', search);
      if (wilParam) params.set('wilayah', wilParam);
      if (selectedProses && selectedProses !== 'ALL') params.set('proses', selectedProses);

      const res = await fetch(`/api/sulam/monitoring?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDataRows(json.rows || []);
        if (json.summaryCards) setSummaryCards(json.summaryCards);
        if (json.wilayahSummary) setWilayahSummary(json.wilayahSummary);
        if (json.umurForcingChart) setUmurForcingChart(json.umurForcingChart);
        if (json.overallDropVsSulam) setOverallDropVsSulam(json.overallDropVsSulam);
        if (json.sebaranBibitChart) setSebaranBibitChart(json.sebaranBibitChart);
        if (json.prosesList) setProsesList(json.prosesList);
        if (json.pagination) setTotalCount(json.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching sulam monitoring:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, search, selectedWilayah, selectedProses]);

  // Real-time auto-sync saat ada pembaruan data master sulam
  useEffect(() => {
    const handleSync = () => {
      fetchData(true);
    };
    window.addEventListener('sulam_updated', handleSync);
    window.addEventListener('master_data_updated', handleSync);
    return () => {
      window.removeEventListener('sulam_updated', handleSync);
      window.removeEventListener('master_data_updated', handleSync);
    };
  }, [page, search, selectedWilayah, selectedProses]);

  const handleToggleWilayah = (wil: string) => {
    if (selectedWilayah.includes(wil)) {
      setSelectedWilayah(selectedWilayah.filter((w) => w !== wil));
    } else {
      setSelectedWilayah([...selectedWilayah, wil]);
    }
    setPage(1);
  };

  const handleSelectAllWilayah = () => {
    if (selectedWilayah.length === WILAYAH_LIST.length || selectedWilayah.length === 0) {
      setSelectedWilayah([]);
    } else {
      setSelectedWilayah([...WILAYAH_LIST]);
    }
    setPage(1);
  };

  const getWilayahLabel = () => {
    if (selectedWilayah.length === 0 || selectedWilayah.length === WILAYAH_LIST.length) {
      return 'Semua Wilayah';
    }
    if (selectedWilayah.length === 1) {
      return selectedWilayah[0];
    }
    return `${selectedWilayah.length} Wilayah`;
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* 1. Top Banner & Export Excel */}
      <div className="bg-gradient-to-r from-teal-700 via-emerald-600 to-emerald-700 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-white/20 backdrop-blur-xs">
              <Sprout className="w-4 h-4 text-white" />
            </span>
            <h2 className="text-base sm:text-lg font-black tracking-tight">Monitoring List Sulam</h2>
          </div>
          <p className="text-xs text-white/80 max-w-xl">
            Tabel summary dinamis dan dashboard analitik pemenuhan order, drop ritase, serta realisasi sulam bibit per wilayah.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          {/* Filter Keterangan Proses (Custom Dropdown dengan Chevron Berputar & Outside Click) */}
          {prosesList.length > 0 && (
            <div className="relative flex-1 sm:flex-none min-w-0" ref={prosesDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProsesOpen((prev) => !prev)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-2.5 sm:min-w-[160px] px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition-colors border border-white/20 cursor-pointer focus:outline-hidden"
                aria-expanded={isProsesOpen}
              >
                <span className="truncate">
                  {selectedProses === 'ALL' ? 'Semua Proses' : selectedProses}
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-white/90 transition-transform duration-200 ${
                    isProsesOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              {isProsesOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-full min-w-[200px] sm:w-56 max-h-64 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-50 py-1 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProses('ALL');
                      setPage(1);
                      setIsProsesOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      selectedProses === 'ALL'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                    }`}
                  >
                    <span>Semua Proses</span>
                    {selectedProses === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                  {prosesList
                    .filter((pr) => pr.trim().toLowerCase() !== 'pangkas produksi')
                    .map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => {
                        setSelectedProses(pr);
                        setPage(1);
                        setIsProsesOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        selectedProses === pr
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                      }`}
                    >
                      <span className="truncate">{pr}</span>
                      {selectedProses === pr && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <a
            href="/api/sulam/export"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-emerald-800 hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </a>
        </div>
      </div>

      {/* 2. 5 KPI Summary Cards (Order, Drop, Real Sulam, % Drop & % Sulam lebih lebar dengan Progress Bar) */}
      <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-3">
        {/* Card 1: Order */}
        <div className="md:col-span-2 lg:col-span-2 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order</span>
            <span className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Package className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100 font-mono">
              {summaryCards.order} <span className="text-[11px] font-normal text-slate-400 font-sans">Rit</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total permintaan rit</div>
          </div>
        </div>

        {/* Card 2: Drop */}
        <div className="md:col-span-2 lg:col-span-2 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Drop</span>
            <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Truck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {summaryCards.drop} <span className="text-[11px] font-normal text-slate-400 font-sans">Rit</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total drop ritase</div>
          </div>
        </div>

        {/* Card 3: Real Sulam (digeser ke posisi ke-3 menggantikan Deviasi) */}
        <div className="col-span-2 md:col-span-2 lg:col-span-2 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Real Sulam</span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {summaryCards.sulam} <span className="text-[11px] font-normal text-slate-400 font-sans">Rit</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total real sulam</div>
          </div>
        </div>

        {/* Card 4: % Drop (lebih lebar dengan Progress Bar) */}
        <div className="col-span-1 md:col-span-3 lg:col-span-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">% Drop</span>
            <span className="p-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Percent className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
              {summaryCards.pctDrop}%
            </div>
            <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, Number(summaryCards.pctDrop) || 0))}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Rata-rata (Total % / 7)</div>
          </div>
        </div>

        {/* Card 5: % Sulam (lebih lebar dengan Progress Bar) */}
        <div className="col-span-1 md:col-span-3 lg:col-span-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">% Sulam</span>
            <span className="p-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono">
              {summaryCards.pctSulam}%
            </div>
            <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, Number(summaryCards.pctSulam) || 0))}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Rata-rata (Total % / 7)</div>
          </div>
        </div>
      </div>

      {/* 3. Summary Monitor Sulam Per Wilayah Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Summary Monitor Sulam Per Wilayah
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {selectedProses !== 'ALL' ? `Proses: ${selectedProses}` : 'Semua Proses'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
          <table className="w-full text-center border-separate border-spacing-0 text-xs whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="py-2.5 px-3 border-r border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-center w-24">Wilayah</th>
                <th className="py-2.5 px-3 border-r border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-center">Order (Rit)</th>
                <th className="py-2.5 px-3 border-r border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-center">Drop (Rit)</th>
                <th className="py-2.5 px-3 border-r border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-center">Real Sulam (Rit)</th>
                <th className="py-2.5 px-3 border-r border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-center">% Drop</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-center">% Sulam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
              {wilayahSummary.map((item) => (
                <tr key={item.wilayah} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2 px-3 border-r border-slate-200/70 dark:border-slate-800/70 font-bold font-sans">
                    {item.wilayah}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200/70 dark:border-slate-800/70 text-blue-600 dark:text-blue-400 font-bold">
                    {item.order}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200/70 dark:border-slate-800/70 text-amber-600 dark:text-amber-400 font-bold">
                    {item.drop}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200/70 dark:border-slate-800/70 text-emerald-600 dark:text-emerald-400 font-bold">
                    {item.sulam}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200/70 dark:border-slate-800/70 font-sans">
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {item.pctDrop}%
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.pctSulam}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total Row */}
            <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white">
              <tr>
                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 font-sans">
                  Total
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400">
                  {summaryCards.order}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-400">
                  {summaryCards.drop}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">
                  {summaryCards.sulam}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400">
                  {summaryCards.pctDrop}%
                </td>
                <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                  {summaryCards.pctSulam}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. GRAFIK MONITOR SULAM: 4 VISUALISASI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Baris Atas Kiri: Gabungan Grafik Batang %Drop vs %Sulam & Grafik Donat Sebaran Kebutuhan Bibit / Kelas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          {/* Grafik Kiri: Batang %Drop vs %Sulam (Perbandingan Keseluruhan) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Grafik Batang %Drop vs %Sulam
              </h4>
              <p className="text-[11px] text-slate-500 leading-snug">
                Perbandingan rata-rata %Drop dan %Sulam
              </p>
            </div>
            <div className="h-56 flex-1 min-h-[220px] w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overallDropVsSulam.filter((d) => {
                    if (d.name === '% Drop') return showOverallDrop;
                    if (d.name === '% Sulam') return showOverallSulam;
                    return true;
                  })}
                  margin={{ top: 20, right: 16, bottom: 6, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={false} tickLine={false} height={6} axisLine={{ stroke: '#64748b', opacity: 0.3 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10.5, fill: '#64748b' }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val}%`, 'Persentase']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={52} label={renderCustomBarVal}>
                    {overallDropVsSulam
                      .filter((d) => {
                        if (d.name === '% Drop') return showOverallDrop;
                        if (d.name === '% Sulam') return showOverallSulam;
                        return true;
                      })
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Tombol Legenda di Bawah */}
            <div className="flex items-center justify-center gap-4 pt-1 pb-2.5">
              <button
                type="button"
                onClick={() => setShowOverallDrop((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showOverallDrop ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan % Drop"
              >
                <span className="w-2.5 h-2.5 rounded-xs shrink-0 bg-[#0ea5e9]" />
                <span>% Drop</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOverallSulam((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showOverallSulam ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan % Sulam"
              >
                <span className="w-2.5 h-2.5 rounded-xs shrink-0 bg-[#10b981]" />
                <span>% Sulam</span>
              </button>
            </div>
          </div>

          {/* Grafik Kanan: Donat Sebaran Kebutuhan Bibit / Kelas */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Grafik Donat Sebaran Kebutuhan Bibit / Kelas
              </h4>
              <p className="text-[11px] text-slate-500 leading-snug">
                Proporsi kebutuhan ritase bibit sulam per kelas ({selectedProses === 'ALL' ? 'Semua Proses' : selectedProses})
              </p>
            </div>
            <div className="h-56 flex-1 min-h-[210px] w-full pt-1">
              {sebaranBibitChart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  Tidak ada data bibit untuk ditampilkan.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [`${val} Rit`, 'Kebutuhan']}
                    />
                    <Pie
                      data={sebaranBibitChart.filter((d) => !hiddenDonutItems[d.name])}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={74}
                      paddingAngle={3}
                    >
                      {sebaranBibitChart
                        .filter((d) => !hiddenDonutItems[d.name])
                        .map((entry, index) => (
                          <Cell key={`donut-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Tombol Legenda di Bawah */}
            {sebaranBibitChart.length > 0 && (
              <div
                className={
                  sebaranBibitChart.length === 1
                    ? 'flex items-center justify-center pt-1 pb-1.5'
                    : 'grid grid-cols-2 gap-x-3 gap-y-1.5 w-fit max-w-full mx-auto pt-1 pb-1.5'
                }
              >
                {sebaranBibitChart.map((entry) => {
                  const isHidden = !!hiddenDonutItems[entry.name];
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => {
                        setHiddenDonutItems((prev) => ({
                          ...prev,
                          [entry.name]: !prev[entry.name],
                        }));
                      }}
                      className={`inline-flex items-center justify-start gap-1.5 text-[11px] leading-tight text-left font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                        !isHidden ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                      }`}
                      title={`Klik untuk tampilkan/sembunyikan ${entry.name}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Baris Atas Kanan: Grafik Distribusi/Umur Tanaman (tetap di posisi semula) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Grafik Distribusi/Umur Tanaman
              </h4>
              <p className="text-[11px] text-slate-500">
                Batang: %Drop • Garis: %Sulam berdasarkan tahapan umur forcing
              </p>
            </div>
            {/* Tombol Legenda di Atas */}
            <div className="flex items-center gap-3 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => setShowForcingDrop((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showForcingDrop ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan % Drop"
              >
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0ea5e9]" />
                <span>% Drop</span>
              </button>

              <button
                type="button"
                onClick={() => setShowForcingSulam((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showForcingSulam ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan % Sulam"
              >
                <span className="w-2.5 h-0.5 rounded-full bg-[#10b981]" />
                <span>% Sulam</span>
              </button>
            </div>
          </div>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={umurForcingChart} margin={{ top: 20, right: 15, bottom: 20, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="kategori" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, name: any) => [`${val}%`, name]}
                />
                {showForcingDrop && (
                  <Bar dataKey="pctDrop" name="% Drop" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={40} label={renderCustomBarVal} />
                )}
                {showForcingSulam && (
                  <Line type="linear" dataKey="pctSulam" name="% Sulam" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} label={renderCustomLineVal} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Baris Bawah (Lebar Penuh): Grafik Progres Drop % Sulam Per Wilayah */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Grafik Progres Drop % Sulam Per Wilayah
              </h4>
              <p className="text-[11px] text-slate-500">
                Batang: Order, Drop, Sulam (Rit) • Garis: %Drop & %Sulam
              </p>
            </div>
            {/* Tombol Legenda di Atas */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 xl:pt-0">
              <button
                type="button"
                onClick={() => setShowWilayahPctDrop((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showWilayahPctDrop ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan % Drop"
              >
                <span className="w-2.5 h-0.5 rounded-full bg-[#06b6d4]" />
                <span>% Drop</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWilayahPctSulam((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showWilayahPctSulam ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan % Sulam"
              >
                <span className="w-2.5 h-0.5 rounded-full bg-[#8b5cf6]" />
                <span>% Sulam</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWilayahDrop((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showWilayahDrop ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan Drop"
              >
                <span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b]" />
                <span>Drop</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWilayahOrder((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showWilayahOrder ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan Order"
              >
                <span className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6]" />
                <span>Order</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWilayahSulam((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity duration-150 select-none ${
                  showWilayahSulam ? 'opacity-100 text-slate-700 dark:text-slate-300' : 'opacity-35 hover:opacity-70 text-slate-400 dark:text-slate-500'
                }`}
                title="Klik untuk tampilkan/sembunyikan Sulam"
              >
                <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981]" />
                <span>Sulam</span>
              </button>
            </div>
          </div>
          <div className="h-72 sm:h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={wilayahSummary} margin={{ top: 20, right: 15, bottom: 20, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="wilayah" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} unit=" Rit" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#10b981' }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                {showWilayahOrder && (
                  <Bar yAxisId="left" dataKey="order" name="Order" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                )}
                {showWilayahDrop && (
                  <Bar yAxisId="left" dataKey="drop" name="Drop" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                )}
                {showWilayahSulam && (
                  <Bar yAxisId="left" dataKey="sulam" name="Sulam" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                )}
                {showWilayahPctDrop && (
                  <Line yAxisId="right" type="linear" dataKey="pctDrop" name="% Drop" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                )}
                {showWilayahPctSulam && (
                  <Line yAxisId="right" type="linear" dataKey="pctSulam" name="% Sulam" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Filter Bar & Controls Untuk Main Table */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 relative z-30">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari Lokasi"
            className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsWilayahOpen(!isWilayahOpen)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{getWilayahLabel()}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isWilayahOpen ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} />
          </button>

          {isWilayahOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsWilayahOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={handleSelectAllWilayah}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Semua Wilayah</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      selectedWilayah.length === 0 || selectedWilayah.length === WILAYAH_LIST.length
                        ? 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/50 scale-110'
                        : 'bg-slate-200 dark:bg-slate-600'
                    }`}
                  />
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {WILAYAH_LIST.map((wil) => {
                    const isSelected = selectedWilayah.includes(wil);
                    return (
                      <button
                        key={wil}
                        type="button"
                        onClick={() => handleToggleWilayah(wil)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{wil}</span>
                        <span
                          className={`w-2 h-2 rounded-full transition-all ${
                            isSelected
                              ? 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/50 scale-110'
                              : 'bg-slate-200 dark:bg-slate-600'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 6. Main Table: 17 Kolom Berurutan List Sulam */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="max-h-[640px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-bold tracking-wider shadow-xs">
              {/* Baris 1 Header Grup */}
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <th rowSpan={2} className="py-2.5 px-2.5 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[45px]">No</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[70px]">Wilayah</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[85px]">Lokasi</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[80px]">Jenis Bibit</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[80px]">Kelas Bibit</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[100px]">Tgl Rawat</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[105px]">Tgl STD Forcing</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[105px]">Tgl F Prod</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[105px]">Tgl F Max</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[105px]">Tgl Order</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[95px]">Umur Forcing</th>
                <th colSpan={3} className="py-2 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 font-extrabold">
                  Permintaan Ritase
                </th>
                <th colSpan={4} className="py-2 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-extrabold">
                  Monitor Drop
                </th>
                <th colSpan={5} className="py-2 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-extrabold">
                  Monitor Sulam
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[140px]">Spek Bibit</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[130px]">Ket Proses</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[120px]">Ket Mati</th>
                <th rowSpan={2} className="py-2.5 px-3 text-center border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 min-w-[130px]">Ket Ritase</th>
              </tr>
              {/* Baris 2 Sub Header */}
              <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] bg-slate-100 dark:bg-slate-800">
                {/* 11. Permintaan Ritase */}
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold min-w-[75px]">Jumlah</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold min-w-[65px]">Rit</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold min-w-[65px]">Real Rit</th>

                {/* 12. Monitor Drop */}
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold min-w-[65px]">Real</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold min-w-[65px]">Total</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold min-w-[65px]">Dev</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold min-w-[70px]">%Drop</th>

                {/* 13. Monitor Sulam */}
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-emerald-50 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold min-w-[65px]">Real</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-emerald-50 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold min-w-[65px]">Manual</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-emerald-50 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold min-w-[65px]">Saldo</th>
                <th className="py-1.5 px-2 text-center border-r border-b border-slate-200/80 dark:border-slate-700/80 bg-emerald-50 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold min-w-[70px]">%Sulam</th>
                <th className="py-1.5 px-2 text-center border-b border-slate-200/80 dark:border-slate-700/80 bg-emerald-50 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold min-w-[95px]">Last Sulam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={24} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                      <p className="text-xs font-semibold">Mengkalkulasi summary list sulam...</p>
                    </div>
                  </td>
                </tr>
              ) : dataRows.length === 0 ? (
                <tr>
                  <td colSpan={24} className="py-16 text-center text-slate-400">
                    <p className="text-xs font-semibold">Tidak ada data lokasi yang cocok.</p>
                  </td>
                </tr>
              ) : (
                dataRows.map((row, idx) => (
                  <tr
                    key={row.lokasi || idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* No */}
                    <td className="py-2 px-2 text-center text-slate-500 border-r border-slate-200/70 dark:border-slate-800/70 font-mono">
                      {(page - 1) * pageSize + idx + 1}
                    </td>

                    {/* 1. Wilayah */}
                    <td className="py-2 px-2.5 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.wilayah}
                    </td>

                    {/* 2. Lokasi */}
                    <td className="py-2 px-2.5 text-center font-black text-slate-900 dark:text-white border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.lokasi}
                    </td>

                    {/* 3. Jenis Bibit */}
                    <td className="py-2 px-2.5 text-center text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.jenisBibit}
                    </td>

                    {/* 4. Kelas Bibit */}
                    <td className="py-2 px-2.5 text-center text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.kelasBibit}
                    </td>

                    {/* 5. Tanggal Rawat */}
                    <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70 font-mono text-[11px]">
                      {row.tglRawat}
                    </td>

                    {/* 6. Tanggal STD Forcing */}
                    <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70 font-mono text-[11px]">
                      {row.tglStdForcing}
                    </td>

                    {/* 7. Tanggal F Prod */}
                    <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70 font-mono text-[11px]">
                      {row.tglFProd}
                    </td>

                    {/* 8. Tanggal F Max */}
                    <td className="py-2 px-2 text-center text-slate-700 dark:text-slate-300 font-semibold border-r border-slate-200/70 dark:border-slate-800/70 font-mono text-[11px]">
                      {row.tglFMax}
                    </td>

                    {/* 9. Tanggal Order */}
                    <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70 font-mono text-[11px]">
                      {row.tglOrder}
                    </td>

                    {/* 10. Umur Forcing */}
                    <td className="py-2 px-2 text-center font-bold text-teal-700 dark:text-teal-400 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.umurForcing !== '-' ? `${row.umurForcing} bln` : '-'}
                    </td>

                    {/* 11. Permintaan Ritase (Jumlah, Rit, Real Rit) */}
                    <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200/70 dark:border-slate-800/70 bg-blue-50/20 dark:bg-blue-950/10">
                      {row.permintaanJumlah ? Number(row.permintaanJumlah).toLocaleString('id-ID') : 0}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70 bg-blue-50/20 dark:bg-blue-950/10">
                      {row.permintaanRit}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70 bg-blue-50/20 dark:bg-blue-950/10">
                      {row.permintaanRealRit}
                    </td>

                    {/* 12. Monitor Drop (Real, Total, Dev, %Drop) */}
                    <td className="py-2 px-2 text-center font-bold text-amber-700 dark:text-amber-400 border-r border-slate-200/70 dark:border-slate-800/70 bg-amber-50/20 dark:bg-amber-950/10">
                      {row.dropReal}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70 bg-amber-50/20 dark:bg-amber-950/10">
                      {row.dropTotal}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70 bg-amber-50/20 dark:bg-amber-950/10">
                      {row.dropDev}
                    </td>
                    <td className="py-2 px-2 text-center font-bold border-r border-slate-200/70 dark:border-slate-800/70 bg-amber-50/20 dark:bg-amber-950/10">
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                        row.dropPct >= 100
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : row.dropPct > 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'text-slate-400'
                      }`}>
                        {row.dropPct}%
                      </span>
                    </td>

                    {/* 13. Monitor Sulam (Real, Manual, Saldo, %Sulam, Last Sulam) */}
                    <td className="py-2 px-2 text-center font-bold text-emerald-700 dark:text-emerald-400 border-r border-slate-200/70 dark:border-slate-800/70 bg-emerald-50/20 dark:bg-emerald-950/10">
                      {row.sulamReal}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200/70 dark:border-slate-800/70 bg-emerald-50/20 dark:bg-emerald-950/10">
                      {row.sulamManual}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200/70 dark:border-slate-800/70 bg-emerald-50/20 dark:bg-emerald-950/10">
                      {row.sulamSaldo}
                    </td>
                    <td className="py-2 px-2 text-center font-bold border-r border-slate-200/70 dark:border-slate-800/70 bg-emerald-50/20 dark:bg-emerald-950/10">
                      {row.sulamPct !== '-' ? (
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                          Number(row.sulamPct) >= 100
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : Number(row.sulamPct) > 0
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'text-slate-400'
                        }`}>
                          {row.sulamPct}%
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70 font-mono text-[11px] bg-emerald-50/20 dark:bg-emerald-950/10">
                      {row.sulamLastDate}
                    </td>

                    {/* 14. Spek Bibit */}
                    <td className="py-2 px-2.5 text-center font-semibold text-emerald-700 dark:text-emerald-300 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.spekBibit}
                    </td>

                    {/* 15. Keterangan Proses */}
                    <td className="py-2 px-2.5 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.keteranganProses}
                    </td>

                    {/* 16. Keterangan Mati */}
                    <td className="py-2 px-2.5 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200/70 dark:border-slate-800/70">
                      {row.keteranganMati}
                    </td>

                    {/* 17. Keterangan Ritase */}
                    <td className="py-2 px-2.5 text-center text-slate-600 dark:text-slate-400">
                      {row.keteranganRitase}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Pagination Footer */}
        <div className="py-3.5 px-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 font-semibold">
          <div>
            Halaman {page} dari {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold text-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
