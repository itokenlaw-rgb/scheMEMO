import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent } from '../types';
import { Save, Clock } from 'lucide-react';

interface SingleEditorProps {
  onSave: (event: CalendarEvent) => void;
}

/** input を □ の直後にフォーカス・カーソル配置するヘルパー */
function focusAfterCheckbox(el: HTMLInputElement | null) {
  if (!el) return;
  el.focus();
  const pos = el.value.length;
  el.setSelectionRange(pos, pos);
}

// プルダウン用の選択肢定義（内部用）
const TIME_PRESETS = [
  { label: '指定なし (本日)', value: 'today' },
  { label: '3時間後', value: '3_hours_later' },
  { label: '今日の 23:00', value: 'today_23' },
  { label: '明日の 09:00', value: 'tomorrow_09' },
  { label: '明日の 23:00', value: 'tomorrow_23' },
  { label: '3日後の 09:00', value: '3_days_later_09' },
  { label: '1週間後の 09:00', value: '1_week_later_09' },
];

export const SingleEditor: React.FC<SingleEditorProps> = ({ onSave }) => {
  const [text1, setText1] = useState('□');
  const [text2, setText2] = useState('□');
  const [text3, setText3] = useState('□');
  
  // 選択された時間指定のステート
  const [timePreset, setTimePreset] = useState<string>('today');

  const inputRef1 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => focusAfterCheckbox(inputRef1.current), 0);
    return () => clearTimeout(id);
  }, []);

  // プリセット文字列から具体的な Date オブジェクト（開始・終了）を計算するヘルパー
  const calculatePresetTime = (preset: string): { start: Date; end: Date } => {
    const now = new Date();
    let start = new Date(now);

    switch (preset) {
      case '3_hours_later':
        start.setHours(now.getHours() + 3);
        break;
      case 'today_23':
        start.setHours(23, 0, 0, 0);
        break;
      case 'tomorrow_09':
        start.setDate(now.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        break;
      case 'tomorrow_23':
        start.setDate(now.getDate() + 1);
        start.setHours(23, 0, 0, 0);
        break;
      case '3_days_later_09':
        start.setDate(now.getDate() + 3);
        start.setHours(9, 0, 0, 0);
        break;
      case '1_week_later_09':
        start.setDate(now.getDate() + 7);
        start.setHours(9, 0, 0, 0);
        break;
      case 'today':
      default:
        // 指定なし（本日）の場合は、現在の時刻をデフォルトとする
        break;
    }

    // 終了時間は一律で開始時間の1時間後に設定
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    return { start, end };
  };

  const handleSaveField = useCallback((
    text: string,
    setText: React.Dispatch<React.SetStateAction<string>>,
    inputRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    const trimmed = text.replace(/^[□☑]\s*/, '').trim();
    if (!trimmed) return;

    // 選択されているプルダウンの値に基づいて Date オブジェクトを取得
    const { start, end } = calculatePresetTime(timePreset);

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: `□ ${trimmed}`,
      start, // types.ts の定義通り Date 型オブジェクト
      end,   // types.ts の定義通り Date 型オブジェクト
      memo: '',
      status: 'unchecked',
      isBatch: false,
    };

    onSave(newEvent);
    setText('□');

    // 保存したらプルダウンをデフォルト（指定なし）に戻す
    setTimePreset('today');

    if (inputRef) {
      setTimeout(() => focusAfterCheckbox(inputRef.current), 0);
    }
  }, [timePreset, onSave]);

  return (
    <div className="card single-editor" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      
      {/* ヘッダーエリア：「クイックメモ」の右端にプルダウンを配置 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.25rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>クイックメモ</h2>
        
        {/* 時間指定プルダウン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '6px' }}>
          <Clock size={14} style={{ opacity: 0.6 }} />
          <select
            value={timePreset}
            onChange={(e) => setTimePreset(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              color: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              paddingRight: '4px'
            }}
          >
            {TIME_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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