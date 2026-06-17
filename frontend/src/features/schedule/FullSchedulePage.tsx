import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

interface ScheduleDay {
  dayNumber: number;
  dayOfWeek: string;
  shiftType: string | null; // null если выходной (Wolne)
  hours: string | null;
  position: string | null;
}

export const FullSchedulePage: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>('Czerwiec 2026');

  // Фейковые данные графика для примера (потом подтянем из парсера/базы)
  const [days] = useState<ScheduleDay[]>([
    { dayNumber: 1, dayOfWeek: 'Pn', shiftType: 'R2', hours: '07:00 - 15:00', position: 'Koordynator' },
    { dayNumber: 2, dayOfWeek: 'Wt', shiftType: 'R2', hours: '07:00 - 15:00', position: 'Koordynator' },
    { dayNumber: 3, dayOfWeek: 'Śr', shiftType: 'N1', hours: '22:00 - 06:00', position: 'Gateman' },
    { dayNumber: 4, dayOfWeek: 'Cz', shiftType: null, hours: null, position: null }, // Выходной
    { dayNumber: 5, dayOfWeek: 'Pt', shiftType: 'R3', hours: '15:00 - 23:00', position: 'Pozycja: Air' },
    { dayNumber: 6, dayOfWeek: 'Sb', shiftType: null, hours: null, position: null },
    { dayNumber: 7, dayOfWeek: 'Nd', shiftType: null, hours: null, position: null },
    // ... и так далее для демонстрации
  ]);

  return (
    <div>
      {/* Неоновый фон */}
      <div className="absolute w-[600px] h-[600px] bg-blue-600/10 blur-[130px] rounded-full -bottom-40 -right-40 -z-10" />

      {/* Верхняя панель управления графиком */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Cały Grafik</h2>
          <p className="text-gray-400 text-sm">Przeglądaj swoje zmiany w tym miesiącu.</p>
        </div>

        {/* Переключатель месяцев */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl self-start sm:self-auto">
          <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 font-semibold text-sm select-none min-w-[120px] text-center">
            {currentMonth}
          </span>
          <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* ТАБЛИЦА С ГРАФИКОМ */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-6 w-24">Data</th>
                <th className="py-4 px-6 w-28">Zmiana</th>
                <th className="py-4 px-6">Godziny pracy</th>
                <th className="py-4 px-6">Stanowisko / Pozycja</th>
                <th className="py-4 px-6 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {days.map((day) => (
                <tr 
                  key={day.dayNumber} 
                  className={`transition-colors hover:bg-white/[0.02] ${
                    day.shiftType === null ? 'bg-emerald-500/[0.02]' : ''
                  }`}
                >
                  {/* Число и день недели */}
                  <td className="py-4 px-6 font-medium">
                    <span className="text-base font-bold mr-1">{day.dayNumber}</span>
                    <span className="text-xs text-gray-500">{day.dayOfWeek}</span>
                  </td>

                  {/* Тип смены */}
                  <td className="py-4 px-6">
                    {day.shiftType ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {day.shiftType}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                        Wolne
                      </span>
                    )}
                  </td>

                  {/* Часы работы */}
                  <td className="py-4 px-6 text-gray-300">
                    {day.hours ? day.hours : <span className="text-gray-600">—</span>}
                  </td>

                  {/* Позиция */}
                  <td className="py-4 px-6 text-gray-400">
                    {day.position ? day.position : <span className="text-gray-500">Odpoczynek</span>}
                  </td>

                  {/* Кнопка действия (например, закинуть на маркет) */}
                  <td className="py-4 px-6 text-right">
                    {day.shiftType && (
                      <button className="text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all">
                        Oddaj zmianę
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
