// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import { SettingsPanel } from './components/SettingsPanel';
import type { CalendarEvent, BatchItem, EventStatus } from './types';
import type { TimeSettings } from './types/settings';
import { loadSettings, saveSettings } from './types/settings';
import { 
  getMockEvents, addMockEvent, updateMockEvent, 
  extractMemosFromSettingsRange, deleteMockEvent, consolidateWeeklyMemos
} from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './api/googleCalendar';
import { Calendar as CalendarIcon, Settings, RefreshCw, Layers } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  useEffect(() => {
    const token = localStorage.getItem('google_access_token');
    if (token) setAccessToken(token);
    else setEvents(getMockEvents());
  }, []);

  const refreshEvents = useCallback(async () => {
    if (!accessToken) return;
    try {
      const unSyncedEvents = events.filter(event => event.id.startsWith('evt-'));
      if (unSyncedEvents.length > 0) {
        for (const event of unSyncedEvents) {
          try {
            await createGoogleEvent(accessToken, event);
          } catch (err) {
            console.error(err);
          }
        }
      }
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error(error);
    }
  }, [accessToken, events]);

  useEffect(() => {
    if (accessToken) {
      const loadFirstTime = async () => {
        try {
          const fetchedEvents = await fetchGoogleEvents(accessToken);
          setEvents(fetchedEvents);
        } catch (error) {
          console.error(error);
        }
      };
      loadFirstTime();
    }
  }, [accessToken]);

  const handleSaveSettings = (newSettings: TimeSettings) => {
    setTimeSettings(newSettings);
    saveSettings(newSettings);
    setShowSettings(false);
  };

  const handleMergeMemosClick = () => {
    const extractedBatchEvent = extractMemosFromSettingsRange(events, timeSettings);
    setSelectedEvent(extractedBatchEvent);
  };

  const handleSaveSingle = async (event: CalendarEvent) => {
    if (accessToken) {
      try {
        const savedGoogleEvent = await createGoogleEvent(accessToken, event);
        setEvents(prev => [...prev, savedGoogleEvent]);
        await refreshEvents();
      } catch (error) {
        console.error(error);
      }
    } else {
      addMockEvent(event);
      setEvents(getMockEvents());
    }
  };

  const handleSaveBatch = async (event: CalendarEvent) => {
    if (accessToken) {
      try {
        if (selectedEvent && event.id === selectedEvent.id && !event.id.startsWith('evt-')) {
          await updateGoogleEvent(accessToken, event);
        } else {
          await createGoogleEvent(accessToken, event);
        }
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setSelectedEvent(null);
      }
    } else {
      if (selectedEvent && event.id === selectedEvent.id) {
        updateMockEvent(event);
      } else {
        addMockEvent(event);
      }
      setEvents(getMockEvents());
      setSelectedEvent(null);
    }
  };

  const handleCarryOver = async (items: BatchItem[]) => {
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-carry`,
      title: '□ やること',
      start: new Date(),
      end: new Date(),
      memo: items.map(item => `${item.checked ? '☑' : '□'} ${item.text}`).join('\n'),
      status: 'unchecked',
      isBatch: true,
    };
    if (accessToken) {
      try {
        await createGoogleEvent(accessToken, newEvent);
        await refreshEvents();
      } catch (error) {
        console.error(error);
      }
    } else {
      addMockEvent(newEvent);
      setEvents(getMockEvents());
    }
  };

  const handleSelectEvent = async (event: CalendarEvent) => {
    if (event.isBatch) {
      setSelectedEvent(event);
    } else {
      // ✅ 型を明確にするため、as EventStatus を追加して型不一致エラーを解消しました
      const newStatus = (event.status === 'checked' ? 'unchecked' : 'checked') as EventStatus;
      const newTitle = newStatus === 'checked' ? event.title.replace('□', '☑') : event.title.replace('☑', '□');
      const updatedEvent = { ...event, status: newStatus, title: newTitle };
      if (accessToken && !event.id.startsWith('evt-')) {
        try {
          await updateGoogleEvent(accessToken, updatedEvent);
          await refreshEvents();
        } catch (error) {
          console.error(error);
        }
      } else {
        updateMockEvent(updatedEvent);
        setEvents(getMockEvents());
      }
    }
  };

  const handleMergeWeeklyMemos = async () => {
    const before = timeSettings.mergeDaysBefore ?? 0;
    const after = timeSettings.mergeDaysAfter ?? 7;
    const { mergedEvent, targetIds } = consolidateWeeklyMemos(events, before, after);

    if (targetIds.length === 0) {
      alert('統合対象となる未完了メモが見つかりませんでした。');
      return;
    }

    const confirmMerge = window.confirm(`未完了メモが ${targetIds.length} 件見つかりました。本日21時の『□ MEMO』に1つにまとめますか？`);
    if (!confirmMerge) return;

    try {
      if (accessToken) {
        for (const id of targetIds) {
          if (!id.startsWith('evt-')) {
            await deleteGoogleEvent(accessToken, id).catch(err => console.error(err));
          }
        }
        await createGoogleEvent(accessToken, mergedEvent);
        await refreshEvents();
      } else {
        targetIds.forEach(id => deleteMockEvent(id));
        addMockEvent(mergedEvent);
        setEvents(getMockEvents());
      }
      alert('タスクを本日の21時に集約しました！');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">
          <CalendarIcon size={24} />
          scheMEMO
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleMergeMemosClick}
            title="カレンダーから設定範囲のメモを抽出して編集"
            style={{ padding: '0.4rem', color: 'var(--accent)', minHeight: '34px' }}
          >
            <Layers size={16} /> まとめる
          </button>

          {accessToken && (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleMergeWeeklyMemos}
                title="一括統合を実行"
                style={{ padding: '0.4rem', minHeight: '34px' }}
              >
                一括統合
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={refreshEvents}
                title="更新"
                style={{ padding: '0.4rem', minHeight: '34px' }}
              >
                <RefreshCw size={16} />
              </button>
            </>
          )}
          <button
            className={`btn btn-outline btn-sm${showSettings ? ' btn-primary' : ''}`}
            style={{ padding: '0.4rem', minHeight: '34px' }}
            onClick={() => setShowSettings(v => !v)}
            title="設定"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          initialSettings={timeSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      <div className="editors-section">
        <SingleEditor onSave={handleSaveSingle} />
        <BatchEditor
          onSave={handleSaveBatch}
          onCarryOver={handleCarryOver}
          initialEvent={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      </div>

      <div className="calendar-section">
        <CalendarView events={events} onSelectEvent={handleSelectEvent} />
      </div>
    </div>
  );
}

export default App;