import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface AlertDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = createContext<AlertDialogContextType | null>(null);

interface AlertDialogProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

function useAlertDialog() {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error(
      "AlertDialog components must be used within an AlertDialog",
    );
  }
  return context;
}

interface AlertDialogTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function AlertDialogTrigger({
  children,
  asChild,
}: AlertDialogTriggerProps) {
  const { setOpen } = useAlertDialog();

  if (asChild) {
    // Clone the child and add onClick
    return <span onClick={() => setOpen(true)}>{children}</span>;
  }

  return <button onClick={() => setOpen(true)}>{children}</button>;
}

interface AlertDialogContentProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogContent({
  children,
  className = "",
}: AlertDialogContentProps) {
  const { open, setOpen } = useAlertDialog();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div
        className={`relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

interface AlertDialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogHeader({
  children,
  className = "",
}: AlertDialogHeaderProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

interface AlertDialogTitleProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogTitle({
  children,
  className = "",
}: AlertDialogTitleProps) {
  return (
    <h2
      className={`text-lg font-semibold text-slate-900 dark:text-slate-100 ${className}`}
    >
      {children}
    </h2>
  );
}

interface AlertDialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogDescription({
  children,
  className = "",
}: AlertDialogDescriptionProps) {
  return (
    <p
      className={`text-sm text-slate-500 dark:text-slate-400 mt-2 ${className}`}
    >
      {children}
    </p>
  );
}

interface AlertDialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogFooter({
  children,
  className = "",
}: AlertDialogFooterProps) {
  return (
    <div className={`flex justify-end gap-2 mt-4 ${className}`}>{children}</div>
  );
}

interface AlertDialogCancelProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogCancel({
  children,
  className = "",
}: AlertDialogCancelProps) {
  const { setOpen } = useAlertDialog();

  return (
    <button
      onClick={() => setOpen(false)}
      className={`px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

interface AlertDialogActionProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AlertDialogAction({
  children,
  className = "",
  onClick,
}: AlertDialogActionProps) {
  const { setOpen } = useAlertDialog();

  return (
    <button
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
      className={`px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
