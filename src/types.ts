export type EventStatus = 'unchecked' | 'partial' | 'checked';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  memo: string;
  status: EventStatus;
  isBatch: boolean;
  isGoogleEvent?: boolean; 
  isCompleted?: boolean;
}

export type TimeOption = 
  | 'today' 
  | 'tomorrow' 
  | 'weekend' 
  | 'endOfMonth' 
  | 'tonight' 
  | 'tomorrowNight' 
  | 'nextWeek' 
  | 'nextMonth';

export interface BatchItem {
  id: string;
  text: string;
  checked: boolean;
}
