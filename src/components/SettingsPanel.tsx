// src/components/SettingsPanel.tsx
import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import type { TimeSettings } from '../types/settings';
import { DEFAULT_TIME_SETTINGS, saveSettings } from '../types/settings';

interface SettingsPanelProps {
  initialSettings: TimeSettings;
  onClose: () => void;
  onSave: (settings: TimeSettings) => void;
}

const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_0_24 = Array.from({ length: 25 }, (_, i) => i);
const DAYS_0_15 = Array.from({ length: 16 }, (_, i) => i);

const SectionDivider: React.FC = () => (
  <div style={{ margin: '0.75rem 0', borderTop: '2px solid var(--border)', textAlign: 'center', lineHeight: '0' }} />
);

const SectionTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem',
    padding: '0.2rem 0.4rem', background: 'var(--background)', borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid var(--primary)', ...style
  }}>
    {children}
  </div>
);

const Row: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem', fontSize: '0.85rem', ...style }}>
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: 'var(--text-muted)', minWidth: '4rem' }}>{children}</span>
);

const Sel = <T extends number | string>({ value, options, onChange, formatLabel, width = '64px' }: { value: T; options: T[]; onChange: (v: T) => void; formatLabel?: (v: T) => string; width?: string; }) => (
  <select
    value={String(value)}
    onChange={e => {
      const raw = e.target.value;
      onChange((typeof value === 'number' ? Number(raw) : raw) as T);
    }}
    style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.4rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', width, textAlign: 'center' }}
  >
    {options.map(opt => (
      <option key={String(opt)} value={String(opt)}>{formatLabel ? formatLabel(opt) : String(opt)}</option>
    ))}
  </select>
);

const CheckRow: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; }> = ({ checked, onChange, children }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
    {children}
  </label>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ initialSettings, onClose, onSave }) => {
  const [s, setS] = useState<TimeSettings>(() => ({ ...DEFAULT_TIME_SETTINGS, ...initialSettings }));

  const set = <K extends keyof TimeSettings>(key: K, val: TimeSettings[K]) => setS(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    saveSettings(s);
    onSave(s);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>設定</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
      </div>

      <SectionTitle>基本設定</SectionTitle>
      <Row>
        <Label>クイックメモ「保存」</Label>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel value={s.quickMemoSaveHour} options={HOURS_0_23} onChange={v => set('quickMemoSaveHour', v)} width="56px" />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>
      <Row>
        <Label>□MEMO「保存」</Label>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel value={s.batchMemoSaveHour} options={HOURS_0_23} onChange={v => set('batchMemoSaveHour', v)} width="56px" />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      <SectionDivider />

      <SectionTitle>クイックメモの時間指定保存</SectionTitle>
      <Row><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>①</span><Sel value={s.preset1HoursLater} options={HOURS_0_24} onChange={v => set('preset1HoursLater', v)} width="56px" /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時間後</span></Row>
      <Row><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>②</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>今日の</span><Sel value={s.preset2TodayHour} options={HOURS_0_23} onChange={v => set('preset2TodayHour', v)} width="56px" /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span></Row>
      <Row><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>③</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>明日の</span><Sel value={s.preset3TomorrowHour} options={HOURS_0_23} onChange={v => set('preset3TomorrowHour', v)} width="56px" /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span></Row>
      <Row><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>④</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>明日の</span><Sel value={s.preset4TomorrowNightHour} options={HOURS_0_23} onChange={v => set('preset4TomorrowNightHour', v)} width="56px" /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span></Row>
      <Row><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>⑤</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>3日後の</span><Sel value={s.preset5In3DaysHour} options={HOURS_0_23} onChange={v => set('preset5In3DaysHour', v)} width="56px" /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span></Row>
      <Row><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>⑥</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>土曜日の</span><Sel value={s.preset6SaturdayHour} options={HOURS_0_23} onChange={v => set('preset6SaturdayHour', v)} width="56px" /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span></Row>

      <SectionDivider />

      <SectionTitle>「□タスクを□MEMOにする」抽出範囲</SectionTitle>
      <Row>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel value={s.mergeDaysBefore} options={DAYS_0_15} onChange={v => set('mergeDaysBefore', v)} width="48px" />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>日前から</span>
        <Sel value={s.mergeDaysAfter} options={DAYS_0_15} onChange={v => set('mergeDaysAfter', v)} width="48px" />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>日後まで</span>
      </Row>

      <SectionDivider />

      {/* 修正：文言を「削除する」から「色を薄いグレーに変更する」に修正 */}
      <SectionTitle>「☑□保存」の場合</SectionTitle>
      <CheckRow checked={s.saveGrayPastCompleted} onChange={v => set('saveGrayPastCompleted', v)}>
        過去の完了タスクは色を薄いグレーにする
      </CheckRow>
      <CheckRow checked={s.saveGrayFutureCompleted} onChange={v => set('saveGrayFutureCompleted', v)}>
        将来の完了タスクは色を薄いグレーにする
      </CheckRow>

      <div style={{ marginTop: '0.5rem' }}>
        <SectionTitle>「☑更新□」の場合</SectionTitle>
        <CheckRow checked={s.updateGrayPastCompleted} onChange={v => set('updateGrayPastCompleted', v)}>
          過去の完了タスクは色を薄いグレーにする
        </CheckRow>
        <CheckRow checked={s.updateGrayFutureCompleted} onChange={v => set('updateGrayFutureCompleted', v)}>
          将来の完了タスクは色を薄いグレーにする
        </CheckRow>
      </div>

      <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center', gap: '0.5rem' }}>
        <Save size={16} /> 設定を保存する
      </button>
    </div>
  );
};