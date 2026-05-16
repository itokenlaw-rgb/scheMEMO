// src/utils/settingsUtils.ts
// calculateEventTime の設定対応版
// 既存の calendarUtils.ts の calculateEventTime をこちらに差し替える

import type { TimeOption } from '../types';
import type { TimeSettings, DayOfWeek } from '../types/settings';
import { loadSettings } from '../types/settings';

// 曜日文字 → JS getDay() インデックス (0=日, 1=月, ..., 6=土)
const DOW_INDEX: Record<DayOfWeek, number> = {
  '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6,
};

/** "HH:MM" を時・分に分解 */
function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

/** dateに時刻を設定した新しいDateを返す */
function withTime(date: Date, time: string): Date {
  const d = new Date(date);
  const { h, m } = parseTime(time);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 当日末 (23:59) */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

/** n分後 */
function addMinutes(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 60 * 1000);
}

/** 翌日の Date を返す */
function nextDay(base: Date, offsetDays = 1): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/** 指定した曜日インデックスの次の日付（today含まない） */
function nextDowAfter(base: Date, targetDow: number): Date {
  const d = new Date(base);
  const diff = ((targetDow - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** 月末 (固定日 or 末日) を返す */
function getEndOfMonth(base: Date, day: number | 'last'): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + 1, 0); // 月の最終日
  if (day === 'last') return d;
  // 指定日 > 最終日なら最終日にクランプ
  const clamped = Math.min(day, d.getDate());
  return new Date(base.getFullYear(), base.getMonth(), clamped);
}

/** 月の最後の指定曜日を返す */
function lastDowOfMonth(base: Date, dow: DayOfWeek): Date {
  const target = DOW_INDEX[dow];
  // 月の最終日から後ろ向きに探す
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const diff = (last.getDay() - target + 7) % 7;
  const d = new Date(last);
  d.setDate(d.getDate() - diff);
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
      let start: Date;
      let end: Date;
      if (s.mode === 'eod') {
        start = new Date(now);
        end = endOfDay(now);
      } else if (s.mode === 'minutes') {
        start = new Date(now);
        end = addMinutes(now, s.minutes);
      } else {
        start = withTime(now, s.time);
        end = endOfDay(now);
      }
      return { start, end };
    }

    case 'tonight': {
      const s = settings.tonight;
      return {
        start: withTime(now, s.startTime),
        end: withTime(now, s.endTime),
      };
    }

    case 'tomorrow': {
      const s = settings.tomorrow;
      let base = nextDay(now);

      if (s.mode === 'skipDow') {
        const skipIdx = DOW_INDEX[s.skipFrom];
        if (base.getDay() === skipIdx) {
          base = nextDowAfter(base, DOW_INDEX[s.skipTo]);
        }
      }

      let start: Date;
      let end: Date;
      if (s.mode === 'same') {
        start = new Date(base);
        start.setHours(now.getHours(), now.getMinutes(), 0, 0);
        end = endOfDay(base);
      } else if (s.mode === 'time') {
        start = withTime(base, s.time);
        end = endOfDay(base);
      } else {
        // skipDow: 同じ時間を引き継ぐ
        start = new Date(base);
        start.setHours(now.getHours(), now.getMinutes(), 0, 0);
        end = endOfDay(base);
      }
      return { start, end };
    }

    case 'tomorrowNight': {
      const s = settings.tomorrowNight;
      let base = nextDay(now);

      if (s.mode === 'skipDow') {
        const skipIdx = DOW_INDEX[s.skipFrom];
        if (base.getDay() === skipIdx) {
          base = nextDowAfter(base, DOW_INDEX[s.skipTo]);
        }
      }

      return {
        start: withTime(base, s.startTime),
        end: withTime(base, s.endTime),
      };
    }

    case 'weekend': {
      const s = settings.weekend;
      let target: Date;
      if (s.dow === '土') {
        target = nextDowAfter(now, 6);
      } else if (s.dow === '日') {
        target = nextDowAfter(now, 0);
      } else {
        // either: 直近の土か日
        const sat = nextDowAfter(now, 6);
        const sun = nextDowAfter(now, 0);
        target = sat < sun ? sat : sun;
      }

      if (s.time === 'allday') {
        return { start: target, end: endOfDay(target) };
      }
      return {
        start: withTime(target, s.time),
        end: endOfDay(target),
      };
    }

    case 'endOfMonth': {
      const s = settings.endOfMonth;
      let target: Date;
      if (s.mode === 'fixed') {
        target = getEndOfMonth(now, s.day);
      } else if (s.mode === 'lastDay') {
        target = getEndOfMonth(now, 'last');
      } else {
        target = lastDowOfMonth(now, s.dow);
      }
      // 既に過去なら翌月で再計算
      if (target < now) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        if (s.mode === 'fixed') {
          target = getEndOfMonth(nextMonth, s.day);
        } else if (s.mode === 'lastDay') {
          target = getEndOfMonth(nextMonth, 'last');
        } else {
          target = lastDowOfMonth(nextMonth, s.dow);
        }
      }
      return { start: target, end: endOfDay(target) };
    }

    case 'nextWeek': {
      const base = nextDowAfter(now, 1); // 次の月曜
      return { start: base, end: endOfDay(base) };
    }

    case 'nextMonth': {
      const base = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: base, end: endOfDay(base) };
    }

    default:
      return { start: now, end: endOfDay(now) };
  }
}
