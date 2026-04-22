export default function CanvasSkeleton() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#17140F]">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[#D96C4F]/30 blur-3xl animate-pulse" />
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-[#D96C4F] to-[#F5B83E] opacity-80 animate-pulse flex items-center justify-center">
          <span className="text-[#F5EFE4] text-4xl font-bold">V</span>
        </div>
        <p className="absolute top-full mt-8 left-1/2 -translate-x-1/2 text-[#F5EFE4]/60 text-sm font-medium whitespace-nowrap">
          Đang tải DOJO...
        </p>
      </div>
    </div>
  )
}
