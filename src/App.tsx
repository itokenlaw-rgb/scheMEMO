import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import { SettingsPanel } from './components/SettingsPanel';
import type { CalendarEvent, BatchItem, TimeOption, EventStatus } from './types';
import type { TimeSettings } from './types/settings';
import { loadSettings } from './types/settings';
import { calculateEventTimeWithSettings } from './utils/settingsUtils';
import { getMockEvents, addMockEvent, updateMockEvent, stringifyBatchMemo, consolidateWeeklyMemos, deleteMockEvent } from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './api/googleCalendar'; // ※deleteGoogleEventのインポートを追加
import { Calendar as CalendarIcon, Settings, LogIn, LogOut, RefreshCw, Layers } from 'lucide-react'; // ★ Layers アイコンを追加

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  const calcTime = useCallback(
    (option: TimeOption) => calculateEventTimeWithSettings(option, timeSettings),
    [timeSettings]
  );

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onError: (error) => console.log('Login Failed:', error),
  });

  const logout = () => {
    setAccessToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(getMockEvents());
  };

  useEffect(() => {
    const token = localStorage.getItem('google_access_token');
    if (token) setAccessToken(token);
    else setEvents(getMockEvents());
  }, []);

  const refreshEvents = useCallback(async () => {
    if (!accessToken) return;
    try {
      setIsLoading(true);
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Failed to fetch events', error);
      if ((error as any).message?.includes('401')) logout();
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) refreshEvents();
  }, [accessToken, refreshEvents]);

  const handleSaveSingle = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
      try {
        await createGoogleEvent(accessToken, event);
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    } else {
      addMockEvent(event);
      setEvents(getMockEvents());
    }
  };

  const handleSaveBatch = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
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
        setIsLoading(false);
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

  const handleCarryOver = async (items: BatchItem[], timeOption: TimeOption) => {
    const { start, end } = calcTime(timeOption);
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-carry`,
      title: '□ やること',
      start,
      end,
      memo: stringifyBatchMemo(items),
      status: 'unchecked',
      isBatch: true,
    };
    if (accessToken) {
      setIsLoading(true);
      try {
        await createGoogleEvent(accessToken, newEvent);
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
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
      const newStatus = (event.status === 'checked' ? 'unchecked' : 'checked') as EventStatus;
      const newTitle =
        newStatus === 'checked'
          ? event.title.replace('□', '☑')
          : event.title.replace('☑', '□');
      const updatedEvent = { ...event, status: newStatus, title: newTitle };
      if (accessToken && !event.id.startsWith('evt-')) {
        setIsLoading(true);
        try {
          await updateGoogleEvent(accessToken, updatedEvent);
          await refreshEvents();
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      } else {
        updateMockEvent(updatedEvent);
        setEvents(getMockEvents());
      }
    }
  };

  // ★ 追加: 1週間分の未完了メモを本日21時に一括統合する関数
  const handleMergeWeeklyMemos = async () => {
    const { mergedEvent, targetIds } = consolidateWeeklyMemos(events);

    if (targetIds.length === 0) {
      alert('今日から1週間以内に統合対象となる未完了メモ（□）が見つかりませんでした。');
      return;
    }

    const confirmMerge = window.confirm(
      `対象の未完了メモが ${targetIds.length} 件見つかりました。\nこれらを削除し、本日21時の『□ MEMO』に1つにまとめますか？`
    );
    if (!confirmMerge) return;

    setIsLoading(true);
    try {
      if (accessToken) {
        // 1. Googleカレンダーから古いメモ予定を全て削除
        for (const id of targetIds) {
          if (!id.startsWith('evt-')) {
            await deleteGoogleEvent(accessToken, id).catch(err =>
              console.error(`Failed to delete event ${id}:`, err)
            );
          }
        }
        // 2. 新しい統合用の「□ MEMO」を書き込み
        await createGoogleEvent(accessToken, mergedEvent);
        // 3. 最新データを再取得して同期
        await refreshEvents();
      } else {
        // オフライン（Mock環境）での挙層
        targetIds.forEach(id => deleteMockEvent(id));
        addMockEvent(mergedEvent);
        setEvents(getMockEvents());
      }
      alert('1週間分の未完了タスクを本日の21時に集約しました！');
    } catch (error) {
      console.error('Failed to merge weekly memos:', error);
      alert('統合処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">
          <CalendarIcon size={24} />
          scheMEMO
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {accessToken ? (
            <>
              {/* ★ 1週間統合ボタンを配置 */}
              <button
                className="btn btn-outline btn-sm"
                onClick={handleMergeWeeklyMemos}
                title="1週間のメモを本日21時に統合"
                style={{ padding: '0.5rem', color: 'var(--accent)' }}
                disabled={isLoading}
              >
                <Layers size={16} />
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={refreshEvents}
                title="更新"
                style={{ padding: '0.5rem' }}
              >
                <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={logout}
                title="ログアウト"
                style={{ padding: '0.5rem' }}
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              {/* ログイン前でもMockテストできるように統合ボタンだけ表示 */}
              <button
                className="btn btn-outline btn-sm"
                onClick={handleMergeWeeklyMemos}
                title="1週間のメモを本日21時に統合 (テスト)"
                style={{ padding: '0.5rem', color: 'var(--accent)' }}
              >
                <Layers size={16} />
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => login()} title="Googleログイン">
                <LogIn size={16} /> ログイン
              </button>
            </>
          )}
          <button
            className={`btn btn-outline btn-sm${showSettings ? ' btn-primary' : ''}`}
            style={{ padding: '0.5rem' }}
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
          onSave={(settings) => {
            setTimeSettings(settings);
            setShowSettings(false);
          }}
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