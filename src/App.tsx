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
import { Calendar as CalendarIcon, Settings, RefreshCw, Layers, LogIn, LogOut } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(loadSettings);

  // 【１】更新ボタンのアニメーション管理ステート
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('google_access_token');
    if (token) setAccessToken(token);
    else setEvents(getMockEvents());
  }, []);

  // 【２】「画面の予定をGoogleへ反映」させた後に「Googleの予定を画面に表示」する双方向同期ロジック
  const refreshEvents = useCallback(async () => {
    if (!accessToken) return;
    
    // ボタン押下時にアニメーションを開始
    setIsSpinning(true);

    try {
      // Step A: scheMEMO側の未同期予定（IDがevt-から始まる仮データ）を抽出
      const unSyncedEvents = events.filter(event => event.id.startsWith('evt-'));
      
      if (unSyncedEvents.length > 0) {
        console.log(`${unSyncedEvents.length}件の未同期データをGoogleカレンダーに保存中...`);
        // scheMEMOカレンダーをGoogleカレンダーに同期（書き出し）
        for (const event of unSyncedEvents) {
          try {
            await createGoogleEvent(accessToken, event);
          } catch (err) {
            console.error(`「${event.title}」の保存に失敗しました:`, err);
          }
        }
      }

      // Step B: 書き出し完了後、Googleカレンダーから最新の予定を再取得
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      // GoogleカレンダーをscheMEMOカレンダーに表示（読み込み）
      setEvents(fetchedEvents);

    } catch (error) {
      console.error('同期処理中にエラーが発生しました:', error);
    } finally {
      // ✅ 最低でも1回転（800ms）は見せつつ、通信が長引いた場合は通信が終わるまで回り続ける仕様に改善
      setTimeout(() => {
        setIsSpinning(false);
      }, 800);
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

  // 【１】OAuth未実装環境でも動く仮のログイン処理（アカウント選択のシミュレートを追加）
  const simulateLogin = () => {
    const userEmail = prompt('ログインするGoogleアカウント（メールアドレス）を入力、または選択してください:', 'user@gmail.com');
    
    // キャンセルされた場合は処理を中断
    if (userEmail === null) return;

    // 入力が空でなければ、選択されたアカウントとしてログイン処理を進める
    const dummyToken = `mock_access_token_for_${userEmail || 'default'}`;
    setAccessToken(dummyToken);
    localStorage.setItem('google_access_token', dummyToken);
    alert(`${userEmail || 'user@gmail.com'} としてログインしました。`);
  };

  // 【２】ログアウト処理（確認ダイアログを追加）
  const logout = () => {
    const confirmLogout = window.confirm('ログアウトしてよろしいですか？');
    if (!confirmLogout) return;

    setAccessToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(getMockEvents());
  };

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
          {accessToken ? (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={refreshEvents}
                title="カレンダーを更新・同期"
                style={{ padding: '0.4rem', minHeight: '34px' }}
              >
                <RefreshCw size={16} className={isSpinning ? 'spin' : ''} />
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
              onClick={simulateLogin} 
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