import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Shared chrome for every dialog/drawer/lightbox in the app — one place that
// owns z-index, backdrop color/opacity, Escape-to-close, and click-outside,
// instead of each call site hand-rolling (and drifting on) its own. Content
// stays fully custom via children; only the positioning/backdrop/dismiss
// logic is centralized.
//
// z-index scale: Modal/Drawer sit at 100. Lightbox sits at 150 so a receipt
// preview can still open from inside an already-open ClaimDetail drawer.
// Layout.tsx's navigational overlays (mobile sidebar, search/notif
// dismiss-catchers) intentionally stay below both (40-70) — they're chrome,
// not dialogs, and should never compete with a real modal for stacking order.
//
// All three render via a portal straight to document.body. Layout.tsx wraps
// every routed page in a `position: relative; z-index: 1` div (for its own
// page-fade-in animation) — that div establishes a stacking context, so
// anything rendered as a normal descendant of it (which is where every
// call site of Modal/Drawer/Lightbox lives, since they're invoked inline
// from page components) has its z-index capped at that ancestor's priority
// of 1, no matter what z-index it declares itself. A z-50 element elsewhere
// on the page (e.g. the header's search box) then paints in front of it —
// which is exactly what caused the "app header covers the top of the modal"
// bug. Portaling to document.body escapes that ancestor entirely.

const useEscapeToClose = (onClose: () => void) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
};

// Returns focus to whatever triggered the dialog once it closes, matching
// ConfirmModal's existing accessibility behavior.
const useReturnFocusOnUnmount = () => {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    return () => previouslyFocused.current?.focus?.();
  }, []);
};

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel, e.g. 'max-w-xl', 'max-w-3xl'. Ignored when `bare`. */
  maxWidthClass?: string;
  closeOnBackdropClick?: boolean;
  ariaLabel?: string;
  /** Extra classes merged onto the panel (e.g. to drop the default rounding). Ignored when `bare`. */
  className?: string;
  /**
   * Skip Modal's own panel div (bg/rounding/shadow/role/aria) — for callers
   * whose child already owns the panel, most commonly a `motion.div` that
   * needs to be the thing framer-motion animates in/out. Modal still owns
   * backdrop, centering, z-index, Escape, and focus-return.
   */
  bare?: boolean;
}

/** Centered dialog: form modals, content viewers — the most common case. */
export const Modal: React.FC<ModalProps> = ({
  onClose, children, maxWidthClass = 'max-w-xl', closeOnBackdropClick = true, ariaLabel, className = '', bare = false,
}) => {
  useEscapeToClose(onClose);
  useReturnFocusOnUnmount();

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/40 flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={closeOnBackdropClick ? onClose : undefined} />
      {bare ? children : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className={`relative bg-white rounded-lg shadow-xl w-full ${maxWidthClass} max-h-[90vh] flex flex-col overflow-hidden ${className}`}
        >
          {children}
        </div>
      )}
    </div>,
    document.body
  );
};

interface ModalHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  /** Dark title bar for content-viewer style dialogs (e.g. MOM transcript). */
  dark?: boolean;
}

/** Optional shared header slot — title + icon + close button, consistent spacing/hover. */
export const ModalHeader: React.FC<ModalHeaderProps> = ({ title, icon, onClose, dark = false }) => (
  <div className={`p-4 flex items-center justify-between shrink-0 border-b ${dark ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-800 border-gray-100'}`}>
    <h3 className={`font-semibold text-sm tracking-wider uppercase flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-800'}`}>
      {icon}
      {title}
    </h3>
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className={`p-1 rounded-full transition-colors ${dark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
    >
      <CloseIcon />
    </button>
  </div>
);

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
  </svg>
);

interface DrawerProps {
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
}

/** Full-height side panel (e.g. ClaimDetail) — same z-index/backdrop/escape as Modal, no centering or rounding. */
export const Drawer: React.FC<DrawerProps> = ({ onClose, children, closeOnBackdropClick = false }) => {
  useEscapeToClose(onClose);
  useReturnFocusOnUnmount();

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden flex bg-slate-900/40">
      {closeOnBackdropClick && <div className="absolute inset-0" onClick={onClose} />}
      {children}
    </div>,
    document.body
  );
};

interface LightboxProps {
  onClose: () => void;
  children: React.ReactNode;
}

/** Full-screen media viewer (receipt previews). Sits above Modal/Drawer so it can open from within an already-open drawer. */
export const Lightbox: React.FC<LightboxProps> = ({ onClose, children }) => {
  useEscapeToClose(onClose);

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      {children}
    </div>,
    document.body
  );
};
