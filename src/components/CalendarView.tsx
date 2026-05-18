// src/components/CalendarView.tsx
// （前後のインポートや他のコンポーネントはそのまま）

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  const [calHeight, setCalHeight] = useState(DEFAULT_HEIGHT);
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null);

  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // （既存の処理のまま）
    const cleanTitle = (event.title || '').replace(/\s+/g, '').toUpperCase();
    const isMemoOrSingleTask = event.isBatch || cleanTitle.includes('MEMO') || event.title.startsWith('□') || event.title.startsWith('☑');
    if (isMemoOrSingleTask) {
      setPopupEvent(event);
      onSelectEvent(event);
      return;
    }
    setPopupEvent(event);
  }, [onSelectEvent]);

  // ─── カレンダー全体のドラッグリサイズ処理（修正版） ───

  const startResize = (clientY: number, target: HTMLElement) => {
    // 1. 通常のボタン、予定(イベント)を直接タップした場合はリサイズしない
    if (
      target.closest('button') || 
      target.closest('.rbc-event') || 
      target.closest('.custom-event-content')
    ) {
      return;
    }

    // 2. 【追加】「前へ・次へ」のナビゲーションや「月・週・日」切り替え、および「日〜土」の曜日ヘッダー部分を対象外にする
    if (
      target.closest('.rbc-toolbar') ||       // 最上部のナビゲーションバー（前へ、次へ、今日など）
      target.closest('.rbc-month-header') ||  // 月ビューの曜日ヘッダー（日〜土）
      target.closest('.rbc-time-header')      // 週・日ビューの曜日・時間ヘッダー
    ) {
      return;
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
      if (e.touches.length > 0) {
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
        touchAction: 'none',
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