
import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { Subject } from '../types';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; color: string; description: string }) => void;
  initialData?: Subject | null;
}

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Pink', value: '#ec4899' },
];

export const AddSubjectModal: React.FC<AddSubjectModalProps> = ({ isOpen, onClose, onAdd, initialData }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[2]); // Default Purple
  const [isColorOpen, setIsColorOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || '');
        const matchedColor = COLORS.find(c => c.value.toLowerCase() === initialData.color.toLowerCase());
        if (matchedColor) setSelectedColor(matchedColor);
        else setSelectedColor({ name: 'Custom', value: initialData.color });
      } else {
        setName('');
        setDescription('');
        setSelectedColor(COLORS[2]);
      }
      setIsColorOpen(false);
    }
  }, [isOpen, initialData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onAdd({
      name,
      description,
      color: selectedColor.value
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1b2e] border border-white/10 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-2">
          <div>
            <h2 className="text-xl font-semibold text-white">{initialData ? 'Edit Subject' : 'Add New Subject'}</h2>
            <p className="text-gray-400 text-sm mt-1">
              {initialData ? 'Update your subject details.' : 'Create a new subject to organize your learning materials.'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Subject Name Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Subject Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chemistry, Mathematics, Physics"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              required
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this subject..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
            />
          </div>

          {/* Color Theme Picker */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-white">
              Color Theme
            </label>
            
            <button
              type="button"
              onClick={() => setIsColorOpen(!isColorOpen)}
              className="w-auto min-w-[140px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white flex items-center justify-between gap-3 hover:bg-white/10 transition-colors focus:outline-none focus:border-purple-500"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full shadow-sm" 
                  style={{ backgroundColor: selectedColor.value }}
                />
                <span className="text-sm">{selectedColor.name}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isColorOpen ? 'rotate-180' : ''}`} />
            </button>

            {isColorOpen && (
              <div className="absolute top-full left-0 mt-2 w-[180px] bg-[#2d2b42] border border-white/10 rounded-lg shadow-xl overflow-hidden z-10">
                {COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color);
                      setIsColorOpen(false);
                    }}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: color.value }}
                      />
                      <span className="text-sm text-gray-200">{color.name}</span>
                    </div>
                    {selectedColor.name === color.name && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
            >
              {initialData ? 'Update Subject' : 'Create Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
