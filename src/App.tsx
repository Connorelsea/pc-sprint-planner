import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ImportExportModal from "./ImportExportModal";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/ui/alert-dialog";

// ============ TYPES ============
interface SubItem {
  id: string;
  text: string;
}

interface Item {
  id: string;
  text: string;
  subItems: SubItem[];
  epic?: string;
  domain?: string;
  requiredPoints?: number | "";
  optionalPoints?: number | "";
}

interface Sprint {
  id: string;
  name: string;
  multiplier: number;
}

type GroupId =
  | "staging"
  | "committed"
  | "milestones"
  | "risks"
  | "dependencies"
  | "willNotDo"
  | "uncommitted";

interface GroupConfig {
  label: string;
  color: string;
  bgColor: string;
}

interface Stats {
  required: number;
  optional: number;
  percent?: number;
  remaining?: number;
}

interface PlannerData {
  sprints: Sprint[];
  velocity: number;
  items: Record<GroupId, Item[]>;
}

interface DragData {
  item: Item;
  groupId: GroupId;
}

interface DraggableItemProps {
  item: Item;
  groupId: GroupId;
  onUpdate: (itemId: string, updates: Partial<Item>) => void;
  onDelete: (itemId: string) => void;
  onDuplicate: (item: Item) => void;
  onReorder: (itemId: string, direction: "up" | "down") => void;
}

interface DroppableGroupProps {
  groupId: GroupId;
  items: Item[];
  onUpdate: (itemId: string, updates: Partial<Item>) => void;
  onDelete: (itemId: string) => void;
  onAdd: (groupId: GroupId) => void;
  onDuplicate: (groupId: GroupId, item: Item) => void;
  onReorder: (
    groupId: GroupId,
    itemId: string,
    direction: "up" | "down",
  ) => void;
  stats?: Stats;
}

interface SprintTableProps {
  sprints: Sprint[];
  velocity: number;
  onSprintsChange: (sprints: Sprint[]) => void;
  onVelocityChange: (velocity: number) => void;
}

// ============ CONSTANTS ============
const GROUP_CONFIG: Record<GroupId, GroupConfig> = {
  staging: { label: "Staging", color: "#64748b", bgColor: "#334155" },
  committed: { label: "Committed", color: "#1e40af", bgColor: "#1e3a8a" },
  milestones: { label: "Milestones", color: "#16a34a", bgColor: "#166534" },
  risks: { label: "Risks", color: "#ea580c", bgColor: "#c2410c" },
  dependencies: { label: "Dependencies", color: "#0d9488", bgColor: "#0f766e" },
  willNotDo: { label: "Will Not Do", color: "#dc2626", bgColor: "#b91c1c" },
  uncommitted: { label: "Uncommitted", color: "#db2777", bgColor: "#be185d" },
};

const DEFAULT_DATA: PlannerData = {
  sprints: [
    { id: "s1", name: "S1", multiplier: 100 },
    { id: "s2", name: "S2", multiplier: 95 },
    { id: "s3", name: "S3", multiplier: 90 },
    { id: "s4", name: "S4", multiplier: 80 },
    { id: "s5", name: "S5", multiplier: 70 },
  ],
  velocity: 34,
  items: {
    staging: [],
    committed: [],
    milestones: [],
    risks: [],
    dependencies: [],
    willNotDo: [],
    uncommitted: [],
  },
};

// ============ UTILITIES ============
const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const loadFromStorage = (): PlannerData => {
  try {
    const saved = localStorage.getItem("sprint-planner-data");
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<PlannerData>;
      // Merge with defaults to handle any missing keys
      return {
        ...DEFAULT_DATA,
        ...parsed,
        items: { ...DEFAULT_DATA.items, ...parsed.items },
      };
    }
  } catch (e) {
    console.error("Failed to load from storage:", e);
  }
  return DEFAULT_DATA;
};

