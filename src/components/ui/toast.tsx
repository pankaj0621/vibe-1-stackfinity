"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Zap, Check, Clock, X, AlertTriangle } from "lucide-react";

export type ToastTone = "sun" | "teal" | "coral" | "neutral";

export interface ToastMessage {
  id?: string;
  title: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: ToastMessage) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((t: ToastMessage) => {
    setToast(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const dur = toast.duration || 3800;
    const timer = setTimeout(() => {
      setToast(null);
    }, dur);
    return () => clearTimeout(timer);
  }, [toast]);

  const getIcon = (tone?: ToastTone) => {
    switch (tone) {
      case "coral":
        return <Clock size={18} />;
      case "teal":
        return <Check size={18} />;
      case "neutral":
        return <AlertTriangle size={18} />;
      default:
        return <Zap size={18} />;
    }
  };

  const getToneClass = (tone?: ToastTone) => {
    switch (tone) {
      case "coral":
        return "bg-coral text-white";
      case "teal":
        return "bg-teal text-white";
      case "neutral":
        return "bg-ink-700 text-white";
      default:
        return "bg-ink text-sun";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 lg:bottom-8 lg:left-auto lg:right-8 lg:translate-x-0"
        >
          <div className="banner-in flex items-start gap-3 rounded-[18px] border border-white/70 bg-white px-5 py-4 shadow-pop">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${getToneClass(
                toast.tone
              )}`}
            >
              {getIcon(toast.tone)}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold text-ink">{toast.title}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink/5 hover:text-ink"
              aria-label="Close notification"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
