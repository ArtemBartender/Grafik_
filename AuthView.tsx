import React, { useEffect, useState, useRef } from 'react';
import { getToken, removeToken, currentClaims, apiCall } from './lib/api';

// Imports of core submodules
import AuthView from './components/AuthView';
import StartView from './components/StartView';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import ProposalsView from './components/ProposalsView';
import MarketView from './components/MarketView';
import CoordinatorView from './components/CoordinatorView';
import ControlView from './components/ControlView';
import AdminView from './components/AdminView';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(null);
  const [claims, setClaims] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('start');

  // Floating messages state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  // Profile shift list (Mój grafik) tab states
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [dashboardMonth, setDashboardMonth] = useState<Date>(new Date(2026, 5, 1)); // June 2026 default seed alignment

  // Change Password dialog (while logged in)
  const [showPassModal, setShowPassModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Menu collapse for mobile navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Password strength meter states matching user criteria ("Słabe", "Dobre", "Świetne")
  const [passStrength, setPassStrength] = useState('');
  const [strengthColor, setStrengthColor] = useState('text-slate-500');

  useEffect(() => {
    const stored = getToken();
    setTokenState(stored);
    if (stored) {
      setClaims(currentClaims());
    }
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogout = () => {
    removeToken();
    setTokenState(null);
    setClaims(null);
    setActiveTab('start');
    addToast('Wylogowano pomyślnie z systemu', 'info');
  };

  const handleLoginSuccess = () => {
    const stored = getToken();
    setTokenState(stored);
    const decoded = currentClaims();
    setClaims(decoded);
    addToast(`Witaj z powrotem, ${decoded?.full_name || 'Użytkowniku'}!`, 'success');
  };

  // Pull individual user shifts list inside Dashboard
  const loadMyShiftsList = async () => {
    if (!token) return;
    try {
      const year = dashboardMonth.getFullYear();
      const month = dashboardMonth.getMonth() + 1;
      const data = await apiCall(`/api/my-shifts-brief?month=${year}-${String(month).padStart(2, '0')}`);
      setMyShifts(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token && activeTab === 'dashboard') {
      loadMyShiftsList();
    }
  }, [token, activeTab, dashboardMonth]);

  // Track password strength
  useEffect(() => {
    if (!newPassword) {
      setPassStrength('');
      return;
    }
    const hasLetters = /[a-zA-Z]/.test(newPassword);
    const hasNumbers = /[0-9]/.test(newPassword);
    const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);

    const length = newPassword.length;
    if (length < 6) {
      setPassStrength('Słabe');
      setStrengthColor('text-red-400');
    } else if (length >= 6 && hasLetters && hasNumbers && !hasSpecial) {
      setPassStrength('Dobre');
      setStrengthColor('text-blue-400');
    } else if (length >= 8 && hasLetters && hasNumbers && hasSpecial) {
      setPassStrength('Świetne');
      setStrengthColor('text-emerald-400');
    } else {
      setPassStrength('Dobre');
      setStrengthColor('text-blue-400');
    }
  }, [newPassword]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      addToast('Wprowadź stare i nowe hasło!', 'error');
      return;
    }
    try {
      await apiCall('/api/change-password-user', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      addToast('Hasło zostało pomyślnie zaktualizowane', 'success');
      setShowPassModal(false);
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      addToast(err.message || 'Błąd zmiany hasła', 'error');
    }
  };

  // If not logged in, render authentication layout directly
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b0d10] font-sans flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Decorative celestial grid rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-slate-800/20 rounded-full select-none pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-dashed border-slate-800/25 rounded-full select-none pointer-events-none animate-spin-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-slate-800/10 rounded-full select-none pointer-events-none" />

        <div className="relative z-10">
          <AuthView onLoginSuccess={handleLoginSuccess} addToast={addToast} />
        </div>

        {/* Floating Custom Stacked Toasts */}
        <div className="absolute bottom-6 right-6 z-50 space-y-2 pointer-events-auto">
          {toasts.map(t => (
            <div 
              key={t.id}
              onClick={() => removeToast(t.id)}
              className={`flex items-center justify-between p-4 rounded-xl shadow-2xl border cursor-pointer animate-slide-in text-sm font-bold max-w-sm ${
                t.type === 'success' 
                  ? 'bg-[#0f1d17] text-emerald-400 border-emerald-500/30' 
                  : t.type === 'error' 
                    ? 'bg-[#221010] text-red-400 border-red-500/30' 
                    : 'bg-[#101925] text-blue-400 border-blue-500/30'
              }`}
            >
              <span>{t.message}</span>
              <button className="ml-4 opacity-50 hover:opacity-100 font-bold">&times;</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const role = claims?.role || 'user';
  const myName = claims?.full_name || 'Użytkownik';

  // Format month labels for simple dashboard list
  const plLocalMonth = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#0b0d10] text-slate-100 flex flex-col font-sans select-none">
      {/* BRANDING TOP HEADER ROW */}
      <header className="bg-slate-900 border-b border-slate-850 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-2">
          {/* Logo badge */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500/80 to-emerald-400/80 flex items-center justify-center font-black text-slate-950 font-mono text-sm leading-none">
            S
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-slate-100 uppercase font-mono">
              SkyShift Pro
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">
              Warszawa Longe Scheduler
            </p>
          </div>
        </div>

        {/* DESKTOP METADATA WRAPPER */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-400">Zalogowany: </span>
            <strong className="text-xs text-slate-200">{myName}</strong>
            <div className="text-[10px] font-bold text-slate-550 uppercase">
              Rola: <span className="text-emerald-400 font-extrabold">{role === 'admin' ? 'Michał / Robert (Admin)' : role === 'coordinator' ? 'Koordynator' : 'Pracownik (Waiters/Bar)'}</span>
            </div>
          </div>

          <button 
            onClick={() => setShowPassModal(true)}
            className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg transition"
          >
            Hasło 🔑
          </button>

          <button 
            onClick={handleLogout}
            className="px-3 py-1.5 border border-red-500/30 hover:bg-red-550/10 text-red-400 text-xs font-bold rounded-lg transition"
          >
            Wyloguj
          </button>
        </div>

        {/* MOBILE HAMBURGER BUTTON */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* MOBILE EXPANDED MENU TRAY */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-3 animate-fade-in text-sm font-semibold">
          <div className="pb-2 border-b border-slate-850 select-none">
            <p className="text-slate-400 text-xs">Menu zalogowanego:</p>
            <p className="text-white font-bold">{myName} ({role})</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setActiveTab('start'); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-left ${activeTab === 'start' ? 'bg-blue-500/10 text-white' : 'text-slate-400'}`}>Dziś w pracy</button>
            <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-left ${activeTab === 'dashboard' ? 'bg-blue-500/10 text-white' : 'text-slate-400'}`}>Mój grafik</button>
            <button onClick={() => { setActiveTab('calendar'); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-left ${activeTab === 'calendar' ? 'bg-blue-500/10 text-white' : 'text-slate-400'}`}>Grafik ogólny</button>
            <button onClick={() => { setActiveTab('stats'); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-left ${activeTab === 'stats' ? 'bg-blue-500/10 text-white' : 'text-slate-400'}`}>Statystyka</button>
            <button onClick={() => { setActiveTab('proposals'); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-left ${activeTab === 'proposals' ? 'bg-blue-500/10 text-white' : 'text-slate-400'}`}>Skrzynka wymian</button>
            <button onClick={() => { setActiveTab('market'); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-left ${activeTab === 'market' ? 'bg-blue-500/10 text-white' : 'text-slate-400'}`}>Giełda zmian</button>
            
            {(role === 'coordinator' || role === 'admin') && (
              <button onClick={() => { setActiveTab('coordinator'); setMobileMenuOpen(false); }} className={`px-3 py-2 text-left text-yellow-500 ${activeTab === 'coordinator' ? 'bg-yellow-550/10' : ''}`}>Raport Koord.</button>
            )}
            {role === 'admin' && (
              <>
                <button onClick={() => { setActiveTab('control'); setMobileMenuOpen(false); }} className={`px-3 py-2 text-left text-orange-400 ${activeTab === 'control' ? 'bg-orange-550/10' : ''}`}>Kontrola zmian</button>
                <button onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }} className={`px-3 py-2 text-left text-emerald-400 ${activeTab === 'admin' ? 'bg-emerald-555/10' : ''}`}>Panel Excel</button>
              </>
            )}
          </div>
          <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2">
            <button onClick={() => setShowPassModal(true)} className="px-4 py-2 bg-slate-800 rounded-lg text-xs text-slate-300">Zmień Hasło</button>
            <button onClick={handleLogout} className="px-4 py-2 border border-red-500/40 text-red-400 rounded-lg text-xs">Wyloguj</button>
          </div>
        </div>
      )}

      {/* CORE DESKTOP NAVIGATION ROW */}
      <nav className="hidden md:flex bg-slate-950 border-b border-slate-900 px-6 gap-2 py-2 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('start')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition ${
            activeTab === 'start' ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Dziś w pracy
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition ${
            activeTab === 'dashboard' ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Mój grafik
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition ${
            activeTab === 'calendar' ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Grafik ogólny
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition ${
            activeTab === 'stats' ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Statystyka
        </button>
        <button 
          onClick={() => setActiveTab('proposals')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition ${
            activeTab === 'proposals' ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Skrzynka wymian
        </button>
        <button 
          onClick={() => setActiveTab('market')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition ${
            activeTab === 'market' ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Giełda zmian
        </button>

        {/* Separator */}
        <span className="w-px bg-slate-800 self-stretch my-1" />

        {/* Coordinators subroutines */}
        {(role === 'coordinator' || role === 'admin') && (
          <button 
            onClick={() => setActiveTab('coordinator')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition text-yellow-500 ${
              activeTab === 'coordinator' ? 'bg-yellow-500/10' : 'hover:text-yellow-450'
            }`}
          >
            Raport Koordynatora
          </button>
        )}

        {/* Admins subroutines */}
        {role === 'admin' && (
          <>
            <button 
              onClick={() => setActiveTab('control')}
              className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition text-orange-400 ${
                activeTab === 'control' ? 'bg-orange-500/10' : 'hover:text-orange-450'
              }`}
            >
              Kontrola zmian
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition text-emerald-400 ${
                activeTab === 'admin' ? 'bg-emerald-500/10' : 'hover:text-emerald-450'
              }`}
            >
              Panel Excel
            </button>
          </>
        )}
      </nav>

      {/* FLOATING ACTION OVERLAYS/MODALS/TOAST PANEL */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-auto">
        {toasts.map(t => (
          <div 
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`flex items-center justify-between p-4 rounded-xl shadow-2xl border cursor-pointer animate-slide-in text-sm font-bold max-w-sm ${
              t.type === 'success' 
                ? 'bg-[#0f1d17] text-emerald-400 border-emerald-500/30' 
                : t.type === 'error' 
                  ? 'bg-[#221010] text-red-400 border-red-500/30' 
                  : 'bg-[#101925] text-blue-400 border-blue-500/30'
            }`}
          >
            <span>{t.message}</span>
            <button className="ml-4 opacity-50 hover:opacity-100 font-bold">&times;</button>
          </div>
        ))}
      </div>

      {/* PRIMARY VIEWS SWITCH COMPILER */}
      <main className="flex-1 overflow-y-auto py-6">
        {activeTab === 'start' && (
          <StartView addToast={addToast} onNavigate={setActiveTab} />
        )}

        {/* Dynamic customized Tab "dashboard" representing individual calendar */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto px-4 py-2">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-1.5">
                    🗓️ Twój osobisty grafik pracy
                  </h1>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Tutaj widzisz zestawienie Twoich zmian w wybranym miesiącu.
                  </p>
                </div>
                
                {/* Adjust month switcher for dashboard grid */}
                <div className="flex items-center gap-2 justify-center">
                  <button 
                    onClick={() => setDashboardMonth(new Date(dashboardMonth.getFullYear(), dashboardMonth.getMonth() - 1, 1))}
                    className="p-1 px-2 text-xs border border-slate-800 rounded-lg hover:bg-slate-850"
                  >
                    ◀
                  </button>
                  <span className="text-xs font-bold text-slate-200 uppercase min-w-[110px] text-center font-mono">
                    {plLocalMonth.format(dashboardMonth)}
                  </span>
                  <button 
                    onClick={() => setDashboardMonth(new Date(dashboardMonth.getFullYear(), dashboardMonth.getMonth() + 1, 1))}
                    className="p-1 px-2 text-xs border border-slate-800 rounded-lg hover:bg-slate-850"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Grid content */}
              <div className="space-y-3">
                {myShifts.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 italic select-none">
                     Brak przypisanych zmian dla Ciebie w tym miesiącu.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-350 border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800">
                          <th className="py-2.5 px-3 font-bold text-slate-400 uppercase">Data</th>
                          <th className="py-2.5 px-3 font-bold text-slate-400 uppercase">Salon (Lounge)</th>
                          <th className="py-2.5 px-3 font-bold text-slate-400 uppercase">Kod zmiany</th>
                          <th className="py-2.5 px-3 font-bold text-slate-400 uppercase">Zaplanowano</th>
                          <th className="py-2.5 px-3 font-bold text-slate-400 uppercase">Faktyczne h</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myShifts.map((s, idx) => {
                          const loungeStr = s.lounge ? String(s.lounge).toUpperCase() : 'Brak';
                          return (
                            <tr key={idx} className="border-b border-slate-850 hover:bg-slate-950/40">
                              <td className="py-3 px-3 font-bold text-slate-100">{s.date}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] select-none ${
                                  loungeStr === 'POLONEZ' ? 'bg-yellow-500/10 text-yellow-405 border border-yellow-500/20' : 'bg-blue-500/10 text-blue-405 border border-blue-500/20'
                                }`}>
                                  {loungeStr}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="badge badge-shift font-mono">{s.code}</span>
                              </td>
                              <td className="py-3 px-3 font-semibold font-mono">{s.scheduled_hours} godzin</td>
                              <td className="py-3 px-3 font-bold text-emerald-400 font-mono">{s.worked_hours} godzin</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarView addToast={addToast} onNavigate={setActiveTab} />
        )}

        {activeTab === 'stats' && (
          <StatsView addToast={addToast} />
        )}

        {activeTab === 'proposals' && (
          <ProposalsView addToast={addToast} />
        )}

        {activeTab === 'market' && (
          <MarketView addToast={addToast} />
        )}

        {(role === 'coordinator' || role === 'admin') && activeTab === 'coordinator' && (
          <CoordinatorView addToast={addToast} />
        )}

        {role === 'admin' && activeTab === 'control' && (
          <ControlView addToast={addToast} />
        )}

        {role === 'admin' && activeTab === 'admin' && (
          <AdminView addToast={addToast} />
        )}
      </main>

      {/* FOOTER METRICS INFO */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3 text-center text-[10px] text-slate-600 font-semibold select-none">
        &copy; 2026 SkyShift Pro Warsaw Airport. Wszelkie prawa zastrzeżone.
      </footer>

      {/* CONSOLE DIALOG PASSWORD CHANGE OVERLAY MODAL */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-slate-200">
                🔒 Zmień hasło konta
              </h3>
              <button 
                onClick={() => setShowPassModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obecne hasło</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nowe hasło</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-101 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                
                {passStrength && (
                  <div className="text-xs font-semibold mt-1">
                    Bezpieczeństwo: <span className={`font-bold ${strengthColor}`}>{passStrength}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-slate-800">
                <button 
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="px-3.5 py-1.5 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:border-slate-500 transition"
                >
                  Anuluj
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-emerald-500 text-slate-950 text-xs font-extrabold rounded-lg hover:opacity-95 transition"
                >
                  Zmień hasło
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
