import React from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { CalendarEvent } from '../types';

const locales = {
  'ja': ja,
};

// 月曜始まりにするため、startOfWeek に weekStartsOn: 1 を渡す
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

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      culture="ja"
      // 月表示に固定し、ツールバーの表示切替ボタンを非表示にする
      defaultView={Views.MONTH}
      views={[Views.MONTH]}
      onSelectEvent={onSelectEvent}
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
  );
};
