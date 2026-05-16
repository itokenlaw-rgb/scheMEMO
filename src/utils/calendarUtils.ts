import { addHours, addDays, nextFriday, endOfMonth, setHours, setMinutes, startOfDay, addWeeks, addMonths, isAfter, isBefore } from 'date-fns';
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
 * 今日から1週間以内の未完了メモ（タイトルが「□」から始まるもの）をスキャンして
 * 本日の21時配置の1つの「□ MEMO」イベントに統合するためのオブジェクトを生成します。
 */
export const consolidateWeeklyMemos = (events: CalendarEvent[]): { mergedEvent: CalendarEvent; targetIds: string[] } => {
  const now = new Date();
  const oneWeekLater = addDays(startOfDay(now), 7);
  const startOfToday = startOfDay(now);

  const targetIds: string[] = [];
  const combinedItems: BatchItem[] = [];

  // 今日から7日以内のイベントを精査
  events.forEach((event) => {
    const eventDate = new Date(event.start);
    // 日付が今日以降かつ1週間以内
    const isInRange = (eventDate >= startOfToday || isAfter(eventDate, startOfToday)) && isBefore(eventDate, oneWeekLater);
    
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