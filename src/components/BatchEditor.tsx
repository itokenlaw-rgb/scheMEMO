// src/components/BatchEditor.tsx
import React, { useState, useEffect } from 'react';
import type { CalendarEvent, TimeOption, BatchItem } from '../types';
import { 
  calculateEventTime, 
  parseBatchMemo, 
  stringifyBatchMemo, 
  determineBatchStatus, 
  getBatchTitlePrefix 
} from '../utils/calendarUtils';
import { Check, Save, Plus, ArrowRight, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface BatchEditorProps {
  onSave: (event: CalendarEvent) => void;
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
  const [selectedTime, setSelectedTime] = useState<TimeOption>('today');
  const [carryOverTime, setCarryOverTime] = useState<TimeOption>('tomorrow');
  const [memoTitle, setMemoTitle] = useState('□MEMO');

  useEffect(() => {
    // 💡 initialEventが存在し、バッチ予定、またはタイトルにMEMOを含む場合に抽出
    if (initialEvent && (initialEvent.isBatch || initialEvent.title.toUpperCase().includes('MEMO'))) {
      setMemoTitle(initialEvent.title);

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

        // 抽出枠数が3つ以上（埋まった状態）であれば空欄を3つ足す
        if (extractedItems.length >= 3) {
          const emptyItems: BatchItem[] = Array(3).fill(null).map((_: null, i: number) => ({
            id: `item-${Date.now()}-empty-${i}`,
            text: '□　',
            checked: false,
          }));
          setItems([...extractedItems, ...emptyItems]);
        } else {
          // 3つ未満の場合は、足りない分を補って合計3枠以上にするか、そのままセット
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
      setItems([
        { id: `item-1`, text: '□　', checked: false },
        { id: `item-2`, text: '□　', checked: false },
        { id: `item-3`, text: '□　', checked: false },
      ]);
    }
  }, [initialEvent]);

  const handleTextChange = (id: string, text: string) => {
    setItems(items.map(item => item.id === id ? { ...item, text } : item));
  };

  const toggleCheck = (id: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const nextChecked = !item.checked;
        const cleanText = item.text.replace(/^[□☑]\s*/, '').trim();
        return {
          ...item,
          checked: nextChecked,
          text: `${nextChecked ? '☑' : '□'}　${cleanText}`
        };
      }
      return item;
    }));
  };

  const addItems = () => {
    const newItems = Array(3).fill(null).map((_, i) => ({
      id: `item-${Date.now()}-${i}`,
      text: '□　',
      checked: false
    }));
    setItems([...items, ...newItems]);
  };

  const checkAll = () => {
    setItems(items.map(item => {
      const cleanText = item.text.replace(/^[□☑]\s*/, '').trim();
      return { ...item, checked: true, text: `☑　${cleanText}` };
    }));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSave = () => {
    const validItems = items.filter(item => item.text.replace(/^[□☑]\s*/, '').trim() !== '');
    if (validItems.length === 0) return;

    const status = determineBatchStatus(validItems);
    const prefix = getBatchTitlePrefix(status);
    const rawTitle = memoTitle.replace(/^[□☑△]\s*/, '').trim() || 'やること';
    const title = `${prefix} ${rawTitle}`;
    const memo = stringifyBatchMemo(validItems.map(i => ({
      ...i,
      text: i.text.replace(/^[□☑]\s*/, '').trim()
    })));

    if (initialEvent) {
      onSave({ ...initialEvent, title, memo, status, isBatch: true });
    } else {
      const { start, end } = calculateEventTime(selectedTime);
      onSave({ id: `evt-${Date.now()}`, title, start, end, memo, status, isBatch: true });
    }
    setMemoTitle('□MEMO');
    onClose();
  };

  const handleCarryOver = () => {
    const uncheckedItems = items.filter(i => !i.checked && i.text.replace(/^[□☑]\s*/, '').trim() !== '');
    if (uncheckedItems.length > 0) {
      onCarryOver(uncheckedItems, carryOverTime);
    }
    handleSave();
  };

  return (
    <div className="card batch-editor">
      <div className="card-title" style={{ gap: '0.5rem' }}>
        <input
          type="text"
          className="text-input"
          value={memoTitle}
          onChange={(e) => setMemoTitle(e.target.value)}
          style={{ fontWeight: 700, fontSize: '1.1rem', flex: 1 }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="btn btn-outline btn-sm" onClick={checkAll}>
          <Check size={16} /> 全部実行済み
        </button>
        <button className="btn btn-outline btn-sm" onClick={addItems}>
          <Plus size={16} /> リスト追加
        </button>
      </div>

      <div className="batch-list">
        {items.map(item => (
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
              style={{ textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.6 : 1 }}
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
        ))}
      </div>

      {!initialEvent && (
        <div className="time-grid" style={{ marginTop: '0.875rem' }}>
          {timeOptions.map(opt => (
            <button
              key={opt.value}
              className={clsx('time-btn', selectedTime === opt.value && 'active')}
              onClick={() => setSelectedTime(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
          <Save size={18} /> {initialEvent ? '更新' : '保存'}
        </button>
        {initialEvent && (
          <button className="btn btn-outline" onClick={onClose}>
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