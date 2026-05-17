// src/components/CalendarView.tsx
import React, { useState, useRef, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { CalendarEvent } from '../types';

const locales = { 'ja': ja };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface CalendarViewProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

const CustomEvent: React.FC<{ event: CalendarEvent }> = ({ event }) => (
  <div
    className={`custom-event-content ${event.status}`}
    style={{ height: '100%', width: '100%', padding: '2px 4px' }}
  >
    <span style={{ fontWeight: 600 }}>{event.title}</span>
  </div>
);

interface EventPopupProps {
  event: CalendarEvent;
  onClose: () => void;
}

const EventPopup: React.FC<EventPopupProps> = ({ event, onClose }) => (
  <div className="event-popup-overlay" onClick={onClose}>
    <div className="event-popup" onClick={(e) => e.stopPropagation()}>
      <button className="event-popup-close" onClick={onClose} aria-label="閉じる">×</button>
      <div className="event-popup-title">{event.title}</div>
      {event.memo
        ? <div className="event-popup-memo">{event.memo}</div>
        : <div className="event-popup-empty">内容なし</div>
      }
    </div>
  </div>
);

interface DragHandleProps {
  position: 'top' | 'bottom';
  onDrag: (deltaY: number) => void;
}

const DragHandle: React.FC<DragHandleProps> = ({ position, onDrag }) => {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastY.current = e.clientY;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientY - lastY.current;
      lastY.current = ev.clientY;
      onDrag(position === 'top' ? -delta : delta);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [position, onDrag]);

  return (
    <div className="calendar-resize-handle" onMouseDown={onMouseDown} />
  );
};

const MIN_HEIGHT = 300;
const MAX_HEIGHT = 900;
const DEFAULT_HEIGHT = 650; // 💡 縦長表示（全体的に大きく）

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  const [calHeight, setCalHeight] = useState(DEFAULT_HEIGHT);
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null);

  const handleDrag = useCallback((delta: number) => {
    setCalHeight(h => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h + delta)));
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // 💡 タイトルから記号やスペースを除去して「MEMO」が含まれるか、または isBatch フラグで確実に判定
    const cleanTitle = (event.title || '').replace(/\s+/g, '').toUpperCase();
    const isMemo = event.isBatch || cleanTitle.includes('MEMO');
    
    if (isMemo) {
      setPopupEvent(event);   // 前面ポップアップを表示
      onSelectEvent(event);   // BatchEditorへ確実に抽出連動させる
      return;
    }
    
    // 通常予定の場合
    setPopupEvent(event);
  }, [onSelectEvent]);

  return (
    <div className="calendar-resizable-wrapper">
      <DragHandle position="top" onDrag={handleDrag} />
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="ja"
        defaultView={Views.MONTH}
        views={[Views.MONTH]}
        onSelectEvent={handleSelectEvent}
        components={{ event: CustomEvent }}
        style={{ height: calHeight }}
        eventPropGetter={(event: CalendarEvent) => {
          let className = '';
          if (event.status === 'checked') className = 'checked';
          if (event.status === 'partial') className = 'partial';
          return { className };
        }}
        messages={{
          today: '今日',
          previous: '前へ',
          next: '次へ',
          month: '月',
          week: '週',
          day: '日',
          agenda: '予定',
          date: '日付',
          time: '時間',
          event: 'イベント',
          noEventsInRange: 'この期間に予定はありません。',
        }}
      />
      <DragHandle position="bottom" onDrag={handleDrag} />

      {popupEvent && (
        <EventPopup
          event={popupEvent}
          onClose={() => setPopupEvent(null)}
        />
      )}
    </div>
  );
};