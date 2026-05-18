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

// ── プルダウン用の選択肢生成ヘルパー ──────────────────────────────────────────

/** 0〜23時 */
const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);
/** 0〜24時間 */
const HOURS_0_24 = Array.from({ length: 25 }, (_, i) => i);
/** 0〜15日 */
const DAYS_0_15 = Array.from({ length: 16 }, (_, i) => i);

// ── 内部補助コンポーネント ────────────────────────────────────────────────────

const SectionDivider: React.FC = () => (
  <div style={{
    margin: '0.75rem 0',
    borderTop: '2px solid var(--border)',
    textAlign: 'center',
    lineHeight: '0',
  }} />
);

const SectionTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    marginBottom: '0.5rem',
    padding: '0.2rem 0.4rem',
    background: 'var(--background)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid var(--primary)',
    ...style,
  }}>
    {children}
  </div>
);

const Row: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexWrap: 'wrap',
    marginBottom: '0.4rem',
    fontSize: '0.85rem',
    ...style,
  }}>
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: 'var(--text-muted)', minWidth: '4rem' }}>{children}</span>
);

/** 汎用プルダウン */
const Sel = <T extends number | string>({
  value,
  options,
  onChange,
  formatLabel,
  width = '64px',
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
  width?: string;
}) => (
  <select
    value={String(value)}
    onChange={e => {
      const raw = e.target.value;
      // number か string かを元の型で判定
      onChange((typeof value === 'number' ? Number(raw) : raw) as T);
    }}
    style={{
      background: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0.2rem 0.4rem',
      fontSize: '0.85rem',
      color: 'var(--text-main)',
      cursor: 'pointer',
      width,
      textAlign: 'center',
    }}
  >
    {options.map(opt => (
      <option key={String(opt)} value={String(opt)}>
        {formatLabel ? formatLabel(opt) : String(opt)}
      </option>
    ))}
  </select>
);

const CheckRow: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}> = ({ checked, onChange, children }) => (
  <label style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    marginBottom: '0.3rem',
  }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
    />
    {children}
  </label>
);

// ── メインコンポーネント ──────────────────────────────────────────────────────

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialSettings,
  onClose,
  onSave,
}) => {
  const [s, setS] = useState<TimeSettings>(() => ({
    ...DEFAULT_TIME_SETTINGS,
    ...initialSettings,
  }));

  const set = <K extends keyof TimeSettings>(key: K, val: TimeSettings[K]) =>
    setS(prev => ({ ...prev, [key]: val }));

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
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>設定</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      {/* ══════════════════════════════════════ */}
      {/* 【基本設定】                           */}
      {/* ══════════════════════════════════════ */}
      <SectionTitle>基本設定</SectionTitle>

      <Row>
        <Label>クイックメモ「保存」</Label>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel
          value={s.quickMemoSaveHour}
          options={HOURS_0_23}
          onChange={v => set('quickMemoSaveHour', v)}
          formatLabel={v => `${v}`}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      <Row>
        <Label>□MEMO「保存」</Label>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel
          value={s.batchMemoSaveHour}
          options={HOURS_0_23}
          onChange={v => set('batchMemoSaveHour', v)}
          formatLabel={v => `${v}`}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      <SectionDivider />

      {/* ══════════════════════════════════════ */}
      {/* 【クイックメモの時間指定保存】         */}
      {/* ══════════════════════════════════════ */}
      <SectionTitle>クイックメモの時間指定保存</SectionTitle>

      {/* ① 〇時間後 */}
      <Row>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>①</span>
        <Sel
          value={s.preset1HoursLater}
          options={HOURS_0_24}
          onChange={v => set('preset1HoursLater', v)}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時間後</span>
      </Row>

      {/* ② 今日の〇時 */}
      <Row>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>②</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>今日の</span>
        <Sel
          value={s.preset2TodayHour}
          options={HOURS_0_23}
          onChange={v => set('preset2TodayHour', v)}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      {/* ③ 明日の〇時 */}
      <Row>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>③</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>明日の</span>
        <Sel
          value={s.preset3TomorrowHour}
          options={HOURS_0_23}
          onChange={v => set('preset3TomorrowHour', v)}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      {/* ④ 明日の〇時（夜） */}
      <Row>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>④</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>明日の</span>
        <Sel
          value={s.preset4TomorrowNightHour}
          options={HOURS_0_23}
          onChange={v => set('preset4TomorrowNightHour', v)}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      {/* ⑤ 3日後の〇時 */}
      <Row>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>⑤</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>3日後の</span>
        <Sel
          value={s.preset5In3DaysHour}
          options={HOURS_0_23}
          onChange={v => set('preset5In3DaysHour', v)}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      {/* ⑥ 土曜日の〇時 */}
      <Row>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '1.2rem' }}>⑥</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>土曜日の</span>
        <Sel
          value={s.preset6SaturdayHour}
          options={HOURS_0_23}
          onChange={v => set('preset6SaturdayHour', v)}
          width="56px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>時</span>
      </Row>

      <SectionDivider />

      {/* ══════════════════════════════════════ */}
      {/* 【抽出範囲】                           */}
      {/* ══════════════════════════════════════ */}
      <SectionTitle>「□タスクを□MEMOにする」抽出範囲</SectionTitle>
      <Row>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel
          value={s.mergeDaysBefore}
          options={DAYS_0_15}
          onChange={v => set('mergeDaysBefore', v)}
          width="48px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>日前から</span>
        <Sel
          value={s.mergeDaysAfter}
          options={DAYS_0_15}
          onChange={v => set('mergeDaysAfter', v)}
          width="48px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>日後まで</span>
      </Row>

      <SectionTitle style={{ marginTop: '0.5rem' }}>「□MEMOを集める」抽出範囲</SectionTitle>
      <Row>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>本日の</span>
        <Sel
          value={s.memoDaysBefore}
          options={DAYS_0_15}
          onChange={v => set('memoDaysBefore', v)}
          width="48px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>日前から</span>
        <Sel
          value={s.memoDaysAfter}
          options={DAYS_0_15}
          onChange={v => set('memoDaysAfter', v)}
          width="48px"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>日後まで</span>
      </Row>

      <SectionDivider />

      {/* ══════════════════════════════════════ */}
      {/* 【保存・更新の完了タスク削除設定】      */}
      {/* ══════════════════════════════════════ */}
      <SectionTitle>「☑□保存」の場合</SectionTitle>
      <CheckRow
        checked={s.saveDeletePastCompleted}
        onChange={v => set('saveDeletePastCompleted', v)}
      >
        過去の完了タスクは削除する
      </CheckRow>
      <CheckRow
        checked={s.saveDeleteFutureCompleted}
        onChange={v => set('saveDeleteFutureCompleted', v)}
      >
        将来の完了タスクは削除する
      </CheckRow>

      <div style={{ marginTop: '0.5rem' }}>
        <SectionTitle>「☑更新□」の場合</SectionTitle>
        <CheckRow
          checked={s.updateDeletePastCompleted}
          onChange={v => set('updateDeletePastCompleted', v)}
        >
          過去の完了タスクは削除する
        </CheckRow>
        <CheckRow
          checked={s.updateDeleteFutureCompleted}
          onChange={v => set('updateDeleteFutureCompleted', v)}
        >
          将来の完了タスクは削除する
        </CheckRow>
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        className="btn btn-primary"
        style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center', gap: '0.5rem' }}
      >
        <Save size={16} /> 設定を保存する
      </button>
    </div>
  );
};
