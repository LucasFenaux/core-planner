import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { EventEditorModal } from './EventEditorModal';
import type { CalendarEvent as DBEvent } from './EventEditorModal';
import { TaskEditorModal } from './TaskEditorModal';
import type { Task as DBTask } from './TaskEditorModal';
import type { Category } from './CategoriesView';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './CalendarView.css';

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const withDragAndDropFn = (withDragAndDrop as any).default || withDragAndDrop;
const DnDCalendar = withDragAndDropFn(Calendar)

interface CalendarItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isTask?: boolean;
  resourceId?: any;
  allDay?: boolean;
}

export function CalendarView() {
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{start: Date, end: Date} | null>(null);
  const [editingEvent, setEditingEvent] = useState<DBEvent | null>(null);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DBTask | null>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Explicit state for calendar to ensure buttons work
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('week');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, eventsRes, categoriesRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/events'),
        fetch('/api/categories')
      ]);
      const tasksData = await tasksRes.json();
      const eventsData = await eventsRes.json();
      const categoriesData = await categoriesRes.json();

      setCategories(categoriesData);

      const combinedEvents: CalendarItem[] = [];

      tasksData.forEach((t: any) => {
        if (t.deadline) {
          const hasTime = t.deadline.includes('T');
          // If no time, parse it as local noon so it lands on the correct day
          const deadline = new Date(hasTime ? t.deadline : t.deadline + 'T12:00:00');
          combinedEvents.push({
            id: t.id,
            title: `[Task] ${t.title}`,
            start: deadline,
            end: hasTime ? new Date(deadline.getTime() + 60 * 60 * 1000) : deadline,
            isTask: true,
            allDay: !hasTime,
            resourceId: { category_ids: t.category_ids || [] }
          });
        }
      });

      eventsData.forEach((e: any) => {
        combinedEvents.push({
          id: e.id,
          title: e.title,
          start: new Date(e.start_time),
          end: new Date(e.end_time),
          isTask: false,
          resourceId: { notes: e.notes, category_ids: e.category_ids || [] }
        });
      });

      setEvents(combinedEvents);
    } catch (err) {
      console.error("Failed to fetch calendar data", err);
    }
  };

  const onEventDrop = async (data: any) => {
    const { event, start, end } = data;
    const updatedEvents = events.map(e => e.id === event.id ? { ...e, start, end } : e);
    setEvents(updatedEvents);

    try {
      if (event.isTask) {
        const tRes = await fetch(`/api/tasks/${event.id}`);
        const tData = await tRes.json();
        await fetch(`/api/tasks/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...tData, deadline: start.toISOString() })
        });
      } else {
        const eRes = await fetch(`/api/events/${event.id}`);
        const eData = await eRes.json();
        await fetch(`/api/events/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...eData, start_time: start.toISOString(), end_time: end.toISOString() })
        });
      }
    } catch (err) {
      console.error("Failed to update event", err);
    }
  };

  const handleSelectSlot = ({ start, end }: { start: Date, end: Date }) => {
    setSelectedSlot({ start, end });
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleSelectEvent = async (event: CalendarItem) => {
    if (event.isTask) {
      try {
        const res = await fetch(`/api/tasks/${event.id}`);
        const data = await res.json();
        setEditingTask(data);
        setIsTaskModalOpen(true);
      } catch (err) {
        console.error("Failed to fetch task details", err);
      }
      return;
    }
    
    // We need the full DB event to get the notes, but since we didn't store notes in CalendarItem,
    // we must fetch it or store it. Actually we can just find it in the original `eventsData` if we fetch,
    // or we can add `notes?: string` to CalendarItem. Let's do that!
    
    setEditingEvent({
      id: event.id,
      title: event.title,
      start_time: event.start.toISOString(),
      end_time: event.end.toISOString(),
      notes: event.resourceId?.notes || '',
      category_ids: event.resourceId?.category_ids || []
    });
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (eventData: Partial<DBEvent>) => {
    try {
      if (editingEvent) {
        const res = await fetch(`/api/events/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editingEvent, ...eventData })
        });
        const data = await res.json();
        setEvents(events.map(e => e.id === data.id ? {
          ...e,
          title: data.title,
          start: new Date(data.start_time),
          end: new Date(data.end_time),
          resourceId: { notes: data.notes, category_ids: data.category_ids || [] }
        } : e));
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
        const data = await res.json();
        setEvents([
          ...events,
          {
            id: data.id,
            title: data.title,
            start: new Date(data.start_time),
            end: new Date(data.end_time),
            isTask: false,
            resourceId: { notes: data.notes, category_ids: data.category_ids || [] }
          }
        ]);
      }
    } catch (err) {
      console.error("Failed to save event", err);
    }
  };

  const handleSaveTask = async (taskData: Partial<DBTask>) => {
    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editingTask, ...taskData })
        });
        fetchData(); // refresh calendar to see changes
      }
    } catch (err) {
      console.error("Failed to save task from calendar", err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error("Failed to delete event", err);
    }
  };

  return (
    <div className="page-body calendar-container">
      <DnDCalendar
        localizer={localizer}
        events={events}
        onEventDrop={onEventDrop}
        onEventResize={onEventDrop}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        selectable
        resizable
        date={currentDate}
        onNavigate={(newDate: Date) => setCurrentDate(newDate)}
        view={currentView}
        onView={(newView: View) => setCurrentView(newView)}
        style={{ height: 'calc(100vh - 150px)' }}
        eventPropGetter={(event: CalendarItem) => {
          let bgColor = event.isTask ? 'var(--bg-tertiary)' : 'var(--accent-color)';
          let textColor = event.isTask ? 'var(--text-primary)' : 'var(--accent-text)';
          let borderColor = event.isTask ? 'var(--border-focus)' : 'var(--accent-color)';

          if (event.resourceId?.category_ids && event.resourceId.category_ids.length > 0) {
            const firstCatId = event.resourceId.category_ids[0];
            const cat = categories.find(c => c.id === firstCatId);
            if (cat) {
              bgColor = `${cat.color}30`; // slight transparency
              textColor = 'var(--text-primary)';
              borderColor = cat.color;
            }
          }

          return {
            style: {
              backgroundColor: bgColor,
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '4px'
            }
          };
        }}
      />
      <EventEditorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialStart={selectedSlot?.start}
        initialEnd={selectedSlot?.end}
        editingEvent={editingEvent}
        categories={categories}
      />
      <TaskEditorModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        categories={categories}
      />
    </div>
  );
}
