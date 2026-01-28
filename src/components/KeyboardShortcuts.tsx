import { useState, useEffect } from "react";
import { Kbd, KbdGroup } from "./ui/kbd";

const COLLAPSE_STORAGE_KEY = "sprint-planner-kbd-collapsed";

export default function KeyboardShortcuts() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : true; // Collapsed by default
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-1.5">
      <div
        className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 -m-2 p-2 rounded-lg transition-colors"
        onClick={toggleCollapse}
      >
        <div
          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isCollapsed ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-200"}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`text-slate-600 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <span className="text-xs font-medium text-slate-700">
          Keyboard Shortcuts
        </span>
      </div>

      {!isCollapsed && (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
          {/* Navigation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Next input/action</span>
              <Kbd>Tab</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Previous input/action</span>
              <KbdGroup>
                <Kbd>⇧</Kbd>
                <Kbd>Tab</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Trigger action</span>
              <Kbd>Enter</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">New sub-item</span>
              <KbdGroup>
                <Kbd>⇧</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
            </div>
          </div>

          {/* Reordering */}
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Focus drag handle</span>
              <KbdGroup>
                <Kbd>Tab</Kbd>
                <span className="text-slate-300 mx-0.5">→</span>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded ring-1 ring-blue-300 bg-blue-50">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-blue-500">
                    <circle cx="5" cy="5" r="2" />
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="19" cy="5" r="2" />
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                    <circle cx="5" cy="19" r="2" />
                    <circle cx="12" cy="19" r="2" />
                    <circle cx="19" cy="19" r="2" />
                  </svg>
                </span>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Reorder task</span>
              <KbdGroup>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </KbdGroup>
            </div>
          </div>

          {/* Editing */}
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Delete empty sub-item</span>
              <Kbd>⌫</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Cancel edit</span>
              <Kbd>Esc</Kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
