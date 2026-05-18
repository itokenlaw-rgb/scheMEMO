// src/components/BatchEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CalendarEvent, TimeOption, BatchItem } from '../types';
import { stringifyBatchMemo } from '../utils/calendarUtils';
import { loadSettings } from '../types/settings';
import { Check, Save, Plus, ArrowRight, Trash2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

// 親のSaveコールバックが、単一のイベントだけでなく配列（複数イベント）も受け取れるように型を定義
interface BatchEditorProps {
  onSave: (event: CalendarEvent | CalendarEvent[], saveMode: 'save' | 'update') => void;
  onCarryOver: (items: BatchItem[], timeOption: TimeOption) => void;
  initialEvent: CalendarEvent | null;
  onClose: () => void;
}

const timeOptions: { value: TimeOption; label: string }[] = [
  { value: 'today', label: '今日中' },
  { value: 'tomorrow', label: '明日中' },
  { value: 'weekend', label: '週末' },
  { value: 'endOfMonth', label: '月末' },
  { value: 'tonight', label: '今日夜' },
  { value: 'tomorrowNight', label: '明日夜' },
  { value: 'nextWeek', label: '来週' },
  { value: 'nextMonth', label: '来月' },
];

export const BatchEditor: React.FC<BatchEditorProps> = ({ onSave, onCarryOver, initialEvent, onClose }) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [carryOverTime, setCarryOverTime] = useState<TimeOption>('tomorrow');
  const [memoTitle, setMemoTitle] = useState('□MEMO');
  const [isTitleChecked, setIsTitleChecked] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialEvent) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (initialEvent) {
      const rawTitle = initialEvent.title.replace(/^[□☑△]\s*/, '').trim();
      const hasMemo = initialEvent.title.toUpperCase().includes('MEMO') || initialEvent.isBatch;

      if (hasMemo) {
        setMemoTitle(initialEvent.title);
        setIsTitleChecked(/^☑/.test(initialEvent.title));
      } else if (initialEvent.title.startsWith('□') || initialEvent.title.startsWith('☑')) {
        setMemoTitle(initialEvent.title);
        setIsTitleChecked(/^☑/.test(initialEvent.title));
      } else {
        setMemoTitle(`□ ${rawTitle}`);
        setIsTitleChecked(false);
      }

      const memo = initialEvent.memo ?? '';
      const lines = memo.split('\n').map((l: string) => l.trim()).filter((l: string) => l !== '');

      if (lines.length > 0) {
        const extractedItems: BatchItem[] = lines.map((line: string, i: number) => {
          const checked = /^☑/.test(line);
          const cleanText = line.replace(/^[□☑△]\s*/, '').trim();
          
          return {
            id: `item-${Date.now()}-${i}`,
            text: `${checked ? '☑' : '□'}　${cleanText}`,
            checked,
          };
        });

        if (extractedItems.length >= 3) {
          const emptyItems: BatchItem[] = Array(3).fill(null).map((_: null, i: number) => ({
            id: `item-${Date.now()}-empty-${i}`,
            text: '□　',
            checked: false,
          }));
          setItems([...extractedItems, ...emptyItems]);
        } else {
          const deficit = 3 - extractedItems.length;
          const emptyItems: BatchItem[] = Array(deficit).fill(null).map((_: null, i: number) => ({
            id: `item-${Date.now()}-empty-${i}`,
            text: '□　',
            checked: false,
          }));
          setItems([...extractedItems, ...emptyItems]);
        }
      } else {
        setItems([
          { id: `item-1`, text: '□　', checked: false },
          { id: `item-2`, text: '□　', checked: false },
          { id: `item-3`, text: '□　', checked: false },
        ]);
      }
    } else {
      setMemoTitle('□MEMO');
      setIsTitleChecked(false);
      setItems([
        { id: `item-1`, text: '□　', checked: false },
        { id: `item-2`, text: '□　', checked: false },
        { id: `item-3`, text: '□　', checked: false },
      ]);
    }
  }, [initialEvent]);

  const toggleTitleCheck = () => {
    const nextChecked = !isTitleChecked;
    setIsTitleChecked(nextChecked);

    const cleanTitle = memoTitle.replace(/^[□☑△]\s*/, '').trim();
    setMemoTitle(`${nextChecked ? '☑' : '□'} ${cleanTitle}`);

    setItems(items.map(item => {
      const cleanText = item.text.replace(/^[□☑\s]*/, '').trim();
      if (cleanText === '') return item;

      return {
        ...item,
        checked: nextChecked,
        text: `${nextChecked ? '☑' : '□'}　${cleanText}`
      };
    }));
  };

  const handleTextChange = (id: string, text: string) => {
    setItems(items.map(item => item.id === id ? { ...item, text } : item));
  };

  const toggleCheck = (id: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const nextChecked = !item.checked;
        const cleanText = item.text.replace(/^[□☑\s]*/, '').trim();
        return {
          ...item,
          checked: nextChecked,
          text: `${nextChecked ? '☑' : '□'}　${cleanText}`
        };
      }
      return item;
    }));
  };

  const addSingleItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      text: '□　',
      checked: false
    };
    setItems([...items, newItem]);
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const get21PMTime = (baseDate: Date = new Date()) => {
    const hour = loadSettings().batchMemoSaveHour ?? 21;
    const start = new Date(baseDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(hour + 1, 0, 0, 0);
    return { start, end };
  };

  // 1つのメモテキスト（文字列）を作成するヘルパー
  const buildMemoString = (targetItems: BatchItem[]) => {
    return stringifyBatchMemo(targetItems.map(i => ({
      ...i,
      text: `${i.checked ? '☑' : '□'} ${i.text.replace(/^[□☑\s]*/, '').trim()}`
    })));
  };

  // ── 【１】「☑□保存」ボタン：混在のまま元の時間に保存 ─────────────────────
  const handleSaveOriginalTime = () => {
    const validItems = items.filter(item => item.text.replace(/^[□☑\s]*/, '').trim() !== '');
    if (validItems.length === 0) return;

    const start = initialEvent ? new Date(initialEvent.start) : new Date();
    const end = initialEvent ? new Date(initialEvent.end) : new Date(Date.now() + 60 * 60 * 1000);

    const memo = buildMemoString(validItems);

    onSave({
      id: initialEvent && !initialEvent.id.startsWith('evt-') ? initialEvent.id : `evt-${Date.now()}-saved`,
      title: memoTitle,
      start,
      end,
      memo,
      status: isTitleChecked ? 'checked' : 'unchecked',
      isBatch: true
    }, 'save');

    cleanupEditor();
  };

  // ── 【１】「☑更新□」ボタン：☑と□を分離して本日21時に登録 ─────────────────
  const handleUpdate21PMTime = () => {
    const validItems = items.filter(item => item.text.replace(/^[□☑\s]*/, '').trim() !== '');
    if (validItems.length === 0) return;

    const { start, end } = get21PMTime(new Date());
    const checkedItems = validItems.filter(i => i.checked);
    const uncheckedItems = validItems.filter(i => !i.checked);

    const eventsToSave: CalendarEvent[] = [];

    // A. ☑したタスクがあれば「☑MEMO」としてまとめる
    if (checkedItems.length > 0) {
      eventsToSave.push({
        // 元イベントがあり、かつ全体がチェック済みの場合は既存IDを再利用、それ以外は新規作成
        id: initialEvent && isTitleChecked && !initialEvent.id.startsWith('evt-') ? initialEvent.id : `evt-${Date.now()}-chkd`,
        title: '☑MEMO',
        start,
        end,
        memo: buildMemoString(checkedItems),
        status: 'checked',
        isBatch: true
      });
    }

    // B. □のままのタスクがあれば「□MEMO」としてまとめる
    if (uncheckedItems.length > 0) {
      eventsToSave.push({
        id: initialEvent && !isTitleChecked && !initialEvent.id.startsWith('evt-') ? initialEvent.id : `evt-${Date.now()}-unchkd`,
        title: '□MEMO',
        start,
        end,
        memo: buildMemoString(uncheckedItems),
        status: 'unchecked',
        isBatch: true
      });
    }

    // 構築したイベント（1つまたは2つ）をまとめて親に引き渡す
    if (eventsToSave.length > 0) {
      onSave(eventsToSave, 'update');
    }

    cleanupEditor();
  };

  const cleanupEditor = () => {
    setMemoTitle('□MEMO');
    setIsTitleChecked(false);
    onClose();
  };

  const handleCarryOver = () => {
    const uncheckedItems = items.filter(i => !i.checked && i.text.replace(/^[□☑\s]*/, '').trim() !== '');
    if (uncheckedItems.length > 0) {
      onCarryOver(uncheckedItems, carryOverTime);
    }
    handleUpdate21PMTime();
  };

  return (
    <div ref={topRef} className="card batch-editor">
      {/* タイトルエリア */}
      <div className="card-title" style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
        <button 
          className={clsx('checkbox-btn', isTitleChecked && 'checked')}
          onClick={toggleTitleCheck}
          style={{ flexShrink: 0 }}
        >
          {isTitleChecked && <Check size={16} />}
        </button>
        <input
          type="text"
          className="text-input"
          value={memoTitle}
          onChange={(e) => setMemoTitle(e.target.value)}
          style={{ 
            fontWeight: 700, 
            fontSize: '1.1rem', 
            flex: 1,
            textDecoration: isTitleChecked ? 'line-through' : 'none',
            opacity: isTitleChecked ? 0.6 : 1
          }}
        />
      </div>

      {/* 個別タスクリスト */}
      <div className="batch-list">
        {items.map(item => {
          const hasText = item.text.replace(/^[□☑\s]*/, '').trim() !== '';
          return (
            <div key={item.id} className="input-group" style={{ marginBottom: 0 }}>
              <button 
                className={clsx('checkbox-btn', item.checked && 'checked')}
                onClick={() => toggleCheck(item.id)}
              >
                {item.checked && <Check size={16} />}
              </button>
              <input 
                type="text" 
                className="text-input"
                value={item.text}
                onChange={(e) => handleTextChange(item.id, e.target.value)}
                placeholder="□　やること"
                style={{ 
                  textDecoration: (item.checked && hasText) ? 'line-through' : 'none', 
                  opacity: (item.checked && hasText) ? 0.6 : 1 
                }}
              />
              <button
                onClick={() => deleteItem(item.id)}
                title="削除"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  minWidth: '32px',
                  minHeight: '32px',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* リスト追加ボタン */}
      <div style={{ display: 'flex', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="btn btn-outline btn-sm" onClick={addSingleItem} style={{ width: '100%' }}>
          <Plus size={16} /> リスト追加
        </button>
      </div>

      {/* 下部アクションボタンエリアの刷新 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'nowrap' }}>
        
        {/* 【１】「☑□保存」ボタン */}
        <button 
          className="btn btn-primary" 
          onClick={handleSaveOriginalTime} 
          style={{ flex: 1, minHeight: '44px', gap: '0.25rem' }}
        >
          <Save size={16} /> ☑□保存
        </button>

        {/* 【１】「☑更新□」ボタン */}
        <button 
          className="btn btn-secondary" 
          onClick={handleUpdate21PMTime} 
          style={{ flex: 1, minHeight: '44px', gap: '0.25rem' }}
        >
          <RefreshCw size={16} /> ☑更新□
        </button>

        {initialEvent && (
          <button className="btn btn-outline" onClick={onClose} style={{ minHeight: '44px' }}>
            キャンセル
          </button>
        )}
      </div>

      {initialEvent && (
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>未完了を持ち越す</h3>
          <div className="time-grid" style={{ marginBottom: '0.5rem' }}>
            {timeOptions.map(opt => (
              <button
                key={`carry-${opt.value}`}
                className={clsx('time-btn', carryOverTime === opt.value && 'active')}
                onClick={() => setCarryOverTime(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-full" onClick={handleCarryOver}>
            <ArrowRight size={18} /> やることを持ち越す
          </button>
        </div>
      )}
    </div>
  );
};