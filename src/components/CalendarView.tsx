// src/components/CalendarView.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
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

const MIN_HEIGHT = 300;
const MAX_HEIGHT = 900;
const DEFAULT_HEIGHT = 650;

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  const [calHeight, setCalHeight] = useState(DEFAULT_HEIGHT);
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null);

  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    const cleanTitle = (event.title || '').replace(/\s+/g, '').toUpperCase();
    const isMemoOrSingleTask = event.isBatch || cleanTitle.includes('MEMO') || event.title.startsWith('□') || event.title.startsWith('☑');
    
    // イベント伝播を防ぎ、直後のドキュメントクリックで即座に閉じないように、少し遅らせてポップアップを開く
    setTimeout(() => {
      if (isMemoOrSingleTask) {
        setPopupEvent(event);
        onSelectEvent(event);
        return;
      }
      setPopupEvent(event);
    }, 0);
  }, [onSelectEvent]);

  // ─── ポップアップの外側操作（スクロール・クリック）で閉じる処理 ───
  useEffect(() => {
    if (!popupEvent) return;

    const handleCloseTrigger = () => {
      setPopupEvent(null);
    };

    // 画面のスクロールを検知してポップアップを閉じる
    window.addEventListener('scroll', handleCloseTrigger, { passive: true });
    // モバイル端末でのスクロール（指でのスワイプ移動）も検知
    window.addEventListener('touchmove', handleCloseTrigger, { passive: true });
    // ポップアップ以外の領域（他のボタンなど含む）がクリックされたら閉じる
    // ※キャプチャフェーズ(true)にすることで、他のボタンの通常処理が動く前に閉じることができます
    window.addEventListener('click', handleCloseTrigger, true);

    return () => {
      window.removeEventListener('scroll', handleCloseTrigger);
      window.removeEventListener('touchmove', handleCloseTrigger);
      window.removeEventListener('click', handleCloseTrigger, true);
    };
  }, [popupEvent]);

  // ─── カレンダー全体のドラッグリサイズ処理（スクロール共存版） ───

  const startResize = (clientY: number, target: HTMLElement): boolean => {
    if (
      target.closest('.rbc-event') || 
      target.closest('.custom-event-content') ||
      target.closest('button')
    ) {
      return false;
    }

    const isDayCell = target.closest('.rbc-day-bg') || target.closest('.rbc-date-cell');
    
    if (!isDayCell) {
      return false;
    }

    isDragging.current = true;
    startY.current = clientY;
    startHeight.current = calHeight;

    const onMove = (moveY: number) => {
      if (!isDragging.current) return;
      const deltaY = moveY - startY.current;
      setCalHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + deltaY)));
    };

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current && e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        onMove(e.touches[0].clientY);
      }
    };

    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);

    return true;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    startResize(e.clientY, e.target as HTMLElement);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      startResize(e.touches[0].clientY, e.target as HTMLElement);
    }
  };

  return (
    <div 
      className="calendar-resizable-wrapper"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ 
        touchAction: 'pan-y',
        userSelect: 'none'
      }}
    >
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
        style={{ height: calHeight, pointerEvents: 'auto' }}
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

      {popupEvent && (
        <EventPopup
          event={popupEvent}
          onClose={() => setPopupEvent(null)}
        />
      )}
    </div>
  );
};