// src/types/settings.ts

export type DayOfWeek = '月' | '火' | '水' | '木' | '金' | '土' | '日';

export interface TodaySettings {
  mode: 'relative' | 'fixed';
  relativeMinutes: number;
  fixedTime: string;
}

export interface TomorrowSettings {
  mode: 'fixed';
  fixedTime: string;
}

export interface TimeSettings {
  today: TodaySettings;
  tomorrow: TomorrowSettings;
  tonight: { fixedTime: string };
  tomorrowNight: { fixedTime: string };
  weekend: { dow: DayOfWeek; time: string };
  endOfMonth: { mode: 'fixed' | 'lastDay' | 'lastDow'; day: number; dow: DayOfWeek };
  nextWeek: { dow: DayOfWeek; time: string };
  nextMonth: { day: number; time: string };
  
  // 抽出・統合・完了タスクの設定項目
  deletePastCompleted: boolean;     // 過去の完了タスクは削除する
  deleteFutureCompleted: boolean;   // 将来の完了タスクは削除する
  memoDaysBefore: number;           // □MEMO抽出範囲（〇日前）
  memoDaysAfter: number;            // □MEMO抽出範囲（〇日後）
  mergeDaysBefore: number;          // タスクをまとめる範囲（〇日前）
  mergeDaysAfter: number;           // タスクをまとめる範囲（〇日後）
}

export const DEFAULT_TIME_SETTINGS: TimeSettings = {
  today: { mode: 'relative', relativeMinutes: 60, fixedTime: '09:00' },
  tomorrow: { mode: 'fixed', fixedTime: '09:00' },
  tonight: { fixedTime: '20:00' },
  tomorrowNight: { fixedTime: '20:00' },
  weekend: { dow: '土', time: '12:00' },
  endOfMonth: { mode: 'lastDay', day: 25, dow: '金' },
  nextWeek: { dow: '月', time: '09:00' },
  nextMonth: { day: 1, time: '09:00' },
  
  deletePastCompleted: false,
  deleteFutureCompleted: false,
  memoDaysBefore: 0,
  memoDaysAfter: 7,
  mergeDaysBefore: 0,
  mergeDaysAfter: 7,
};

export function loadSettings(): TimeSettings {
  const stored = localStorage.getItem('calendar_time_settings');
  if (!stored) return DEFAULT_TIME_SETTINGS;
  try {
    return { ...DEFAULT_TIME_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_TIME_SETTINGS;
  }
}

export function saveSettings(settings: TimeSettings): void {
  localStorage.setItem('calendar_time_settings', JSON.stringify(settings));
}