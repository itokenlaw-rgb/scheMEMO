// src/api/googleCalendar.ts (末尾の convertFromGoogleEvent のみ一部修正)

const convertFromGoogleEvent = (gEvent: any): CalendarEvent => {
  const title = gEvent.summary || '';

  const isBatch =
    title.includes('やること') &&
    (title.startsWith('□') || title.startsWith('☑') || title.startsWith('△'));

  let status: 'unchecked' | 'partial' | 'checked' = 'unchecked';
  
  // 【修正】タイトルが ☑ から始まっていれば、一括メモでなくても完了(checked)状態にする
  if (title.startsWith('☑')) {
    status = 'checked';
  } else if (isBatch) {
    const items = parseBatchMemo(gEvent.description || '');
    status = determineBatchStatus(items);
  }

  const startRaw = gEvent.start?.dateTime ?? gEvent.start?.date;
  const endRaw   = gEvent.end?.dateTime   ?? gEvent.end?.date;

  const startDate = new Date(startRaw);
  const endDate   = new Date(endRaw);

  return {
    id: gEvent.id,
    title,
    start: startDate,
    end: endDate,
    memo: gEvent.description || '',
    status,
    isBatch,
  };
};