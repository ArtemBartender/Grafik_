import React, { useState } from 'react';
import { AuthPage } from './features/auth/AuthPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { FullSchedulePage } from './features/schedule/FullSchedulePage';

type Screen = 'auth' | 'dashboard' | 'schedule' | 'stats' | 'market' | 'parser';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');

  // Функция для имитации входа (пока бэк не подключен)
  const handleLoginSuccess = () => {
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentScreen('auth');
  };

  if (currentScreen === 'auth') {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex min-h-screen bg-[#0b0c10] text-white font-sans">
      {/* Левый Sidebar (Общий для всех внутренних страниц) */}
      <aside className="w-64 bg-white/5 backdrop-blur-md border-r border-white/10 flex flex-col justify-between p-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-sm">
              LOT
            </div>
            <span className="text-xl font-bold tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Grafik Zmian
            </span>
          </div>

          <nav className="space-y-2">
            <button 
              onClick={() => setCurrentScreen('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                currentScreen === 'dashboard' 
                  ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/10 border border-purple-500/30 text-purple-400' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Panel Główny
            </button>
            <button 
              onClick={() => setCurrentScreen('schedule')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                currentScreen === 'schedule' 
                  ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/10 border border-purple-500/30 text-purple-400' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Cały Grafik
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all opacity-50 cursor-not-allowed">
              Statystyki
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all opacity-50 cursor-not-allowed">
              Rynek Zmian
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all opacity-50 cursor-not-allowed">
              Parser Excel
            </button>
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            Wyloguj się
          </button>
        </div>
      </aside>

      {/* Контент текущего выбранного экрана */}
      <main className="flex-1 p-8 relative overflow-hidden">
        {currentScreen === 'dashboard' && <DashboardPage />}
        {currentScreen === 'schedule' && <FullSchedulePage />}
      </main>
    </div>
  );
}

export default App;
