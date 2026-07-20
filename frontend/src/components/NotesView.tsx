import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Plus, Trash2, Edit3, Eye, Save } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import debounce from 'lodash.debounce';

interface Note {
  id: string;
  title: string;
  content: string;
  category_ids?: string[];
  updated_at: string;
}

import type { Category } from './CategoriesView';
import { CategoryMultiSelect, CategoryBadges } from './CategoryMultiSelect';

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchNotes();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data);
      if (data.length > 0 && !activeNoteId) {
        setActiveNoteId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch notes", err);
    }
  };

  const createNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Note', content: '' })
      });
      const data = await res.json();
      setNotes([data, ...notes]);
      setActiveNoteId(data.id);
      setIsEditing(true);
      // Auto-focus title shortly after rendering
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    } catch (err) {
      console.error("Failed to create note", err);
    }
  };

  // Debounced save function
  const saveNoteToServer = useCallback(
    debounce(async (id: string, updates: Partial<Note>) => {
      setIsSaving(true);
      try {
        await fetch(`/api/notes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      } catch (err) {
        console.error("Failed to update note", err);
      } finally {
        // Small delay to make the 'Saving...' indicator visible
        setTimeout(() => setIsSaving(false), 500);
      }
    }, 750),
    []
  );

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNoteId) return;
    const noteToUpdate = notes.find(n => n.id === activeNoteId);
    if (!noteToUpdate) return;
    
    const updatedNote = { ...noteToUpdate, ...updates };
    setNotes(notes.map(n => n.id === activeNoteId ? updatedNote : n));
    saveNoteToServer(activeNoteId, updatedNote);
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      const newNotes = notes.filter(n => n.id !== id);
      setNotes(newNotes);
      if (activeNoteId === id) {
        setActiveNoteId(newNotes.length > 0 ? newNotes[0].id : null);
      }
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const activeNote = notes.find(n => n.id === activeNoteId);

  return (
    <div className="page-body">
      <div className="editor-container">
        
        {/* Sidebar for Notes list */}
        <div className="notes-list">
          <button className="btn-secondary" style={{ marginBottom: '1rem', justifyContent: 'center' }} onClick={createNote}>
            <Plus size={16} /> New Note
          </button>
          
          {notes.map(note => (
            <div 
              key={note.id} 
              className={clsx('note-item', activeNoteId === note.id && 'active')}
              onClick={() => setActiveNoteId(note.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="note-item-title">{note.title || 'Untitled Note'}</div>
                <button className="btn-icon" style={{ padding: 2 }} onClick={(e) => deleteNote(note.id, e)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="note-item-preview">
                {note.content ? note.content.substring(0, 50) + '...' : 'No content'}
              </div>
              <CategoryBadges categoryIds={note.category_ids || []} categories={categories} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                {format(new Date(note.updated_at + 'Z'), 'MMM d, h:mm a')}
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '1rem', fontSize: '0.875rem' }}>
              No notes.
            </div>
          )}
        </div>

        {/* Note Editor Area */}
        {activeNote ? (
          <div className="note-editor-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input 
                ref={titleInputRef}
                type="text" 
                className="note-title-input" 
                style={{ flexGrow: 1 }}
                value={activeNote.title}
                onChange={(e) => updateActiveNote({ title: e.target.value })}
                placeholder="Note Title"
              />
              <div style={{ 
                fontSize: '0.75rem', 
                color: isSaving ? 'var(--text-primary)' : 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'color var(--transition-fast)'
              }}>
                <Save size={12} />
                {isSaving ? 'Saving...' : 'Saved'}
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <CategoryMultiSelect 
                categories={categories}
                selectedIds={activeNote.category_ids || []}
                onChange={(ids) => updateActiveNote({ category_ids: ids })}
              />
            </div>
            
            <div className="editor-tabs">
              <button 
                className={clsx('editor-tab', isEditing && 'active')} 
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Write
              </button>
              <button 
                className={clsx('editor-tab', !isEditing && 'active')} 
                onClick={() => setIsEditing(false)}
              >
                <Eye size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Preview
              </button>
            </div>

            {isEditing ? (
              <textarea 
                className="note-textarea" 
                value={activeNote.content}
                onChange={(e) => updateActiveNote({ content: e.target.value })}
                placeholder="Start writing in Markdown..."
              />
            ) : (
              <div className="markdown-preview">
                <ReactMarkdown
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          children={String(children).replace(/\n$/, '')}
                          style={vscDarkPlus as any}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        />
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {activeNote.content || '*No content yet.*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            Select a note or create a new one
          </div>
        )}

      </div>
    </div>
  );
}
