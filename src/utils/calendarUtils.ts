import { addHours, addDays, subDays, nextFriday, endOfMonth, setHours, setMinutes, startOfDay, addWeeks, addMonths, isAfter, isBefore } from 'date-fns';
import type { TimeOption, CalendarEvent, BatchItem, EventStatus } from '../types';

export const calculateEventTime = (option: TimeOption, baseDate: Date = new Date()): { start: Date, end: Date } => {
  let start = new Date(baseDate);
  
  switch (option) {
    case 'today':
      // 1 hour later
      start = addHours(start, 1);
      break;
    case 'tomorrow':
      start = addDays(start, 1);
      start = addHours(start, 1);
      break;
    case 'tonight':
      // Today at 20:00
      start = setHours(setMinutes(start, 0), 20);
      if (start < new Date()) {
          start = addDays(start, 1); // fallback to tomorrow if it's past 20:00
      }
      break;
    case 'tomorrowNight':
      // Tomorrow at 20:00
      start = addDays(start, 1);
      start = setHours(setMinutes(start, 0), 20);
      break;
    case 'weekend':
      // Next Friday 18:00
      start = nextFriday(startOfDay(start));
      start = setHours(setMinutes(start, 0), 18);
      break;
    case 'endOfMonth':
      start = endOfMonth(start);
      start = setHours(setMinutes(start, 0), 18);
      break;
    case 'nextWeek':
      start = addWeeks(start, 1);
      start = setHours(setMinutes(start, 0), 9);
      break;
    case 'nextMonth':
      start = addMonths(start, 1);
      start = setHours(setMinutes(start, 0), 9);
      break;
    default:
      start = addHours(start, 1);
  }

  // Round to nearest 30 mins for cleaner look
  const minutes = start.getMinutes();
  if (minutes > 0 && minutes <= 30) {
    start = setMinutes(start, 30);
  } else if (minutes > 30) {
    start = addHours(setMinutes(start, 0), 1);
  }

  const end = addMinutes(start, 30);
  return { start, end };
};

const addMinutes = (date: Date, minutes: number) => {
  return new Date(date.getTime() + minutes * 60000);
};

export const parseBatchMemo = (memo: string): BatchItem[] => {
  if (!memo) return [];
  const lines = memo.split('\n').filter(line => line.trim() !== '');
  return lines.map((line, i) => {
    const isChecked = line.startsWith('☑');
    const text = line.replace(/^[□☑]\s*/, '');
    return {
      id: `item-${Date.now()}-${i}`,
      text,
      checked: isChecked
    };
  });
};

export const stringifyBatchMemo = (items: BatchItem[]): string => {
  return items.map(item => `${item.checked ? '☑' : '□'} ${item.text}`).join('\n');
};

export const determineBatchStatus = (items: BatchItem[]): EventStatus => {
  if (items.length === 0) return 'unchecked';
  const checkedCount = items.filter(i => i.checked).length;
  if (checkedCount === 0) return 'unchecked';
  if (checkedCount === items.length) return 'checked';
  return 'partial';
};

export const getBatchTitlePrefix = (status: EventStatus) => {
  if (status === 'checked') return '☑';
  if (status === 'partial') return '△';
  return '□';
};

/**
 * 指定された「〇日前から〇日後まで」の未完了メモ（タイトルが「□」から始まるもの）をスキャンして
 * 本日の21時配置の1つの「□ MEMO」イベントに統合するためのオブジェクトを生成します。
 */
export const consolidateWeeklyMemos = (
  events: CalendarEvent[],
  daysBefore: number = 0,
  daysAfter: number = 7
): { mergedEvent: CalendarEvent; targetIds: string[] } => {
  const now = new Date();
  const startRange = startOfDay(subDays(now, daysBefore)); // 〇日前の00:00
  const endRange = startOfDay(addDays(now, daysAfter + 1)); // 〇日後の23:59までを含めるため、+1日してその日の00:00未満を条件にする

  const targetIds: string[] = [];
  const combinedItems: BatchItem[] = [];

  events.forEach((event) => {
    const eventDate = new Date(event.start);
    // 指定した期間内にあるか判定
    const isInRange = (eventDate >= startRange || isAfter(eventDate, startRange)) && isBefore(eventDate, endRange);
    
    // かつ、タイトルが「□」から始まる未完了メモが対象
    if (isInRange && event.title.trim().startsWith('□')) {
      targetIds.push(event.id);

      if (event.isBatch) {
        // バッチ予定の場合はメモ欄を解析して、未完了のものだけを抽出
        const parsedItems = parseBatchMemo(event.memo);
        parsedItems.forEach(item => {
          if (!item.checked && item.text.trim() !== '') {
            combinedItems.push({
              id: `item-${Date.now()}-${combinedItems.length}`,
              text: item.text.trim(),
              checked: false
            });
          }
        });
      } else {
        // シングル予定の場合はタイトルからタスク文字列を抽出
        const taskText = event.title.replace(/^□\s*/, '').trim();
        if (taskText) {
          combinedItems.push({
            id: `item-${Date.now()}-${combinedItems.length}`,
            text: taskText,
            checked: false
          });
        }
      }
    }
  });

  // 重複した表現（やることテキスト）を排除して綺麗にする
  const uniqueItems: BatchItem[] = [];
  const seenTexts = new Set<string>();
  combinedItems.forEach(item => {
    if (!seenTexts.has(item.text)) {
      seenTexts.add(item.text);
      uniqueItems.push(item);
    }
  });

  // 統合後の「□ MEMO」の時間を本日21:00〜21:30に設定
  const start = setHours(setMinutes(new Date(), 0), 21);
  const end = setHours(setMinutes(new Date(), 30), 21);

  const mergedEvent: CalendarEvent = {
    id: `evt-${Date.now()}-merged`,
    title: '□ MEMO',
    start,
    end,
    memo: stringifyBatchMemo(uniqueItems),
    status: 'unchecked',
    isBatch: true
  };

  return { mergedEvent, targetIds };
};

