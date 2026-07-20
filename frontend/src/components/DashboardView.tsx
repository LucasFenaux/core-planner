import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Calendar as CalendarIcon, FileText, CheckCircle, TrendingUp, Circle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { CalendarEvent } from './EventEditorModal';

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

interface DashboardStats {
  total_tasks: number;
  completed_tasks: number;
  tasks_by_status: { status: string; count: number }[];
  tasks_by_category: { name: string; color: string; count: number }[];
  upcoming_events: CalendarEvent[];
  recent_notes: Note[];
}

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error('Failed to fetch dashboard stats', e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading dashboard...</p>
      </div>
    );
  }

  // Pre-process tasks by status for the bar chart
  const statusColors: Record<string, string> = {
    todo: '#64748b',
    in_progress: '#3b82f6',
    done: '#22c55e'
  };

  const statusData = stats.tasks_by_status.map(s => ({
    name: s.status.replace('_', ' ').toUpperCase(),
    count: s.count,
    fill: statusColors[s.status] || '#cbd5e1'
  }));

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.3 }
    })
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants} 
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '1rem', borderRadius: '50%' }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Total Tasks</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.total_tasks}</div>
          </div>
        </motion.div>

        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} 
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '1rem', borderRadius: '50%' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Tasks Completed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.completed_tasks}</div>
          </div>
        </motion.div>

        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} 
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', padding: '1rem', borderRadius: '50%' }}>
            <CalendarIcon size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Upcoming Events</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.upcoming_events.length}</div>
          </div>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants} 
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '1rem', borderRadius: '50%' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Completion Rate</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0}%
            </div>
          </div>
        </motion.div>

      </div>

      {/* Main Charts Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Task Status Bar Chart */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckSquare size={18} color="var(--accent-color)" /> Task Pipeline
          </h3>
          <div style={{ height: 250 }}>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>No tasks found</div>
            )}
          </div>
        </motion.div>

        {/* Task by Category Pie Chart */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariants}
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Circle size={18} color="var(--accent-color)" /> Tasks by Category
          </h3>
          <div style={{ height: 250 }}>
            {stats.tasks_by_category.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Pie
                    data={stats.tasks_by_category}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    stroke="none"
                  >
                    {stats.tasks_by_category.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend 
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>No categorized tasks found</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity Lists Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Upcoming Events */}
        <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariants}
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={18} color="var(--accent-color)" /> Upcoming Events
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.upcoming_events.length > 0 ? stats.upcoming_events.map(event => (
              <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 500 }}>{event.title}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  {format(parseISO(event.start_time), 'MMM d, h:mm a')}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-tertiary)', padding: '1rem 0' }}>No upcoming events scheduled.</div>
            )}
          </div>
        </motion.div>

        {/* Recent Notes */}
        <motion.div custom={7} initial="hidden" animate="visible" variants={cardVariants}
          style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} color="var(--accent-color)" /> Recent Notes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.recent_notes.length > 0 ? stats.recent_notes.map(note => (
              <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 500 }}>{note.title}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  Edited {format(parseISO(note.updated_at), 'MMM d')}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-tertiary)', padding: '1rem 0' }}>No recent notes found.</div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
