import { useState } from "react";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: string;
  onImport: (data: string) => void;
}

export default function ImportExportModal({
  isOpen,
  onClose,
  currentData,
  onImport,
}: ImportExportModalProps) {
  const [importText, setImportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleImport = () => {
    if (!importText.trim()) {
      setError("Please paste JSON data to import");
      return;
    }

    try {
      // Validate JSON
      JSON.parse(importText);
      onImport(importText);
      setImportText("");
      setError(null);
      onClose();
    } catch (err) {
      setError("Invalid JSON format. Please check your data.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            Import / Export Data
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
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

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Export Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                Export (Current Data)
              </label>
              <button
                onClick={handleCopy}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
            <textarea
              readOnly
              value={currentData}
              className="w-full h-32 px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded resize-none focus:outline-none focus:border-slate-300"
            />
          </div>

          {/* Import Section */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Import (Paste JSON to overwrite)
            </label>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setError(null);
              }}
              placeholder="Paste JSON data here..."
              className="w-full h-32 px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded resize-none focus:outline-none focus:border-blue-400"
            />
            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Import & Overwrite
          </button>
        </div>
      </div>
    </div>
  );
}
