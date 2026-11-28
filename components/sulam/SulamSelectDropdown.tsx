'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface SulamSelectDropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  accent?: 'emerald' | 'teal';
  disabled?: boolean;
}

/**
 * Custom select dropdown with aligned rotating ChevronDown, click-outside auto-close,
 * and optional search filter for long option lists such as Lokasi.
 */
export default function SulamSelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Pilih...',
  searchable = false,
  searchPlaceholder = 'Cari...',
  accent = 'emerald',
  disabled = false,
}: SulamSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions =
    searchable && query.trim()
      ? options.filter((opt) => opt.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

  const focusRing =
    accent === 'teal'
      ? 'focus:ring-teal-500 border-teal-500/70'
      : 'focus:ring-emerald-500 border-emerald-500/70';
  const activeText =
    accent === 'teal'
      ? 'text-teal-700 dark:text-teal-400'
      : 'text-emerald-700 dark:text-emerald-400';
  const activeRow =
    accent === 'teal'
      ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold'
      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold';
  const hoverRow =
    accent === 'teal'
      ? 'hover:bg-teal-50/70 dark:hover:bg-teal-950/30'
      : 'hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`relative w-full pl-3.5 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-left flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 ${
          isOpen
            ? focusRing
            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
        }`}
      >
        <span
          className={`truncate font-bold ${
            value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 font-normal'
          }`}
        >
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
            isOpen ? `rotate-180 ${activeText}` : 'text-slate-400'
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {searchable && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-400">
                Data tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt === value;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? activeRow
                        : `text-slate-700 dark:text-slate-300 ${hoverRow}`
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className={`w-3.5 h-3.5 shrink-0 ${activeText}`} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
