// src/components/SettingsPanel.tsx
import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import type {
  TimeSettings,
  DayOfWeek,
} from '../types/settings';
import { DEFAULT_TIME_SETTINGS, saveSettings } from '../types/settings';

interface SettingsPanelProps {
  initialSettings: TimeSettings;
  onClose: () => void;
  onSave: (settings: TimeSettings) => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => `${i + 8}:00`);
const NIGHT_HOURS = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '23:59'];
const DOWS: DayOfWeek[] = ['月', '火', '水', '木', '金', '土', '日'];
const EOM_DAYS = [25, 26, 27, 28, 29, 30, 31];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialSettings,
  onClose,
  onSave,
}) => {
  const [s, setS] = useState<TimeSettings>(() => ({
    ...DEFAULT_TIME_SETTINGS,
    ...initialSettings,
  }));

  const patch = <K extends keyof TimeSettings>(
    key: K,
    val: Partial<TimeSettings[K]>
  ) => {
    setS(prev => ({
      ...prev,
      [key]: { ...prev[key] as object, ...val },
    }));
  };

  const setDirect = <K extends keyof TimeSettings>(key: K, val: TimeSettings[K]) => {
    setS(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    saveSettings(s);
    onSave(s);
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1rem',
      marginBottom: '1rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>時間マッピング設定</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* 今日中 */}
        <div>
          <Label>今日中 (today)</Label>
          <Row>
            <Radio name="today_m" value="relative" checked={s.today.mode === 'relative'} onChange={() => patch('today', { mode: 'relative' })}>
              現在時刻から
            </Radio>
            {s.today.mode === 'relative' && (
              <Sel value={String(s.today.relativeMinutes)} onChange={v => patch('today', { relativeMinutes: Number(v) })}>
                <option value="30">30分後</option>
                <option value="60">1時間後</option>
                <option value="120">2時間後</option>
              </Sel>
            )}
          </Row>
          <Row>
            <Radio name="today_m" value="fixed" checked={s.today.mode === 'fixed'} onChange={() => patch('today', { mode: 'fixed' })}>
              時刻指定
            </Radio>
            {s.today.mode === 'fixed' && (
              <Sel value={s.today.fixedTime} onChange={v => patch('today', { fixedTime: v })}>
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Sel>
            )}
          </Row>
        </div>

        {/* 明日中 */}
        <div>
          <Label>明日中 (tomorrow)</Label>
          <Row>
            <Radio name="tom_m" value="fixed" checked={s.tomorrow.mode === 'fixed'} onChange={() => patch('tomorrow', { mode: 'fixed' })}>
              時刻指定
            </Radio>
            <Sel value={s.tomorrow.fixedTime} onChange={v => patch('tomorrow', { fixedTime: v })} disabled={s.tomorrow.mode !== 'fixed'}>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </Row>
        </div>

        {/* 今日夜 / 明日夜 */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <Label>今日夜 (tonight)</Label>
            <Sel value={s.tonight.fixedTime} onChange={v => patch('tonight', { fixedTime: v })}>
              {NIGHT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <Label>明日夜 (tomorrowNight)</Label>
            {/* ✅ 正しい引数とアロー構文 (v => ...) に修正しました */}
            <Sel value={s.tomorrowNight.fixedTime} onChange={v => patch('tomorrowNight', { fixedTime: v })}>
              {NIGHT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </div>
        </div>

        {/* 週末 */}
        <div>
          <Label>週末 (weekend)</Label>
          <Row>
            <Sel value={s.weekend.dow} onChange={v => patch('weekend', { dow: v as DayOfWeek })}>
              {DOWS.map(d => <option key={d} value={d}>{d}曜日</option>)}
            </Sel>
            <Radio name="wk_t" value="fixed" checked={s.weekend.time !== 'allday'} onChange={() => patch('weekend', { time: '12:00' })}>
              時刻
            </Radio>
            {s.weekend.time !== 'allday' && (
              <Sel value={s.weekend.time} onChange={v => patch('weekend', { time: v })}>
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Sel>
            )}
            <Radio name="wk_t" value="allday" checked={s.weekend.time === 'allday'} onChange={() => patch('weekend', { time: 'allday' })}>
              終日
            </Radio>
          </Row>
        </div>

        {/* 月末 */}
        <div>
          <Label>月末 (endOfMonth)</Label>
          <Row>
            <Radio name="eom_m" value="lastDay" checked={s.endOfMonth.mode === 'lastDay'} onChange={() => patch('endOfMonth', { mode: 'lastDay' })}>
              最終日
            </Radio>
          </Row>
          <Row>
            <Radio name="eom_m" value="fixed" checked={s.endOfMonth.mode === 'fixed'} onChange={() => patch('endOfMonth', { mode: 'fixed' })}>
              指定日
            </Radio>
            {s.endOfMonth.mode === 'fixed' && (
              <Sel value={String(s.endOfMonth.day)} onChange={v => patch('endOfMonth', { day: Number(v) })}>
                {EOM_DAYS.map(d => <option key={d} value={String(d)}>{d}日</option>)}
              </Sel>
            )}
          </Row>
          <Row>
            <Radio name="eom_m" value="lastDow" checked={s.endOfMonth.mode === 'lastDow'} onChange={() => patch('endOfMonth', { mode: 'lastDow' })}>
              最終
            </Radio>
            {s.endOfMonth.mode === 'lastDow' && (
              <Sel value={s.endOfMonth.dow} onChange={v => patch('endOfMonth', { dow: v as DayOfWeek })}>
                {DOWS.map(d => <option key={d} value={d}>{d}曜日</option>)}
              </Sel>
            )}
          </Row>
        </div>

        {/* 来週 */}
        <div>
          <Label>来週 (nextWeek)</Label>
          <Row>
            <Sel value={s.nextWeek.dow} onChange={v => patch('nextWeek', { dow: v as DayOfWeek })}>
              {DOWS.map(d => <option key={d} value={d}>{d}曜日</option>)}
            </Sel>
            <Sel value={s.nextWeek.time} onChange={v => patch('nextWeek', { time: v })}>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </Row>
        </div>

        {/* 来月 */}
        <div>
          <Label>来月 (nextMonth)</Label>
          <Row>
            <span>毎月</span>
            <Sel value={String(s.nextMonth.day)} onChange={v => patch('nextMonth', { day: Number(v) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={String(d)}>{d}日</option>
              ))}
            </Sel>
            <Sel value={s.nextMonth.time} onChange={v => patch('nextMonth', { time: v })}>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </Row>
        </div>

        {/* 抽出・統合・完了タスクの挙動設定 */}
        <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '2px solid var(--border)' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            抽出・統合・完了タスクの設定
          </div>
          
          {/* 【１】完了タスクの削除オプション */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={s.deletePastCompleted ?? false}
                onChange={e => setDirect('deletePastCompleted', e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              過去の完了タスクは削除する
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={s.deleteFutureCompleted ?? false}
                onChange={e => setDirect('deleteFutureCompleted', e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              将来の完了タスクは削除する
            </label>
          </div>

          {/* 【２】□MEMOの抽出範囲設定 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, minWidth: '130px' }}>□MEMOの抽出範囲</span>
            <input
              type="number"
              value={s.memoDaysBefore}
              onChange={e => setDirect('memoDaysBefore', Math.max(0, Number(e.target.value)))}
              style={{ width: '50px', padding: '0.2rem', border: '1px solid var(--border)', borderRadius: '4px', textAlign: 'center', background: 'var(--background)', color: 'var(--text-main)' }}
            />
            <span>日前 から</span>
            <input
              type="number"
              value={s.memoDaysAfter}
              onChange={e => setDirect('memoDaysAfter', Math.max(0, Number(e.target.value)))}
              style={{ width: '50px', padding: '0.2rem', border: '1px solid var(--border)', borderRadius: '4px', textAlign: 'center', background: 'var(--background)', color: 'var(--text-main)' }}
            />
            <span>日後 まで</span>
          </div>

          {/* 【３】タスクをまとめる範囲設定 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, minWidth: '130px' }}>タスクをまとめる範囲</span>
            <input
              type="number"
              value={s.mergeDaysBefore}
              onChange={e => setDirect('mergeDaysBefore', Math.max(0, Number(e.target.value)))}
              style={{ width: '50px', padding: '0.2rem', border: '1px solid var(--border)', borderRadius: '4px', textAlign: 'center', background: 'var(--background)', color: 'var(--text-main)' }}
            />
            <span>日前 から</span>
            <input
              type="number"
              value={s.mergeDaysAfter}
              onChange={e => setDirect('mergeDaysAfter', Math.max(0, Number(e.target.value)))}
              style={{ width: '50px', padding: '0.2rem', border: '1px solid var(--border)', borderRadius: '4px', textAlign: 'center', background: 'var(--background)', color: 'var(--text-main)' }}
            />
            <span>日後 まで</span>
          </div>
        </div>

      </div>

      <button
        onClick={handleSave}
        className="btn btn-primary"
        style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center', gap: '0.5rem' }}
      >
        <Save size={16} /> 設定を保存する
      </button>
    </div>
  );
};

/* 内部補助コンポーネント群 */
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
    {children}
  </div>
);

const Radio: React.FC<{
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}> = ({ name, value, checked, onChange, children }) => (
  <label style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    flexWrap: 'wrap',
  }}>
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      style={{ accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
    />
    {children}
  </label>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
    {children}
  </div>
);

const Sel: React.FC<{
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ value, onChange, children, disabled }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    style={{
      background: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0.25rem 0.5rem',
      fontSize: '0.85rem',
      color: 'var(--text-main)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {children}
  </select>
);