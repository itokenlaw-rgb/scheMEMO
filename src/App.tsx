import React, { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarView } from './components/CalendarView';
import { SingleEditor } from './components/SingleEditor';
import { BatchEditor } from './components/BatchEditor';
import type { CalendarEvent, BatchItem, TimeOption } from './types';
import { getMockEvents, addMockEvent, updateMockEvent, calculateEventTime, stringifyBatchMemo } from './utils/calendarUtils';
import { fetchGoogleEvents, createGoogleEvent, updateGoogleEvent } from './api/googleCalendar';
import { Calendar as CalendarIcon, Settings, User, LogIn, LogOut, RefreshCw } from 'lucide-react';

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onError: (error) => console.log('Login Failed:', error),
  });

  const logout = () => {
    setAccessToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(getMockEvents()); // Revert to mock on logout
  };

  useEffect(() => {
    const token = localStorage.getItem('google_access_token');
    if (token) {
      setAccessToken(token);
    } else {
      setEvents(getMockEvents());
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    if (!accessToken) return;
    try {
      setIsLoading(true);
      const fetchedEvents = await fetchGoogleEvents(accessToken);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Failed to fetch events", error);
      if ((error as any).message?.includes('401')) {
        logout(); // Token expired
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      refreshEvents();
    }
  }, [accessToken, refreshEvents]);

  const handleSaveSingle = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
      try {
        await createGoogleEvent(accessToken, event);
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    } else {
      addMockEvent(event);
      setEvents(getMockEvents());
    }
  };

  const handleSaveBatch = async (event: CalendarEvent) => {
    if (accessToken) {
      setIsLoading(true);
      try {
        if (selectedEvent && event.id === selectedEvent.id && !event.id.startsWith('evt-')) {
          await updateGoogleEvent(accessToken, event);
        } else {
          await createGoogleEvent(accessToken, event);
        }
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
        setSelectedEvent(null);
      }
    } else {
      if (selectedEvent && event.id === selectedEvent.id) {
        updateMockEvent(event);
      } else {
        addMockEvent(event);
      }
      setEvents(getMockEvents());
      setSelectedEvent(null);
    }
  };

  const handleCarryOver = async (items: BatchItem[], timeOption: TimeOption) => {
    const { start, end } = calculateEventTime(timeOption);
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-carry`,
      title: `□ やること`,
      start,
      end,
      memo: stringifyBatchMemo(items),
      status: 'unchecked',
      isBatch: true
    };
    
    if (accessToken) {
      setIsLoading(true);
      try {
        await createGoogleEvent(accessToken, newEvent);
        await refreshEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    } else {
      addMockEvent(newEvent);
      setEvents(getMockEvents());
    }
  };

  const handleSelectEvent = async (event: CalendarEvent) => {
    if (event.isBatch) {
      setSelectedEvent(event);
    } else {
      const newStatus = event.status === 'checked' ? 'unchecked' : 'checked';
      const newTitle = newStatus === 'checked' ? event.title.replace('□', '☑') : event.title.replace('☑', '□');
      const updatedEvent = { ...event, status: newStatus, title: newTitle };
      
      if (accessToken && !event.id.startsWith('evt-')) {
        setIsLoading(true);
        try {
          await updateGoogleEvent(accessToken, updatedEvent);
          await refreshEvents();
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      } else {
        updateMockEvent(updatedEvent);
        setEvents(getMockEvents());
      }
    }
  };

  return (
    <div className="app-container">
      <div className="left-panel">
        <header className="app-header">
          <div className="app-logo">
            <CalendarIcon size={28} />
            scheMEMO
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {accessToken ? (
              <>
                <button className="btn btn-outline btn-sm" onClick={refreshEvents} title="更新" style={{ padding: '0.5rem' }}>
                  <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                </button>
                <button className="btn btn-outline btn-sm" onClick={logout} title="ログアウト" style={{ padding: '0.5rem' }}>
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => login()} title="Googleログイン">
                <LogIn size={18} /> ログイン
              </button>
            )}
            <button className="btn btn-outline btn-sm" style={{ padding: '0.5rem' }}>
              <Settings size={18} />
            </button>
          </div>
        </header>

        <SingleEditor onSave={handleSaveSingle} />
        
        <BatchEditor 
          onSave={handleSaveBatch} 
          onCarryOver={handleCarryOver} 
          initialEvent={selectedEvent} 
          onClose={() => setSelectedEvent(null)}
        />
      </div>
      
      <div className="right-panel">
        <CalendarView 
          events={events} 
          onSelectEvent={handleSelectEvent}
        />
      </div>
    </div>
  );
}

export default App;
