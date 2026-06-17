export interface Shift {
  id: string;
  date: string;       // Например: "2026-06-17"
  type: string;       // Например: "R2" (код смены)
  hours: string;      // Например: "07:00 - 15:00"
  position: string;   // Например: "Katowice Air" / Рабочая позиция
}

export interface UserStatsSummary {
  hoursThisMonth: number;
  estimatedSalary: number;
}
