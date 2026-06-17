import React, { useEffect, useState, useRef } from 'react';
import { apiCall, currentClaims } from '../lib/api';

interface CalendarViewProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (tab: string) => void;
}

export default function CalendarView({ addToast, onNavigate }: CalendarViewProps) {
  // Calendar dates tracking
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 5, 1)); // Default June 2026 for seed alignment
  const [showPastShifts, setShowPastShifts] = useState(false);
  
  const [myShiftsMap, setMyShiftsMap] = useState<Map<string, any>>(new Map());
  const [bulkMonthData, setBulkMonthData] = useState<{ [date: string]: { morning: any[]; evening: any[] } }>({});
  
  // Selection logic state drawer
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  
  // Swap selection modal config
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetPerson, setSwapTargetPerson] = useState<any | null>(null);
  const [swapTargetDateIso, setSwapTargetDateIso] = useState<string | null>(null);

  const todayIsoRef = useRef('');
  const todayAnchorRef = useRef<HTMLDivElement | null>(null);
  const [myClaims, setMyClaims] = useState<any>(null);

  const plLocalMonth = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });
  const plWeekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
  const plDay = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' });

  // Get today's Warsaw ISO & Claims
  useEffect(() => {
    setMyClaims(currentClaims());

    const s = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const datePart = s.split(',')[0].trim();
    const [d, m, y] = datePart.split('.').map(Number);
    todayIsoRef.current = `${y || 2026}-06-${String(d || 16).padStart(2, '0')}`;
  }, []);

  // Fetch logged-in user custom shifts to check trade conflicts
  const loadMyShifts = async () => {
    try {
      const arr = await apiCall('/api/my-shifts');
      const storeMap = new Map();
      (arr || []).forEach((s: any) => {
        storeMap.set(s.shift_date, s);
      });
      setMyShiftsMap(storeMap);
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk Load Month Shifts
  const loadMonthData = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const data = await apiCall(`/api/month-shifts?year=${year}&month=${month}`);
      setBulkMonthData(data || {});
    } catch (e) {
      addToast('Błąd pobierania grafiku dla wybranego miesiąca', 'error');
    }
  };

  useEffect(() => {
    loadMyShifts();
    loadMonthData(currentMonth);
  }, [currentMonth]);

  // Adjust months
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedPerson(null);
    setSelectedDayIso(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedPerson(null);
    setSelectedDayIso(null);
  };

  const handleJumpToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setTimeout(() => {
      if (todayAnchorRef.current) {
        todayAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // Swapping target validator
  const isDirectTakeoverAllowed = (dateIso: string) => {
    // Cannot collect in past or today
    if (dateIso <= todayIsoRef.current) return false;
    // Cannot collect if you already work that day
    return !myShiftsMap.has(dateIso);
  };

  // Direct Claim/Takeover shift trigger
  const handleTakeoverClaim = async (person: any, dateIso: string) => {
    if (!isDirectTakeoverAllowed(dateIso)) {
      addToast('Tej zmiany nie można wziąć (przeszłość / dzisiaj lub pracujesz już w tym dniu).', 'error');
      return;
    }
    try {
      await apiCall('/api/takeovers', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: person.user_id, date: dateIso })
      });
      // Try fallback to automatic shift marketplace creation & request if legacy market offers match
      addToast('Zgłoszono upodobanie zmiany giełdowej pomyślnie!', 'success');
      loadMyShifts();
      loadMonthData(currentMonth);
      setSelectedPerson(null);
    } catch (err: any) {
      addToast(err.message || 'Błąd zatwierdzania kolekcji', 'error');
    }
  };

  // Trigger proposal POST
  const submitSwapProposal = async (myDateIso: string) => {
    if (!swapTargetPerson || !swapTargetDateIso) return;
    try {
      await apiCall('/api/proposals', {
        method: 'POST',
        body: JSON.stringify({
          target_user_id: swapTargetPerson.user_id,
          my_date: myDateIso,
          their_date: swapTargetDateIso
        })
      });
      addToast('✅ Prośba o wymianę została pomyślnie wysłana.', 'success');
      setShowSwapModal(false);
      onNavigate('proposals');
    } catch (err: any) {
      addToast(err.message || 'Błąd przy składaniu propozycji', 'error');
    }
  };

  // Days compiler
  const getDaysArray = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const start_date = new Date(year, month, 1);
    const end_date = new Date(year, month + 1, 0);

    const list: string[] = [];
    for (let day = 1; day <= end_date.getDate(); day++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      list.push(iso);
    }
    return list;
  };

  const sortingPriorityWeight = (p: any) => {
    const isCoord = !!p.is_coordinator;
    const lounge = (p.coord_lounge || p.lounge || '').toLowerCase();
    const isBar = p.is_bar_today;
    const isZ = !!p.is_zmiwaka;

    if (isZ) return 999;
    if (isCoord && lounge === 'polonez') return 1;
    if (isBar) return 2;
    if (lounge === 'polonez') return 3;
    if (isCoord && lounge === 'mazurek') return 4;
    if (lounge === 'mazurek') return 5;
    return 6;
  };

  const renderColRow = (titleLabel: string, list: any[], group: 'morning' | 'evening', iso: string) => {
    const parsedList = (list || []).slice().sort((a,b) => sortingPriorityWeight(a) - sortingPriorityWeight(b));

    return (
      <div className={`shift-group group--${group} flex-1 p-3 rounded-xl space-y-2.5`}>
        <div className="flex justify-between items-center text-xs font-bold text-slate-400 select-none">
          <span className="flex items-center gap-1">
            {group === 'morning' ? '☀' : '🌙'} {titleLabel}
          </span>
          <span className="px-2 py-0.5 bg-slate-900/60 rounded-full text-slate-500 font-mono text-[10px]">{parsedList.length} d</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {parsedList.length === 0 ? (
            <span className="text-slate-650 text-xs italic py-1">—</span>
          ) : (
            parsedList.map((p) => {
              const looksBar = /(^|[\/\s])B($|[\/\s])/i.test(String(p.shift_code || ''));
              const isBar = p.is_bar_today ?? looksBar;
              const isZ = p.is_zmiwaka;
              const lounge = String(p.lounge || '').toLowerCase();
              const coordLounge = String(p.coord_lounge || '').toLowerCase();

              let frameClass = '';
              if (isZ) frameClass = 'chip-zmywak-ring';
              else if (isBar) frameClass = 'chip-polonez';
              else if (lounge === 'mazurek' || lounge === 'polonez') frameClass = `chip-${lounge}`;

              let customStyle: React.CSSProperties = {};
              if (p.is_coordinator && coordLounge) {
                if (coordLounge === 'mazurek') customStyle = { boxShadow: 'inset 0 0 0 2px rgba(42,110,245,.45)' };
                else if (coordLounge === 'polonez') customStyle = { boxShadow: 'inset 0 0 0 2px rgba(255,214,74,.55)' };
              }

              // Highlight selected person chip
              const isSelected = selectedPerson?.user_id === p.user_id && selectedDayIso === iso;
              if (isSelected) {
                customStyle = { 
                  ...customStyle, 
                  ring: '2px solid var(--accent)', 
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: '#fff'
                };
              }

              return (
                <button 
                  key={p.user_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDayIso(iso);
                    setSelectedPerson(p);
                  }}
                  className={`person-chip flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${frameClass}`}
                  style={customStyle}
                >
                  <span className="font-bold text-white text-[13px]">{p.full_name}</span>
                  {p.is_coordinator && <span className="badge badge-coord text-[9px] px-1 py-0.5">K</span>}
                  {isBar && <span className="badge badge-bar text-[9px] px-1 py-0.5">B</span>}
                  {isZ && <span className="badge badge-zmiwak text-[9px] px-1 py-0.5">Z</span>}
                  {p.shift_code && (
                    <span className="badge badge-shift text-[10px] px-1 font-mono">
                      {String(p.shift_code).replace(/\s+/g, '').replace('/B', '')}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const daysList = getDaysArray();
  
  // Future shifts of current logged-in user available for exchange mapping
  const futureExchangesList = (Array.from(myShiftsMap.values()) as any[])
    .filter(s => s.shift_date >= todayIsoRef.current)
    .sort((a,b) => a.shift_date.localeCompare(b.shift_date));

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto px-4 py-2">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        
        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <button 
              onClick={handlePrevMonth}
              className="p-2 border border-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 font-bold transition text-sm active:scale-95"
            >
              ◀
            </button>
            <h2 className="text-lg font-bold text-white uppercase text-center min-w-[160px]">
              {plLocalMonth.format(currentMonth)}
            </h2>
            <button 
              onClick={handleNextMonth}
              className="p-2 border border-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 font-bold transition text-sm active:scale-95"
            >
              ▶
            </button>
          </div>
          
          <div className="flex items-center gap-2 justify-center">
            <button 
              onClick={handleJumpToday}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition active:scale-95"
            >
              Dziś
            </button>
            <button 
              onClick={() => setShowPastShifts(!showPastShifts)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition active:scale-95"
            >
              {showPastShifts ? 'Ukryj przeszłe' : 'Pokaż przeszłe zmiany'}
            </button>
          </div>
        </div>

        <div className="text-slate-400 text-xs py-1 select-none">
          💡 Kliknij planszę pracownika, aby wysunąć panel propozycji wymian lub szybkiego pobrania zmiany.
        </div>

        {/* CALENDAR ROWS CONTAINER */}
        <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
          {daysList.map((iso) => {
            const dtObj = new Date(iso + 'T12:00:00');
            const isToday = iso === todayIsoRef.current;
            const isPast = iso < todayIsoRef.current;

            // Skip if past and toggled off
            if (isPast && !showPastShifts) return null;

            const dayData = bulkMonthData[iso] || { morning: [], evening: [] };

            return (
              <div 
                key={iso}
                ref={isToday ? todayAnchorRef : null}
                className={`day-row flex flex-col gap-3 rounded-2xl border p-4 transition duration-200 ${
                  isToday 
                    ? 'border-blue-500/50 bg-[#0f1b2e] shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/30' 
                    : isPast
                      ? 'border-slate-850/50 opacity-60 bg-slate-950/20'
                      : 'border-slate-800 bg-slate-900/60'
                }`}
                data-day-row={iso}
              >
                {/* LADDER ROW WRAP */}
                <div className="flex flex-col md:flex-row gap-4">
                  {/* LEFT: Date label card */}
                  <div className="w-[80px] shrink-0 text-left select-none">
                    <div className="text-xs uppercase font-extrabold text-slate-450 tracking-wider">
                      {plWeekday.format(dtObj)}
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono">
                      {plDay.format(dtObj)}
                    </div>
                  </div>

                  {/* RIGHT: Morning + Evening lists */}
                  <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    {renderColRow('Rano (1)', dayData.morning, 'morning', iso)}
                    {renderColRow('Popo (2)', dayData.evening, 'evening', iso)}
                  </div>
                </div>

                {/* EXPANDED ACTIONS PANELS SIBLINGS */}
                {selectedDayIso === iso && selectedPerson && (
                  <div className="mt-2.5 p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between text-xs text-slate-400 gap-2 flex-wrap">
                      <div>
                        Dla: <strong className="text-slate-200">{selectedPerson.full_name}</strong> – zmiana <span className="px-1.5 py-0.5 bg-slate-800 rounded font-mono font-bold text-slate-300">{selectedPerson.shift_code}</span>
                      </div>
                      <button 
                        onClick={() => { setSelectedPerson(null); setSelectedDayIso(null); }}
                        className="text-slate-500 hover:text-slate-300 font-bold"
                      >
                        Zamknij panel &times;
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {/* Check if person works on date */}
                      {myClaims && selectedPerson.user_id !== myClaims.user_id ? (
                        <>
                          <button 
                            onClick={() => {
                              setSwapTargetPerson(selectedPerson);
                              setSwapTargetDateIso(iso);
                              setShowSwapModal(true);
                            }}
                            className="px-4 py-2 bg-slate-905 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-lg transition"
                          >
                            Zaproponuj wymianę
                          </button>
                          
                          <button 
                            disabled={!isDirectTakeoverAllowed(iso)}
                            onClick={() => handleTakeoverClaim(selectedPerson, iso)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                              isDirectTakeoverAllowed(iso)
                                ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-slate-950 hover:opacity-95'
                                : 'bg-slate-800 text-slate-550 border border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            Weź tę zmianę
                          </button>
                        </>
                      ) : (
                        <p className="text-slate-500 text-[11px] italic">To jest Twoja zarejestrowana zmiana.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SWAP RECIPIENT CHOICE MODAL */}
      {showSwapModal && swapTargetPerson && swapTargetDateIso && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-slate-200">
                🧩 Wybierz swoją zmianę do wymiany
              </h3>
              <button 
                onClick={() => setShowSwapModal(false)}
                className="text-slate-400 hover:text-slate-100 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="text-sm text-slate-400 mb-4 select-none">
              Proponujesz wymianę użytkownikowi <strong className="text-slate-200">{swapTargetPerson.full_name}</strong> na dzień <strong className="text-slate-200">{swapTargetDateIso}</strong>. Wybierz ze swoich przyszłych grafik, którą zmianę chcesz mu zaoferować w zamian:
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {futureExchangesList.length === 0 ? (
                <div className="text-slate-500 text-xs italic py-2">Brak Twoich zarejestrowanych przyszłych zmian. Nie można złożyć propozycji.</div>
              ) : (
                futureExchangesList.map((s) => {
                  const targetLoungeGroup = String(swapTargetPerson.shift_code).trim().startsWith('2') ? '2' : '1';
                  const myLoungeGroup = String(s.shift_code).trim().startsWith('2') ? '2' : '1';
                  const sameDay = s.shift_date === swapTargetDateIso;
                  
                  // Cannot work 2 full shifts same day on same layout
                  const disabled = sameDay && targetLoungeGroup === myLoungeGroup;

                  return (
                    <div 
                      key={s.id} 
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        disabled 
                          ? 'border-slate-850 opacity-40 bg-slate-950/20' 
                          : 'border-slate-800 bg-slate-950/50 hover:bg-slate-950 transition'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-300">
                          {s.shift_date}
                        </div>
                        <div className="text-xs text-slate-500 font-medium font-mono">
                          Kod: <span className="text-slate-400 font-bold">{s.shift_code}</span> · {s.lounge ? String(s.lounge).toUpperCase() : 'Brak'}
                        </div>
                      </div>

                      <button 
                        disabled={disabled}
                        onClick={() => submitSwapProposal(s.shift_date)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          disabled
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-800'
                            : 'bg-gradient-to-r from-blue-500 to-emerald-500 text-slate-950 hover:opacity-90 active:scale-95'
                        }`}
                      >
                        {disabled ? 'Niedozwolony ten sam slot' : 'Wybierz'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-slate-800">
              <button 
                onClick={() => setShowSwapModal(false)}
                className="px-4 py-2 bg-transparent border border-slate-700 hover:border-slate-500 hover:bg-slate-800 rounded-xl text-slate-350 text-sm font-semibold transition"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
