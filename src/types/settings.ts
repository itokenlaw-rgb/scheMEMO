// src/types/settings.ts

export type DayOfWeek = '月' | '火' | '水' | '木' | '金' | '土' | '日';

export interface TodaySettings {
  mode: 'eod' | 'minutes' | 'time';
  minutes: 30 | 60 | 90 | 120 | 180;
  time: string; // "HH:MM"
}

export interface TonightSettings {
  startTime: string; // "HH:MM"
  endTime: string;
}

export interface TomorrowSettings {
  mode: 'same' | 'time' | 'skipDow';
  time: string;
  skipFrom: DayOfWeek;
  skipTo: DayOfWeek;
}

export interface TomorrowNightSettings {
  mode: 'time' | 'skipDow';
  startTime: string;
  endTime: string;
  skipFrom: DayOfWeek;
  skipTo: DayOfWeek;
}

export interface WeekendSettings {
  dow: '土' | '日' | 'either';
  time: string; // "HH:MM" or "allday"
}

export interface EndOfMonthSettings {
  mode: 'fixed' | 'lastDay' | 'lastDow';
  day: number | 'last'; // 25–31 or 'last'
  dow: DayOfWeek;
}

export interface TimeSettings {
  today: TodaySettings;
  tonight: TonightSettings;
  tomorrow: TomorrowSettings;
  tomorrowNight: TomorrowNightSettings;
  weekend: WeekendSettings;
  endOfMonth: EndOfMonthSettings;
}

export const DEFAULT_TIME_SETTINGS: TimeSettings = {
  today: {
    mode: 'eod',
    minutes: 60,
    time: '18:00',
  },
  tonight: {
    startTime: '20:00',
    endTime: '23:00',
  },
  tomorrow: {
    mode: 'same',
    time: '13:00',
    skipFrom: '土',
    skipTo: '月',
  },
  tomorrowNight: {
    mode: 'time',
    startTime: '20:00',
    endTime: '23:00',
    skipFrom: '土',
    skipTo: '月',
  },
  weekend: {
    dow: '土',
    time: '10:00',
  },
  endOfMonth: {
    mode: 'fixed',
    day: 29,
    dow: '金',
  },
};

const SETTINGS_STORAGE_KEY = 'scheMEMO_timeSettings';

export function loadSettings(): TimeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_TIME_SETTINGS;
    return { ...DEFAULT_TIME_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TIME_SETTINGS;
  }
}

export function saveSettings(settings: TimeSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
