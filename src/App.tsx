// src/App.tsx  ← 差分のみ。設定パネル統合版
// 変更箇所: ① Settings ボタンでパネル開閉、② calculateEventTime を settingsUtils に差し替え

import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import { SettingsPanel } from './components/SettingsPanel';          // ★追加
import type { CalendarEvent, BatchItem, TimeOption, EventStatus } from './types';
import type { TimeSettings } from './types/settings';                  // ★追加
import { loadSettings } from './types/settings';                       // ★追加
import { calculateEventTimeWithSettings } from './utils/settingsUtils'; // ★追加（旧 calculateEventTime を置き換え）
import { getMockEvents, addMockEvent, updateMockEvent, stringifyBatchMemo } from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent } from './api/googleCalendar';
import { Calendar as CalendarIcon, Settings, LogIn, LogOut, RefreshCw } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);           // ★追加
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings); // ★追加

  // ── calculateEventTime のラッパー（設定を使う版） ──────────────
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
    const { start, end } = calcTime(timeOption); // ★ calcTime を使用
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
            <button className="btn btn-primary btn-sm" onClick={() => login()} title="Googleログイン">
              <LogIn size={16} /> ログイン
            </button>
          )}
          {/* ★ 設定ボタン: クリックでパネル開閉 */}
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

      {/* ★ 設定パネル: showSettings のときだけ表示 */}
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
        {/* SingleEditor / BatchEditor に calcTime を渡すため、
            それぞれのコンポーネント内部で calculateEventTime を使っている箇所を
            props 経由の calcTime に切り替えるか、
            またはグローバルな settingsUtils を直接 import して使う。
            最もシンプルな方法: SingleEditor / BatchEditor でも
            import { calculateEventTimeWithSettings } from '../utils/settingsUtils';
            を使い loadSettings() を直接呼べばよい（localStorage 経由で共有）。 */}
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
