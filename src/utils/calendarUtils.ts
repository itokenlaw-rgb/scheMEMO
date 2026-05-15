import { addHours, addDays, nextFriday, endOfMonth, setHours, setMinutes, startOfDay, addWeeks, addMonths } from 'date-fns';
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
