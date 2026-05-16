// src/types/settings.ts

export type DayOfWeek = '月' | '火' | '水' | '木' | '金' | '土' | '日';

export interface TimeSettings {
  today: { time: string };
  tomorrow: { time: string };
  tonight: { time: string };
  tomorrowNight: { time: string };
  weekend: { mode: 'fri_18' | 'sat_am'; time: string };
  endOfMonth: { mode: 'fixed' | 'lastDay' | 'lastDow'; day: number; dow: DayOfWeek; time: string };
  nextWeek: { dow: DayOfWeek; time: string };
  nextMonth: { day: number; time: string };
  
  // 【新設項目】
  deletePastCompleted: boolean;     // 過去の完了タスクは削除する
  deleteFutureCompleted: boolean;   // 将来の完了タスクは削除する
  memoDaysBefore: number;           // □MEMO抽出範囲（〇日前）
  memoDaysAfter: number;            // □MEMO抽出範囲（〇日後）
  mergeDaysBefore: number;          // タスクをまとめる範囲（〇日前）
  mergeDaysAfter: number;           // タスクをまとめる範囲（〇日後）
}

export const DEFAULT_TIME_SETTINGS: TimeSettings = {
  today: { time: '11:00' },
  tomorrow: { time: '11:00' },
  tonight: { time: '20:00' },
  tomorrowNight: { time: '20:00' },
  weekend: { mode: 'fri_18', time: '18:00' },
  endOfMonth: { mode: 'lastDay', day: 25, dow: '金', time: '11:00' },
  nextWeek: { dow: '月', time: '09:00' },
  nextMonth: { day: 1, time: '09:00' },
  
  // 初期値
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