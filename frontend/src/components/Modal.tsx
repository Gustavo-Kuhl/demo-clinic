import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  const widths = { sm: 'md:max-w-md', md: 'md:max-w-xl', lg: 'md:max-w-3xl' }

  return createPortal(
    // Mobile: items-end (slide de baixo). Desktop: items-center (centralizado)
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center md:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — bottom sheet no mobile, dialog centralizado no desktop */}
      <div
        className={`
          relative w-full ${widths[size]} bg-white shadow-2xl flex flex-col
          rounded-t-2xl md:rounded-2xl
          animate-slide-up md:animate-fade-in
          max-h-[90dvh]
        `}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Handle bar (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-display text-base md:text-lg font-semibold text-slate-900 truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
