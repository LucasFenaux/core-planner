import { useState, useEffect } from 'react';
import { 
  format, subDays, addDays, 
  startOfWeek, subWeeks, addWeeks, 
  startOfMonth, endOfMonth, subMonths, addMonths, 
  eachDayOfInterval 
} from 'date-fns';
import { Copy, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Task } from './TaskEditorModal';

type ViewMode = 'day' | 'week' | 'month';

interface DailyLog {
  date: string;
  content: string;
}

export function JournalView() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [logsRes, tasksRes] = await Promise.all([
        fetch('/api/daily-logs'),
        fetch('/api/tasks')
      ]);
      const logsData: DailyLog[] = await logsRes.json();
      const tasksData: Task[] = await tasksRes.json();
      
      const logsMap: Record<string, string> = {};
      logsData.forEach(l => { logsMap[l.date] = l.content; });
      
      setLogs(logsMap);
      setTasks(tasksData);
    } catch (err) {
      console.error("Failed to fetch journal data", err);
    }
  };

  const handleSaveLog = async (dateStr: string, content: string) => {
    setLogs(prev => ({ ...prev, [dateStr]: content }));
    try {
      await fetch(`/api/daily-logs/${dateStr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
    } catch (err) {
      console.error("Failed to save log", err);
    }
  };

  const navigatePrevious = () => {
    if (viewMode === 'day') setSelectedDate(subDays(selectedDate, 1));
    else if (viewMode === 'week') setSelectedDate(subWeeks(selectedDate, 1));
    else setSelectedDate(subMonths(selectedDate, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'day') setSelectedDate(addDays(selectedDate, 1));
    else if (viewMode === 'week') setSelectedDate(addWeeks(selectedDate, 1));
    else setSelectedDate(addMonths(selectedDate, 1));
  };

  let displayDays: Date[] = [];
  let headerLabel = '';
  
  if (viewMode === 'day') {
    displayDays = [selectedDate];
    headerLabel = format(selectedDate, 'MMM d, yyyy');
  } else if (viewMode === 'week') {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
    const end = addDays(start, 6);
    displayDays = eachDayOfInterval({ start, end });
    headerLabel = `Week of ${format(start, 'MMM d, yyyy')}`;
  } else {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    displayDays = eachDayOfInterval({ start, end });
    headerLabel = format(selectedDate, 'MMMM yyyy');
  }

  const copyToClipboard = () => {
    let fullText = '';
    
    displayDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const content = logs[dateStr] || '';
      const dayTasks = tasks.filter(t => t.status === 'done' && t.updated_at?.startsWith(dateStr));
      
      // Skip empty days
      if (!content.trim() && dayTasks.length === 0) {
        return;
      }
      
      const dateHeader = format(day, "MMM do yyyy (eeee):");
      fullText += `${dateHeader}\n`;
      if (content.trim()) {
        fullText += `${content}\n`;
      }
      
      if (dayTasks.length > 0) {
        fullText += `\nTasks Completed:\n`;
        dayTasks.forEach(t => {
          fullText += `- ${t.title}\n`;
        });
      }
      fullText += '\n'; // extra newline between days
    });

    if (!fullText.trim()) {
      fullText = "No notes or tasks for this period.";
    }

    navigator.clipboard.writeText(fullText.trim()).then(() => {
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    });
  };

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={navigatePrevious}>
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ margin: 0, minWidth: '220px', textAlign: 'center' }}>
            {headerLabel}
          </h2>
          <button className="btn-icon" onClick={navigateNext}>
            <ChevronRight size={20} />
          </button>
          <button className="btn-secondary" onClick={() => setSelectedDate(new Date())} style={{ marginLeft: '1rem' }}>
            Today
          </button>
        </div>

        {/* View Segmented Control */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
          {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '0.25rem 1rem',
                border: 'none',
                background: viewMode === mode ? 'var(--bg-primary)' : 'transparent',
                color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: viewMode === mode ? 500 : 400,
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        
        <button className="btn-primary" onClick={copyToClipboard} style={{ minWidth: '140px' }}>
          <Copy size={16} />
          {copyStatus || 'Copy ' + (viewMode.charAt(0).toUpperCase() + viewMode.slice(1))}
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: viewMode === 'day' ? 'row' : 'column',
        gap: '2rem',
        paddingRight: '0.5rem'
      }}>
        {displayDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayContent = logs[dateStr] || '';
          const dayTasks = tasks.filter(t => t.status === 'done' && t.updated_at?.startsWith(dateStr));
          
          return (
            <DayLogEntry 
              key={dateStr}
              date={day} 
              initialContent={dayContent} 
              completedTasks={dayTasks}
              onSave={(content) => handleSaveLog(dateStr, content)}
              isSingleDay={viewMode === 'day'}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Subcomponent for a single day's log ---

interface DayLogEntryProps {
  date: Date;
  initialContent: string;
  completedTasks: Task[];
  onSave: (content: string) => void;
  isSingleDay: boolean;
}

function DayLogEntry({ date, initialContent, completedTasks, onSave, isSingleDay }: DayLogEntryProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if initialContent changes from parent (e.g. navigation)
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleBlur = () => {
    if (content !== initialContent) {
      setIsSaving(true);
      onSave(content);
      setTimeout(() => setIsSaving(false), 500); // UI feedback
    }
  };

  const editorSection = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {!isSingleDay && (
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
          {format(date, 'eeee, MMM d')}
        </h3>
      )}
      <textarea
        style={{
          flex: 1,
          width: '100%',
          minHeight: isSingleDay ? '100%' : '120px',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          fontFamily: 'var(--font-sans)',
          fontSize: '1rem',
          lineHeight: 1.6,
          resize: 'vertical',
        }}
        placeholder="Write your daily notes here..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
      />
      <div style={{ textAlign: 'right', marginTop: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
        {isSaving ? 'Saving...' : 'Saved automatically when you click away'}
      </div>
    </div>
  );

  const tasksSection = (
    <div style={{ 
      width: isSingleDay ? '300px' : '100%', 
      background: 'var(--bg-secondary)', 
      borderRadius: 'var(--radius-lg)', 
      padding: '1.5rem', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '1rem' }}>
        <CheckCircle2 size={18} style={{ color: 'var(--accent-color)' }} />
        Tasks Completed
      </h3>
      
      <div style={{ 
        flex: 1, 
        overflowY: isSingleDay ? 'auto' : 'visible', 
        display: 'flex', 
        flexDirection: isSingleDay ? 'column' : 'row', 
        flexWrap: isSingleDay ? 'nowrap' : 'wrap',
        gap: '0.75rem' 
      }}>
        {completedTasks.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginTop: isSingleDay ? '2rem' : '0' }}>
            No tasks completed.
          </div>
        ) : (
          completedTasks.map(task => (
            <div key={task.id} style={{ 
              background: 'var(--bg-primary)', 
              padding: '0.75rem', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              minWidth: isSingleDay ? 'auto' : '200px',
              flex: isSingleDay ? 'none' : '1 1 200px'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {task.title}
              </div>
              {task.description && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {task.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (isSingleDay) {
    return (
      <>
        {editorSection}
        {tasksSection}
      </>
    );
  }

  // Week/Month view rendering (stacked horizontally inside a row container)
  return (
    <div style={{ display: 'flex', gap: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ flex: '2' }}>
        {editorSection}
      </div>
      <div style={{ flex: '1', minWidth: '300px' }}>
        {tasksSection}
      </div>
    </div>
  );
}
