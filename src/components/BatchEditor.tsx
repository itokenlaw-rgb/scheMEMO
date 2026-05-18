// src/components/BatchEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CalendarEvent, TimeOption, BatchItem } from '../types';
import { stringifyBatchMemo } from '../utils/calendarUtils';
import { loadSettings } from '../types/settings';
import { Check, Plus, Trash2 } from 'lucide-react'; // 不要になったSave, ArrowRight, RefreshCwを削除
import clsx from 'clsx';

interface BatchEditorProps {
  onSave: (event: CalendarEvent | CalendarEvent[], saveMode: 'save' | 'update') => void;
  onCarryOver: (items: BatchItem[], timeOption: TimeOption) => void;
  initialEvent: CalendarEvent | null;
  onClose: () => void;
}

export const BatchEditor: React.FC<BatchEditorProps> = ({ onSave, onCarryOver, initialEvent, onClose }) => {
  const [items, setItems] = useState<BatchItem[]>([]);
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

  const buildMemoString = (targetItems: BatchItem[]) => {
    return stringifyBatchMemo(targetItems.map(i => ({
      ...i,
      text: `${i.checked ? '☑' : '□'} ${i.text.replace(/^[□☑\s]*/, '').trim()}`
    })));
  };

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

  const handleUpdate21PMTime = () => {
    const validItems = items.filter(item => item.text.replace(/^[□☑\s]*/, '').trim() !== '');
    if (validItems.length === 0) return;

    const { start, end } = get21PMTime(new Date());
    const checkedItems = validItems.filter(i => i.checked);
    const uncheckedItems = validItems.filter(i => !i.checked);

    const eventsToSave: CalendarEvent[] = [];

    if (checkedItems.length > 0) {
      eventsToSave.push({
        id: initialEvent && isTitleChecked && !initialEvent.id.startsWith('evt-') ? initialEvent.id : `evt-${Date.now()}-chkd`,
        title: '☑MEMO',
        start,
        end,
        memo: buildMemoString(checkedItems),
        status: 'checked',
        isBatch: true
      });
    }

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

      {/* 個別タスクリスト（完全エクセル風・隙間ゼロ） */}
      <div 
        className="batch-list" 
        style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-sm)', 
          overflow: 'hidden', 
          marginTop: '0.5rem',
          backgroundColor: 'var(--border)'
        }}
      >
        {items.map((item, index) => {
          const hasText = item.text.replace(/^[□☑\s]*/, '').trim() !== '';
          return (
            <div
              key={item.id}
              style={{
                margin: 0,
                padding: 0,
                gap: 0,
                border: 'none',
                borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                display: 'flex',
                alignItems: 'stretch',
                width: '100%',
              }}
            >
              {/* チェックボタン */}
              <button 
                className={clsx('checkbox-btn', item.checked && 'checked')}
                onClick={() => toggleCheck(item.id)}
                style={{
                  flexShrink: 0,
                  borderRadius: 0,
                  border: 'none',
                  borderRight: '1px solid var(--border)',
                  margin: 0,
                  width: '44px',
                  height: 'auto',
                  minWidth: '44px',
                  minHeight: '44px',
                  background: item.checked ? 'var(--primary)' : 'transparent',
                }}
              >
                {item.checked && <Check size={16} />}
              </button>

              {/* テキスト入力欄 */}
              <input 
                type="text" 
                className="text-input"
                value={item.text}
                onChange={(e) => handleTextChange(item.id, e.target.value)}
                placeholder="□　やること"
                style={{ 
                  textDecoration: (item.checked && hasText) ? 'line-through' : 'none', 
                  opacity: (item.checked && hasText) ? 0.6 : 1,
                  borderRadius: 0,
                  border: 'none',
                  boxShadow: 'none',
                  flex: 1,
                  padding: '0.625rem 0.875rem',
                  height: 'auto',
                  minHeight: '44px',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text-main)',
                }}
              />

              {/* 削除ボタン */}
              <button
                onClick={() => deleteItem(item.id)}
                title="削除"
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderLeft: '1px solid var(--border)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  width: '40px',
                  minWidth: '40px',
                  justifyContent: 'center',
                  borderRadius: 0,
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

      {/* 下部アクションボタンエリア */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'nowrap' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSaveOriginalTime} 
          style={{ flex: 1, minHeight: '44px', gap: '0.25rem' }}
        >
          ☑□保存
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={handleUpdate21PMTime} 
          style={{ flex: 1, minHeight: '44px', gap: '0.25rem' }}
        >
          ☑更新□
        </button>

        {initialEvent && (
          <button className="btn btn-outline" onClick={onClose} style={{ minHeight: '44px' }}>
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
};