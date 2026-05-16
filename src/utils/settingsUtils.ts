// src/utils/settingsUtils.ts
import type { TimeOption } from '../types';
import type { TimeSettings } from '../types/settings';
import { loadSettings } from '../types/settings';
import { startOfDay, addDays, endOfDay, addWeeks, addMonths } from 'date-fns'; // ✅ 不要なインポートを削除

function parseTime(t: string): { h: number; m: number } {
  if (!t || !t.includes(':')) return { h: 9, m: 0 };
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

function withTime(date: Date, time: string): Date {
  const d = new Date(date);
  const { h, m } = parseTime(time);
  d.setHours(h, m, 0, 0);
  return d;
}

export function calculateEventTimeWithSettings(
  option: TimeOption,
  settings: TimeSettings = loadSettings()
): { start: Date; end: Date } {
  const now = new Date();

  switch (option) {
    case 'today': {
      const s = settings.today;
      let start = new Date(now);
      if (s.mode === 'relative') {
        const offset = s.relativeMinutes ?? 60;
        start = new Date(now.getTime() + offset * 60 * 1000);
      } else {
        start = withTime(now, s.fixedTime);
      }
      return { start, end: endOfDay(now) };
    }

    case 'tonight': {
      const s = settings.tonight;
      return {
        start: withTime(now, s.fixedTime),
        end: endOfDay(now),
      };
    }

    case 'tomorrow': {
      const s = settings.tomorrow;
      const base = addDays(now, 1);
      return {
        start: withTime(base, s.fixedTime),
        end: endOfDay(base),
      };
    }

    case 'tomorrowNight': {
      const s = settings.tomorrowNight;
      const base = addDays(now, 1);
      return {
        start: withTime(base, s.fixedTime),
        end: endOfDay(base),
      };
    }

    case 'weekend': {
      const s = settings.weekend;
      const targetDow = s.dow === '日' ? 0 : 6;
      const d = new Date(now);
      const diff = ((targetDow - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      return {
        start: withTime(d, s.time),
        end: endOfDay(d),
      };
    }

    case 'endOfMonth': {
      const s = settings.endOfMonth;
      let target = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      if (s.mode === 'fixed') {
        const day = Math.min(s.day, target.getDate());
        target = new Date(now.getFullYear(), now.getMonth(), day);
      } else if (s.mode === 'lastDow') {
        const dows: Record<string, number> = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
        const targetDow = dows[s.dow] ?? 5;
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const diff = (last.getDay() - targetDow + 7) % 7;
        last.setDate(last.getDate() - diff);
        target = last;
      }
      return { start: startOfDay(target), end: endOfDay(target) };
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