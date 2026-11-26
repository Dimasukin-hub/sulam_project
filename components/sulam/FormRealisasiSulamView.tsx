'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  MapPin,
  Layers,
  Users,
  Sprout,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface MasterLokasiItem {
  lokasi: string;
  wilayah: string | null;
  status?: string | null;
}

export default function FormRealisasiSulamView() {
  const { user } = useAuth();

  // Form states
  const [lokasiList, setLokasiList] = useState<MasterLokasiItem[]>([]);
  const [selectedLokasi, setSelectedLokasi] = useState('');
  const [lokasiSearch, setLokasiSearch] = useState('');
  const [isLokasiDropdownOpen, setIsLokasiDropdownOpen] = useState(false);

  const [wilayah, setWilayah] = useState('');
  const [statusTanaman, setStatusTanaman] = useState('');
  const [spekBibit, setSpekBibit] = useState('');

  // Datepicker states
  const today = new Date();
  const [tanggal, setTanggal] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());

  // Input Jumlah TK & Jumlah Bibit
  const [jumlahTk, setJumlahTk] = useState<number | ''>('');
  const [jumlahBibit, setJumlahBibit] = useState<number | ''>('');

  // Submission & History states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [realHistory, setRealHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // 1. Fetch lokasi options
  useEffect(() => {
    async function fetchLokasiOptions() {
      try {
        const res = await fetch('/api/sulam/lookup-lokasi');
        const json = await res.json();
        if (json.success && Array.isArray(json.lokasiList)) {
          setLokasiList(json.lokasiList);
        }
      } catch (e) {
        console.error('Error fetching lokasi options:', e);
      }
    }
    fetchLokasiOptions();
    fetchRealHistory();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.lokasi-dropdown-container')) {
        setIsLokasiDropdownOpen(false);
      }
      if (!target.closest('.datepicker-dropdown-container')) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Fetch riwayat transaksi realisasi
  async function fetchRealHistory() {
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/sulam/form-realisasi?limit=25');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRealHistory(json.data);
      }
    } catch (e) {
      console.error('Error fetching real history:', e);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  // 3. Handle location selection -> Auto lookup wilayah
  async function handleSelectLokasi(lok: string, wil: string | null) {
    setSelectedLokasi(lok);
    setWilayah(wil || '');
    setIsLokasiDropdownOpen(false);
    setFormMessage(null);

    try {
      const res = await fetch(`/api/sulam/lookup-lokasi?lokasi=${encodeURIComponent(lok)}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.wilayah) setWilayah(json.data.wilayah);
        setStatusTanaman(json.data.keterangan || '-');
        setSpekBibit(json.data.spekBB || '-');
      }
    } catch (e) {
      console.warn('Error fetching detail lokasi:', e);
    }
  }

  // Datepicker helper
  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLokasi) {
      setFormMessage({ type: 'error', text: 'Lokasi wajib dipilih!' });
      return;
    }
    if (!tanggal) {
      setFormMessage({ type: 'error', text: 'Tanggal realisasi wajib dipilih!' });
      return;
    }

    const nBibit = Number(jumlahBibit) || 0;
    if (nBibit <= 0) {
      setFormMessage({ type: 'error', text: 'Jumlah bibit harus lebih dari 0!' });
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const res = await fetch('/api/sulam/form-realisasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lokasi: selectedLokasi,
          wilayah,
          tanggal,
          jumlahTk: Number(jumlahTk) || 0,
          jumlahBibit: nBibit,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan transaksi realisasi.');
      }

      setFormMessage({
        type: 'success',
        text: json.message || 'Transaksi realisasi sulam berhasil disimpan, baris baru ditambahkan ke MasterDataRealSulam, dan ListSulam diperbarui!',
      });

      // Reset inputs
      setJumlahTk('');
      setJumlahBibit('');
      fetchRealHistory();
    } catch (err: any) {
      setFormMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filtered dropdown options
  const filteredLokasiList = lokasiList.filter((item) =>
    item.lokasi.toLowerCase().includes((selectedLokasi || '').toLowerCase()) ||
    (item.wilayah && item.wilayah.toLowerCase().includes((selectedLokasi || '').toLowerCase()))
  );

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-12">
      {/* HEADER SECTION */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-teal-600 to-emerald-700 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Form Realisasi Sulam</h1>
            <p className="text-xs text-white/80 mt-1 max-w-xl">
              Pencatatan realisasi penanaman bibit sulam di lokasi lahan.
            </p>
          </div>
        </div>
      </div>

      {/* ALERT / MESSAGE */}
      {formMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 transition-all animate-in fade-in ${
            formMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/40 text-rose-800 dark:text-rose-300'
          }`}
        >
          {formMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          )}
          <span className="flex-1">{formMessage.text}</span>
        </div>
      )}

      {/* FORM INPUT SECTION */}
      <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Layers className="w-4 h-4 text-teal-600" />
          <span>Input Data Realisasi Tanam Sulam</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. KOTAK LOKASI (INPUT ALA GORONG-GORONG) */}
          <div className="relative lokasi-dropdown-container">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Lokasi <b className="text-rose-500">*</b></span>
            </label>

            <div className="relative">
              <input
                type="text"
                value={selectedLokasi}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setSelectedLokasi(val);
                  setIsLokasiDropdownOpen(true);
                  const match = lokasiList.find((item) => item.lokasi.trim().toUpperCase() === val.trim());
                  if (match) {
                    handleSelectLokasi(match.lokasi, match.wilayah);
                  }
                }}
                onFocus={() => setIsLokasiDropdownOpen(true)}
                placeholder=""
                className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
              />

              {selectedLokasi ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLokasi('');
                    setWilayah('');
                    setIsLokasiDropdownOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                  title="Hapus / Reset Lokasi"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              ) : (
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              )}
            </div>

            {/* Dropdown Options */}
            {isLokasiDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800 scrollbar-thin">
                {filteredLokasiList.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 text-center">Lokasi tidak ditemukan</div>
                ) : (
                  filteredLokasiList.map((item) => (
                    <button
                      key={item.lokasi}
                      type="button"
                      onClick={() => {
                        handleSelectLokasi(item.lokasi, item.wilayah);
                        setIsLokasiDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="font-bold text-teal-600">{item.lokasi}</span>
                      <span className="text-[10.5px] font-mono text-slate-400">{item.wilayah || '-'}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. KOTAK WILAYAH */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Wilayah
            </label>
            <input
              type="text"
              value={wilayah}
              readOnly
              placeholder=""
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-not-allowed"
            />
          </div>

          {/* 3. KOTAK TANGGAL (DATEPICKER GORONG-GORONG STYLE) */}
          <div className="relative datepicker-dropdown-container">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Tanggal Realisasi <b className="text-rose-500">*</b></span>
            </label>

            <div
              onClick={() => setIsCalendarOpen((prev) => !prev)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between cursor-pointer shadow-2xs hover:border-teal-600 transition-colors"
            >
              <span className="min-h-[16px]">{formatDateDisplay(tanggal)}</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>

            {isCalendarOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (calendarMonth === 0) {
                        setCalendarMonth(11);
                        setCalendarYear((y) => y - 1);
                      } else {
                        setCalendarMonth((m) => m - 1);
                      }
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {MONTH_NAMES[calendarMonth]} {calendarYear}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (calendarMonth === 11) {
                        setCalendarMonth(0);
                        setCalendarYear((y) => y + 1);
                      } else {
                        setCalendarMonth((m) => m + 1);
                      }
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                  <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: getFirstDayOfWeek(calendarYear, calendarMonth) }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isSelected = tanggal === dateStr;

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => {
                          setTanggal(dateStr);
                          setIsCalendarOpen(false);
                        }}
                        className={`h-7 w-7 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. DUA KOTAK: JUMLAH TK & JUMLAH BIBIT (DIAMETER STYLE) */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
            {/* Jumlah TK */}
            <div className="p-2 sm:p-3 rounded-xl bg-slate-500/5 dark:bg-slate-500/10 border-2 border-slate-300 dark:border-slate-600 focus-within:border-teal-500 transition-all text-center shadow-2xs">
              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                Jumlah Tenaga Kerja (TK)
              </span>
              <input
                type="number"
                min="0"
                value={jumlahTk}
                onChange={(e) => setJumlahTk(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                placeholder=""
                className="w-full text-center text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white bg-transparent focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5 font-semibold">Orang</span>
            </div>

            {/* Jumlah Bibit */}
            <div className="p-2 sm:p-3 rounded-xl bg-teal-500/5 dark:bg-teal-500/10 border-2 border-teal-500/40 dark:border-teal-500/60 focus-within:border-teal-500 transition-all text-center shadow-2xs">
              <span className="text-[11px] font-extrabold text-teal-800 dark:text-teal-300 block mb-1">
                Jumlah Bibit (Batang) <b className="text-rose-500">*</b>
              </span>
              <input
                type="number"
                min="1"
                value={jumlahBibit}
                onChange={(e) => setJumlahBibit(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                placeholder=""
                className="w-full text-center text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white bg-transparent focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5 font-semibold">Batang</span>
            </div>
          </div>
        </div>

        {/* TOMBOL SUBMIT */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Simpan</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* TABEL RIWAYAT TRANSAKSI REALISASI SULAM */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-teal-600" />
            <span>Riwayat Transaksi Form Realisasi Sulam</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar seluruh input transaksi penanaman bibit sulam yang telah tersimpan.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-center">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">No</th>
                <th className="py-2.5 px-3 text-center">Lokasi</th>
                <th className="py-2.5 px-3 text-center">Wilayah</th>
                <th className="py-2.5 px-3 text-center">Tanggal</th>
                <th className="py-2.5 px-3 text-center">Jumlah TK</th>
                <th className="py-2.5 px-3 text-center">Jumlah Bibit (Btg)</th>
                <th className="py-2.5 px-3 text-center">Estimasi Rit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isHistoryLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
                    <span>Memuat riwayat transaksi realisasi...</span>
                  </td>
                </tr>
              ) : realHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada riwayat realisasi sulam yang tersimpan.
                  </td>
                </tr>
              ) : (
                realHistory.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-100">{item.lokasi}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">{item.wilayah || '-'}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                      {item.tanggal ? new Date(item.tanggal).toISOString().slice(0, 10) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {item.jumlahTk ? `${item.jumlahTk} Org` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-extrabold text-teal-600 dark:text-teal-400 bg-teal-50/40 dark:bg-teal-950/20">
                      {item.jumlahBibit ? Number(item.jumlahBibit).toLocaleString('id-ID') : 0}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                      ~{Math.max(1, Math.ceil(Number(item.jumlahBibit || 0) / 2000))} Rit
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

