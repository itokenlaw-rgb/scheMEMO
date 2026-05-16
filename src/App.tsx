// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
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
import { Calendar as CalendarIcon, Settings, RefreshCw, Layers, LogIn, LogOut } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  // ── ログイン（App(11)方式：useGoogleLogin） ──────────────────────────────
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onError: (error) => console.log('Login Failed:', error),
  });

  // ── ログアウト（App(11)方式：確認ダイアログなし） ──────────────────────
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

  // ── 双方向同期（App.tsxの構成 + App(11)の401自動ログアウト） ────────────
  const refreshEvents = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);

    try {
      // Step A: 未同期予定（evt- 仮ID）をGoogleへ書き出し
      const unSyncedEvents = events.filter(event => event.id.startsWith('evt-'));
      if (unSyncedEvents.length > 0) {
        console.log(`${unSyncedEvents.length}件の未同期データをGoogleカレンダーに保存中...`);
        for (const event of unSyncedEvents) {
          try {
            await createGoogleEvent(accessToken, event);
          } catch (err) {
            console.error(`「${event.title}」の保存に失敗しました:`, err);
          }
        }
      }

      // Step B: Googleから最新予定を取得して画面に反映
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      setEvents(fetchedEvents);

    } catch (error) {
      console.error('同期処理中にエラーが発生しました:', error);
      // 401エラー（トークン期限切れ）の場合は自動ログアウト
      if ((error as any).message?.includes('401')) logout();
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, events]);

  useEffect(() => {
    if (accessToken) {
      const loadFirstTime = async () => {
        try {
          setIsLoading(true);
          const fetchedEvents = await fetchGoogleEvents(accessToken);
          setEvents(fetchedEvents);
        } catch (error) {
          console.error('初回イベント取得に失敗しました', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadFirstTime();
    }
  }, [accessToken]);

  // ── 設定 ──────────────────────────────────────────────────────────────────
  const handleSaveSettings = (newSettings: TimeSettings) => {
    setTimeSettings(newSettings);
    saveSettings(newSettings);
    setShowSettings(false);
  };

  // ── MEMOを編集（App.tsx固有機能） ────────────────────────────────────────
  const handleMergeMemosClick = () => {
    const extractedBatchEvent = extractMemosFromSettingsRange(events, timeSettings);
    setSelectedEvent(extractedBatchEvent);
  };

  // ── クイックメモ保存 ──────────────────────────────────────────────────────
  const handleSaveSingle = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
      try {
        const savedGoogleEvent = await createGoogleEvent(accessToken, event);
        setEvents(prev => [...prev, savedGoogleEvent]);
        await refreshEvents();
      } catch (error) {
        console.error('Googleカレンダーへのクイックメモ保存に失敗しました:', error);
        await refreshEvents();
      } finally {
        setIsLoading(false);
      }
    } else {
      addMockEvent(event);
      setEvents(getMockEvents());
    }
  };

  // ── バッチ保存 ────────────────────────────────────────────────────────────
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

  // ── 繰り越し ──────────────────────────────────────────────────────────────
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

  // ── 予定選択（チェック切り替え / バッチ編集） ─────────────────────────────
  const handleSelectEvent = async (event: CalendarEvent) => {
    if (event.isBatch) {
      setSelectedEvent(event);
    } else {
      const newStatus = (event.status === 'checked' ? 'unchecked' : 'checked') as EventStatus;
      const newTitle = newStatus === 'checked' ? event.title.replace('□', '☑') : event.title.replace('☑', '□');
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

  // ── タスクをまとめる ──────────────────────────────────────────────────────
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

    setIsLoading(true);
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
      alert('統合処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">
          <CalendarIcon size={24} />
          scheMEMO
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {accessToken ? (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={refreshEvents}
                title="カレンダーを更新・同期"
                style={{ padding: '0.4rem', minHeight: '34px' }}
                disabled={isLoading}
              >
                <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              </button>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={logout} 
                title="Googleカレンダーからログアウト" 
                style={{ minHeight: '34px', gap: '0.25rem', display: 'flex', alignItems: 'center' }}
              >
                <LogOut size={16} /> ログアウト
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => login()} 
              title="Googleカレンダーにログイン・連携" 
              style={{ minHeight: '34px', padding: '0.4rem 0.75rem', gap: '0.25rem', display: 'flex', alignItems: 'center' }}
            >
              <LogIn size={14} /> ログイン
            </button>
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
        
        <div style={{ display: 'flex', gap: '1rem', width: '100%', margin: '0.5rem 0' }}>
          <button
            className="btn btn-secondary"
            onClick={handleMergeWeeklyMemos}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '42px' }}
            disabled={isLoading}
          >
            <Layers size={18} /> タスクをまとめる
          </button>

          <button
            className="btn btn-outline"
            onClick={handleMergeMemosClick}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '42px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            <Layers size={18} /> MEMOを編集
          </button>
        </div>

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
