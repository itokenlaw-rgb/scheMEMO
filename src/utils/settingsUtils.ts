// src/utils/settingsUtils.ts
import type { TimeOption } from '../types';
import type { TimeSettings } from '../types/settings';
import { loadSettings } from '../types/settings';
import { startOfDay, addDays, endOfDay, addWeeks, addMonths } from 'date-fns';

/** 直近の土曜日（今日が土曜ならその日）を返す */
function nextOrThisSaturday(from: Date): Date {
  const d = new Date(from);
  const dow = d.getDay(); // 0=日 … 6=土
  const diff = dow === 6 ? 0 : 6 - dow;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff)); // 今日が土曜なら翌週土曜
  return d;
}

export function calculateEventTimeWithSettings(
  option: TimeOption,
  settings: TimeSettings = loadSettings()
): { start: Date; end: Date } {
  const now = new Date();

  switch (option) {
    case 'today': {
      const start = new Date(now);
      start.setHours(settings.quickMemoSaveHour, 0, 0, 0);
      return { start, end: endOfDay(now) };
    }

    case 'tonight': {
      const start = new Date(now);
      start.setHours(settings.preset2TodayHour, 0, 0, 0);
      return { start, end: endOfDay(now) };
    }

    case 'tomorrow': {
      const base = addDays(now, 1);
      const start = new Date(base);
      start.setHours(settings.preset3TomorrowHour, 0, 0, 0);
      return { start, end: endOfDay(base) };
    }

    case 'tomorrowNight': {
      const base = addDays(now, 1);
      const start = new Date(base);
      start.setHours(settings.preset4TomorrowNightHour, 0, 0, 0);
      return { start, end: endOfDay(base) };
    }

    case 'weekend': {
      const sat = nextOrThisSaturday(now);
      const start = new Date(sat);
      start.setHours(settings.preset6SaturdayHour, 0, 0, 0);
      return { start, end: endOfDay(sat) };
    }

    case 'endOfMonth': {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfDay(lastDay), end: endOfDay(lastDay) };
    }

    case 'nextWeek': {
      const base = addWeeks(startOfDay(now), 1);
      return { start: base, end: endOfDay(base) };
    }

    case 'nextMonth': {
      const base = addMonths(startOfDay(now), 1);
      return { start: base, end: endOfDay(base) };
    }

    default:
      return { start: now, end: endOfDay(now) };
  }
}
