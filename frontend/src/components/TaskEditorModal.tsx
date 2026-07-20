import React, { useState, useEffect } from 'react';

import type { Category } from './CategoriesView';
import { CategoryMultiSelect } from './CategoryMultiSelect';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline?: string;
  category_ids?: string[];
  recurrence?: string;
  created_at: string;
  updated_at: string;
}

interface TaskEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  task?: Task | null; // If null, it's a new task
  categories: Category[];
}

export function TaskEditorModal({ isOpen, onClose, onSave, task, categories }: TaskEditorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [includeTime, setIncludeTime] = useState(false);
  const [recurrence, setRecurrence] = useState('none');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      
      if (task.deadline) {
        if (task.deadline.includes('T')) {
          setIncludeTime(true);
          setDeadline(task.deadline.substring(0, 16)); // Format for datetime-local
        } else {
          setIncludeTime(false);
          setDeadline(task.deadline.substring(0, 10)); // Format for date
        }
      } else {
        setIncludeTime(false);
        setDeadline('');
      }
      
      setRecurrence(task.recurrence || 'none');
      setCategoryIds(task.category_ids || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDeadline('');
      setIncludeTime(false);
      setRecurrence('none');
      setCategoryIds([]);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      ...(task && { id: task.id, status: task.status }),
      title,
      description,
      priority,
      deadline: deadline ? (includeTime ? new Date(deadline).toISOString() : deadline) : undefined,
      category_ids: categoryIds,
      recurrence,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-header">{task ? 'Edit Task' : 'Create New Task'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Add details..."
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Categories</label>
            <CategoryMultiSelect 
              categories={categories} 
              selectedIds={categoryIds} 
              onChange={setCategoryIds} 
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Priority</label>
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.75rem',
                  fontFamily: 'inherit'
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ margin: 0 }}>Deadline (Optional)</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', margin: 0, fontWeight: 'normal' }}>
                  <input 
                    type="checkbox" 
                    checked={includeTime} 
                    onChange={(e) => {
                      setIncludeTime(e.target.checked);
                      if (deadline) {
                         // Truncate to date if toggling off time, or append default time if toggling on
                         setDeadline(e.target.checked ? `${deadline.substring(0, 10)}T12:00` : deadline.substring(0, 10));
                      }
                    }} 
                  />
                  Include Time
                </label>
              </div>
              <input 
                type={includeTime ? "datetime-local" : "date"} 
                value={deadline} 
                onChange={(e) => setDeadline(e.target.value)} 
              />
            </div>
          </div>

          {deadline && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Repeat</label>
              <select 
                value={recurrence} 
                onChange={(e) => setRecurrence(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.75rem',
                  fontFamily: 'inherit',
                  width: '100%'
                }}
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
