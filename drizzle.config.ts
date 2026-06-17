import React, { useEffect, useState } from 'react';
import { apiCall } from '../lib/api';

interface CoordinatorViewProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CoordinatorView({ addToast }: CoordinatorViewProps) {
  const [lounge, setLounge] = useState<'mazurek' | 'polonez'>('mazurek');
  const [shiftType, setShiftType] = useState<'morning' | 'evening'>('morning');
  const [dateVal, setDateVal] = useState('2026-06-16'); // Default seed focused

  // Bars positions
  const [bars, setBars] = useState({
    bar0: '', bar1: '', bar2: '', 'bar-elita': '', zmiwak: '', barman: ''
  });

  // Hours positions
  const [times, setTimes] = useState({
    arrived: '', left: ''
  });

  // Notes positions  
  const [notes, setNotes] = useState({
    past: '', missing: '', passengers: ''
  });

  const loadReport = async () => {
    try {
      const q = new URLSearchParams({
        lounge, shift_type: shiftType, date: dateVal
      }).toString();
      const res = await apiCall(`/api/coord-panel/report?${q}`);
      
      setBars(res.bars || { bar0: '', bar1: '', bar2: '', 'bar-elita': '', zmiwak: '', barman: '' });
      setTimes(res.times || { arrived: '', left: '' });
      setNotes(res.notes || { past: '', missing: '', passengers: '' });
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadReport();
  }, [lounge, shiftType, dateVal]);

  const handleSaveReport = async () => {
    try {
      await apiCall('/api/coord-panel/report', {
        method: 'POST',
        body: JSON.stringify({
          lounge,
          shift_type: shiftType,
          shift_date: dateVal,
          bars,
          times,
          notes
        })
      });
      addToast('Raport koordynatora został zapisany pomyślnie!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Błąd zapisu raportu', 'error');
    }
  };

  const handleBarChange = (key: string, val: string) => {
    setBars(p => ({ ...p, [key]: val }));
  };

  const handleTimeChange = (key: string, val: string) => {
    setTimes(p => ({ ...p, [key]: val }));
  };

  const handleNoteChange = (key: string, val: string) => {
    setNotes(p => ({ ...p, [key]: val }));
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto px-4 py-2">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        
        {/* HEADER SELECTS */}
        <h2 className="text-xl font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
          💼 Panel Raportowania Koordynatora
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase">Wybierz Salon (Lounge)</label>
            <select 
              value={lounge}
              onChange={(e) => setLounge(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
            >
              <option value="mazurek">Mazurek</option>
              <option value="polonez">Polonez</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase">Wybierz zmianę</label>
            <select 
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
            >
              <option value="morning">Rano (Zmiana 1)</option>
              <option value="evening">Popo (Zmiana 2)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase">Wybierz datę</label>
            <input 
              type="date" 
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className="w-full px-3 py-2 border border-slate-850 bg-slate-950 text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
            />
          </div>
        </div>
      </section>

      {/* SECTION 1: BARS DISPOSITION */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-slate-450 uppercase border-b border-slate-800 pb-2">
          1. Rozstawienie ludzi po barach
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Bar 0</label>
            <input 
              type="text" 
              value={bars.bar0}
              onChange={(e) => handleBarChange('bar0', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold"
              placeholder="FIO pracownika"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Bar 1</label>
            <input 
              type="text" 
              value={bars.bar1}
              onChange={(e) => handleBarChange('bar1', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold"
              placeholder="FIO pracownika"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Bar 2</label>
            <input 
              type="text" 
              value={bars.bar2}
              onChange={(e) => handleBarChange('bar2', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold"
              placeholder="FIO pracownika"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Bar Elita</label>
            <input 
              type="text" 
              value={bars['bar-elita']}
              onChange={(e) => handleBarChange('bar-elita', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold"
              placeholder="FIO pracownika"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Zmywak</label>
            <input 
              type="text" 
              value={bars.zmiwak}
              onChange={(e) => handleBarChange('zmiwak', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-101 text-sm font-bold"
              placeholder="FIO pracownika"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Barman</label>
            <input 
              type="text" 
              value={bars.barman}
              onChange={(e) => handleBarChange('barman', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold"
              placeholder="FIO pracownika"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2: TIMES ARRIVED DEPARTED */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-slate-450 uppercase border-b border-slate-800 pb-2">
          2. Godziny pracy salonu
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase">Godzina przyjścia koordynatora</label>
            <input 
              type="time" 
              value={times.arrived}
              onChange={(e) => handleTimeChange('arrived', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase">Godzina wyjścia koordynatora</label>
            <input 
              type="time" 
              value={times.left}
              onChange={(e) => handleTimeChange('left', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm font-bold font-mono"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: NOTES PAST/MISSING/REVIEW LOGS */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-slate-450 uppercase border-b border-slate-800 pb-2">
          3-5. Uwagi do zmiany
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase">Uwagi i zalecenia do ubiegłej zmiany</label>
            <textarea 
              value={notes.past}
              onChange={(e) => handleNoteChange('past', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm placeholder-slate-600 h-16 outline-none resize-none"
              placeholder="np. Czystość i zaopatrzenie lodówek..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase">Braki towarowe i zapotrzebowanie</label>
            <textarea 
              value={notes.missing}
              onChange={(e) => handleNoteChange('missing', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm placeholder-slate-600 h-16 outline-none resize-none"
              placeholder="np. Brak cytryn, mało toniku glass..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase">Opinie i kłopoty pasażerów</label>
            <textarea 
              value={notes.passengers}
              onChange={(e) => handleNoteChange('passengers', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-750 bg-slate-950 text-slate-100 text-sm placeholder-slate-605 h-16 outline-none resize-none"
              placeholder="np. Pasażer zgłosił problem z wifi w strefie..."
            />
          </div>
        </div>
      </section>

      {/* ACTION TRIGGERS */}
      <button 
        type="button"
        onClick={handleSaveReport}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-emerald-500 text-slate-950 text-center font-black rounded-xl hover:opacity-95 transform active:scale-[0.99] transition text-sm"
      >
        Zapisz raport koordynatora
      </button>
    </div>
  );
}