const saveToStorage = (data: PlannerData): void => {
  try {
    localStorage.setItem("sprint-planner-data", JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to storage:", e);
  }
};

// ============ DRAGGABLE ITEM ============
function DraggableItem({
  item,
  groupId,
  onUpdate,
  onDelete,
  onDuplicate,
  onReorder,
}: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { item, groupId } as DragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(item);

  // Inline editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [inlineText, setInlineText] = useState(item.text);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [inlineSubText, setInlineSubText] = useState("");

  // Sync inline text with item prop when it changes externally
  useEffect(() => {
    setInlineText(item.text);
  }, [item.text]);

  const startEditingText = () => {
    setInlineText(item.text);
    setIsEditingText(true);
  };

  const handleSave = () => {
    onUpdate(item.id, editData);
    setIsEditing(false);
  };

  const handleInlineTextSave = () => {
    if (inlineText !== item.text) {
      onUpdate(item.id, { text: inlineText });
    }
    setIsEditingText(false);
  };

  const handleInlineTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      // Save current text and create new sub-item
      if (inlineText !== item.text) {
        onUpdate(item.id, { text: inlineText });
      }
      setIsEditingText(false);
      addInlineSubItem();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleInlineTextSave();
    } else if (e.key === "Escape") {
      setInlineText(item.text);
      setIsEditingText(false);
    } else if (e.key === "Tab") {
      if (e.shiftKey) {
        // Shift+Tab: save and let browser handle going to previous element
        if (inlineText !== item.text) {
          onUpdate(item.id, { text: inlineText });
        }
        setTimeout(() => {
          setIsEditingText(false);
        }, 0);
      } else if (item.subItems && item.subItems.length > 0) {
        // Tab to first sub-item if exists
        e.preventDefault();
        if (inlineText !== item.text) {
          onUpdate(item.id, { text: inlineText });
        }
        setIsEditingText(false);
        const firstSub = item.subItems[0];
        setTimeout(() => {
          setEditingSubId(firstSub.id);
          setInlineSubText(firstSub.text);
        }, 0);
      } else {
        // No sub-items, save and let browser handle Tab to next element
        if (inlineText !== item.text) {
          onUpdate(item.id, { text: inlineText });
        }
        setTimeout(() => {
          setIsEditingText(false);
        }, 0);
      }
    }
  };

  const handleSubItemClick = (subId: string, text: string) => {
    setEditingSubId(subId);
    setInlineSubText(text);
  };

  const handleSubItemSave = (subId: string) => {
    const updatedSubItems = item.subItems.map((s) =>
      s.id === subId ? { ...s, text: inlineSubText } : s,
    );
    onUpdate(item.id, { subItems: updatedSubItems });
    setEditingSubId(null);
  };

  const handleSubItemKeyDown = (e: React.KeyboardEvent, subId: string) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      // Save current sub-item and create new one after it
      const currentIndex = item.subItems.findIndex((s) => s.id === subId);
      const newSubId = generateId();
      const updatedSubItems = item.subItems.map((s) =>
        s.id === subId ? { ...s, text: inlineSubText } : s,
      );
      // Insert new sub-item after current one
      updatedSubItems.splice(currentIndex + 1, 0, { id: newSubId, text: "" });
      onUpdate(item.id, { subItems: updatedSubItems });
      // Focus on new sub-item
      setTimeout(() => {
        setEditingSubId(newSubId);
        setInlineSubText("");
      }, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubItemSave(subId);
    } else if (e.key === "Escape") {
      setEditingSubId(null);
    } else if (e.key === "Tab") {
      const currentIndex = item.subItems.findIndex((s) => s.id === subId);
      // Save current sub-item
      const updatedSubItems = item.subItems.map((s) =>
        s.id === subId ? { ...s, text: inlineSubText } : s,
      );
      onUpdate(item.id, { subItems: updatedSubItems });

      if (e.shiftKey) {
        // Shift+Tab: go to previous sub-item or main text
        e.preventDefault();
        if (currentIndex > 0) {
          const prevSub = item.subItems[currentIndex - 1];
          setTimeout(() => {
            setEditingSubId(prevSub.id);
            setInlineSubText(prevSub.text);
          }, 0);
        } else {
          // Go to main text
          setEditingSubId(null);
          setTimeout(() => {
            setInlineText(item.text);
            setIsEditingText(true);
          }, 0);
        }
      } else {
        // Tab: go to next sub-item or let browser handle if last
        if (currentIndex < item.subItems.length - 1) {
          e.preventDefault();
          const nextSub = item.subItems[currentIndex + 1];
          setTimeout(() => {
            setEditingSubId(nextSub.id);
            setInlineSubText(nextSub.text);
          }, 0);
        } else {
          // Last sub-item, let browser handle Tab to next element
          // Use timeout so browser Tab action completes before input unmounts
          setTimeout(() => {
            setEditingSubId(null);
          }, 0);
        }
      }
    } else if (e.key === "Backspace" && inlineSubText === "") {
      e.preventDefault();
      // Find the index of the current sub-item
      const currentIndex = item.subItems.findIndex((s) => s.id === subId);
      // Remove the sub-item
      const updatedSubItems = item.subItems.filter((s) => s.id !== subId);
      onUpdate(item.id, { subItems: updatedSubItems });

      // Focus on previous sub-item or main text
      if (currentIndex > 0) {
        const prevSub = item.subItems[currentIndex - 1];
        setTimeout(() => {
          setEditingSubId(prevSub.id);
          setInlineSubText(prevSub.text);
        }, 0);
      } else {
        // Focus on main text
        setEditingSubId(null);
        setTimeout(() => {
          setInlineText(item.text);
          setIsEditingText(true);
        }, 0);
      }
    }
  };

  const addInlineSubItem = () => {
    const newSubId = generateId();
    const updatedSubItems = [
      ...(item.subItems || []),
      { id: newSubId, text: "" },
    ];
    onUpdate(item.id, { subItems: updatedSubItems });
    // Start editing the new sub-item
    setTimeout(() => {
      setEditingSubId(newSubId);
      setInlineSubText("");
    }, 0);
  };

  const addSubItem = () => {
    setEditData({
      ...editData,
      subItems: [...(editData.subItems || []), { id: generateId(), text: "" }],
    });
  };

  const updateSubItem = (subId: string, text: string): void => {
    setEditData({
      ...editData,
      subItems: editData.subItems.map((s) =>
        s.id === subId ? { ...s, text } : s,
      ),
    });
  };

  const removeSubItem = (subId: string): void => {
    setEditData({
      ...editData,
      subItems: editData.subItems.filter((s) => s.id !== subId),
    });
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-2 mb-1">
        <input
          type="text"
          value={editData.text}
          onChange={(e) => setEditData({ ...editData, text: e.target.value })}
          placeholder="Main text..."
          className="w-full px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded mb-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <input
            type="text"
            value={editData.epic || ""}
            onChange={(e) => setEditData({ ...editData, epic: e.target.value })}
            placeholder="Epic (XX-0000)"
            className="px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            value={editData.domain || ""}
            onChange={(e) =>
              setEditData({ ...editData, domain: e.target.value })
            }
            placeholder="Domain"
            className="px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            value={editData.requiredPoints || ""}
            onChange={(e) =>
              setEditData({
                ...editData,
                requiredPoints: e.target.value ? parseInt(e.target.value) : "",
              })
            }
            placeholder="Req pts"
            className="px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            value={editData.optionalPoints || ""}
            onChange={(e) =>
              setEditData({
                ...editData,
                optionalPoints: e.target.value ? parseInt(e.target.value) : "",
              })
            }
            placeholder="Opt pts"
            className="px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="mb-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sub-items
            </span>
            <button
              onClick={addSubItem}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              + Add
            </button>
          </div>
          {(editData.subItems || []).map((sub) => (
            <div key={sub.id} className="flex gap-1 mb-1">
              <input
                type="text"
                value={sub.text}
                onChange={(e) => updateSubItem(sub.id, e.target.value)}
                placeholder="Sub-item text..."
                className="flex-1 px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <button
                onClick={() => removeSubItem(sub.id)}
                className="text-red-500 hover:text-red-700 px-1.5"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleSave}
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditData(item);
              setIsEditing(false);
            }}
            className="px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm hover:bg-slate-300 dark:hover:bg-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/70 ml-auto"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mb-1 group relative"
    >
      <div className="flex items-start px-1.5 py-1">
        <div
          {...attributes}
          {...listeners}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onReorder(item.id, "up");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onReorder(item.id, "down");
            }
          }}
          className="cursor-grab active:cursor-grabbing p-0.5 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0 focus:text-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-blue-50 dark:focus:bg-blue-900/50 rounded"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
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
        </div>
        <div className="flex-1">
          {/* Pills + text, with conditional layout based on editing state and pill presence */}
          {(() => {
            const hasPills = !!(
              item.epic ||
              item.domain ||
              item.requiredPoints ||
              item.optionalPoints
            );
            const shouldBreakLine = isEditingText && hasPills;

            const pillsContent = (
              <>
                {item.epic && (
                  <a
                    href={`https://purecars.atlassian.net/browse/${item.epic}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded leading-none underline hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors border border-blue-200 dark:border-blue-700"
                    style={{ boxShadow: "0 1px 2px rgba(59, 130, 246, 0.15)" }}
                  >
                    {item.epic}
                  </a>
                )}
                {item.domain && (
                  <span
                    className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded leading-none flex items-center gap-1 border border-slate-200 dark:border-slate-600"
                    style={{ boxShadow: "0 1px 2px rgba(100, 116, 139, 0.15)" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getDomainColor(item.domain) }}
                    />
                    {item.domain}
                  </span>
                )}
                {(item.requiredPoints || item.optionalPoints) &&
                  (() => {
                    const totalPoints =
                      (typeof item.requiredPoints === "number"
                        ? item.requiredPoints
                        : parseInt(item.requiredPoints || "0") || 0) +
                      (typeof item.optionalPoints === "number"
                        ? item.optionalPoints
                        : parseInt(item.optionalPoints || "0") || 0);
                    const pointsConfig =
                      totalPoints >= 36
                        ? {
                            classes:
                              "bg-red-200 dark:bg-red-900/70 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700",
                            shadow: "rgba(239, 68, 68, 0.2)",
                          }
                        : totalPoints >= 26
                          ? {
                              classes:
                                "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700",
                              shadow: "rgba(239, 68, 68, 0.15)",
                            }
                          : totalPoints >= 16
                            ? {
                                classes:
                                  "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700",
                                shadow: "rgba(249, 115, 22, 0.15)",
                              }
                            : totalPoints >= 11
                              ? {
                                  classes:
                                    "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700",
                                  shadow: "rgba(234, 179, 8, 0.15)",
                                }
                              : totalPoints >= 6
                                ? {
                                    classes:
                                      "bg-green-200 dark:bg-green-900/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700",
                                    shadow: "rgba(34, 197, 94, 0.2)",
                                  }
                                : {
                                    classes:
                                      "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700",
                                    shadow: "rgba(34, 197, 94, 0.15)",
                                  };
                    return (
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded leading-none ${pointsConfig.classes}`}
                        style={{
                          boxShadow: `0 1px 2px ${pointsConfig.shadow}`,
                        }}
                      >
                        {item.requiredPoints ? `${item.requiredPoints}p` : ""}
                        {item.requiredPoints && item.optionalPoints ? "+" : ""}
                        {item.optionalPoints ? `${item.optionalPoints}p` : ""}
                      </span>
                    );
                  })()}
              </>
            );

            const textContent = isEditingText ? (
              <input
                type="text"
                value={inlineText}
                onChange={(e) => setInlineText(e.target.value)}
                onBlur={handleInlineTextSave}
                onKeyDown={handleInlineTextKeyDown}
                autoFocus
                className={`text-xs font-medium text-blue-700 dark:text-blue-400 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 ${shouldBreakLine ? "w-full" : "flex-1 min-w-[80px]"}`}
              />
            ) : (
              <span
                tabIndex={0}
                onClick={startEditingText}
                onFocus={startEditingText}
                className="text-xs font-medium text-slate-800 dark:text-slate-300 cursor-text hover:text-slate-600 dark:hover:text-slate-400 break-words focus:outline-none"
              >
                {item.text || (
                  <em className="text-slate-400 italic">Enter text...</em>
                )}
              </span>
            );

            return shouldBreakLine ? (
              <div>
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {pillsContent}
                </div>
                {textContent}
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-wrap">
                {pillsContent}
                {textContent}
              </div>
            );
          })()}
          {/* Inline editable sub-items */}
          {item.subItems && item.subItems.length > 0 && (
            <ul className="mt-0.5 ml-2 text-[11px] text-slate-600 dark:text-slate-400">
              {item.subItems.map((sub) => (
                <li key={sub.id} className="flex items-center">
                  <span
                    className={`mr-1 transition-colors ${editingSubId === sub.id ? "text-blue-500" : "text-slate-400"}`}
                  >
                    •
                  </span>
                  {editingSubId === sub.id ? (
                    <input
                      type="text"
                      value={inlineSubText}
                      onChange={(e) => setInlineSubText(e.target.value)}
                      onBlur={() => handleSubItemSave(sub.id)}
                      onKeyDown={(e) => handleSubItemKeyDown(e, sub.id)}
                      autoFocus
                      className="flex-1 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-[11px] text-blue-700 dark:text-blue-400"
                    />
                  ) : (
                    <span
                      tabIndex={0}
                      onClick={() => handleSubItemClick(sub.id, sub.text)}
                      onFocus={() => handleSubItemClick(sub.id, sub.text)}
                      className="cursor-text hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none"
                    >
                      {sub.text || <em className="text-slate-400">empty</em>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* Action buttons - absolutely positioned */}
      <div className="absolute -top-2 right-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 bg-white dark:bg-slate-700 rounded shadow-sm border border-slate-200 dark:border-slate-600 px-0.5 transition-opacity">
        {/* Add sub-item button */}
        <button
          onClick={addInlineSubItem}
          className="p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
          title="Add sub-item"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
        {/* Duplicate button */}
        <button
          onClick={() => onDuplicate(item)}
          className="p-0.5 text-slate-400 hover:text-green-600 dark:hover:text-green-400"
          title="Duplicate"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        {/* Edit button */}
        <button
          onClick={() => {
            setEditData(item);
            setIsEditing(true);
          }}
          className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Edit"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        {/* Delete button with confirmation */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="p-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              title="Delete"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this item?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete "
                {item.text || "this item"}" and all its sub-items.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(item.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ============ DROPPABLE GROUP ============
function DroppableGroup({
  groupId,
  items,
  onUpdate,
  onDelete,
  onAdd,
  onDuplicate,
  onReorder,
  stats,
}: DroppableGroupProps) {
  const config = GROUP_CONFIG[groupId];
  const { setNodeRef, isOver } = useDroppable({ id: groupId });

  const formatItemsForExport = (): string => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    return items
      .map((item, idx) => {
        const num = idx + 1;
        const parts: string[] = [];

        // Build the main line: "1. [Domain] - Title (EPIC)"
        let mainLine = `${num}.`;
        if (item.domain) {
          mainLine += ` [${item.domain}]`;
        }
        if (item.text) {
          mainLine += item.domain ? ` - ${item.text}` : ` ${item.text}`;
        }
        if (item.epic) {
          mainLine += ` (${item.epic})`;
        }
        parts.push(mainLine);

        // Add sub-items with tab indent and letter prefix
        if (item.subItems && item.subItems.length > 0) {
          item.subItems.forEach((sub, subIdx) => {
            if (sub.text) {
              const letter = letters[subIdx] || String(subIdx + 1);
              parts.push(`\t${letter}. ${sub.text}`);
            }
          });
        }

        return parts.join("\n");
      })
      .filter(Boolean)
      .join("\n");
  };

  const handleExport = async () => {
    const text = formatItemsForExport();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      // Brief visual feedback could be added here
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="rounded-t-lg px-2 py-1.5"
        style={{
          backgroundColor: config.bgColor,
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.1), inset 0 -1px 0 0 rgba(0,0,0,0.15)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-white text-sm">{config.label}</h3>
            {items.length > 0 && (
              <button
                onClick={handleExport}
                className="p-0.5 text-white/60 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            )}
          </div>
          {stats && (
            <span className="text-xs text-white/80">
              {stats.required}p req
              {stats.optional > 0 && ` + ${stats.optional}p opt`}
              {stats.percent !== undefined && ` • ${stats.percent}%`}
              {stats.remaining !== undefined && ` • ${stats.remaining}p left`}
            </span>
          )}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-b-lg border-2 border-t-0 transition-colors overflow-y-auto ${
          isOver
            ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30"
            : "border-slate-200 dark:border-slate-700"
        }`}
        style={{ minHeight: "120px" }}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <DraggableItem
              key={item.id}
              item={item}
              groupId={groupId}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={(i) => onDuplicate(groupId, i)}
              onReorder={(itemId, dir) => onReorder(groupId, itemId, dir)}
            />
          ))}
        </SortableContext>
        <button
          onClick={() => onAdd(groupId)}
          className="w-full py-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-dashed border-slate-300 dark:border-slate-600 transition-colors"
        >
          + Add Item
        </button>
      </div>
    </div>
  );
}

// ============ COMMITTED STATS PANEL ============
interface DomainStat {
  name: string;
  points: number;
  percent: number;
}

// ROYGBIV color palette for domains
const ROYGBIV_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink (extended)
  "#14b8a6", // Teal (extended)
  "#f59e0b", // Amber (extended)
];

const DOMAIN_COLORS_STORAGE_KEY = "sprint-planner-domain-colors";

const loadDomainColors = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem(DOMAIN_COLORS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load domain colors:", e);
  }
  return { Unassigned: "#94a3b8" };
};

const saveDomainColors = (colors: Record<string, string>): void => {
  try {
    localStorage.setItem(DOMAIN_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch (e) {
    console.error("Failed to save domain colors:", e);
  }
};

// Get next available color from ROYGBIV palette
const getNextColor = (existingColors: Record<string, string>): string => {
  const usedColors = new Set(Object.values(existingColors));
  for (const color of ROYGBIV_COLORS) {
    if (!usedColors.has(color)) {
      return color;
    }
  }
  // If all colors used, cycle through with slight variation
  const index = Object.keys(existingColors).length % ROYGBIV_COLORS.length;
  return ROYGBIV_COLORS[index];
};

// Singleton for domain colors (loaded once, updated as needed)
let domainColorsCache: Record<string, string> = loadDomainColors();

function getDomainColor(domain: string): string {
  if (domainColorsCache[domain]) {
    return domainColorsCache[domain];
  }
  // Assign new color for unknown domain
  const newColor = getNextColor(domainColorsCache);
  domainColorsCache[domain] = newColor;
  saveDomainColors(domainColorsCache);
  return newColor;
}

// Function to sync domain colors with current data
const syncDomainColors = (data: PlannerData): void => {
  const allDomains = new Set<string>();
  Object.values(data.items).forEach((items) => {
    items.forEach((item) => {
      if (item.domain) {
        allDomains.add(item.domain);
      }
    });
  });

  let updated = false;
  allDomains.forEach((domain) => {
    if (!domainColorsCache[domain]) {
      domainColorsCache[domain] = getNextColor(domainColorsCache);
      updated = true;
    }
  });

  if (updated) {
    saveDomainColors(domainColorsCache);
  }
};

interface CommittedStatsPanelProps {
  committedPercent: number;
  domainStats: DomainStat[];
  totalPoints: number;
  committedPoints: number;
}

function CommittedStatsPanel({
  committedPercent,
  domainStats,
  totalPoints,
  committedPoints,
}: CommittedStatsPanelProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-2 mb-1.5">
      {/* Committed Progress Bar */}
      <div className={domainStats.length > 0 ? "mb-1.5" : ""}>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Committed
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {committedPoints}p / {Math.round(totalPoints)}p
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                committedPercent > 100
                  ? "bg-red-500"
                  : committedPercent > 80
                    ? "bg-amber-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(committedPercent, 100)}%` }}
            />
          </div>
          <span
            className={`text-xs font-semibold w-8 text-right ${
              committedPercent > 100
                ? "text-red-600"
                : committedPercent > 80
                  ? "text-amber-600"
                  : "text-blue-600"
            }`}
          >
            {committedPercent}%
          </span>
        </div>
      </div>

      {/* Domain Breakdown */}
      {domainStats.length > 0 && (
        <div>
          {/* Stacked bar */}
          <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden flex mb-1">
            {domainStats.map((d) => (
              <div
                key={d.name}
                className="h-full transition-all"
                style={{
                  flexGrow: d.points,
                  backgroundColor: getDomainColor(d.name),
                }}
                title={`${d.name}: ${d.points}p (${d.percent}%)`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="space-y-0.5">
            {domainStats.map((d) => (
              <div key={d.name} className="flex items-center text-[11px]">
                <div
                  className="w-2 h-2 rounded-sm mr-1 flex-shrink-0"
                  style={{ backgroundColor: getDomainColor(d.name) }}
                />
                <span className="flex-1 text-slate-600 dark:text-slate-300 truncate">
                  {d.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1 tabular-nums">
                  {d.points}p
                </span>
                <span className="text-slate-400 dark:text-slate-500 ml-0.5 w-7 text-right tabular-nums">
                  {d.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SPRINT TABLE (Compact Sidebar Version) ============
function SprintTable({
  sprints,
  velocity,
  onSprintsChange,
  onVelocityChange,
}: SprintTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sprint-planner-velocity-collapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    try {
      localStorage.setItem(
        "sprint-planner-velocity-collapsed",
        String(newValue),
      );
    } catch {
      // Ignore storage errors
    }
  };

  const addSprint = () => {
    const newSprint = {
      id: generateId(),
      name: `S${sprints.length + 1}`,
      multiplier:
        sprints.length > 0
          ? Math.max(40, sprints[sprints.length - 1].multiplier - 10)
          : 100,
    };
    onSprintsChange([...sprints, newSprint]);
  };

  const updateSprint = (
    id: string,
    field: keyof Sprint,
    value: string | number,
  ): void => {
    onSprintsChange(
      sprints.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const removeSprint = (id: string): void => {
    onSprintsChange(sprints.filter((s) => s.id !== id));
  };

  const totalPoints = sprints.reduce(
    (sum, s) => sum + velocity * (s.multiplier / 100),
    0,
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-2 mb-1.5">
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 -m-2 p-2 rounded-lg transition-colors"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isCollapsed ? "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600" : "bg-slate-200 dark:bg-slate-600"}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`text-slate-600 dark:text-slate-300 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
            Velocity
          </span>
        </div>
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="number"
            value={velocity}
            onChange={(e) => onVelocityChange(parseInt(e.target.value) || 0)}
            className="w-10 px-1 py-0.5 border border-slate-300 dark:border-slate-600 rounded text-center text-[11px] bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">
            {totalPoints.toFixed(0)}p
          </span>
        </div>
      </div>
      {!isCollapsed && (
        <>
          <div className="space-y-0.5 mt-1.5">
            {sprints.map((sprint) => {
              const adjusted = velocity * (sprint.multiplier / 100);
              return (
                <div
                  key={sprint.id}
                  className="flex items-center gap-1 text-[11px] bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-0.5"
                >
                  <input
                    type="text"
                    value={sprint.name}
                    onChange={(e) =>
                      updateSprint(sprint.id, "name", e.target.value)
                    }
                    className="w-8 px-0.5 py-0.5 border border-slate-200 dark:border-slate-600 rounded text-[11px] text-center bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    value={sprint.multiplier}
                    onChange={(e) =>
                      updateSprint(
                        sprint.id,
                        "multiplier",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-12 px-1 py-0.5 border border-slate-200 dark:border-slate-600 rounded text-center text-[11px] bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100"
                    min="0"
                    max="100"
                    step="5"
                  />
                  <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                    %
                  </span>
                  <span className="flex-1 text-right font-medium text-slate-600 dark:text-slate-300">
                    {adjusted.toFixed(0)}p
                  </span>
                  <button
                    onClick={() => removeSprint(sprint.id)}
                    className="text-red-400 hover:text-red-600 text-sm leading-none"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={addSprint}
            className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            + Add Sprint
          </button>
        </>
      )}
    </div>
  );
}

// ============ MAIN APP ============
export default function SprintPlanner() {
  const [data, setData] = useState<PlannerData>(() => {
    const loaded = loadFromStorage();
    // Sync domain colors with loaded data
    syncDomainColors(loaded);
    return loaded;
  });
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("sprint-planner-dark-mode");
      return saved === "true";
    } catch {
      return false;
    }
  });

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem("sprint-planner-dark-mode", String(isDarkMode));
    // Apply dark class to document for Tailwind dark mode
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Save to storage whenever data changes
  useEffect(() => {
    saveToStorage(data);
    // Also sync domain colors when data changes
    syncDomainColors(data);
  }, [data]);

  // Calculate statistics
  const calcStats = useCallback(
    (groupId: GroupId): { required: number; optional: number } => {
      const items = data.items[groupId] || [];
      const required = items.reduce(
        (sum, item) =>
          sum +
          (typeof item.requiredPoints === "number" ? item.requiredPoints : 0),
        0,
      );
      const optional = items.reduce(
        (sum, item) =>
          sum +
          (typeof item.optionalPoints === "number" ? item.optionalPoints : 0),
        0,
      );
      return { required, optional };
    },
    [data.items],
  );

  const totalPlanningPoints = data.sprints.reduce(
    (sum, s) => sum + data.velocity * (s.multiplier / 100),
    0,
  );
  const committedStats = calcStats("committed");
  const committedPercent =
    totalPlanningPoints > 0
      ? Math.round((committedStats.required / totalPlanningPoints) * 100)
      : 0;
  const committedRemaining = Math.round(
    totalPlanningPoints - committedStats.required,
  );

  // Calculate domain breakdown for committed items
  const domainBreakdown = useCallback(() => {
    const domains: Record<string, number> = {};
    const committedItems = data.items.committed || [];
    let totalPoints = 0;

    committedItems.forEach((item) => {
      const points =
        typeof item.requiredPoints === "number" ? item.requiredPoints : 0;
      if (points > 0) {
        const domain = item.domain || "Unassigned";
        domains[domain] = (domains[domain] || 0) + points;
        totalPoints += points;
      }
    });

    return Object.entries(domains)
      .map(([name, points]) => ({
        name,
        points,
        percent: totalPoints > 0 ? Math.round((points / totalPoints) * 100) : 0,
      }))
      .sort((a, b) => b.points - a.points);
  }, [data.items.committed]);

  const domainStats = domainBreakdown();

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveItem(active.data.current as DragData);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const dragData = active.data.current as DragData;
    const sourceGroup = dragData.groupId;

    // Check if dropping on a group or on another item
    const isOverGroup = Object.keys(GROUP_CONFIG).includes(overId);

    if (isOverGroup) {
      // Moving to a different group (drop zone)
      const destGroup = overId as GroupId;
      if (sourceGroup === destGroup) return;

      const item = dragData.item;
      setData((prev) => ({
        ...prev,
        items: {
          ...prev.items,
          [sourceGroup]: prev.items[sourceGroup].filter(
            (i) => i.id !== item.id,
          ),
          [destGroup]: [...prev.items[destGroup], item],
        },
      }));
    } else {
      // Dropping on another item - could be same group or different group
      const overData = over.data.current as DragData | undefined;
      const destGroup = overData?.groupId || sourceGroup;

      if (sourceGroup === destGroup) {
        // Reordering within same group
        setData((prev) => {
          const items = prev.items[sourceGroup];
          const oldIndex = items.findIndex((i) => i.id === activeId);
          const newIndex = items.findIndex((i) => i.id === overId);

          if (oldIndex === -1 || newIndex === -1) return prev;

          return {
            ...prev,
            items: {
              ...prev.items,
              [sourceGroup]: arrayMove(items, oldIndex, newIndex),
            },
          };
        });
      } else {
        // Moving to different group, insert at position
        const item = dragData.item;
        setData((prev) => {
          const destItems = prev.items[destGroup];
          const newIndex = destItems.findIndex((i) => i.id === overId);

          const newDestItems = [...destItems];
          newDestItems.splice(
            newIndex === -1 ? destItems.length : newIndex,
            0,
            item,
          );

          return {
            ...prev,
            items: {
              ...prev.items,
              [sourceGroup]: prev.items[sourceGroup].filter(
                (i) => i.id !== item.id,
              ),
              [destGroup]: newDestItems,
            },
          };
        });
      }
    }
  };

  const handleAddItem = (groupId: GroupId): void => {
    const newItem: Item = {
      id: generateId(),
      text: "",
      subItems: [],
      epic: "",
      domain: "",
      requiredPoints: "",
      optionalPoints: "",
    };
    setData((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [groupId]: [...prev.items[groupId], newItem],
      },
    }));
  };

  const handleDuplicateItem = (groupId: GroupId, item: Item): void => {
    const duplicatedItem: Item = {
      ...item,
      id: generateId(),
      text: item.text ? `${item.text} (copy)` : "",
      subItems: item.subItems.map((sub) => ({ ...sub, id: generateId() })),
    };
    setData((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [groupId]: [...prev.items[groupId], duplicatedItem],
      },
    }));
  };

  const handleReorderItem = (
    groupId: GroupId,
    itemId: string,
    direction: "up" | "down",
  ): void => {
    setData((prev) => {
      const items = prev.items[groupId];
      const currentIndex = items.findIndex((i) => i.id === itemId);
      if (currentIndex === -1) return prev;

      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= items.length) return prev;

      const newItems = [...items];
      [newItems[currentIndex], newItems[newIndex]] = [
        newItems[newIndex],
        newItems[currentIndex],
      ];

      return {
        ...prev,
        items: {
          ...prev.items,
          [groupId]: newItems,
        },
      };
    });
  };

  const handleImportData = (jsonString: string): void => {
    try {
      const imported = JSON.parse(jsonString) as Partial<PlannerData>;
      const newData: PlannerData = {
        ...DEFAULT_DATA,
        ...imported,
        items: { ...DEFAULT_DATA.items, ...imported.items },
      };
      setData(newData);
      syncDomainColors(newData);
    } catch (e) {
      console.error("Failed to import data:", e);
    }
  };

  const handleUpdateItem =
    (groupId: GroupId) =>
    (itemId: string, updates: Partial<Item>): void => {
      setData((prev) => ({
        ...prev,
        items: {
          ...prev.items,
          [groupId]: prev.items[groupId].map((item) =>
            item.id === itemId ? { ...item, ...updates } : item,
          ),
        },
      }));
    };

  const handleDeleteItem =
    (groupId: GroupId) =>
    (itemId: string): void => {
      setData((prev) => ({
        ...prev,
        items: {
          ...prev.items,
          [groupId]: prev.items[groupId].filter((item) => item.id !== itemId),
        },
      }));
    };

  return (
    <div
      className={`min-h-screen p-2 transition-colors ${isDarkMode ? "bg-slate-950" : "bg-slate-300"}`}
    >
      <div className="max-w-[1800px] mx-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-2 h-[calc(100vh-16px)]">
            {/* Left Sidebar: Stats + Sprint Table + Staging */}
            <div className="w-64 flex-shrink-0 flex flex-col">
              <CommittedStatsPanel
                committedPercent={committedPercent}
                domainStats={domainStats}
                totalPoints={totalPlanningPoints}
                committedPoints={committedStats.required}
              />
              <SprintTable
                sprints={data.sprints}
                velocity={data.velocity}
                onSprintsChange={(sprints) =>
                  setData((prev) => ({ ...prev, sprints }))
                }
                onVelocityChange={(velocity) =>
                  setData((prev) => ({ ...prev, velocity }))
                }
              />
              <KeyboardShortcuts />
              <div className="flex-1 min-h-0">
                <DroppableGroup
                  groupId="staging"
                  items={data.items.staging}
                  onUpdate={handleUpdateItem("staging")}
                  onDelete={handleDeleteItem("staging")}
                  onAdd={handleAddItem}
                  onDuplicate={handleDuplicateItem}
                  onReorder={handleReorderItem}
                  stats={calcStats("staging")}
                />
              </div>
              {/* Bottom buttons */}
              <div className="mt-1.5 flex gap-1">
                <button
                  onClick={() => setShowImportExport(true)}
                  className="flex-1 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10 rounded transition-colors flex items-center justify-center gap-1"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Import / Export
                </button>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10 rounded transition-colors flex items-center justify-center"
                  title={
                    isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                  }
                >
                  {isDarkMode ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 min-h-0">
              <DroppableGroup
                groupId="committed"
                items={data.items.committed}
                onUpdate={handleUpdateItem("committed")}
                onDelete={handleDeleteItem("committed")}
                onAdd={handleAddItem}
                onDuplicate={handleDuplicateItem}
                onReorder={handleReorderItem}
                stats={{
                  ...committedStats,
                  percent: committedPercent,
                  remaining: committedRemaining,
                }}
              />
              <DroppableGroup
                groupId="milestones"
                items={data.items.milestones}
                onUpdate={handleUpdateItem("milestones")}
                onDelete={handleDeleteItem("milestones")}
                onAdd={handleAddItem}
                onDuplicate={handleDuplicateItem}
                onReorder={handleReorderItem}
              />
              <DroppableGroup
                groupId="risks"
                items={data.items.risks}
                onUpdate={handleUpdateItem("risks")}
                onDelete={handleDeleteItem("risks")}
                onAdd={handleAddItem}
                onDuplicate={handleDuplicateItem}
                onReorder={handleReorderItem}
              />
              <DroppableGroup
                groupId="dependencies"
                items={data.items.dependencies}
                onUpdate={handleUpdateItem("dependencies")}
                onDelete={handleDeleteItem("dependencies")}
                onAdd={handleAddItem}
                onDuplicate={handleDuplicateItem}
                onReorder={handleReorderItem}
              />
              <DroppableGroup
                groupId="willNotDo"
                items={data.items.willNotDo}
                onUpdate={handleUpdateItem("willNotDo")}
                onDelete={handleDeleteItem("willNotDo")}
                onAdd={handleAddItem}
                onDuplicate={handleDuplicateItem}
                onReorder={handleReorderItem}
                stats={calcStats("willNotDo")}
              />
              <DroppableGroup
                groupId="uncommitted"
                items={data.items.uncommitted}
                onUpdate={handleUpdateItem("uncommitted")}
                onDelete={handleDeleteItem("uncommitted")}
                onAdd={handleAddItem}
                onDuplicate={handleDuplicateItem}
                onReorder={handleReorderItem}
                stats={calcStats("uncommitted")}
              />
            </div>
          </div>

          <DragOverlay>
            {activeItem && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 border-blue-400 p-1.5 opacity-90">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {activeItem.item.text || "Untitled"}
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        currentData={JSON.stringify(data, null, 2)}
        onImport={handleImportData}
      />
    </div>
  );
}
