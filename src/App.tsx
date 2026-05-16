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
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './api/googleCalendar';
import { Calendar as CalendarIcon, Settings, LogIn, LogOut, RefreshCw, Layers } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  // 〇日前・〇日後の設定ステートを追加 (初期設定: 0日前から 7日後まで)
  const [daysBefore, setDaysBefore] = useState<number>(0);
  const [daysAfter, setDaysAfter] = useState<number>(7);

  // 0 から 15 までの配列を作成
  const dayOptions = Array.from({ length: 16 }, (_, i) => i);

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

      // ✅ 変数名のハイフンを修正しました (un-syncedEvents -> unSyncedEvents)
      const unSyncedEvents = events.filter(event => event.id.startsWith('evt-'));

      if (unSyncedEvents.length > 0) {
        console.log(`${unSyncedEvents.length}件の未同期予定をGoogleカレンダーに反映中...`);
        
        // 未同期の予定を1件ずつGoogleカレンダーAPIに送信して登録
        for (const event of unSyncedEvents) {
          try {
            await createGoogleEvent(accessToken, event);
          } catch (createError) {
            console.error(`予定「${event.title}」の同期に失敗しました:`, createError);
          }
        }
      }

      // 2. すべての書き出しが終わったら、Googleカレンダーから最新状態をまとめて再取得して画面を更新
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      setEvents(fetchedEvents);

    } catch (error) {
      console.error('同期・更新処理に失敗しました', error);
      if ((error as any).message?.includes('401')) logout();
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, events]); // events に依存するため依存配列に追加

  useEffect(() => {
    if (accessToken) refreshEvents();
  }, [accessToken, refreshEvents]);

  const handleSaveSingle = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
      try {
        const { id, ...eventWithoutId } = event; 
        const savedGoogleEvent = await createGoogleEvent(accessToken, event as CalendarEvent);
        setEvents(prev => [...prev, savedGoogleEvent]);
        await refreshEvents();
      } catch (error) {
        console.error("Googleカレンダーへのクイックメモ保存に失敗しました:", error);
        await refreshEvents();
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

  // メモ一括統合の実行処理 (設定されたステートを渡す)
  const handleMergeWeeklyMemos = async () => {
    const { mergedEvent, targetIds } = consolidateWeeklyMemos(events, daysBefore, daysAfter);

    if (targetIds.length === 0) {
      alert(`${daysBefore}日前から${daysAfter}日後までの期間に、統合対象となる未完了メモ（□）が見つかりませんでした。`);
      return;
    }

    const confirmMerge = window.confirm(
      `指定期間内に未完了メモが ${targetIds.length} 件見つかりました。\nこれらを削除し、本日21時の『□ MEMO』に1つにまとめますか？`
    );
    if (!confirmMerge) return;

    setIsLoading(true);
    try {
      if (accessToken) {
        for (const id of targetIds) {
          if (!id.startsWith('evt-')) {
            await deleteGoogleEvent(accessToken, id).catch(err =>
              console.error(`Failed to delete event ${id}:`, err)
            );
          }
        }
        await createGoogleEvent(accessToken, mergedEvent);
        await refreshEvents();
      } else {
        targetIds.forEach(id => deleteMockEvent(id));
        addMockEvent(mergedEvent);
        setEvents(getMockEvents());
      }
      alert('指定期間の未完了タスクを本日の21時に集約しました！');
    } catch (error) {
      console.error('Failed to merge memos:', error);
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
        
        {/* プルダウンメニューと統合用のアクションエリア */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', background: 'var(--surface)', padding: '0.25rem 0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <select 
              value={daysBefore} 
              onChange={(e) => setDaysBefore(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            >
              {dayOptions.map(d => <option key={`before-${d}`} value={d}>{d}</option>)}
            </select>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>前〜</span>
            <select 
              value={daysAfter} 
              onChange={(e) => setDaysAfter(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            >
              {dayOptions.map(d => <option key={`after-${d}`} value={d}>{d}</option>)}
            </select>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>後</span>
          </div>

          {accessToken ? (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleMergeWeeklyMemos}
                title={`${daysBefore}日前から${daysAfter}日後までのメモを本日21時に統合`}
                style={{ padding: '0.4rem', color: 'var(--accent)', minHeight: '34px' }}
                disabled={isLoading}
              >
                <Layers size={16} />
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={refreshEvents}
                title="更新"
                style={{ padding: '0.4rem', minHeight: '34px' }}
              >
                <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={logout}
                title="ログアウト"
                style={{ padding: '0.4rem', minHeight: '34px' }}
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleMergeWeeklyMemos}
                title="指定期間のメモを本日21時に統合 (テスト)"
                style={{ padding: '0.4rem', color: 'var(--accent)', minHeight: '34px' }}
              >
                <Layers size={16} />
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => login()} title="Googleログイン" style={{ minHeight: '34px', padding: '0.4rem 0.75rem' }}>
                <LogIn size={14} /> ログイン
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