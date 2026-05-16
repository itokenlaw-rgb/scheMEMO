import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { CalendarEvent } from '../types';

const locales = {
  'ja': ja,
};

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

const CustomEvent: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  return (
    <div
      className={`custom-event-content ${event.status}`}
      style={{ height: '100%', width: '100%', padding: '2px 4px' }}
    >
      <span style={{ fontWeight: 600 }}>{event.title}</span>
    </div>
  );
};

interface EventPopupProps {
  event: CalendarEvent;
  onClose: () => void;
}

const EventPopup: React.FC<EventPopupProps> = ({ event, onClose }) => {
  return (
    <div className="event-popup-overlay" onClick={onClose}>
      <div
        className="event-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="event-popup-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
        <div className="event-popup-title">{event.title}</div>
        {event.memo && (
          <div className="event-popup-memo">{event.memo}</div>
        )}
        {!event.memo && (
          <div className="event-popup-empty">内容なし</div>
        )}
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null);

  const handleSelectEvent = (event: CalendarEvent) => {
    setPopupEvent(event);
    // 元のonSelectEventも呼ぶ（チェック切り替えなどの既存ロジック）
    // ポップアップ表示を優先するため、isBatchのみ通知
    if (event.isBatch) {
      onSelectEvent(event);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="ja"
        defaultView={Views.MONTH}
        views={[Views.MONTH]}
        onSelectEvent={handleSelectEvent}
        components={{
          event: CustomEvent,
        }}
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