// Mock Google Calendar state
let mockEvents: CalendarEvent[] = [];

export const getMockEvents = () => mockEvents;
export const addMockEvent = (e: CalendarEvent) => { mockEvents = [...mockEvents, e]; };
export const updateMockEvent = (updated: CalendarEvent) => {
  mockEvents = mockEvents.map(e => e.id === updated.id ? updated : e);
};
export const deleteMockEvent = (id: string) => {
  mockEvents = mockEvents.filter(e => e.id !== id);
};

// src/utils/calendarUtils.ts (末尾などに追記)

import { subDays, addDays, startOfDay, endOfDay } from 'date-fns';
import type { CalendarEvent, BatchItem } from '../types';
import type { TimeSettings } from '../types/settings';

/**
 * 設定された条件に基づき、指定の日付範囲から「□MEMO」で始まるタスクを抽出し、
 * 1つの仮想的なバッチイベントオブジェクトを生成します。
 */
export const extractMemosFromSettingsRange = (
  events: CalendarEvent[],
  settings: TimeSettings,
  baseDate: Date = new Date()
): CalendarEvent => {
  const daysBefore = settings.memoDaysBefore ?? 0;
  const daysAfter = settings.memoDaysAfter ?? 7;

  // 抽出対象の開始日時・終了日時
  const startRange = startOfDay(subDays(baseDate, daysBefore));
  const endRange = endOfDay(addDays(baseDate, daysAfter));
  const now = new Date();

  const combinedItems: BatchItem[] = [];

  events.forEach(event => {
    const eventStart = new Date(event.start);

    // 1. 日付範囲内かチェック
    if (eventStart >= startRange && eventStart <= endRange) {
      // 2. タイトルが「□MEMO」または「□」「☑」等で始まるか
      const isTargetTitle = event.title.startsWith('□MEMO') || 
                            event.title.startsWith('□ MEMO') || 
                            event.title.startsWith('□') || 
                            event.title.startsWith('☑');

      if (isTargetTitle) {
        const isPast = eventStart < startOfDay(now);

        if (event.isBatch && event.memo) {
          // バッチ予定のパース
          const items = parseBatchMemo(event.memo);
          items.forEach(item => {
            // 【１】完了タスクの削除条件チェック
            if (item.checked) {
              if (isPast && settings.deletePastCompleted) return;    // 過去の完了タスクをスキップ
              if (!isPast && settings.deleteFutureCompleted) return;  // 将来の完了タスクをスキップ
            }
            combinedItems.push({
              id: `ext-${Date.now()}-${Math.random()}`,
              text: item.text,
              checked: item.checked
            });
          });
        } else {
          // シングル予定のパース
          const taskText = event.title.replace(/^[□☑]\s*(MEMO)?\s*/, '').trim();
          const isChecked = event.status === 'checked';

          if (taskText) {
            // 【１】完了タスクの削除条件チェック
            if (isChecked) {
              if (isPast && settings.deletePastCompleted) return;
              if (!isPast && settings.deleteFutureCompleted) return;
            }
            combinedItems.push({
              id: `ext-${Date.now()}-${Math.random()}`,
              text: taskText,
              checked: isChecked
            });
          }
        }
      }
    }
  });

  // テキストの重複を排除して綺麗にする
  const uniqueItems: BatchItem[] = [];
  const seenTexts = new Set<string>();
  combinedItems.forEach(item => {
    if (!seenTexts.has(item.text)) {
      seenTexts.add(item.text);
      uniqueItems.push(item);
    }
  });

  // BatchEditorへそのまま渡せる「まとめ用」の仮想バッチオブジェクト
  return {
    id: 'evt-extracted-memo-summary', // 新規、または上書き用の仮ID
    title: '□ MEMO',
    start: new Date(),
    end: new Date(),
    memo: stringifyBatchMemo(uniqueItems),
    status: determineBatchStatus(uniqueItems),
    isBatch: true
  };
};