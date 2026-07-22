import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, CheckCircle, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskEditorModal } from './TaskEditorModal';
import type { Task } from './TaskEditorModal';
import type { Category } from './CategoriesView';
import { CategoryBadges } from './CategoryMultiSelect';

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetchTasks();
    fetchCategories();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (taskData.id) {
        const res = await fetch(`/api/tasks/${taskData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        const updatedTask = await res.json();
        setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...taskData, status: 'todo' })
        });
        const newTask = await res.json();
        setTasks([newTask, ...tasks]);
      }
    } catch (err) {
      console.error("Failed to save task", err);
    }
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    
    // Optimistic update
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: newStatus })
      });
      if (newStatus === 'done' && task.recurrence && task.recurrence !== 'none') {
        // If we completed a recurring task, the backend likely cloned it. 
        // We need to fetch the fresh list of tasks to see the newly generated one.
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to toggle task", err);
      // Revert optimistic update on failure
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete task", err);
    }
  };

  const clearCompleted = async () => {
    const completedTasks = tasks.filter(t => t.status === 'done');
    for (const task of completedTasks) {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    }
    setTasks(tasks.filter(t => t.status !== 'done'));
  };

  const filteredTasks = filterCategory === 'all' 
    ? tasks 
    : tasks.filter(t => t.category_ids && t.category_ids.includes(filterCategory));

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // 1. Status: todo before done
    if (a.status !== b.status) {
      return a.status === 'todo' ? -1 : 1;
    }

    // 2. Priority: high > medium > low
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const weightA = priorityWeight[a.priority] || 0;
    const weightB = priorityWeight[b.priority] || 0;
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // 3. Due date (deadline): earliest first
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    } else if (a.deadline) {
      return -1;
    } else if (b.deadline) {
      return 1;
    }

    // 4. Fallback to created_at (newer first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="page-body" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.75rem',
              fontFamily: 'inherit',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <button 
            className="btn-secondary" 
            onClick={clearCompleted} 
            disabled={!tasks.some(t => t.status === 'done')}
            style={{ opacity: tasks.some(t => t.status === 'done') ? 1 : 0.5 }}
          >
            <CheckCircle size={18} />
            Clear Completed
          </button>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          New Task
        </button>
      </div>

      <div className="task-list">
        <AnimatePresence>
          {sortedTasks.map(task => (
            <motion.div 
              key={task.id} 
              layout
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
              transition={{ duration: 0.2 }}
              className="task-item"
              style={{ opacity: task.status === 'done' ? 0.6 : 1 }}
            >
              <input 
                type="checkbox" 
                className="task-checkbox" 
                checked={task.status === 'done'}
                onChange={() => toggleTaskStatus(task)}
              />
              <div className="task-content">
                <div className={`task-title ${task.status === 'done' ? 'completed' : ''}`}>
                  {task.title}
                </div>
                {task.description && (
                  <div className="task-desc" style={{ marginBottom: '0.25rem' }}>{task.description}</div>
                )}
                <CategoryBadges categoryIds={task.category_ids || []} categories={categories} />
                <div className="task-meta">
                  <span className={`badge badge-${task.priority}`}>
                    {task.priority}
                  </span>
                  {task.deadline && (
                    <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {task.recurrence && task.recurrence !== 'none' && <Repeat size={12} />}
                      Due: {task.deadline.includes('T') 
                             ? format(new Date(task.deadline), 'MMM d, h:mm a') 
                             : format(new Date(task.deadline + 'T12:00:00'), 'MMM d')}
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                    Added: {format(new Date(task.created_at + 'Z'), 'MMM d')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="btn-icon" onClick={() => openEditModal(task)} title="Edit Task">
                  <Edit2 size={16} />
                </button>
                <button className="btn-icon" onClick={() => deleteTask(task.id)} title="Delete Task">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '2rem' }}>
            No tasks yet. Create one!
          </div>
        )}
      </div>

      <TaskEditorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        categories={categories}
      />
    </div>
  );
}
