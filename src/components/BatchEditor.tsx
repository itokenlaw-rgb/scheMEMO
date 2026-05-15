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

  useEffect(() => {
    if (initialEvent && initialEvent.isBatch) {
      setItems(parseBatchMemo(initialEvent.memo));
    } else {
      // Default 3 items
      setItems([
        { id: `item-1`, text: '', checked: false },
        { id: `item-2`, text: '', checked: false },
        { id: `item-3`, text: '', checked: false },
      ]);
    }
  }, [initialEvent]);

  const handleTextChange = (id: string, text: string) => {
    setItems(items.map(item => item.id === id ? { ...item, text } : item));
  };

  const toggleCheck = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const addItems = () => {
    const newItems = Array(3).fill(null).map((_, i) => ({
      id: `item-${Date.now()}-${i}`,
      text: '',
      checked: false
    }));
    setItems([...items, ...newItems]);
  };

  const checkAll = () => {
    setItems(items.map(item => ({ ...item, checked: true })));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSave = () => {
    const validItems = items.filter(item => item.text.trim() !== '');
    if (validItems.length === 0) return;

    const status = determineBatchStatus(validItems);
    const prefix = getBatchTitlePrefix(status);
    const title = `${prefix} やること`;
    const memo = stringifyBatchMemo(validItems);

    if (initialEvent) {
      onSave({
        ...initialEvent,
        title,
        memo,
        status,
      });
    } else {
      const { start, end } = calculateEventTime(selectedTime);
      onSave({
        id: `evt-${Date.now()}`,
        title,
        start,
        end,
        memo,
        status,
        isBatch: true
      });
    }
    onClose();
  };

  const handleCarryOver = () => {
    const uncheckedItems = items.filter(i => !i.checked && i.text.trim() !== '');
    if (uncheckedItems.length > 0) {
      onCarryOver(uncheckedItems, carryOverTime);
    }
    
    // Save current as is
    handleSave();
  };

  return (
    <div className="card batch-editor">
      <h2 className="card-title">
        {initialEvent ? 'リストメモ' : 'リストメモ'}
      </h2>

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
              placeholder="やること"
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
