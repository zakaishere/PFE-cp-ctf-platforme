"use client";

import { useState } from "react";

const PRESETS = [
  "Array", "String", "Hash Table", "Math", "Dynamic Programming",
  "Sorting", "Greedy", "Depth-First Search", "Binary Search",
  "Tree", "Graph", "Two Pointers", "Sliding Window", "Stack",
  "Queue", "Heap", "Backtracking", "Bit Manipulation", "Recursion",
  "Linked List", "Matrix", "Simulation",
];

interface TagsInputProps {
  value:    string[];
  onChange: (tags: string[]) => void;
}

export function TagsInput({ value, onChange }: TagsInputProps) {
  const [inputVal, setInputVal] = useState("");

  function addTag(tag: string) {
    const clean = tag.trim();
    if (clean && !value.includes(clean) && value.length < 8) {
      onChange([...value, clean]);
    }
    setInputVal("");
  }

  function removeTag(tag: string) {
    onChange(value.filter(t => t !== tag));
  }

  return (
    <div>
      {/* Selected pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {value.map(tag => (
          <div key={tag} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 8px 3px 10px",
            background: "var(--blue-light)",
            border: "1px solid var(--blue)",
            borderRadius: 20,
            fontSize: 12, fontWeight: 600,
            color: "var(--blue)",
          }}>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{
                background: "none", border: "none",
                cursor: "pointer", color: "var(--blue)",
                fontSize: 14, lineHeight: 1, padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Text input */}
      <input
        className="input"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(inputVal);
          }
          if (e.key === "Backspace" && !inputVal && value.length > 0) {
            removeTag(value[value.length - 1]);
          }
        }}
        placeholder="Type a topic and press Enter..."
        style={{ marginBottom: 8 }}
      />

      {/* Preset suggestions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {PRESETS
          .filter(p => !value.includes(p))
          .filter(p => !inputVal || p.toLowerCase().includes(inputVal.toLowerCase()))
          .slice(0, 12)
          .map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => addTag(preset)}
              style={{
                padding: "2px 8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                fontSize: 11, color: "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.1s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background  = "#deebff";
                el.style.color       = "#0052cc";
                el.style.borderColor = "#0052cc";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background  = "#f4f5f7";
                el.style.color       = "#5e6c84";
                el.style.borderColor = "var(--border)";
              }}
            >
              + {preset}
            </button>
          ))}
      </div>
    </div>
  );
}
