// src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import { SettingsPanel } from './components/SettingsPanel';
import type { CalendarEvent, BatchItem } from './types';
import type { TimeSettings } from './types/settings';
import { loadSettings, saveSettings } from './types/settings';
// 修正後
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

  // サイレント更新用タイマーの参照
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * トークンを保存し、有効期限も記録する。
   * また TOKEN_LIFETIME_MS 後に自動でサイレント再取得をスケジュールする。
   */
  const persistToken = useCallback((token: string) => {
    const expiry = Date.now() + TOKEN_LIFETIME_MS;
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_EXPIRY, String(expiry));
    setAccessToken(token);

    // 既存タイマーをリセット
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      // サイレント再ログイン（prompt なし）
      silentLogin();
    }, TOKEN_LIFETIME_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
    setAccessToken(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // ── 通常ログイン ──────────────────────────────────────────────────────────────
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => persistToken(tokenResponse.access_token),
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onError: (error) => console.error('Login Failed:', error),
  });

  // ── サイレント再取得（prompt: 'none' で画面を出さずに更新） ─────────────────
  const silentLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => persistToken(tokenResponse.access_token),
    scope: 'https://www.googleapis.com/auth/calendar.events',
    prompt: 'none',          // ← ポイント：認証画面を出さない
    onError: () => {
      // サイレント取得に失敗した場合はトークンを破棄してログアウト扱い
      console.warn('サイレント更新に失敗しました。再ログインが必要です。');
      clearToken();
      setEvents(getMockEvents());
    },
  });

  const logout = useCallback(() => {
    clearToken();
    setEvents(getMockEvents());
  }, [clearToken]);

  // ── 起動時：保存済みトークンの復元 ───────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expiry = Number(localStorage.getItem(STORAGE_KEY_EXPIRY) || '0');

    if (token && expiry > Date.now()) {
      // まだ有効 → そのまま使う＋残り時間でタイマーセット
      const remaining = expiry - Date.now();
      setAccessToken(token);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => silentLogin(), remaining);
    } else if (token) {
      // 期限切れ → サイレント更新を試みる
      clearToken();
      silentLogin();
    } else {
      // 未ログイン
      setEvents(getMockEvents());
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Google カレンダー初回読み込み ─────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        setIsLoading(true);
        const fetchedEvents = await fetchGoogleEvents(accessToken);
        setEvents(fetchedEvents);
      } catch (error) {
        console.error(error);
        if ((error as any).message?.includes('401')) {
          clearToken();
          silentLogin();
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 手動同期 ──────────────────────────────────────────────────────────────────
  const refreshEvents = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const unSyncedEvents = events.filter(event => event.id.startsWith('evt-'));
      for (const event of unSyncedEvents) {
        await createGoogleEvent(accessToken, event).catch(err => console.error('失敗:', err));
      }
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('同期エラー:', error);
      if ((error as any).message?.includes('401')) {
        clearToken();
        silentLogin();
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, events]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveSettings = (newSettings: TimeSettings) => {
    setTimeSettings(newSettings);
    saveSettings(newSettings);
    setShowSettings(false);
  };

  // ── 【２】新設：□MEMOのフィルタリング用ヘルパー（古い順ソート） ──────────────
  const getFilteredMemos = useCallback(() => {
    return events
      .filter(e => e.isBatch || (e.title || '').toUpperCase().includes('MEMO'))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  // 【２】機能実装：一番古い □MEMO の抽出
  const handleSelectOldestMemo = () => {
    const memos = getFilteredMemos();
    if (memos.length === 0) {
      alert('対象となる □MEMO が見見つかりませんでした。');
      return;
    }
    setSelectedEvent(memos[0]);
  };

  // 【２】機能実装：最新の □MEMO の抽出
  const handleSelectLatestMemo = () => {
    const memos = getFilteredMemos();
    if (memos.length === 0) {
      alert('対象となる □MEMO が見つかりませんでした。');
      return;
    }
    setSelectedEvent(memos[memos.length - 1]);
  };

  // 【２】機能実装：□MEMOをすべて1つに集める（□タスク・☑タスク全並べ）
  const handleCollectAllMemos = () => {
    const memos = getFilteredMemos();
    if (memos.length === 0) {
      alert('集める対象の □MEMO が見つかりませんでした。');
      return;
    }

    const combinedMemoLines: string[] = [];
    memos.forEach(memoEvent => {
      if (memoEvent.memo) {
        const lines = memoEvent.memo.split('\n').map(l => l.trim()).filter(l => l !== '');
        combinedMemoLines.push(...lines);
      }
    });

    if (combinedMemoLines.length === 0) {
      alert('□MEMO は見つかりましたが、中身が空でした。');
      return;
    }

    const today21 = new Date(); today21.setHours(21, 0, 0, 0);
    const today22 = new Date(); today22.setHours(22, 0, 0, 0);

    const collectedEvent: CalendarEvent = {
      id: `evt-${Date.now()}-collected`,
      title: '□MEMO',
      start: today21,
      end: today22,
      memo: combinedMemoLines.join('\n'),
      status: 'unchecked',
      isBatch: true,
    };

    setSelectedEvent(collectedEvent);
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

  const handleSaveBatch = async (event: CalendarEvent, options?: { forceDeleteOriginal?: boolean }) => {
    const forceDelete = options?.forceDeleteOriginal ?? false;

    if (accessToken) {
      setIsLoading(true);
      try {
        // 1. 強制削除フラグが立っている、または設定の削除条件に合致する場合の元予定クリーンアップ処理
        if (selectedEvent && !selectedEvent.id.startsWith('evt-')) {
          if (forceDelete) {
            // 「☑□保存」時は無条件で古いイベントを削除
            await deleteGoogleEvent(accessToken, selectedEvent.id).catch(err => console.error(err));
          } else {
            // 「☑更新□」時は設定パネルの「deletePastCompleted / deleteFutureCompleted」などの条件をみて削除を判定
            // (既存の条件判定ロジックがあればここに適用)
          }
        }

        // 2. 新規状態としてカレンダーへPOST保存、またはPUT更新
        if (selectedEvent && event.id === selectedEvent.id && !event.id.startsWith('evt-') && !forceDelete) {
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
      // オフライン（Mock環境）の処理
      if (selectedEvent && event.id === selectedEvent.id && !forceDelete) {
        updateMockEvent(event);
      } else {
        if (selectedEvent && forceDelete) deleteMockEvent(selectedEvent.id);
        addMockEvent(event);
      }
      setEvents(getMockEvents());
      setSelectedEvent(null);
    }
  };

  const handleCarryOver = async (items: BatchItem[]) => {
    const today21 = new Date(); today21.setHours(21, 0, 0, 0);
    const today22 = new Date(); today22.setHours(22, 0, 0, 0);
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-carry`,
      title: '□MEMO',
      start: today21,
      end: today22,
      memo: items.map(item => `${item.checked ? '☑' : '□'} ${item.text.replace(/^[□☑]\s*/, '').trim()}`).join('\n'),
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

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleMergeWeeklyMemos = async () => {
    const before = timeSettings.mergeDaysBefore ?? 7;
    const after = timeSettings.mergeDaysAfter ?? 7;
    const { mergedEvent, targetIds } = consolidateWeeklyMemos(events, before, after);

    if (targetIds.length === 0) {
      alert('統合対象となる未完了メモが見つかりませんでした。');
      return;
    }

    if (!window.confirm(`未完了メモが ${targetIds.length} 件見つかりました。本日21時の『□ MEMO』に1つにまとめますか？`)) return;

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

        {/* ── 【１】【２】UIボタン操作エリアの刷新 ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', margin: '0.5rem 0' }}>
          
          {/* 【１】横長1行の「□タスクを ↓ □MEMOにする」ボタン */}
          <button
            className="btn btn-secondary"
            onClick={handleMergeWeeklyMemos}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '44px' }}
            disabled={isLoading}
          >
            <Layers size={18} /> □タスクを ↓ □MEMOにする
          </button>

{/* 【２】3列等幅・2行縦並び表示の機能ボタン */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="btn btn-outline btn-memo-action"
              onClick={handleSelectOldestMemo}
              disabled={isLoading}
              /* 🎨 右：キリッとした濃いパープル */
              style={{ color: 'var(--primary-hover)', borderColor: 'var(--primary-hover)' }}
            >
              <div>一番古い</div>
              <div>□MEMO</div>
            </button>

            <button
              className="btn btn-outline btn-memo-action"
              onClick={handleCollectAllMemos}
              disabled={isLoading}
              /* 🎨 中央：鮮やかなオレンジ */
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              <div>□MEMOを</div>
              <div>集める</div>
            </button>

            <button
              className="btn btn-outline btn-memo-action"
              onClick={handleSelectLatestMemo}
              disabled={isLoading}
              /* 🎨 右：キリッとした濃いパープル */
              style={{ color: 'var(--primary-hover)', borderColor: 'var(--primary-hover)' }}
            >
              <div>最新の</div>
              <div>□MEMO</div>
            </button>
          </div>
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