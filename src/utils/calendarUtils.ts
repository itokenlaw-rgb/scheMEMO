// src/utils/calendarUtils.ts
import { addHours, addDays, subDays, nextFriday, endOfMonth, setHours, setMinutes, startOfDay, endOfDay, addWeeks, addMonths } from 'date-fns';
import type { TimeOption, CalendarEvent, BatchItem, EventStatus } from '../types';

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
      break;
    case 'nextMonth':
      start = addMonths(start, 1);
      break;
  }
  return { start, end: addHours(start, 1) };
};

export const parseBatchMemo = (memo: string | undefined): BatchItem[] => {
  if (!memo) return [];
  return memo.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, index) => {
      const checked = line.startsWith('☑');
      return {
        id: `item-${Date.now()}-${index}`,
        text: line,
        checked
      };
    });
};

export const stringifyBatchMemo = (items: BatchItem[]): string => {
  return items.map(item => item.text).join('\n');
};

export const determineBatchStatus = (items: BatchItem[]): EventStatus => {
  if (items.length === 0) return 'unchecked';
  const checkedCount = items.filter(i => i.checked).length;
  if (checkedCount === 0) return 'unchecked';
  if (checkedCount === items.length) return 'checked';
  return 'partial';
};

export const getBatchTitlePrefix = (status: EventStatus): string => {
  switch (status) {
    case 'checked': return '☑';
    case 'partial': return '△';
    default: return '□';
  }
};

// □MEMOの抽出範囲（isBatch かつ status が unchecked）から対象イベントを返す
export const extractUncheckedMemoEvents = (events: CalendarEvent[], settings: any): CalendarEvent[] => {
  const before = settings?.mergeDaysBefore ?? 7;
  const after = settings?.mergeDaysAfter ?? 7;
  const now = new Date();
  const rangeStart = startOfDay(subDays(now, before));
  const rangeEnd = endOfDay(addDays(now, after));

  return events
    .filter(e => {
      if (!e.isBatch) return false;
      // タイトルが □ で始まる（未完了MEMO）のみ
      if (!/^□/.test(e.title)) return false;
      const d = new Date(e.start);
      return d >= rangeStart && d <= rangeEnd;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
};

export const extractMemosFromSettingsRange = (events: CalendarEvent[], settings: any): CalendarEvent[] => {
  return extractUncheckedMemoEvents(events, settings);
};

// 一番古い □MEMO を返す
export const getOldestMemoEvent = (events: CalendarEvent[], settings: any): CalendarEvent | null => {
  const memos = extractUncheckedMemoEvents(events, settings);
  return memos.length > 0 ? memos[0] : null;
};

// 一番新しい □MEMO を返す
export const getNewestMemoEvent = (events: CalendarEvent[], settings: any): CalendarEvent | null => {
  const memos = extractUncheckedMemoEvents(events, settings);
  return memos.length > 0 ? memos[memos.length - 1] : null;
};

// 範囲内の □MEMO をすべて1つに集約（☑タスクも含む、古い順に並べる）
export const collectAllMemosInRange = (events: CalendarEvent[], settings: any): CalendarEvent => {
  const memos = extractUncheckedMemoEvents(events, settings);

  const allLines: string[] = [];
  memos.forEach(event => {
    if (event.memo) {
      event.memo.split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)
        .forEach((l: string) => allLines.push(l));
    }
  });

  const start = setHours(setMinutes(new Date(), 0), 21);
  const end = setHours(setMinutes(new Date(), 0), 22);

  return {
    id: `evt-${Date.now()}-collected`,
    title: '□MEMO',
    start,
    end,
    memo: allLines.join('\n'),
    status: 'unchecked',
    isBatch: true,
  };
};

export const consolidateWeeklyMemos = (events: CalendarEvent[], _before?: number, _after?: number): { mergedEvent: CalendarEvent; targetIds: string[] } => {
  const targetIds: string[] = [];
  const combinedItems: BatchItem[] = [];

  const now = new Date();
  const startOfWeekDate = startOfDay(subDays(now, now.getDay() - 1));
  const endOfWeekDate = endOfDay(addDays(startOfWeekDate, 6));

  events.forEach(event => {
    const eventDate = new Date(event.start);
    if (eventDate >= startOfWeekDate && eventDate <= endOfWeekDate) {
      targetIds.push(event.id);
      if (event.isBatch && event.memo) {
        const items = parseBatchMemo(event.memo);
        items.forEach(item => {
          if (item.text.trim()) {
            combinedItems.push({
              id: `item-${Date.now()}-${combinedItems.length}`,
              text: item.text.trim(),
              checked: false
            });
          }
        });
      } else {
        const taskText = event.title.replace(/^[□☑△]\s*/, '').trim();
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