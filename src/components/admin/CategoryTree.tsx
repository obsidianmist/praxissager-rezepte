import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, CornerDownRight } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import type { CategoryPayload } from '../../types';
import { generateId } from '../../lib/utils';

interface CategoryTreeProps {
  categories: CategoryPayload[];
  onChange: (cats: CategoryPayload[]) => void;
}

// Fallback TEN structure if empty
const DEFAULT_TEN_CATEGORIES: CategoryPayload[] = [
  { id: generateId(), name: 'Ernährung', parentId: null },
  { id: generateId(), name: 'Ausleitende Verfahren', parentId: null },
  { id: generateId(), name: 'Phytotherapie', parentId: null },
  { id: generateId(), name: 'Manuelle Therapien', parentId: null }
];

export function CategoryTree({ categories, onChange }: CategoryTreeProps) {
  const [editingCat, setEditingCat] = useState<CategoryPayload | null>(null);
  const [editName, setEditName] = useState('');

  // Initialer State: Lade TEN-Struktur, falls leer
  useEffect(() => {
    if (categories.length === 0) {
      const stored = localStorage.getItem('praxis_categories');
      if (stored) {
         try {
           onChange(JSON.parse(stored));
         } catch(e) {
           onChange(DEFAULT_TEN_CATEGORIES);
         }
      } else {
         onChange(DEFAULT_TEN_CATEGORIES);
      }
    }
  }, []); // Only on mount

  // Garantierte Persistenz
  const triggerChange = (newCats: CategoryPayload[]) => {
    localStorage.setItem('praxis_categories', JSON.stringify(newCats));
    onChange(newCats);
  };

  const handleAddMain = () => {
    const name = prompt('Name der Übergruppe:');
    if (name && name.trim() !== '') {
      triggerChange([...categories, { id: generateId(), name, parentId: null }]);
    }
  };

  const handleAddSub = (parentId: string) => {
    const name = prompt('Name der Untergruppe:');
    if (name && name.trim() !== '') {
      triggerChange([...categories, { id: generateId(), name, parentId }]);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Möchtest du diese Kategorie wirklich löschen? Rezepte in dieser Kategorie werden automatisch als 'Nicht zugewiesen' markiert.")) {
      triggerChange(categories.filter(c => c.id !== id && c.parentId !== id));
    }
  };

  const startEdit = (cat: CategoryPayload) => {
    setEditingCat(cat);
    setEditName(cat.name);
  };

  const saveEdit = () => {
    if (editingCat && editName.trim() !== '') {
      triggerChange(categories.map(c => c.id === editingCat.id ? { ...c, name: editName } : c));
      setEditingCat(null);
    }
  };

  const tree = categories.filter(c => !c.parentId).map(main => ({
    ...main,
    children: categories.filter(c => c.parentId === main.id)
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-text-main dark:text-dark-text">Struktur verwalten</h3>
        <Button onClick={handleAddMain} className="py-2 px-4 text-sm whitespace-nowrap">
          <Plus className="w-4 h-4 mr-2" />
          Neue Übergruppe erstellen
        </Button>
      </div>

      {editingCat && (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl mb-6 flex flex-col sm:flex-row gap-4 border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-2">
          <Input 
            value={editName} 
            onChange={e => setEditName(e.target.value)} 
            placeholder="Name bearbeiten..."
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            className="flex-grow"
            autoFocus
          />
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <Button onClick={saveEdit} className="flex-1 sm:flex-none">Speichern</Button>
            <Button variant="secondary" onClick={() => setEditingCat(null)} className="flex-1 sm:flex-none">Abbrechen</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tree.map(main => (
          <div key={main.id} className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-gray-700 rounded-2xl mb-4 shadow-sm overflow-hidden transition-colors">
            <div className="flex items-center p-4 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 group">
              <span className="font-semibold text-text-main dark:text-dark-text flex-grow">{main.name}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleAddSub(main.id)} className="p-2 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-xl transition-colors" title="Unterkategorie hinzufügen">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => startEdit(main)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors" title="Bearbeiten">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(main.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors" title="Löschen">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {main.children.length > 0 && (
              <div className="flex flex-col">
                {main.children.map(sub => (
                  <div key={sub.id} className="flex items-center p-3 pl-10 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-white dark:bg-dark-surface group transition-colors">
                    <CornerDownRight className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-3" />
                    <span className="text-gray-600 dark:text-gray-300 flex-grow text-sm">{sub.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(sub)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors" title="Bearbeiten">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(sub.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors" title="Löschen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {categories.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          Noch keine Struktur vorhanden. Klicke auf "Neue Übergruppe erstellen".
        </div>
      )}
    </div>
  );
}
