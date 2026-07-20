
import type { Category } from './CategoriesView';

interface CategoryMultiSelectProps {
  categories: Category[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CategoryMultiSelect({ categories, selectedIds, onChange }: CategoryMultiSelectProps) {
  
  const toggleCategory = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(catId => catId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (categories.length === 0) {
    return (
      <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
        No categories available. Create them in the Categories tab.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {categories.map(cat => {
        const isSelected = selectedIds.includes(cat.id);
        return (
          <div
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            style={{
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${isSelected ? cat.color : 'var(--border-color)'}`,
              backgroundColor: isSelected ? `${cat.color}20` : 'transparent',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cat.color }} />
            {cat.name}
          </div>
        );
      })}
    </div>
  );
}

// Helper to render badges
export function CategoryBadges({ categoryIds, categories }: { categoryIds: string[], categories: Category[] }) {
  if (!categoryIds || categoryIds.length === 0) return null;
  
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
      {categoryIds.map(id => {
        const cat = categories.find(c => c.id === id);
        if (!cat) return null;
        return (
          <div key={id} style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '4px',
            fontSize: '0.75rem', 
            padding: '2px 6px', 
            borderRadius: '12px',
            backgroundColor: `${cat.color}20`,
            color: 'var(--text-primary)',
            border: `1px solid ${cat.color}40`
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cat.color }} />
            {cat.name}
          </div>
        );
      })}
    </div>
  );
}
