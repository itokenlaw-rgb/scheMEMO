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
// src/App.tsx より、該当の handleMergeWeeklyMemos 関数周辺のみ抜粋

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
        
        const isWithinRange = eventDate >= startRange && eventDate <= endRange;
        
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

      // ── 【１の修正】集めたタスクを開始時刻の古い順（時系列順）に並び替える ──
      targetTasks.sort((a, b) => {
        const timeA = new Date(a.start).getTime();
        const timeB = new Date(b.start).getTime();
        return timeA - timeB; // 古い順にソート
      });

      // 3. 時系列順にソートされたタスクのタイトルを1行ずつの箇条書きテキストにする
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

      // 7. エディターへセット
      setSelectedEvent(generatedMemoEvent);

    } catch (error) {
      console.error(error);
      alert("処理中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

// ─── 【修正】「一番古いメモ」ボタンを押したときの処理 ───
  const handleSelectOldestMemo = () => {
    // 1. タイトルに「MEMO」が含まれる、または isBatch が true の予定を抽出
    // ★【仕様変更】すでに「☑」から始まる完了済みのメモは [!e.title.startsWith('☑')] で完全に除外します
    const activeMemoEvents = events.filter(e => {
      const title = (e.title || '').trim();
      const isMemo = title.toUpperCase().includes('MEMO') || e.isBatch;
      const isCompleted = title.startsWith('☑');
      return isMemo && !isCompleted;
    });

    if (activeMemoEvents.length === 0) {
      alert("未完了の「□MEMO」が見つかりませんでした。");
      return;
    }

    // 2. 残った未完了メモの中から、開始時刻が一番古いものを取得
    const oldestMemo = activeMemoEvents.reduce((old, current) => 
      new Date(current.start) < new Date(old.start) ? current : old
    );

    // 3. ★【仕様変更】エディターで表示するときに、確実に最初からチェックが外れた状態（□MEMO）にするための変換
    const cleanTitle = oldestMemo.title.replace(/^[□☑△]\s*/, '').trim();
    const preparedMemoEvent: CalendarEvent = {
      ...oldestMemo,
      title: `□ ${cleanTitle}`, // タイトルの先頭を強制的に「□」にする
      status: 'unchecked'       // ステートを未チェック状態にする
    };

    // 4. 調整したイベントをエディターへセットして展開
    setSelectedEvent(preparedMemoEvent);
  };


  const handleCollectAllMemos = () => {
    setIsLoading(true);
    try {
      // 1. すべてのイベントから「□MEMO」などのメモ予定を抽出
      const memoEvents = events.filter(e => 
        (e.title || '').toUpperCase().includes('MEMO') || e.isBatch
      );

      if (memoEvents.length === 0) {
        alert("集める対象の「□MEMO」が見つかりませんでした。");
        setIsLoading(false);
        return;
      }

      // 2. メモ予定を開始時刻の古い順（時系列順）にソート
      memoEvents.sort((a, b) => {
        const timeA = new Date(a.start).getTime();
        const timeB = new Date(b.start).getTime();
        return timeA - timeB;
      });

      // 3. 古い順に並んだメモから、中の全タスク行を一つの配列にフラットに抽出
      const allLines: string[] = [];
      memoEvents.forEach(event => {
        if (event.memo) {
          const lines = event.memo
            .split('\n')
            .map(l => l.trim())
            .filter(l => l !== '');
          allLines.push(...lines);
        }
      });

      if (allLines.length === 0) {
        alert("抽出したメモの中にタスク（テキスト）がありませんでした。");
        setIsLoading(false);
        return;
      }

      // 4. 新しく生成する「まとめ□MEMO」のテキストとして結合
      const combinedMemoContent = allLines.join('\n');

      // 5. 本日の指定時刻（例: 21時）に配置する仮想の親イベントを作成
      const now = new Date();
      const memoStart = new Date(now);
      memoStart.setHours(timeSettings.batchMemoSaveHour || 21, 0, 0, 0);
      const memoEnd = new Date(memoStart);
      memoEnd.setHours(memoStart.getHours() + 1);

      const generatedCollectedMemo: CalendarEvent = {
        id: `evt-${Date.now()}-collected`,
        title: '□MEMO',
        start: memoStart,
        end: memoEnd,
        memo: combinedMemoContent,
        status: 'unchecked',
        isBatch: true
      };

      // 6. BatchEditor に流し込むためにステートへセット
      setSelectedEvent(generatedCollectedMemo);

    } catch (error) {
      console.error(error);
      alert("メモの収集処理中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
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

<BatchEditor
  onSave={handleSaveBatch}
  onCarryOver={handleCarryOver}
  initialEvent={selectedEvent}
  onClose={() => setSelectedEvent(null)}
  // 【新設】抽出範囲内の ☑タスク を一括削除する処理
  onDeleteCheckedTasks={() => {
    // 1. 設定から抽出範囲（日前〜日後）の時間を計算
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - timeSettings.mergeDaysBefore);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setDate(now.getDate() + timeSettings.mergeDaysAfter);
    end.setHours(23, 59, 59, 999);

    // 2. 範囲内の「☑」から始まるタスク（MEMOを含まないもの）だけを厳密に抽出
    const targets = events.filter(evt => {
      const isWithinRange = evt.start >= start && evt.start <= end;
      const isChecked = evt.title.trim().startsWith('☑');
      const isMemo = evt.title.includes('MEMO');
      return isWithinRange && isChecked && !isMemo;
    });

    if (targets.length === 0) {
      alert('指定された抽出範囲内に、削除対象となる完了済みタスク（☑タスク）は見つかりませんでした。');
      return;
    }

    if (window.confirm(`【確認】抽出範囲内の「☑タスク」を合計 ${targets.length} 件、完全に削除しますか？\n※□タスクやMEMOは絶対に削除されません。`)) {
      // アラート音（ビープ音）を鳴らす
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // 高めのピピッという音
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);

      // カレンダーDBから削除を実行
      setIsLoading(true);
      Promise.all(
        targets.map(async (evt) => {
          if (accessToken) {
            await deleteGoogleEvent(accessToken, evt.id);
          } else {
            deleteMockEvent(evt.id);
          }
        })
      ).then(() => {
        // 画面の表示を更新
        setEvents(prev => prev.filter(e => !targets.some(t => t.id === e.id)));
        alert(`削除が完了しました。（対象: ☑タスク ${targets.length} 件）`);
      }).catch(err => {
        alert('削除中にエラーが発生しました: ' + err.message);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }}
  // 【新設】抽出範囲内の ☑MEMO を一括削除する処理
  onDeleteCheckedMemos={() => {
    // 1. 設定から抽出範囲（日前〜日後）の時間を計算
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - timeSettings.mergeDaysBefore);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setDate(now.getDate() + timeSettings.mergeDaysAfter);
    end.setHours(23, 59, 59, 999);

    // 2. 範囲内の「☑」かつ「MEMO」から始まる予定だけを厳密に抽出
    const targets = events.filter(evt => {
      const isWithinRange = evt.start >= start && evt.start <= end;
      // タイトルから空白を除いて「☑MEMO」で始まっているか判定
      const cleanTitle = evt.title.replace(/\s+/g, '');
      return isWithinRange && cleanTitle.startsWith('☑MEMO');
    });

    if (targets.length === 0) {
      alert('指定された抽出範囲内に、削除対象となる完了済みメモ（☑MEMO）は見つかりませんでした。');
      return;
    }

    if (window.confirm(`【警告】抽出範囲内の「☑MEMO」を合計 ${targets.length} 件、完全に削除しますか？\n※中の未完了タスク等が含まれている場合も一緒に消去されます。`)) {
      // アラート音（ビープ音）を鳴らす
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // 少し低めの警告音
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.25);

      // カレンダーDBから削除を実行
      setIsLoading(true);
      Promise.all(
        targets.map(async (evt) => {
          if (accessToken) {
            await deleteGoogleEvent(accessToken, evt.id);
          } else {
            deleteMockEvent(evt.id);
          }
        })
      ).then(() => {
        // 画面の表示を更新
        setEvents(prev => prev.filter(e => !targets.some(t => t.id === e.id)));
        setSelectedEvent(null); // 開いていたエディターも安全に閉じる
        alert(`削除が完了しました。（対象: ☑MEMO ${targets.length} 件）`);
      }).catch(err => {
        alert('削除中にエラーが発生しました: ' + err.message);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }}
/>
      </div>

      <div className="calendar-section">
        <CalendarView events={events} onSelectEvent={handleSelectEvent} />
      </div>
    </div>
  );
}

export default App;