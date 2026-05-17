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
      start = setHours(setMinutes(start, 0), 18);\n      break;
    case 'endOfMonth':
      start = endOfMonth(start);\n      start = setHours(setMinutes(start, 0), 18);\n      break;
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

export const extractMemosFromSettingsRange = (events: CalendarEvent[], _settings: TimeSettings): CalendarEvent[] => {
  return events.filter(e => e.isBatch);
};

export const consolidateWeeklyMemos = (events: CalendarEvent[]): { mergedEvent: CalendarEvent; targetIds: string[] } => {
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
    isBatch: true // 💡 確実にバッチフラグを立てる
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