import React, { useState, useEffect, useRef } from 'react';
import type { CalendarEvent, TimeOption } from '../types';
import { calculateEventTime } from '../utils/calendarUtils';
import { Save } from 'lucide-react';

interface SingleEditorProps {
  onSave: (event: CalendarEvent) => void;
  defaultTime?: TimeOption;
}

export const SingleEditor: React.FC<SingleEditorProps> = ({ onSave, defaultTime = 'today' }) => {
  // 【２】3つの入力欄の状態を個別に管理
  const [text1, setText1] = useState('□');
  const [text2, setText2] = useState('□');
  const [text3, setText3] = useState('□');
  
  // 【４】将来的な利用や裏側の時間設定保持のため、selectedTime の状態は内部的に残します
  const [selectedTime] = useState<TimeOption>(defaultTime);
  
  // 最初の入力欄へのオートフォーカス用Ref
  const inputRef1 = useRef<HTMLInputElement>(null);

  // 画面起動時に「□」の直後にカーソルを当てる
  useEffect(() => {
    if (inputRef1.current) {
      inputRef1.current.focus();
      const length = inputRef1.current.value.length;
      inputRef1.current.setSelectionRange(length, length);
    }
  }, []);

  // 各入力欄ごとの保存処理
  const handleSaveField = (
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
      isBatch: false
    };
    
    onSave(newEvent);
    setText('□'); // 保存後に「□」に戻す

    // 保存後に同じ場所へフォーカスを当て直す
    if (inputRef && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    }
  };

  return (
    <div className="card single-editor" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>クイックメモ</h2>

      {/* 入力欄 1 */}
      <div className="input-group" style={{ marginBottom: 0 }}>
        {/* 【３】左側のチェックボックス用ボタンを削除しました */}
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

      {/* 【４】下部にあった time-grid（今日中などのボタン表示）を丸ごと削除しました */}
    </div>
  );
};