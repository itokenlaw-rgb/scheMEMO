import React, { useState } from 'react';
import type { CalendarEvent, TimeOption } from '../types';
import { calculateEventTime } from '../utils/calendarUtils';
import { Check, Save } from 'lucide-react';
import clsx from 'clsx';

interface SingleEditorProps {
  onSave: (event: CalendarEvent) => void;
  defaultTime?: TimeOption;
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

export const SingleEditor: React.FC<SingleEditorProps> = ({ onSave, defaultTime = 'today' }) => {
  const [text, setText] = useState('□　');
  const [checked, setChecked] = useState(false);
  const [selectedTime, setSelectedTime] = useState<TimeOption>(defaultTime);

  const handleSave = () => {
    const trimmed = text.replace(/^[□☑]\s*/, '').trim();
    if (!trimmed) return;
    
    const { start, end } = calculateEventTime(selectedTime);
    const prefix = checked ? '☑' : '□';
    
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: `${prefix} ${trimmed}`,
      start,
      end,
      memo: '',
      status: checked ? 'checked' : 'unchecked',
      isBatch: false
    };
    
    onSave(newEvent);
    setText('□　');
    setChecked(false);
  };

  const handleCheckToggle = () => {
    const newChecked = !checked;
    setChecked(newChecked);
    // 先頭の□/☑を切り替える
    const body = text.replace(/^[□☑]\s*/, '');
    setText(`${newChecked ? '☑' : '□'}　${body}`);
  };

  return (
    <div className="card single-editor">
      <h2 className="card-title">クイックメモ</h2>

      <div className="input-group">
        <button 
          className={clsx('checkbox-btn', checked && 'checked')}
          onClick={handleCheckToggle}
          title="実行済にする"
        >
          {checked && <Check size={16} />}
        </button>
        <input 
          type="text" 
          className="text-input"
          placeholder="□やること"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> 保存
        </button>
      </div>

      <div className="time-grid">
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
    </div>
  );
};
