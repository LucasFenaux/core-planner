import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TasksView } from './components/TasksView';
import { NotesView } from './components/NotesView';
import { CalendarView } from './components/CalendarView';
import { CategoriesView } from './components/CategoriesView';
import { CommandPalette } from './components/CommandPalette';
import { DashboardView } from './components/DashboardView';
import { JournalView } from './components/JournalView';
import { SettingsView } from './components/SettingsView';

function App() {
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('productivity-app-view') || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('productivity-app-view', currentView);
  }, [currentView]);

  return (
    <div className="app-container">
      <CommandPalette setCurrentView={setCurrentView} />
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="main-content">
        <header className="page-header">
          <h1 className="page-title">
            {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
          </h1>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
            Press <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)' }}>⌘K</kbd> or <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)' }}>Ctrl+K</kbd> for Command Menu
          </div>
        </header>

        {currentView === 'tasks' && <TasksView />}
        {currentView === 'notes' && <NotesView />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'categories' && <CategoriesView />}
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'journal' && <JournalView />}
        {currentView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default App;
