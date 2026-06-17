import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  BarChart2, 
  RefreshCw, 
  Upload, 
  LogOut, 
  User as UserIcon,
  Clock,
  Briefcase
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  // Имитируем данные (потом они будут прилетать из Flask + Supabase)
  const [user] = useState({ name: 'Andrii', role: 'Pracownik' });
  const [currentShift] = useState<Shift | null>({
    id: '1',
    date: '17.06.2026',
    type: 'R2',
    hours: '07:00 - 15:00',
    position: 'Pozycja: Koordynator'
  });

  return (
    <div className="flex min-h-screen bg-[#0b0c10] text-white font-sans">
      
      {/* ЛЕВАЯ ПАНЕЛЬ: МЕНЮ (Sidebar) */}
      <aside className="w-64 bg-white/5 backdrop-blur-md border-r border-white/10 flex flex-col justify-between p-6">
        <div>
          {/* Логотип */}
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-sm">
              LOT
            </div>
            <span className="text-xl font-bold tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Grafik Zmian
            </span>
          </div>

          {/* Пункты навигации */}
          <nav className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/30 to-blue-600/10 border border-purple-500/30 text-purple-400 font-medium transition-all">
              <Home size={20} /> Panel Główny
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all">
              <Calendar size={20} /> Cały Grafik
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all">
              <BarChart2 size={20} /> Statystyki
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all">
              <RefreshCw size={20} /> Rynek Zmian
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all">
              <Upload size={20} /> Parser Excel
            </button>
          </nav>
        </div>

        {/* Профиль и Выход (Внизу Sidebar) */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-purple-400">
              <UserIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium">
            <LogOut size={18} /> Wyloguj się
          </button>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 p-8 relative overflow-hidden">
        {/* Неоновый свет на фоне */}
        <div className="absolute w-[600px] h-[600px] bg-purple-600/10 blur-[130px] rounded-full -top-40 -right-40 -z-10" />

        {/* Хедер страницы */}
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-1">
            Cześć, {user.name}! 👋
          </h2>
          <p className="text-gray-400 text-sm">
            Oto Twój status i dzisiejsza zmiana.
          </p>
        </header>

        {/* СЕТКА С КАРТОЧКАМИ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* КАРТОЧКА: ДЖИЗЕЙШАЯ СМЕНА (Как на скриншоте) */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            {/* Градиентная полоска сверху карточки для красоты */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 to-blue-500" />
            
            <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Clock size={16} className="text-purple-400" /> Twoja zmiana dzisiaj
            </h3>

            {currentShift ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                    {currentShift.type}
                  </span>
                  <span className="text-xl font-semibold text-gray-200">
                    {currentShift.hours}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 px-3 py-2 rounded-lg w-fit border border-white/5">
                  <Briefcase size={16} className="text-blue-400" />
                  {currentShift.position}
                </div>
              </div>
            ) : (
              <p className="text-emerald-400 font-medium text-lg py-2">
                🎉 Dzisiaj masz wolne! Odpoczywaj.
              </p>
            )}
          </div>

          {/* Сюда можно будет вывести мини-статистику или уведомления */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Szybki skrót miesiąca</h3>
              <p className="text-xs text-gray-500 mb-4">Aktualne podsumowanie roboczogodzin</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                  <span className="text-gray-400">Przepracowane godziny:</span>
                  <span className="font-semibold">120h / 160h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Szacowane wynagrodzenie:</span>
                  <span className="font-semibold text-emerald-400">~ 4,800 PLN</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
};
