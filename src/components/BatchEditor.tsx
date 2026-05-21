// src/components/BatchEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CalendarEvent, TimeOption, BatchItem } from '../types';
import { stringifyBatchMemo } from '../utils/calendarUtils';
import { Check, Plus, Trash2 } from 'lucide-react'; 
import clsx from 'clsx';

interface BatchEditorProps {
  onSave: (event: CalendarEvent | CalendarEvent[], saveMode: 'save' | 'update') => void;
  onCarryOver: (items: BatchItem[], timeOption: TimeOption) => void;
  initialEvent: CalendarEvent | null;
  onClose: () => void;
  onDeleteCheckedTasks?: () => void; // 追加
  onDeleteCheckedMemos?: () => void; // 追加
}

export const BatchEditor: React.FC<BatchEditorProps> = ({ 
  onSave, 
  onCarryOver: _onCarryOver, 
  initialEvent, 
  onClose,
  onDeleteCheckedTasks, // 追加
  onDeleteCheckedMemos  // 追加
}) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [memoTitle, setMemoTitle] = useState('□MEMO');
  const [isTitleChecked, setIsTitleChecked] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialEvent) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const rawTitle = initialEvent.title.replace(/^[□☑△]\s*/, '').trim();
      const hasMemo = initialEvent.title.includes('MEMO');
      setMemoTitle(hasMemo ? '□MEMO' : rawTitle || '□MEMO');
      setIsTitleChecked(initialEvent.title.startsWith('☑'));

      if (initialEvent.memo) {
        const lines = initialEvent.memo.split('\n');
        const parsed: BatchItem[] = lines
          .filter(line => line.trim().length > 0)
          .map((line, idx) => {
            const checked = line.startsWith('☑');
            const text = line.replace(/^[□☑]\s*/, '').trim();
            return {
              id: `init-${idx}-${Date.now()}`,
              text,
              checked,
              originalEventId: initialEvent.id
            };
          });
        setItems(parsed);
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
      setMemoTitle('□MEMO');
      setIsTitleChecked(false);
    }
  }, [initialEvent]);

  if (!initialEvent) return null;

  const toggleCheck = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const updateText = (id: string, text: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, text } : item));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addSingleItem = () => {
    setItems(prev => [...prev, { id: `new-${Date.now()}-${Math.random()}`, text: '', checked: false }]);
  };

  return (
    <div ref={topRef} className="card batch-editor" style={{ marginTop: '1rem', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
          <button
            className={clsx('checkbox-trigger', isTitleChecked && 'checked')}
            onClick={() => setIsTitleChecked(!isTitleChecked)}
            style={{ padding: 0, width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isTitleChecked && <Check size={16} />}
          </button>
          <input
            type="text"
            className="text-input"
            value={memoTitle}
            onChange={e => setMemoTitle(e.target.value)}
            style={{ fontSize: '1.1rem', fontWeight: 'bold', border: 'none', padding: '4px', width: '100%', background: 'transparent' }}
          />
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose} style={{ minWidth: '40px' }}>閉じる</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
        {items.map(item => (
          <div key={item.id} className="input-group" style={{ marginBottom: 0, gap: '0.25rem', alignItems: 'center' }}>
            <button
              className={clsx('checkbox-trigger', item.checked && 'checked')}
              onClick={() => toggleCheck(item.id)}
              style={{ padding: 0, width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {item.checked && <Check size={14} />}
            </button>
            <input
              type="text"
              className="text-input"
              value={item.text}
              onChange={e => updateText(item.id, e.target.value)}
              style={{
                textDecoration: item.checked ? 'line-through' : 'none',
                opacity: item.checked ? 0.5 : 1,
                fontSize: '0.9rem',
                padding: '6px 8px'
              }}
            />
            <button
              className="btn btn-outline"
              onClick={() => deleteItem(item.id)}
              style={{ padding: 0, width: '34px', height: '34px', color: 'var(--text-muted)', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', minWidth: '40px', justifyContent: 'center', borderRadius: 0 }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="btn btn-outline btn-sm" onClick={addSingleItem} style={{ width: '100%' }}>
          <Plus size={16} /> リスト追加
        </button>
      </div>

      {/* アクションボタンエリア */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
        
        {/* 上段：通常の保存・更新 */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => onSave({ ...initialEvent, title: `${isTitleChecked ? '☑' : '□'} ${memoTitle}`, memo: stringifyBatchMemo(items) }, 'save')} style={{ flex: 1, minHeight: '44px' }}>
            ☑□保存
          </button>
          <button className="btn btn-secondary" onClick={() => onSave({ ...initialEvent, title: `${isTitleChecked ? '☑' : '□'} ${memoTitle}`, memo: stringifyBatchMemo(items) }, 'update')} style={{ flex: 1, minHeight: '44px' }}>
            ☑更新□
          </button>
        </div>

        {/* 下段：【修正】ご指示通りの仕様に変更した一括削除ボタン2種 */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-outline" 
            onClick={onDeleteCheckedTasks} 
            style={{ flex: 1, minHeight: '40px', borderColor: '#ef4444', color: '#ef4444', backgroundColor: '#fff5f5', fontWeight: '600', fontSize: '0.85rem' }}
          >
            <Trash2 size={14} style={{ marginRight: '2px' }} /> ☑タスクを削除
          </button>

          <button 
            className="btn btn-outline" 
            onClick={onDeleteCheckedMemos} 
            style={{ flex: 1, minHeight: '40px', borderColor: '#b91c1c', color: '#b91c1c', backgroundColor: '#fef2f2', fontWeight: '600', fontSize: '0.85rem' }}
          >
            <Trash2 size={14} style={{ marginRight: '2px' }} /> ☑MEMOを削除
          </button>
        </div>

      </div>
    </div>
  );
};