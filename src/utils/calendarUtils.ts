// src/utils/calendarUtils.ts
import { addHours, addDays, subDays, nextFriday, endOfMonth, setHours, setMinutes, startOfDay, endOfDay, addWeeks, addMonths, isAfter, isBefore } from 'date-fns';
import type { TimeOption, CalendarEvent, BatchItem, EventStatus } from '../types';
import type { TimeSettings } from '../types/settings';

export const calculateEventTime = (option: TimeOption, baseDate: Date = new Date()): { start: Date, end: Date } => {
  let start = new Date(baseDate);
  
  switch (option) {
    case 'today':
      start = addHours(start, 1);
      break;
    case 'tomorrow':
      start = addDays(start, 1);
      start = addHours(start, 1);
      break;
    case 'tonight':
      start = setHours(setMinutes(start, 0), 20);
      if (start < new Date()) {
          start = addDays(start, 1);
      }
      break;
    case 'tomorrowNight':
      start = addDays(start, 1);
      start = setHours(setMinutes(start, 0), 20);
      break;
    case 'weekend':
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

  const minutes = start.getMinutes();
  if (minutes > 0 && minutes <= 30) {
    start = setMinutes(start, 30);
  } else if (minutes > 30) {
    start = addHours(setMinutes(start, 0), 1);
  }

  const end = new Date(start.getTime() + 30 * 60000);
  return { start, end };
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
 * 設定された条件に基づき、指定の日付範囲から「□MEMO」で始まるタスクを抽出し、
 * 1つの仮想的なバッチイベントオブジェクトを生成して BatchEditor に渡します。
 */
export const extractMemosFromSettingsRange = (
  events: CalendarEvent[],
  settings: TimeSettings,
  baseDate: Date = new Date()
): CalendarEvent => {
  const daysBefore = settings.memoDaysBefore ?? 0;
  const daysAfter = settings.memoDaysAfter ?? 7;

  const startRange = startOfDay(subDays(baseDate, daysBefore));
  const endRange = endOfDay(addDays(baseDate, daysAfter));
  const now = new Date();

  const combinedItems: BatchItem[] = [];

  events.forEach(event => {
    const eventStart = new Date(event.start);

    if (eventStart >= startRange && eventStart <= endRange) {
      const isTargetTitle = event.title.startsWith('□MEMO') || 
                            event.title.startsWith('□ MEMO') || 
                            event.title.startsWith('□') || 
                            event.title.startsWith('☑');

      if (isTargetTitle) {
        const isPast = eventStart < startOfDay(now);

        if (event.isBatch && event.memo) {
          const items = parseBatchMemo(event.memo);
          items.forEach(item => {
            if (item.checked) {
              if (isPast && settings.deletePastCompleted) return;
              if (!isPast && settings.deleteFutureCompleted) return;
            }
            combinedItems.push({
              id: `ext-${Date.now()}-${Math.random()}`,
              text: item.text,
              checked: item.checked
            });
          });
        } else {
          const taskText = event.title.replace(/^[□☑]\s*(MEMO)?\s*/, '').trim();
          const isChecked = event.status === 'checked';

          if (taskText) {
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

  const uniqueItems: BatchItem[] = [];
  const seenTexts = new Set<string>();
  combinedItems.forEach(item => {
    if (!seenTexts.has(item.text)) {
      seenTexts.add(item.text);
      uniqueItems.push(item);
    }
  });

  return {
    id: 'evt-extracted-memo-summary',
    title: '□ MEMO',
    start: new Date(),
    end: new Date(),
    memo: stringifyBatchMemo(uniqueItems),
    status: determineBatchStatus(uniqueItems),
    isBatch: true
  };
};

/**
 * タスクをまとめる旧関数 (互換性のために残します)
 */
export const consolidateWeeklyMemos = (
  events: CalendarEvent[],
  daysBefore: number = 0,
  daysAfter: number = 7
): { mergedEvent: CalendarEvent; targetIds: string[] } => {
  const now = new Date();
  const startRange = startOfDay(subDays(now, daysBefore));
  const endRange = startOfDay(addDays(now, daysAfter + 1));

  const targetIds: string[] = [];
  const combinedItems: BatchItem[] = [];

  events.forEach((event) => {
    const eventDate = new Date(event.start);
    const isInRange = (eventDate >= startRange || isAfter(eventDate, startRange)) && isBefore(eventDate, endRange);
    
    if (isInRange && event.title.trim().startsWith('□')) {
      targetIds.push(event.id);

      if (event.isBatch) {
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

  const uniqueItems: BatchItem[] = [];
  const seenTexts = new Set<string>();
  combinedItems.forEach(item => {
    if (!seenTexts.has(item.text)) {
      seenTexts.add(item.text);
      uniqueItems.push(item);
    }
  });

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

let mockEvents: CalendarEvent[] = [];
export const getMockEvents = () => mockEvents;
export const addMockEvent = (e: CalendarEvent) => { mockEvents = [...mockEvents, e]; };
export const updateMockEvent = (updated: CalendarEvent) => {
  mockEvents = mockEvents.map(e => e.id === updated.id ? updated : e);
};
export const deleteMockEvent = (id: string) => {
  mockEvents = mockEvents.filter(e => e.id !== id);
};