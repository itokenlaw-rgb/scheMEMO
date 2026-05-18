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

// アクセストークンの有効期限（Google は 3600 秒 = 1時間）
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55分後に再取得（余裕を持たせる）
const STORAGE_KEY_TOKEN = 'google_access_token';
const STORAGE_KEY_EXPIRY = 'google_token_expiry';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  // ローカルストレージからトークンを復旧する処理
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

  // SingleEditor（1行入力）用の保存制御関数
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

  // BatchEditor（一括エディター）用の保存制御関数（単一・複数配列両対応）
  const handleSaveBatch = async (input: CalendarEvent | CalendarEvent[]) => {
    const eventsToSave = Array.isArray(input) ? input : [input];

    if (accessToken) {
      setIsLoading(true);
      try {
        // 1. 元の予定がある場合、設定の削除選択に従ってクリーンアップ
        if (selectedEvent && !selectedEvent.id.startsWith('evt-')) {
          const isPast = new Date(selectedEvent.start) < new Date();
          const shouldDelete = isPast 
            ? timeSettings.deletePastCompleted 
            : timeSettings.deleteFutureCompleted;

          const idReused = eventsToSave.some(e => e.id === selectedEvent.id);
          if (shouldDelete && !idReused) {
            await deleteGoogleEvent(accessToken, selectedEvent.id).catch(err => console.error(err));
          }
        }

        // 2. 新しいイベント（群）をカレンダーへ保存
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
      // オフライン（Mock環境）の処理
      if (selectedEvent && !selectedEvent.id.startsWith('evt-')) {
        const isPast = new Date(selectedEvent.start) < new Date();
        const shouldDelete = isPast ? timeSettings.deletePastCompleted : timeSettings.deleteFutureCompleted;
        
        const idReused = eventsToSave.some(e => e.id === selectedEvent.id);
        if (shouldDelete && !idReused) deleteMockEvent(selectedEvent.id);
      }

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

  const handleMergeWeeklyMemos = async () => {
    if (accessToken) {
      setIsLoading(true);
      try {
        const gEvents = await fetchGoogleEvents(accessToken);
        const result = consolidateWeeklyMemos(gEvents);
        if (result) {
          for (const id of result.targetIds) {
            await deleteGoogleEvent(accessToken, id).catch(err => console.error(err));
          }
          await createGoogleEvent(accessToken, result.mergedEvent);
          await refreshEvents();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    } else {
      const result = consolidateWeeklyMemos(getMockEvents());
      if (result) {
        result.targetIds.forEach(id => deleteMockEvent(id));
        addMockEvent(result.mergedEvent);
        setEvents(getMockEvents());
      }
    }
  };

  const handleSelectOldestMemo = () => {
    const memoEvents = events.filter(e => e.title.toUpperCase().includes('MEMO') || e.isBatch);
    if (memoEvents.length === 0) return;
    const oldest = memoEvents.reduce((old, current) => 
      new Date(current.start) < new Date(old.start) ? current : old
    );
    setSelectedEvent(oldest);
  };

  const handleCollectAllMemos = () => {
    console.log('□MEMOを集める click');
  };

  const handleSelectLatestMemo = () => {
    const memoEvents = events.filter(e => e.title.toUpperCase().includes('MEMO') || e.isBatch);
    if (memoEvents.length === 0) return;
    const latest = memoEvents.reduce((lat, current) => 
      new Date(current.start) > new Date(lat.start) ? current : lat
    );
    setSelectedEvent(latest);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title-area">
          <CalendarIcon className="header-icon" size={28} />
          <h1 className="header-title">scheMEMO</h1>
          {isLoading && <RefreshCw className="animate-spin text-muted" size={18} />}
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={refreshEvents} title="同期" disabled={isLoading}>
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="設定">
            <Settings size={20} />
          </button>
          {accessToken ? (
            <button className="btn btn-outline btn-sm font-semibold" onClick={logout}>
              <LogOut size={16} /> ログアウト
            </button>
          ) : (
            <button className="btn btn-primary btn-sm font-semibold" onClick={() => login()}>
              <LogIn size={16} /> Googleログイン
            </button>
          )}
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
        {/* １行クイック入力エディター */}
        <SingleEditor onSave={handleSaveSingle} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', margin: '0.5rem 0' }}>
          <button
            className="btn btn-secondary"
            onClick={handleMergeWeeklyMemos}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '44px' }}