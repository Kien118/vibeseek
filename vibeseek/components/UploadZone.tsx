'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadZoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export default function UploadZone({ onFileSelect, disabled }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        onFileSelect(acceptedFiles[0])
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
  })

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <motion.div
        animate={{
          borderColor: isDragActive ? 'rgba(245,184,62,0.8)' : 'rgba(245,239,228,0.15)',
          backgroundColor: isDragActive ? 'rgba(245,184,62,0.08)' : 'rgba(34,29,23,0.6)',
          scale: isDragActive ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[200px] rounded-2xl
          border-2 border-dashed
          cursor-pointer
          transition-all group
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#F5B83E]/50 hover:bg-[#F5B83E]/5'}
        `}
      >
        {/* Glow effect when dragging */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl bg-[#F5B83E]/10 blur-xl"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center gap-3 p-8 text-center">
          {/* Icon */}
          <motion.div
            animate={{ y: isDragActive ? -8 : 0 }}
            className="text-5xl"
          >
            {isDragActive ? '🎯' : '📄'}
          </motion.div>

          <div>
            <p className="font-display font-bold text-[#F5EFE4] text-lg">
              {isDragActive ? 'Thả PDF vào đây!' : 'Drag & Drop PDF của bạn'}
            </p>
            <p className="text-[#F5EFE4]/40 text-sm mt-1 font-body">
              hoặc <span className="text-[#5B89B0] underline underline-offset-2">click để chọn file</span>
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            {['PDF', 'Max 10MB', 'Text-based'].map((badge) => (
              <span
                key={badge}
                className="text-xs font-mono px-2 py-1 rounded-md
                           bg-[#F5EFE4]/5 border border-[#F5EFE4]/10 text-[#F5EFE4]/40"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
