"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { Subject } from "@/types/dashboard";

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    color: string | null;
    description: string | null;
  }) => void;
  initialData?: Subject | null;
}

const COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#eab308" },
  { name: "Pink", value: "#ec4899" },
];

export default function AddSubjectModal({
  isOpen,
  onClose,
  onAdd,
  initialData,
}: AddSubjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[2]); // Purple default
  const [isColorOpen, setIsColorOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description ?? "");

      const safeColor = initialData.color ?? COLORS[2].value;
      const match = COLORS.find(
        (c) => c.value.toLowerCase() === safeColor.toLowerCase()
      );

      setSelectedColor(
        match ?? { name: "Custom", value: safeColor }
      );
    } else {
      setName("");
      setDescription("");
      setSelectedColor(COLORS[2]);
    }

    setIsColorOpen(false);
  }, [isOpen, initialData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsColorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      description: description.trim() || null,
      color: selectedColor.value || null,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e1b2e] border border-white/10 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-2">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {initialData ? "Edit Subject" : "Add New Subject"}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {initialData
                ? "Update your subject details."
                : "Create a subject to organize your learning."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-white mb-1">
              Subject Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-white mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white resize-none focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Color Picker */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm text-white mb-1">Color</label>
            <button
              type="button"
              onClick={() => setIsColorOpen(!isColorOpen)}
              className="flex items-center justify-between w-[160px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedColor.value }}
                />
                <span className="text-sm">{selectedColor.name}</span>
              </div>
              <ChevronDown className={`w-4 h-4 ${isColorOpen ? "rotate-180" : ""}`} />
            </button>

            {isColorOpen && (
              <div className="absolute mt-2 w-[180px] bg-[#2d2b42] border border-white/10 rounded-lg shadow-xl z-10">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color);
                      setIsColorOpen(false);
                    }}
                    className="w-full flex justify-between items-center px-3 py-2 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                      <span className="text-sm text-gray-200">{color.name}</span>
                    </div>
                    {selectedColor.value === color.value && (
                      <Check className="w-4 h-4 text-white" />
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
              className="px-4 py-2 text-sm text-gray-300 border border-white/10 rounded-lg hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500"
            >
              {initialData ? "Update Subject" : "Create Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
