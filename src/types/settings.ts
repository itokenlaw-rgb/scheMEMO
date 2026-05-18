// src/types/settings.ts

export interface TimeSettings {
  // ── 【基本設定】 ──────────────────────────────────────────────
  // クイックメモ「保存」の時刻（本日の〇時）
  quickMemoSaveHour: number;        // 0-23、デフォルト 21
  // □MEMO「保存」の時刻（本日の〇時）
  batchMemoSaveHour: number;        // 0-23、デフォルト 21

  // ── 【クイックメモの時間指定保存】 ──────────────────────────
  // ① 〇時間後
  preset1HoursLater: number;        // 0-24、デフォルト 3
  // ② 今日の〇時
  preset2TodayHour: number;         // 0-23、デフォルト 21
  // ③ 明日の〇時
  preset3TomorrowHour: number;      // 0-23、デフォルト 9
  // ④ 明日の〇時（夜）
  preset4TomorrowNightHour: number; // 0-23、デフォルト 21
  // ⑤ 3日後の〇時
  preset5In3DaysHour: number;       // 0-23、デフォルト 9
  // ⑥ 土曜日の〇時
  preset6SaturdayHour: number;      // 0-23、デフォルト 9

  // ── 【「□タスクを□MEMOにする」抽出範囲】 ─────────────────
  mergeDaysBefore: number;          // 0-15
  mergeDaysAfter: number;           // 0-15

  // ── 【「□MEMOを集める」抽出範囲】 ──────────────────────────
  memoDaysBefore: number;           // 0-15
  memoDaysAfter: number;            // 0-15

  // ── 【☑□保存 の場合】 ────────────────────────────────────────
  saveDeletePastCompleted: boolean;
  saveDeleteFutureCompleted: boolean;

  // ── 【☑更新□ の場合】 ───────────────────────────────────────
  updateDeletePastCompleted: boolean;
  updateDeleteFutureCompleted: boolean;

  // 旧互換フィールド（削除しない）
  deletePastCompleted?: boolean;
  deleteFutureCompleted?: boolean;
}

export const DEFAULT_TIME_SETTINGS: TimeSettings = {
  quickMemoSaveHour: 21,
  batchMemoSaveHour: 21,

  preset1HoursLater: 3,
  preset2TodayHour: 21,
  preset3TomorrowHour: 9,
  preset4TomorrowNightHour: 21,
  preset5In3DaysHour: 9,
  preset6SaturdayHour: 9,

  mergeDaysBefore: 7,
  mergeDaysAfter: 7,

  memoDaysBefore: 7,
  memoDaysAfter: 7,

  saveDeletePastCompleted: false,
  saveDeleteFutureCompleted: false,
  updateDeletePastCompleted: false,
  updateDeleteFutureCompleted: false,
};

export function loadSettings(): TimeSettings {
  const stored = localStorage.getItem('calendar_time_settings');
  if (!stored) return DEFAULT_TIME_SETTINGS;
  try {
    return { ...DEFAULT_TIME_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_TIME_SETTINGS;
  }
}

export function saveSettings(settings: TimeSettings): void {
  localStorage.setItem('calendar_time_settings', JSON.stringify(settings));
}
