'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  MapPin,
  ChevronDown,
  Layers,
  Info,
  XCircle,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import SulamSelectDropdown from '@/components/sulam/SulamSelectDropdown';
import { DROP_KELAS_BIBIT_OPTIONS, isSulamClassMismatch } from '@/lib/sulamClassOptions';

interface MasterLokasiItem {
  lokasi: string;
  wilayah: string | null;
  status?: string | null;
  bibitOrdered?: string | null;
  dropReal?: number;
  dropTotal?: number;
  permintaanRit?: number;
}

export default function FormDropSulamView() {
  const { user } = useAuth();

  // Form states
  const [lokasiList, setLokasiList] = useState<MasterLokasiItem[]>([]);
  const [selectedLokasi, setSelectedLokasi] = useState('');
  const [lokasiSearch, setLokasiSearch] = useState('');
  const [isLokasiDropdownOpen, setIsLokasiDropdownOpen] = useState(false);

  const [wilayah, setWilayah] = useState('');
  const [statusTanaman, setStatusTanaman] = useState('');
  const [monitorDropInfo, setMonitorDropInfo] = useState<{ orderedRit: number; droppedRit: number } | null>(null);
  const [bibitOrderedFromList, setBibitOrderedFromList] = useState<string | null>(null);
  const [locationJenisBibit, setLocationJenisBibit] = useState<string | null>(null);

  // Datepicker states
  const today = new Date();
  const [tanggal, setTanggal] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());

  // Input Jenis Rit (CD & Fuso)
  const [ritCD, setRitCD] = useState<number | ''>('');
  const [ritFuso, setRitFuso] = useState<number | ''>('');

  // Kelas Bibit (Manual input)
  const [kelasBibit, setKelasBibit] = useState('');

  // Submission & Table states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [dropHistory, setDropHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Edit & Delete states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editLokasi, setEditLokasi] = useState('');
  const [editWilayah, setEditWilayah] = useState('');
  const [editTanggal, setEditTanggal] = useState('');
  const [editRitCD, setEditRitCD] = useState<number | ''>('');
  const [editRitFuso, setEditRitFuso] = useState<number | ''>('');
  const [editKelasBibit, setEditKelasBibit] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

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
    fetchDropHistory();
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

  // 2. Fetch riwayat transaksi drop
  async function fetchDropHistory() {
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/sulam/form-drop?limit=25');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDropHistory(json.data);
      }
    } catch (e) {
      console.error('Error fetching drop history:', e);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  // 3. Handle location selection -> Auto lookup wilayah, status tanaman, and order info
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
        setLocationJenisBibit(json.data.jenisBibit || null);
        const orderClassLabel = json.data.formattedKelasBibit || json.data.spekBB || null;
        setBibitOrderedFromList(orderClassLabel);
        if (orderClassLabel && !kelasBibit) {
          setKelasBibit(orderClassLabel);
        }
        setMonitorDropInfo({
          orderedRit: json.data.ritCD || 0,
          droppedRit: 0,
        });
      }
    } catch (e) {
      console.warn('Error fetching detail lokasi:', e);
    }
  }

  // Peringatan jika kelas bibit tidak sesuai dengan order
  const isClassMismatch = isSulamClassMismatch(kelasBibit, bibitOrderedFromList, locationJenisBibit);

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
      setFormMessage({ type: 'error', text: 'Tanggal drop wajib dipilih!' });
      return;
    }

    const nCD = Number(ritCD) || 0;
    const nFuso = Number(ritFuso) || 0;
    if (nCD <= 0 && nFuso <= 0) {
      setFormMessage({ type: 'error', text: 'Minimal salah satu jenis rit (CD atau Fuso) harus lebih dari 0!' });
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const res = await fetch('/api/sulam/form-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lokasi: selectedLokasi,
          wilayah,
          tanggal,
          cd: nCD,
          fuso: nFuso,
          kelasBibit: kelasBibit.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan transaksi drop.');
      }

      setFormMessage({
        type: 'success',
        text: json.message || 'Transaksi drop sulam berhasil disimpan dan mengupdate tabel ListSulam!',
      });

      // Reset input rit
      setRitCD('');
      setRitFuso('');
      fetchDropHistory();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sulam_updated'));
        window.dispatchEvent(new CustomEvent('master_data_updated'));
      }
    } catch (err: any) {
      setFormMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditModal(item: any) {
    setEditingItem(item);
    setEditLokasi(item.lokasi || '');
    setEditWilayah(item.wilayah || '');
    setEditTanggal(item.tanggal ? new Date(item.tanggal).toISOString().slice(0, 10) : '');
    setEditRitCD(item.cd ?? 0);
    setEditRitFuso(item.fuso ?? 0);
    setEditKelasBibit(item.kelasBibit || '');
  }

  async function handleEditLokasiChange(lok: string) {
    const clean = lok.trim().toUpperCase();
    setEditLokasi(clean);
    const matched = lokasiList.find((l) => l.lokasi === clean);
    if (matched?.wilayah) setEditWilayah(matched.wilayah);
    if (!clean) return;
    try {
      const res = await fetch(`/api/sulam/lookup-lokasi?lokasi=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (json.success && json.data?.wilayah) {
        setEditWilayah(json.data.wilayah);
      }
    } catch {
      // ignore lookup error
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem || !editLokasi.trim() || !editTanggal) return;
    const nCD = Number(editRitCD) || 0;
    const nFuso = Number(editRitFuso) || 0;
    if (nCD <= 0 && nFuso <= 0) {
      alert('Minimal salah satu jenis rit (CD atau Fuso) harus lebih dari 0!');
      return;
    }

    try {
      setIsEditSaving(true);
      const res = await fetch('/api/sulam/form-drop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          lokasi: editLokasi,
          wilayah: editWilayah,
          tanggal: editTanggal,
          cd: nCD,
          fuso: nFuso,
          kelasBibit: editKelasBibit.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.message || 'Gagal menyimpan perubahan Form Drop Sulam.');
        return;
      }
      setFormMessage({ type: 'success', text: json.message || 'Data Form Drop Sulam berhasil diperbarui.' });
      setEditingItem(null);
      fetchDropHistory();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sulam_updated'));
        window.dispatchEvent(new CustomEvent('master_data_updated'));
      }
    } catch {
      alert('Terjadi kesalahan koneksi saat memperbarui data drop.');
    } finally {
      setIsEditSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingItem) return;
    try {
      setIsDeletingItem(true);
      const res = await fetch(`/api/sulam/form-drop?id=${deletingItem.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.message || 'Gagal menghapus data Form Drop Sulam.');
        return;
      }
      setFormMessage({ type: 'success', text: json.message || 'Data Form Drop Sulam berhasil dihapus.' });
      setDeletingItem(null);
      fetchDropHistory();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sulam_updated'));
        window.dispatchEvent(new CustomEvent('master_data_updated'));
      }
    } catch {
      alert('Terjadi kesalahan koneksi saat menghapus data drop.');
    } finally {
      setIsDeletingItem(false);
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
      <div className="p-6 rounded-3xl bg-linear-to-r from-emerald-600 to-teal-700 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Form Drop Sulam</h1>
            <p className="text-xs text-white/80 mt-1 max-w-xl">
              Pencatatan kedatangan (drop) bibit sulam ke lokasi lahan.
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
              : formMessage.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 text-amber-800 dark:text-amber-300'
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
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>Input Data Drop Bibit Sulam</span>
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
                className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
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
                      <span className="font-bold text-emerald-600">{item.lokasi}</span>
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
              <span>Tanggal Drop <b className="text-rose-500">*</b></span>
            </label>

            <div
              onClick={() => setIsCalendarOpen((prev) => !prev)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between cursor-pointer shadow-2xs hover:border-emerald-600 transition-colors"
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
                            ? 'bg-emerald-600 text-white font-bold'
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

        {/* 4. DUA KOTAK JENIS RIT (CD & FUSO) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Jenis Rit <b className="text-rose-500">*</b></span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
            {/* Rit CD */}
            <div className="p-2 sm:p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border-2 border-emerald-500/40 dark:border-emerald-500/60 focus-within:border-emerald-500 transition-all text-center shadow-2xs">
              <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 block mb-1">
                Rit CD
              </span>
              <input
                type="number"
                min="0"
                value={ritCD}
                onChange={(e) => setRitCD(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                placeholder="0"
                className="w-full text-center text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white bg-transparent focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5 font-semibold">Rit</span>
            </div>

            {/* Rit Fuso */}
            <div className="p-2 sm:p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border-2 border-blue-500/40 dark:border-blue-500/60 focus-within:border-blue-500 transition-all text-center shadow-2xs">
              <span className="text-[11px] font-extrabold text-blue-800 dark:text-blue-300 block mb-1">
                Rit Fuso
              </span>
              <input
                type="number"
                min="0"
                value={ritFuso}
                onChange={(e) => setRitFuso(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                placeholder="0"
                className="w-full text-center text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white bg-transparent focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-0.5 font-semibold">Rit</span>
            </div>
          </div>
        </div>

        {/* 5. KOTAK KELAS BIBIT */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Kelas Bibit</span>
            {bibitOrderedFromList && (
              <span className="text-[10.5px] text-slate-400 font-normal">
                Order Terdaftar: <b>{bibitOrderedFromList}</b>
              </span>
            )}
          </label>
          <SulamSelectDropdown
            value={kelasBibit}
            options={Array.from(
              new Set([
                ...(kelasBibit && !DROP_KELAS_BIBIT_OPTIONS.includes(kelasBibit) ? [kelasBibit] : []),
                ...DROP_KELAS_BIBIT_OPTIONS,
              ])
            )}
            onChange={(val) => setKelasBibit(val)}
            placeholder="Pilih Kelas Bibit"
            searchable
            searchPlaceholder="Cari kelas bibit..."
            triggerClassName="py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 shadow-2xs"
          />

          {/* NOTIFIKASI JIKA KELAS BIBIT TIDAK SESUAI DENGAN ORDER */}
          {isClassMismatch && (
            <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <b>Perhatian:</b> Kelas bibit yang Anda masukkan (<b>{kelasBibit}</b>) berbeda dengan spek bibit pada order terdaftar (<b>{bibitOrderedFromList}</b>). Transaksi tetap dapat disimpan.
              </span>
            </div>
          )}
        </div>

        {/* TOMBOL SUBMIT */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
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

      {/* TABEL RIWAYAT TRANSAKSI FORM DROP SULAM */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Transaksi Form Drop Sulam</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar seluruh input transaksi kedatangan bibit sulam yang telah tersimpan.
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
                <th className="py-2.5 px-3 text-center">CD (Rit)</th>
                <th className="py-2.5 px-3 text-center">Fuso (Rit)</th>
                <th className="py-2.5 px-3 text-center">Total (Rit)</th>
                <th className="py-2.5 px-3 text-center">Kelas Bibit</th>
                <th className="py-2.5 px-3 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isHistoryLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Memuat riwayat transaksi drop...</span>
                  </td>
                </tr>
              ) : dropHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Belum ada riwayat drop sulam yang tersimpan.
                  </td>
                </tr>
              ) : (
                dropHistory.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-100">{item.lokasi}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">{item.wilayah || '-'}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                      {item.tanggal ? new Date(item.tanggal).toISOString().slice(0, 10) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">{item.cd}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600">{item.fuso}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-900 dark:text-slate-100 bg-emerald-50/40 dark:bg-emerald-950/20">
                      {Number(item.cd || 0) + Number(item.fuso || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium text-slate-700 dark:text-slate-300">{item.kelasBibit || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition-colors cursor-pointer"
                          title="Edit Drop Sulam"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition-colors cursor-pointer"
                          title="Hapus Drop Sulam"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIT DROP SULAM */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isEditSaving && setEditingItem(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-600" />
                <span>Edit Form Drop Sulam</span>
              </h3>
              <button
                type="button"
                disabled={isEditSaving}
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Lokasi *</label>
                  <SulamSelectDropdown
                    value={editLokasi}
                    options={Array.from(
                      new Set([
                        ...(editLokasi ? [editLokasi] : []),
                        ...lokasiList.map((l) => l.lokasi),
                      ])
                    )}
                    onChange={handleEditLokasiChange}
                    placeholder="Pilih Lokasi"
                    searchable
                    searchPlaceholder="Cari lokasi..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Wilayah</label>
                  <input
                    type="text"
                    value={editWilayah}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Drop *</label>
                <input
                  type="date"
                  value={editTanggal}
                  onChange={(e) => setEditTanggal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rit CD</label>
                  <input
                    type="number"
                    min="0"
                    value={editRitCD}
                    onChange={(e) =>
                      setEditRitCD(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rit Fuso</label>
                  <input
                    type="number"
                    min="0"
                    value={editRitFuso}
                    onChange={(e) =>
                      setEditRitFuso(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kelas Bibit</label>
                <SulamSelectDropdown
                  value={editKelasBibit}
                  options={Array.from(
                    new Set([
                      ...(editKelasBibit && !DROP_KELAS_BIBIT_OPTIONS.includes(editKelasBibit)
                        ? [editKelasBibit]
                        : []),
                      ...DROP_KELAS_BIBIT_OPTIONS,
                    ])
                  )}
                  onChange={(val) => setEditKelasBibit(val)}
                  placeholder="Pilih Kelas Bibit"
                  searchable
                  searchPlaceholder="Cari kelas bibit..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isEditSaving}
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isEditSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isEditSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEditSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS DROP SULAM */}
      <DeleteConfirmationModal
        isOpen={Boolean(deletingItem)}
        onClose={() => !isDeletingItem && setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Data Drop Sulam"
        itemLabel={
          deletingItem
            ? `${deletingItem.lokasi} (${Number(deletingItem.cd || 0) + Number(deletingItem.fuso || 0)} Rit)`
            : undefined
        }
        isDeleting={isDeletingItem}
      />
    </div>
  );
}

