import type { CalendarEvent } from '../types';
import { parseBatchMemo, determineBatchStatus } from '../utils/calendarUtils';

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

// Fetch events from the last 3 months to 3 months ahead
export const fetchGoogleEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  const timeMin = new Date();
  timeMin.setMonth(timeMin.getMonth() - 3);
  
  const timeMax = new Date();
  timeMax.setMonth(timeMax.getMonth() + 3);

  const response = await fetch(
    `${BASE_URL}/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=500`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  const data = await response.json();
  
  return data.items
    .filter((item: any) => item.summary && (item.summary.startsWith('□') || item.summary.startsWith('☑') || item.summary.startsWith('△')))
    .map((item: any) => convertFromGoogleEvent(item));
};

export const createGoogleEvent = async (accessToken: string, event: CalendarEvent): Promise<CalendarEvent> => {
  const gEvent = convertToGoogleEvent(event);
  const response = await fetch(`${BASE_URL}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gEvent),
  });

  if (!response.ok) {
    throw new Error('Failed to create event');
  }

  const data = await response.json();
  return convertFromGoogleEvent(data);
};

export const updateGoogleEvent = async (accessToken: string, event: CalendarEvent): Promise<CalendarEvent> => {
  const gEvent = convertToGoogleEvent(event);
  const response = await fetch(`${BASE_URL}/calendars/primary/events/${event.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gEvent),
  });

  if (!response.ok) {
    throw new Error('Failed to update event');
  }

  const data = await response.json();
  return convertFromGoogleEvent(data);
};

export const deleteGoogleEvent = async (accessToken: string, eventId: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete event');
  }
};

// Utils to convert between our CalendarEvent and Google Calendar Event
const convertToGoogleEvent = (event: CalendarEvent) => {
  return {
    summary: event.title,
    description: event.memo,
    start: {
      dateTime: event.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    // Prevent default reminders
    reminders: {
      useDefault: false,
      overrides: [],
    },
  };
};

const convertFromGoogleEvent = (gEvent: any): CalendarEvent => {
  const title = gEvent.summary || '';
  const isBatch = title.includes('やること') && (title.startsWith('□') || title.startsWith('☑') || title.startsWith('△'));
  
  let status: 'unchecked' | 'partial' | 'checked' = 'unchecked';
  if (isBatch) {
      const items = parseBatchMemo(gEvent.description || '');
      status = determineBatchStatus(items);
  } else {
      if (title.startsWith('☑')) status = 'checked';
  }

  return {
    id: gEvent.id,
    title: title,
    start: new Date(gEvent.start.dateTime || gEvent.start.date),
    end: new Date(gEvent.end.dateTime || gEvent.end.date),
    memo: gEvent.description || '',
    status,
    isBatch,
  };
};
