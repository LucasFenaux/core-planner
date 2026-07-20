import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

import type { Category } from './CategoriesView';
import { CategoryMultiSelect } from './CategoryMultiSelect';

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  notes?: string;
  category_ids?: string[];
}

interface EventEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
  initialStart?: Date | null;
  initialEnd?: Date | null;
  editingEvent?: CalendarEvent | null;
  categories: Category[];
}

export function EventEditorModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  initialStart, 
  initialEnd, 
  editingEvent,
  categories
}: EventEditorModalProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        setTitle(editingEvent.title);
        setStartTime(format(new Date(editingEvent.start_time), "yyyy-MM-dd'T'HH:mm"));
        setEndTime(format(new Date(editingEvent.end_time), "yyyy-MM-dd'T'HH:mm"));
        setNotes(editingEvent.notes || '');
        setCategoryIds(editingEvent.category_ids || []);
      } else {
        setTitle('');
        setStartTime(initialStart ? format(initialStart, "yyyy-MM-dd'T'HH:mm") : '');
        setEndTime(initialEnd ? format(initialEnd, "yyyy-MM-dd'T'HH:mm") : '');
        setNotes('');
        setCategoryIds([]);
      }
    }
  }, [isOpen, initialStart, initialEnd, editingEvent]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;
    
    onSave({
      ...(editingEvent && { id: editingEvent.id }),
      title,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      notes,
      category_ids: categoryIds,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-header">{editingEvent ? 'Edit Event' : 'Create Event'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Event Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="What's happening?"
              autoFocus
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Start Time</label>
              <input 
                type="datetime-local" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>End Time</label>
              <input 
                type="datetime-local" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Categories</label>
            <CategoryMultiSelect 
              categories={categories} 
              selectedIds={categoryIds} 
              onChange={setCategoryIds} 
            />
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Add description or notes..."
              rows={3}
            />
          </div>

          <div className="modal-actions" style={{ justifyContent: editingEvent && onDelete ? 'space-between' : 'flex-end' }}>
            {editingEvent && onDelete && (
              <button type="button" className="btn-secondary" style={{ color: 'var(--text-tertiary)' }} onClick={() => {
                onDelete(editingEvent.id);
                onClose();
              }}>
                Delete
              </button>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Save Event</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
