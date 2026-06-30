import type { ReactNode } from 'react'

interface ModalProps {
  children: ReactNode
  onClose?: () => void
}

/** Centered overlay panel. Click the backdrop to dismiss (when onClose is given). */
export function Modal({ children, onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
