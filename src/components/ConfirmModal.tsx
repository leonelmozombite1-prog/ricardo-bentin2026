import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Sí, continuar',
  cancelText = 'Cancelar',
  confirmColor = 'danger',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colorStyles = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25',
    primary: 'bg-[#0b1c3d] hover:bg-[#152e63] text-white shadow-blue-900/25'
  };

  const iconStyles = {
    danger: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    primary: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 overflow-hidden">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${iconStyles[confirmColor]}`}>
            {confirmColor === 'danger' ? (
              <Trash2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-cinzel text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {message}
            </p>
          </div>

          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-md transition cursor-pointer ${colorStyles[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
