// src/App.tsx

import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import { SettingsPanel } from './components/SettingsPanel';
import type { CalendarEvent, BatchItem, TimeOption } from './types';
import type { TimeSettings } from './types/settings';
import { loadSettings, saveSettings } from './types/settings';
import { calculateEventTimeWithSettings } from './utils/settingsUtils';
import { 
  getMockEvents, addMockEvent, updateMockEvent, stringifyBatchMemo, 
  extractMemosFromSettingsRange, deleteMockEvent // ★関数のインポートを変更
} from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './api/googleCalendar';
import { Calendar as CalendarIcon, Settings, LogIn, LogOut, RefreshCw, Layers } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  // 💡 【３】ホーム画面の範囲設定ステート（daysBefore / daysAfter）は削除しました。
  // すべて timeSettings（localStorage連動）内の値を使用します。

  // 予定データの読み込み
  const loadCalendarEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      if (accessToken) {
        const googleEvents = await fetchGoogleEvents(accessToken);
        setEvents(googleEvents);
      } else {
        setEvents(getMockEvents());
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // 設定の保存処理
  const handleSaveSettings = (newSettings: TimeSettings) => {
    setTimeSettings(newSettings);
    saveSettings(newSettings);
    setShowSettings(false);
  };

  // 【まとめる】ボタンが押された時の処理
  const handleMergeMemosClick = () => {
    // 1. 設定内の「□MEMOの抽出範囲」及び「完了タスク削除設定」を反映してタスクを抽出
    const extractedBatchEvent = extractMemosFromSettingsRange(events, timeSettings);
    
    // 2. 抽出された中身をそのまま BatchEditor に流し込んで表示（展開）する
    setSelectedEvent(extractedBatchEvent);
  };

  // 保存・更新・キャリーオーバー各種ハンドラ (既存のまま維持)
  const handleSaveSingle = async (newEvent: CalendarEvent) => { /* ... */ };
  const handleSaveBatch = async (updatedEvent: CalendarEvent) => { /* ... */ };
  const handleCarryOver = async (items: BatchItem[], timeOption: TimeOption) => { /* ... */ };
  const handleSelectEvent = (event: CalendarEvent) => { setSelectedEvent(event); };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <CalendarIcon size={24} className="text-primary" />
          <h1>Calendar Memo</h1>
        </div>
        <div className="header-actions">
          {accessToken ? (
            <>
              {/* 【３】ホーム画面の入力欄は削除し、「まとめるボタン」のみを残しました */}
              <button 
                className="btn btn-outline btn-sm" 
                onClick={handleMergeMemosClick}
                title="カレンダーから指定範囲のメモを抽出してまとめる"
                style={{ padding: '0.4rem', color: 'var(--accent)', minHeight: '34px' }}
              >
                <Layers size={16} /> まとめる
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setAccessToken(null)} title="ログアウト" style={{ minHeight: '34px' }}>
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              {/* Mock環境でも同様に機能するように設置 */}
              <button 
                className="btn btn-outline btn-sm" 
                onClick={handleMergeMemosClick}
                title="カレンダーから指定範囲のメモを抽出してまとめる"
                style={{ padding: '0.4rem', color: 'var(--accent)', minHeight: '34px' }}
              >
                <Layers size={16} /> まとめる
              </button>
              {/* Googleログインボタンなど */}
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