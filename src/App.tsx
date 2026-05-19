// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import { SettingsPanel } from './components/SettingsPanel';
import type { CalendarEvent, BatchItem } from './types';
import type { TimeSettings } from './types/settings';
import { loadSettings, saveSettings } from './types/settings';
import {
  getMockEvents, addMockEvent, updateMockEvent,
  deleteMockEvent, consolidateWeeklyMemos
} from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './api/googleCalendar';
import { Calendar as CalendarIcon, Settings, RefreshCw, Layers, LogIn, LogOut } from 'lucide-react';

const TOKEN_LIFETIME_MS = 55 * 60 * 1000;
const STORAGE_KEY_TOKEN = 'google_access_token';
const STORAGE_KEY_EXPIRY = 'google_token_expiry';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expiryStr = localStorage.getItem(STORAGE_KEY_EXPIRY);
    if (savedToken && expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() < expiry) {
        setAccessToken(savedToken);
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_EXPIRY);
      }
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      const expiryTime = Date.now() + TOKEN_LIFETIME_MS;
      localStorage.setItem(STORAGE_KEY_TOKEN, tokenResponse.access_token);
      localStorage.setItem(STORAGE_KEY_EXPIRY, expiryTime.toString());
    },
    onError: (error) => console.error('Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });

  const logout = () => {
    setAccessToken(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
    setEvents([]);
  };

  const refreshEvents = useCallback(async () => {
    if (!accessToken) {
      setEvents(getMockEvents());
      return;
    }
    setIsLoading(true);
    try {
      const gEvents = await fetchGoogleEvents(accessToken);
      setEvents(gEvents);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleSaveSingle = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
      try {
        const savedGoogleEvent = await createGoogleEvent(accessToken, event);
        setEvents(prev => [...prev, savedGoogleEvent]);
        await refreshEvents();
      } catch (error) {
        console.error(error);
        await refreshEvents();
      } finally {
        setIsLoading(false);
      }
    } else {
      addMockEvent(event);
      setEvents(getMockEvents());
    }
  };

  // 一括エディターの保存処理（こちらも削除ではなく、完了フラグ等に応じた更新に変更）
  const handleSaveBatch = async (input: CalendarEvent | CalendarEvent[], saveMode: 'save' | 'update' = 'save') => {
    const eventsToSave = Array.isArray(input) ? input : [input];

    if (accessToken) {
      setIsLoading(true);
      try {
        for (const event of eventsToSave) {
          if (selectedEvent && event.id === selectedEvent.id && !event.id.startsWith('evt-')) {
            await updateGoogleEvent(accessToken, event);
          } else {
            await createGoogleEvent(accessToken, event);
          }
        }
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
        setSelectedEvent(null);
      }
    } else {
      eventsToSave.forEach(event => {
        if (selectedEvent && event.id === selectedEvent.id) {
          updateMockEvent(event);
        } else {
          addMockEvent(event);
        }
      });
      setEvents(getMockEvents());
      setSelectedEvent(null);
    }
  };

  const handleCarryOver = (items: BatchItem[], timeOption: any) => {
    console.log('Carry over items:', items, 'to', timeOption);
  };

  const handleSaveSettings = (settings: TimeSettings) => {
    setTimeSettings(settings);
    saveSettings(settings);
    setShowSettings(false);
  };

  // 【2の修正】：元のタスクを削除せず、□を☑に変更して完了タスク(色変更対象)とする「まとめ」処理
  const handleMergeWeeklyMemos = async () => {
    setIsLoading(true);
    try {
      const currentEvents = accessToken ? await fetchGoogleEvents(accessToken) : getMockEvents();

      // 1. 設定から抽出範囲を取得
      const now = new Date();
      const startRange = new Date(now);
      startRange.setDate(now.getDate() - timeSettings.mergeDaysBefore);
      startRange.setHours(0, 0, 0, 0);

      const endRange = new Date(now);
      endRange.setDate(now.getDate() + timeSettings.mergeDaysAfter);
      endRange.setHours(23, 59, 59, 999);

      // 2. 範囲内の「□」から始まる予定を抽出
      const targetTasks = currentEvents.filter(e => {
        const eventDate = new Date(e.start);
        return eventDate >= startRange && eventDate <= endRange && e.title.startsWith('□') && !e.title.toUpperCase().includes('MEMO') && !e.isBatch;
      });

      if (targetTasks.length === 0) {
        alert("範囲内に集める対象の「□タスク」が見つかりませんでした。");
        setIsLoading(false);
        return;
      }

      // 3. まとめた予定「□MEMO」の内容を作成
      const memoLines = targetTasks.map(t => `□ ${t.title.replace(/^[□☑]\s*/, '').trim()}`);
      const memoContent = memoLines.join('\n');

      // 4. □MEMOの保存時間を生成 (設定の batchMemoSaveHour 時)
      const memoStart = new Date(now);
      memoStart.setHours(timeSettings.batchMemoSaveHour, 0, 0, 0);
      const memoEnd = new Date(memoStart);
      memoEnd.setHours(memoStart.getHours() + 1);

      const newBatchMemoEvent: CalendarEvent = {
        id: `evt-${Date.now()}-merged`,
        title: '□MEMO',
        start: memoStart,
        end: memoEnd,
        memo: memoContent,
        status: 'unchecked',
        isBatch: true
      };

      if (accessToken) {
        // Google連携時：新しくまとめた□MEMOを作成
        await createGoogleEvent(accessToken, newBatchMemoEvent);

        // 元のタスクは削除せず、タイトルを「☑」にし、ステータスを checked にして更新
        for (const task of targetTasks) {
          const updatedTask: CalendarEvent = {
            ...task,
            title: task.title.replace(/^□/, '☑'),
            status: 'checked'
          };
          await updateGoogleEvent(accessToken, updatedTask);
        }
        await refreshEvents();
      } else {
        // ローカル（Mock）環境
        addMockEvent(newBatchMemoEvent);
        targetTasks.forEach(task => {
          updateMockEvent({
            ...task,
            title: task.title.replace(/^□/, '☑'),
            status: 'checked'
          });
        });
        setEvents(getMockEvents());
      }
    } catch (error) {
      console.error(error);
      alert("処理中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOldestMemo = () => {
    const memoEvents = events.filter(e => e.title.toUpperCase().includes('MEMO') || e.isBatch);
    if (memoEvents.length === 0) return;
    const oldest = memoEvents.reduce((old, current) => new Date(current.start) < new Date(old.start) ? current : old);
    setSelectedEvent(oldest);
  };

  const handleCollectAllMemos = () => {
    console.log('□MEMOを集める click');
  };

  const handleSelectLatestMemo = () => {
    const memoEvents = events.filter(e => e.title.toUpperCase().includes('MEMO') || e.isBatch);
    if (memoEvents.length === 0) return;
    const latest = memoEvents.reduce((lat, current) => new Date(current.start) > new Date(lat.start) ? current : lat);
    setSelectedEvent(latest);
  };

  return (
    <div className="app-container">
      <header className="app-header" style={{ padding: '0.75rem 1rem' }}>
        <div className="app-logo" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)', gap: '0.5rem' }}>
          <CalendarIcon size={24} />
          scheMEMO
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {accessToken ? (
            <>
              <button className="btn btn-outline btn-sm" onClick={refreshEvents} title="カレンダーを更新・同期" style={{ padding: '0.4rem', minHeight: '34px' }} disabled={isLoading}>
                <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              </button>
              <button className="btn btn-outline btn-sm" onClick={logout} title="Googleカレンダーからログアウト" style={{ minHeight: '34px', gap: '0.25rem', display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
                <LogOut size={16} /> ログアウト
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => login()} title="Googleカレンダーにログイン・連携" style={{ minHeight: '34px', padding: '0.4rem 0.75rem', gap: '0.25rem', display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: '500' }}>
              <LogIn size={14} /> ログイン
            </button>
          )}
          <button className={`btn btn-outline btn-sm${showSettings ? ' btn-primary' : ''}`} style={{ padding: '0.4rem', minHeight: '34px' }} onClick={() => setShowSettings(v => !v)} title="設定">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsPanel initialSettings={timeSettings} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      )}

      <div className="editors-section">
        <SingleEditor onSave={handleSaveSingle} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', margin: '0.5rem 0' }}>
          <button
            className="btn btn-secondary"
            onClick={handleMergeWeeklyMemos}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '42px',
              backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.95rem'
            }}
            disabled={isLoading}
          >
            <Layers size={18} /> □タスクを ↓ □MEMOにする
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button className="btn btn-outline" onClick={handleSelectOldestMemo} disabled={isLoading} style={{ flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.8rem', lineHeight: '1.2', borderRadius: '0.5rem', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: '#3b82f6', backgroundColor: '#ffffff', color: '#3b82f6', fontWeight: '600' }}>
              <div>一番古い</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#3b82f6' }}>□メモ</div>
            </button>
            <button className="btn btn-outline" onClick={handleCollectAllMemos} disabled={isLoading} style={{ flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.8rem', lineHeight: '1.2', borderRadius: '0.5rem', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: '#f59e0b', backgroundColor: '#ffffff', color: '#d97706', fontWeight: '600' }}>
              <div>□MEMOを</div>
              <div style={{ fontSize: '0.8rem', color: '#d97706' }}>集める</div>
            </button>
            <button className="btn btn-outline" onClick={handleSelectLatestMemo} disabled={isLoading} style={{ flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.8rem', lineHeight: '1.2', borderRadius: '0.5rem', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: '#3b82f6', backgroundColor: '#ffffff', color: '#3b82f6', fontWeight: '600' }}>
              <div>最新の</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#3b82f6' }}>□メモ</div>
            </button>
          </div>
        </div>

        <BatchEditor onSave={handleSaveBatch} onCarryOver={handleCarryOver} initialEvent={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>

      <div className="calendar-section">
        <CalendarView events={events} onSelectEvent={handleSelectEvent} />
      </div>
    </div>
  );
}

export default App;