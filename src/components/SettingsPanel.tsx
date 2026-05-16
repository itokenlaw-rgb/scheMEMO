// src/components/SettingsPanel.tsx
import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import type {
  TimeSettings,
  TodaySettings,
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
    setS(prev => ({ ...prev, [key]: { ...prev[key], ...val } }));
  };

  const handleSave = () => {
    saveSettings(s);
    onSave(s);
    onClose();
  };

  return (
    <div className="card" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>⚙️ 時間設定</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── 今日中 ── */}
        <Section label="今日中">
          <RadioGroup>
            <Radio
              name="today"
              value="eod"
              checked={s.today.mode === 'eod'}
              onChange={() => patch('today', { mode: 'eod' })}
            >
              終日（当日末）
            </Radio>
            <Radio
              name="today"
              value="min"
              checked={s.today.mode === 'minutes'}
              onChange={() => patch('today', { mode: 'minutes' })}
            >
              <Sel
                value={String(s.today.minutes)}
                onChange={v => patch('today', { minutes: Number(v) as TodaySettings['minutes'] })}
              >
                {[30, 60, 90, 120, 180].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Sel>
              <span className="sel-unit">分後</span>
            </Radio>
            <Radio
              name="today"
              value="time"
              checked={s.today.mode === 'time'}
              onChange={() => patch('today', { mode: 'time' })}
            >
              <Sel
                value={s.today.time}
                onChange={v => patch('today', { time: v })}
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Sel>
              <span className="sel-unit">まで</span>
            </Radio>
          </RadioGroup>
        </Section>

        {/* ── 今日夜 ── */}
        <Section label="今日夜">
          <Row>
            <Sel
              value={s.tonight.startTime}
              onChange={v => patch('tonight', { startTime: v })}
            >
              {NIGHT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
            <Muted>〜</Muted>
            <Sel
              value={s.tonight.endTime}
              onChange={v => patch('tonight', { endTime: v })}
            >
              {NIGHT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </Row>
        </Section>

        {/* ── 明日中 ── */}
        <Section label="明日中">
          <RadioGroup>
            <Radio
              name="tomorrow"
              value="same"
              checked={s.tomorrow.mode === 'same'}
              onChange={() => patch('tomorrow', { mode: 'same' })}
            >
              今と同じ時間
            </Radio>
            <Radio
              name="tomorrow"
              value="time"
              checked={s.tomorrow.mode === 'time'}
              onChange={() => patch('tomorrow', { mode: 'time' })}
            >
              <Sel
                value={s.tomorrow.time}
                onChange={v => patch('tomorrow', { time: v })}
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Sel>
              <span className="sel-unit">時</span>
            </Radio>
            <Radio
              name="tomorrow"
              value="skipDow"
              checked={s.tomorrow.mode === 'skipDow'}
              onChange={() => patch('tomorrow', { mode: 'skipDow' })}
            >
              曜日スキップ
            </Radio>
          </RadioGroup>
          {s.tomorrow.mode === 'skipDow' && (
            <SubRow>
              <Muted>明日が</Muted>
              <Sel
                value={s.tomorrow.skipFrom}
                onChange={v => patch('tomorrow', { skipFrom: v as DayOfWeek })}
              >
                {DOWS.map(d => <option key={d} value={d}>{d}</option>)}
              </Sel>
              <Muted>曜日なら翌</Muted>
              <Sel
                value={s.tomorrow.skipTo}
                onChange={v => patch('tomorrow', { skipTo: v as DayOfWeek })}
              >
                {DOWS.map(d => <option key={d} value={d}>{d}</option>)}
              </Sel>
              <Muted>曜日に</Muted>
            </SubRow>
          )}
        </Section>

        {/* ── 明日夜 ── */}
        <Section label="明日夜">
          <RadioGroup>
            <Radio
              name="tomorrowNight"
              value="time"
              checked={s.tomorrowNight.mode === 'time'}
              onChange={() => patch('tomorrowNight', { mode: 'time' })}
            >
              <Sel
                value={s.tomorrowNight.startTime}
                onChange={v => patch('tomorrowNight', { startTime: v })}
              >
                {NIGHT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Sel>
              <Muted>〜</Muted>
              <Sel
                value={s.tomorrowNight.endTime}
                onChange={v => patch('tomorrowNight', { endTime: v })}
              >
                {NIGHT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Sel>
            </Radio>
            <Radio
              name="tomorrowNight"
              value="skipDow"
              checked={s.tomorrowNight.mode === 'skipDow'}
              onChange={() => patch('tomorrowNight', { mode: 'skipDow' })}
            >
              曜日スキップ
            </Radio>
          </RadioGroup>
          {s.tomorrowNight.mode === 'skipDow' && (
            <SubRow>
              <Muted>明日が</Muted>
              <Sel
                value={s.tomorrowNight.skipFrom}
                onChange={v => patch('tomorrowNight', { skipFrom: v as DayOfWeek })}
              >
                {DOWS.map(d => <option key={d} value={d}>{d}</option>)}
              </Sel>
              <Muted>曜日なら翌</Muted>
              <Sel
                value={s.tomorrowNight.skipTo}
                onChange={v => patch('tomorrowNight', { skipTo: v as DayOfWeek })}
              >
                {DOWS.map(d => <option key={d} value={d}>{d}</option>)}
              </Sel>
              <Muted>曜日に</Muted>
            </SubRow>
          )}
        </Section>

        {/* ── 週末 ── */}
        <Section label="週末">
          <Row>
            <Sel
              value={s.weekend.dow}
              onChange={v => patch('weekend', { dow: v as '土' | '日' | 'either' })}
            >
              <option value="土">土曜日</option>
              <option value="日">日曜日</option>
              <option value="either">土・日どちらか早い方</option>
            </Sel>
          </Row>
          <Row>
            <Muted>時刻：</Muted>
            <Sel
              value={s.weekend.time}
              onChange={v => patch('weekend', { time: v })}
            >
              <option value="allday">終日</option>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </Sel>
          </Row>
        </Section>

        {/* ── 月末 ── */}
        <Section label="月末">
          <RadioGroup>
            <Radio
              name="eom"
              value="fixed"
              checked={s.endOfMonth.mode === 'fixed'}
              onChange={() => patch('endOfMonth', { mode: 'fixed' })}
            >
              毎月
              <Sel
                value={String(s.endOfMonth.day)}
                onChange={v => patch('endOfMonth', { day: v === 'last' ? 'last' : Number(v) })}
              >
                {EOM_DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
                <option value="last">末日</option>
              </Sel>
            </Radio>
            <Radio
              name="eom"
              value="lastDay"
              checked={s.endOfMonth.mode === 'lastDay'}
              onChange={() => patch('endOfMonth', { mode: 'lastDay' })}
            >
              毎月末日
            </Radio>
            <Radio
              name="eom"
              value="lastDow"
              checked={s.endOfMonth.mode === 'lastDow'}
              onChange={() => patch('endOfMonth', { mode: 'lastDow' })}
            >
              毎月最後の
              <Sel
                value={s.endOfMonth.dow}
                onChange={v => patch('endOfMonth', { dow: v as DayOfWeek })}
              >
                {DOWS.map(d => <option key={d} value={d}>{d}</option>)}
              </Sel>
              <span className="sel-unit">曜日</span>
            </Radio>
          </RadioGroup>
        </Section>

        <button className="btn btn-primary btn-full" onClick={handleSave}>
          <Save size={18} /> 設定を保存
        </button>
      </div>
    </div>
  );
};

// ── 小さいヘルパーコンポーネント ──

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
    <div style={{
      fontSize: '0.75rem',
      fontWeight: 700,
      color: 'var(--text-muted)',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem',
      textTransform: 'uppercase',
    }}>
      {label}
    </div>
    {children}
  </div>
);

const RadioGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
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
    gap: '0.5rem',
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

const SubRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    flexWrap: 'wrap',
    marginTop: '0.375rem',
    marginLeft: '1.5rem',
    fontSize: '0.8125rem',
  }}>
    {children}
  </div>
);

const Sel: React.FC<{
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      background: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0.25rem 0.375rem',
      fontSize: '0.8125rem',
      color: 'var(--text-main)',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}
  >
    {children}
  </select>
);

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{children}</span>
);
