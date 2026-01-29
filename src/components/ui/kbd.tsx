import type { ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className = "" }: KbdProps) {
  return (
    <kbd
      className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-gradient-to-b from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-300 dark:border-slate-600 border-b-slate-400 dark:border-b-slate-500 rounded ${className}`}
      style={{
        boxShadow:
          "0 1px 0 1px rgba(0,0,0,0.04), 0 2px 0 0 rgba(0,0,0,0.06), inset 0 -2px 0 0 rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </kbd>
  );
}

interface KbdGroupProps {
  children: ReactNode;
  className?: string;
}

export function KbdGroup({ children, className = "" }: KbdGroupProps) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {children}
    </span>
  );
}
