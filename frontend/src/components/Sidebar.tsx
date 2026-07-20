
import { LayoutDashboard, CheckSquare, FileText, Calendar, Settings, Tag, BookOpen } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'categories', label: 'Categories', icon: Tag },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{ width: 24, height: 24, backgroundColor: 'var(--accent-color)', borderRadius: '4px' }}></div>
        Focus
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={clsx('nav-item', currentView === item.id && 'active')}
            onClick={() => setCurrentView(item.id)}
          >
            <item.icon size={18} />
            {item.label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div 
          className={clsx('nav-item', currentView === 'settings' && 'active')}
          onClick={() => setCurrentView('settings')}
        >
          <Settings size={18} />
          Settings
        </div>
      </div>
    </div>
  );
}
