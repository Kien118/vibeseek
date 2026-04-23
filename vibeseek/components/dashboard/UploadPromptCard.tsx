interface Props {
  onUpload: () => void
}

export default function UploadPromptCard({ onUpload }: Props) {
  return (
    <div
      className="glass rounded-3xl border border-terracotta/25 p-6 sm:p-7 flex items-center gap-5 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 60% 80% at 90% 50%, rgba(217,108,79,0.09) 0%, transparent 70%)',
      }}
    >
      {/* Icon box */}
      <div className="w-[60px] h-[60px] rounded-2xl bg-terracotta/15 border border-dashed border-terracotta/50 grid place-items-center text-terracotta-soft text-2xl shrink-0">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>

      {/* Middle text */}
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold text-paper-cream text-lg">Có tài liệu mới cần học?</h3>
        <p className="text-paper-cream/65 text-sm leading-relaxed mt-1">
          Kéo thả PDF vào đây — DOJO sẽ tạo Vibe Cards, Quiz và storyboard video trong ~45 giây.
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onUpload}
        className="btn-polish-terra shrink-0 bg-gradient-to-br from-terracotta to-[#B5573D] text-paper-cream font-display font-bold px-5 py-3 rounded-xl"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,200,180,0.35), 0 2px 10px rgba(217,108,79,0.25)',
        }}
      >
        Upload PDF
      </button>
    </div>
  )
}
