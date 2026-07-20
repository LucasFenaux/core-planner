import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { LayoutDashboard, CheckSquare, FileText, Calendar as CalendarIcon, Plus, Tag } from 'lucide-react';
import './CommandPalette.css'; // We'll add some specific styling for this

interface CommandPaletteProps {
  setCurrentView: (view: string) => void;
}

export function CommandPalette({ setCurrentView }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  // Toggle the menu when ⌘K is pressed or Escape to close
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <Command.Dialog 
        open={open} 
        onOpenChange={setOpen} 
        label="Global Command Menu"
        onClick={(e) => e.stopPropagation()}
        className="cmdk-dialog"
      >
        <Command.Input placeholder="Type a command or search..." autoFocus className="cmdk-input" />
        
        <Command.List className="cmdk-list">
          <Command.Empty>No results found.</Command.Empty>

          <Command.Group heading="Navigation">
            <Command.Item onSelect={() => { setCurrentView('dashboard'); setOpen(false); }}>
              <LayoutDashboard size={16} /> Go to Dashboard
            </Command.Item>
            <Command.Item onSelect={() => { setCurrentView('tasks'); setOpen(false); }}>
              <CheckSquare size={16} /> Go to Tasks
            </Command.Item>
            <Command.Item onSelect={() => { setCurrentView('notes'); setOpen(false); }}>
              <FileText size={16} /> Go to Notes
            </Command.Item>
            <Command.Item onSelect={() => { setCurrentView('calendar'); setOpen(false); }}>
              <CalendarIcon size={16} /> Go to Calendar
            </Command.Item>
            <Command.Item onSelect={() => { setCurrentView('categories'); setOpen(false); }}>
              <Tag size={16} /> Go to Categories
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Actions">
            <Command.Item onSelect={() => { 
                setCurrentView('tasks'); 
                setOpen(false); 
                // In a real app we might trigger a 'new task' modal here
            }}>
              <Plus size={16} /> Create Task
            </Command.Item>
            <Command.Item onSelect={() => { 
                setCurrentView('notes'); 
                setOpen(false); 
            }}>
              <Plus size={16} /> Create Note
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </div>
  );
}
