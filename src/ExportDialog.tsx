import { useState, useEffect } from "react";

interface Item {
  id: string;
  text: string;
  epic?: string;
  domain?: string;
  requiredPoints?: number | string;
  optionalPoints?: number | string;
  subItems?: { id: string; text: string }[];
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  groupLabel: string;
}

interface ExportOptions {
  includeEpic: boolean;
  includeDomain: boolean;
  includePoints: boolean;
  includeSubItems: boolean;
  includeNumbering: boolean;
  includeSubItemBullets: boolean;
}

export default function ExportDialog({
  isOpen,
  onClose,
  items,
  groupLabel,
}: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    includeEpic: true,
    includeDomain: true,
    includePoints: true,
    includeSubItems: true,
    includeNumbering: true,
    includeSubItemBullets: true,
  });
  const [copied, setCopied] = useState(false);

  // Reset copied state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatItemsForExport = (): string => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    return items
      .map((item, index) => {
        const parts: string[] = [];

        // Main line with optional metadata
        const mainLineParts: string[] = [];

        if (options.includeNumbering) {
          mainLineParts.push(`${index + 1}.`);
        }

        if (options.includeEpic && item.epic) {
          mainLineParts.push(`[${item.epic}]`);
        }

        if (options.includeDomain && item.domain) {
          mainLineParts.push(`(${item.domain})`);
        }

        mainLineParts.push(item.text || "Untitled");

        if (options.includePoints) {
          const pointsParts: string[] = [];
          if (item.requiredPoints)
            pointsParts.push(`${item.requiredPoints}p req`);
          if (item.optionalPoints)
            pointsParts.push(`${item.optionalPoints}p opt`);
          if (pointsParts.length > 0) {
            mainLineParts.push(`- ${pointsParts.join(", ")}`);
          }
        }

        parts.push(mainLineParts.join(" "));

        // Sub-items
        if (
          options.includeSubItems &&
          item.subItems &&
          item.subItems.length > 0
        ) {
          item.subItems.forEach((sub, subIndex) => {
            if (sub.text) {
              let prefix = "\t";
              if (options.includeSubItemBullets) {
                prefix += options.includeNumbering
                  ? `${letters[subIndex] || subIndex + 1}.`
                  : "•";
                prefix += " ";
              }
              parts.push(`${prefix}${sub.text}`);
            }
          });
        }

        return parts.join("\n");
      })
      .filter(Boolean)
      .join("\n");
  };

  const exportText = formatItemsForExport();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Export {groupLabel}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Include in export:
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { key: "includeNumbering" as const, label: "Numbering" },
              { key: "includeEpic" as const, label: "Epic" },
              { key: "includeDomain" as const, label: "Domain" },
              { key: "includePoints" as const, label: "Points" },
              { key: "includeSubItems" as const, label: "Sub-items" },
              {
                key: "includeSubItemBullets" as const,
                label: "Sub-item bullets",
              },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={() => toggleOption(key)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Preview ({items.length} items)
            </label>
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                copied
                  ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400"
                  : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/70"
              }`}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
          <pre className="w-full min-h-[200px] px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded whitespace-pre-wrap text-slate-800 dark:text-slate-200">
            {exportText || (
              <em className="text-slate-400">No items to export</em>
            )}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              handleCopy();
              setTimeout(onClose, 500);
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Copy & Close
          </button>
        </div>
      </div>
    </div>
  );
}
