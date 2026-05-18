import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent, TimeOption } from '../types';
import { calculateEventTime } from '../utils/calendarUtils';
import { Save } from 'lucide-react';

interface SingleEditorProps {
  onSave: (event: CalendarEvent) => void;
  defaultTime?: TimeOption;
}

/** input を □ の直後にフォーカス・カーソル配置するヘルパー */
function focusAfterCheckbox(el: HTMLInputElement | null) {
  if (!el) return;
  el.focus();
  // □ は1文字だが、念のため value から長さを取る
  const pos = el.value.length;
  el.setSelectionRange(pos, pos);
}

export const SingleEditor: React.FC<SingleEditorProps> = ({ onSave, defaultTime = 'today' }) => {
  const [text1, setText1] = useState('□');
  const [text2, setText2] = useState('□');
  const [text3, setText3] = useState('□');
  const [selectedTime] = useState<TimeOption>(defaultTime);

  const inputRef1 = useRef<HTMLInputElement>(null);

  // 【修正】StrictMode の二重 effect に対応するため setTimeout を使う
  useEffect(() => {
    const id = setTimeout(() => focusAfterCheckbox(inputRef1.current), 0);
    return () => clearTimeout(id);
  }, []);

  const handleSaveField = useCallback((
    text: string,
    setText: React.Dispatch<React.SetStateAction<string>>,
    inputRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    const trimmed = text.replace(/^[□☑]\s*/, '').trim();
    if (!trimmed) return;

    const { start, end } = calculateEventTime(selectedTime);

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: `□ ${trimmed}`,
      start,
      end,
      memo: '',
      status: 'unchecked',
      isBatch: false,
    };

    onSave(newEvent);
    setText('□');

    if (inputRef) {
      // setState の反映後にカーソルを戻す
      setTimeout(() => focusAfterCheckbox(inputRef.current), 0);
    }
  }, [selectedTime, onSave]);

  return (
    <div className="card single-editor" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>クイックメモ</h2>

      {/* 入力欄 1 */}
      <div className="input-group" style={{ marginBottom: 0 }}>
        <input
          ref={inputRef1}
          type="text"
          className="text-input"
          placeholder="□やること 1"
          value={text1}
          onChange={(e) => setText1(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveField(text1, setText1, inputRef1)}
        />
        <button className="btn btn-primary" onClick={() => handleSaveField(text1, setText1, inputRef1)}>
          <Save size={18} /> 保存
        </button>
      </div>

      {/* 入力欄 2 */}
      <div className="input-group" style={{ marginBottom: 0 }}>
        <input
          type="text"
          className="text-input"
          placeholder="□やること 2"
          value={text2}
          onChange={(e) => setText2(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveField(text2, setText2)}
        />
        <button className="btn btn-primary" onClick={() => handleSaveField(text2, setText2)}>
          <Save size={18} /> 保存
        </button>
      </div>

      {/* 入力欄 3 */}
      <div className="input-group" style={{ marginBottom: 0 }}>
        <input
          type="text"
          className="text-input"
          placeholder="□やること 3"
          value={text3}
          onChange={(e) => setText3(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveField(text3, setText3)}
        />
        <button className="btn btn-primary" onClick={() => handleSaveField(text3, setText3)}>
          <Save size={18} /> 保存
        </button>
      </div>
    </div>
  );
};
