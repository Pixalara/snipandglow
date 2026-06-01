'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronDown } from 'lucide-react';

type Preset = 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom Range' },
];

function getISTDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];
}

function getPresetRange(preset: Preset): { from: string; to: string; label: string } {
  const today = getISTDate(0);
  const yesterday = getISTDate(-1);

  // Week: Monday to today
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const mondayStr = monday.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];

  // Last week: prev Monday to prev Sunday
  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);
  const lastSunday = new Date(monday);
  lastSunday.setDate(monday.getDate() - 1);
  const lastMondayStr = lastMonday.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];
  const lastSundayStr = lastSunday.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];

  // Month
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Last month
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lmStart = lm.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];
  const lmEndStr = lmEnd.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];

  switch (preset) {
    case 'today': return { from: today, to: today, label: 'Today' };
    case 'yesterday': return { from: yesterday, to: yesterday, label: 'Yesterday' };
    case 'week': return { from: mondayStr, to: today, label: 'This Week' };
    case 'last_week': return { from: lastMondayStr, to: lastSundayStr, label: 'Last Week' };
    case 'month': return { from: monthStart, to: today, label: 'This Month' };
    case 'last_month': return { from: lmStart, to: lmEndStr, label: 'Last Month' };
    default: return { from: monthStart, to: today, label: 'Custom' };
  }
}

interface Props {
  currentFrom: string;
  currentTo: string;
  currentPreset: string;
}

export function CostFilter({ currentFrom, currentTo, currentPreset }: Props) {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>((currentPreset as Preset) || 'month');
  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);
  const [showCustom, setShowCustom] = useState(currentPreset === 'custom');

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const range = getPresetRange(p);
    setFrom(range.from);
    setTo(range.to);
    router.push(`/admin/whatsapp-costs?preset=${p}&from=${range.from}&to=${range.to}`);
  }

  function applyCustom() {
    if (!from || !to) return;
    router.push(`/admin/whatsapp-costs?preset=custom&from=${from}&to=${to}`);
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              preset === p.key
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5">
            <Calendar className="size-3.5 text-slate-400" />
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="bg-transparent text-xs text-white outline-none w-28"
            />
          </div>
          <span className="text-slate-500 text-xs">to</span>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5">
            <Calendar className="size-3.5 text-slate-400" />
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="bg-transparent text-xs text-white outline-none w-28"
            />
          </div>
          <button
            onClick={applyCustom}
            disabled={!from || !to}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
