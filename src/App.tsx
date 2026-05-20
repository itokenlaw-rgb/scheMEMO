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
  getMockEvents, addMockEvent, updateMockEvent
} from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent } from './api/googleCalendar';
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

  // 一括化（マージ）対象になっている元の□タスクたちのIDを一時保存するステート
  const [mergedTaskIds, setMergedTaskIds] = useState<string[]>([]);

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

  // 一括編集エディター（BatchEditor）で保存が確定したときに元のタスクを「☑」にする処理
  const handleSaveBatch = async (input: CalendarEvent | CalendarEvent[], saveMode: 'save' | 'update' = 'save') => {
    const eventsToSave = Array.isArray(input) ? input : [input];
    console.log(`Saving batch in mode: ${saveMode}`);

    if (accessToken) {
      setIsLoading(true);
      try {
        // 1. 新しい □MEMO イベントをカレンダーへ作成または更新
        for (const event of eventsToSave) {
          if (selectedEvent && event.id === selectedEvent.id && !event.id.startsWith('evt-')) {
            await updateGoogleEvent(accessToken, event);
          } else {
            await createGoogleEvent(accessToken, event);
          }
        }

        // 2. 記憶していた統合元の「□タスク」があれば、すべて「☑」に変更して一括更新
        if (mergedTaskIds.length > 0) {
          const currentEvents = await fetchGoogleEvents(accessToken);
          const tasksToComplete = currentEvents.filter(e => mergedTaskIds.includes(e.id));
          
          for (const task of tasksToComplete) {
            const currentTitle = task.title || '';
            if (currentTitle.startsWith('□')) {
              const updatedTask: CalendarEvent = {
                ...task,
                title: currentTitle.replace(/^□/, '☑'),
                status: 'checked'
              };
              await updateGoogleEvent(accessToken, updatedTask);
            }
          }
        }

        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
        setSelectedEvent(null);
        setMergedTaskIds([]); // 記憶リセット
      }
    } else {
      // ローカル（Mock）環境用
      eventsToSave.forEach(event => {
        if (selectedEvent && event.id === selectedEvent.id) {
          updateMockEvent(event);
        } else {
          addMockEvent(event);
        }
      });

      if (mergedTaskIds.length > 0) {
        const currentEvents = getMockEvents();
        currentEvents.forEach((task) => {
          const currentTitle = task.title || '';
          if (mergedTaskIds.includes(task.id) && currentTitle.startsWith('□')) {
            updateMockEvent({
              ...task,
              title: currentTitle.replace(/^□/, '☑'),
              status: 'checked'
            });
          }
        });
      }

      setEvents(getMockEvents());
      setSelectedEvent(null);
      setMergedTaskIds([]);
    }
  };

  const handleCarryOver = (_items: BatchItem[], _timeOption: any) => {
    // コンパイルエラー対策でアンダースコアを付与
  };

  const handleSaveSettings = (settings: TimeSettings) => {
    setTimeSettings(settings);
    saveSettings(settings);
    setShowSettings(false);
  };

  // ── 「□タスクを⇩□MEMOにする」ボタンを押したときの処理 ──
  const handleMergeWeeklyMemos = async () => {
    setIsLoading(true);
    try {
      const currentEvents = accessToken ? await fetchGoogleEvents(accessToken) : getMockEvents();

      // 1. 設定画面から取得した日前・日後の値で抽出範囲を計算
      const now = new Date();
      const startRange = new Date(now);
      startRange.setDate(now.getDate() - timeSettings.mergeDaysBefore);
      startRange.setHours(0, 0, 0, 0);

      const endRange = new Date(now);
      endRange.setDate(now.getDate() + timeSettings.mergeDaysAfter);
      endRange.setHours(23, 59, 59, 999);

      // 2. ＜１＞「□」から始まるタスクを抽出し、＜２＞既に「□MEMO」になっているものは完全に除外
      const targetTasks = currentEvents.filter((e: CalendarEvent) => {
        if (!e.start) return false;
        const eventDate = new Date(e.start);
        const title = (e.title || '').trim();
        
        // 指定された日付範囲内か
        const isWithinRange = eventDate >= startRange && eventDate <= endRange;
        
        // 「□」で始まり、かつ「□MEMO」などの一括用タイトルを含まない純粋なタスクか（タイトル空防御付き）
        const isPureTask = 
          title.startsWith('□') && 
          !title.toUpperCase().includes('MEMO') && 
          !e.isBatch;

        return isWithinRange && isPureTask;
      });

      if (targetTasks.length === 0) {
        alert("指定の範囲内に、集める対象の「□タスク」が見つかりませんでした。（既存の □MEMO は除外されています）");
        setIsLoading(false);
        return;
      }

      // 3. 集めたタスクのタイトルを1行ずつの箇条書きテキスト（内容欄用）にする
      const memoLines = targetTasks.map((t: CalendarEvent) => (t.title || '').trim());
      const memoContent = memoLines.join('\n');

      // 4. 設定画面の「□MEMO保存本日の〇時」の時刻を作成
      const memoStart = new Date(now);
      memoStart.setHours(timeSettings.batchMemoSaveHour, 0, 0, 0);
      const memoEnd = new Date(memoStart);
      memoEnd.setHours(memoStart.getHours() + 1);

      // 5. 仮想の □MEMO 予定オブジェクトを生成して画面中央に送る
      const generatedMemoEvent: CalendarEvent = {
        id: `evt-${Date.now()}-merged`,
        title: '□MEMO',
        start: memoStart,
        end: memoEnd,
        memo: memoContent,
        status: 'unchecked',
        isBatch: true
      };

      // 6. 保存時に「☑」へ書き換えるために、対象タスクのIDを一時保存
      const taskIds = targetTasks.map(t => t.id);
      setMergedTaskIds(taskIds);

      // 7. エディターへセット（BatchEditorが自動的に起動し、バラして中身を表示します）
      setSelectedEvent(generatedMemoEvent);

    } catch (error) {
      console.error(error);
      alert("処理中にエラーが発生しました。カレンダーデータの一部に不整合がある可能性があります。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOldestMemo = () => {
    const memoEvents = events.filter(e => (e.title || '').toUpperCase().includes('MEMO') || e.isBatch);
    if (memoEvents.length === 0) return;
    const oldest = memoEvents.reduce((old, current) => new Date(current.start) < new Date(old.start) ? current : old);
    setSelectedEvent(oldest);
  };

  const handleCollectAllMemos = () => {
    console.log('□MEMOを集める click');
  };

  const handleSelectLatestMemo = () => {
    const memoEvents = events.filter(e => (e.title || '').toUpperCase().includes('MEMO') || e.isBatch);
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

        <BatchEditor onSave={handleSaveBatch} onCarryOver={handleCarryOver} initialEvent={selectedEvent} onClose={() => { setSelectedEvent(null); setMergedTaskIds([]); }} />
      </div>

      <div className="calendar-section">
        <CalendarView events={events} onSelectEvent={handleSelectEvent} />
      </div>
    </div>
  );
}

export default App;