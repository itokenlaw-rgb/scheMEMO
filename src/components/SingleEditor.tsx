// src/components/SingleEditor.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent } from '../types';
import type { TimeSettings } from '../types/settings';
import { loadSettings } from '../types/settings';
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

/** 直近の土曜日（今日が土曜ならその日）の日付を返す */
function nextOrThisSaturday(from: Date): Date {
  const d = new Date(from);
  const dow = d.getDay(); // 0=日 … 6=土
  const diff = dow <= 6 ? (6 - dow) || 7 : 1;
  d.setDate(d.getDate() + (dow === 6 ? 0 : diff));
  return d;
}

/** 設定値をもとにプリセット選択肢のラベルを生成 */
function buildPresets(s: TimeSettings) {
  return [
    { label: '［時間指定保存］', value: 'default' },
    { label: `${s.preset1HoursLater}時間後`, value: 'p1' },
    { label: `今日の ${s.preset2TodayHour}時`, value: 'p2' },
    { label: `明日の ${s.preset3TomorrowHour}時`, value: 'p3' },
    { label: `明日の ${s.preset4TomorrowNightHour}時`, value: 'p4' },
    { label: `3日後の ${s.preset5In3DaysHour}時`, value: 'p5' },
    { label: `土曜日の ${s.preset6SaturdayHour}時`, value: 'p6' },
  ];
}

/** プリセット値 → Date 計算 */
function calcPresetTime(value: string, s: TimeSettings): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date(now);

  switch (value) {
    case 'p1':
      start = new Date(now.getTime() + s.preset1HoursLater * 60 * 60 * 1000);
      break;
    case 'p2':
      start.setHours(s.preset2TodayHour, 0, 0, 0);
      break;
    case 'p3':
      start.setDate(now.getDate() + 1);
      start.setHours(s.preset3TomorrowHour, 0, 0, 0);
      break;
    case 'p4':
      start.setDate(now.getDate() + 1);
      start.setHours(s.preset4TomorrowNightHour, 0, 0, 0);
      break;
    case 'p5':
      start.setDate(now.getDate() + 3);
      start.setHours(s.preset5In3DaysHour, 0, 0, 0);
      break;
    case 'p6': {
      const sat = nextOrThisSaturday(now);
      sat.setHours(s.preset6SaturdayHour, 0, 0, 0);
      start = sat;
      break;
    }
    default: {
      start.setHours(s.quickMemoSaveHour, 0, 0, 0);
      break;
    }
  }

  const end = new Date(start);
  end.setHours(start.getHours() + 1, 0, 0, 0);
  return { start, end };
}

export const SingleEditor: React.FC<SingleEditorProps> = ({ onSave }) => {
  const [text1, setText1] = useState('□');
  const [text2, setText2] = useState('□');
  const [text3, setText3] = useState('□');
  const [timePreset, setTimePreset] = useState<string>('default');
  const [settings, setSettings] = useState<TimeSettings>(loadSettings);

  useEffect(() => {
    const onStorage = () => setSettings(loadSettings());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const inputRef1 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => focusAfterCheckbox(inputRef1.current), 0);
    return () => clearTimeout(id);
  }, []);

  // 右横の単体「保存」ボタン
  const handleSaveField = useCallback((
    text: string,
    setText: React.Dispatch<React.SetStateAction<string>>,
    inputRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    const trimmed = text.replace(/^[□☑]\s*/, '').trim();
    if (!trimmed) return;

    const { start, end } = calcPresetTime('default', settings);

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: text.trim(),
      start,
      end,
      memo: '',
      status: 'unchecked',
      isBatch: false,
    };

    onSave(newEvent);
    setText('□');

    if (inputRef) {
      setTimeout(() => focusAfterCheckbox(inputRef.current), 0);
    }
  }, [settings, onSave]);

  // プルダウンの選択肢が変更されたときに直接呼び出す一括登録処理
  const handleSelectPresetDirectly = (presetValue: string) => {
    if (presetValue === 'default') return;

    const fields = [
      { text: text1, setter: setText1 },
      { text: text2, setter: setText2 },
      { text: text3, setter: setText3 }
    ];

    // 入力があるタスクのみを対象にする
    const validFields = fields.filter(f => f.text.replace(/^[□☑]\s*/, '').trim().length > 0);

    if (validFields.length === 0) {
      alert('時間指定保存するタスクを入力欄に記入してから、選択肢を選んでください。');
      setTimePreset('default');
      return;
    }

    const { start, end } = calcPresetTime(presetValue, settings);

    validFields.forEach((field, index) => {
      const newEvent: CalendarEvent = {
        id: `evt-${Date.now()}-preset-${index}-${Math.random().toString(36).substring(2, 5)}`,
        title: field.text.trim(),
        start: new Date(start),
        end: new Date(end),
        memo: '',
        status: 'unchecked',
        isBatch: false,
      };
      onSave(newEvent);
      field.setter('□');
    });

    setTimePreset('default'); // プルダウンの表示を初期状態に戻す
    alert('選択した時間指定でカレンダーに登録しました。');
    setTimeout(() => focusAfterCheckbox(inputRef1.current), 0);
  };

  const buildInputChangeHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val.startsWith('□') && !val.startsWith('☑')) {
        setter('□' + val);
      } else {
        setter(val);
      }
    };
  };

  const presets = buildPresets(settings);

  return (
    <div className="card single-editor" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* ヘッダー：【１】タイトル「クイックメモ」の右端に時間指定保存の選択肢を配置 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.25rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>クイックメモ</h2>

        {/* 【２】背景色と文字色を保存ボタン（btn-primary）と同じ色調に変更 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.25rem', 
          backgroundColor: 'var(--primary)', 
          color: '#ffffff',
          padding: '5px 10px', 
          borderRadius: '6px' 
        }}>
          <Clock size={14} style={{ opacity: 0.9 }} />
          <select
            value={timePreset}
            onChange={(e) => {
              const val = e.target.value;
              setTimePreset(val);
              handleSelectPresetDirectly(val);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              color: '#ffffff',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: '600'
            }}
          >
            {presets.map(p => (
              <option key={p.value} value={p.value} style={{ color: 'var(--text-main)', backgroundColor: '#ffffff' }}>
                {p.label}
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
          onChange={buildInputChangeHandler(setText1)}
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
          onChange={buildInputChangeHandler(setText2)}
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
          onChange={buildInputChangeHandler(setText3)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveField(text3, setText3)}
        />
        <button className="btn btn-primary" onClick={() => handleSaveField(text3, setText3)}>
          <Save size={18} /> 保存
        </button>
      </div>
    </div>
  );
};