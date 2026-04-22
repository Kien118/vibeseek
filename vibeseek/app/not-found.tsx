import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">🔍</div>
        <h1 className="text-2xl font-bold text-paper-cream">Không tìm thấy trang</h1>
        <p className="text-paper-cream/70 text-sm">
          Trang bạn tìm không tồn tại hoặc đã bị xóa.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Link
            href="/dashboard"
            className="px-5 py-2 rounded-full bg-gradient-to-r from-terracotta to-sunflower text-paper-cream font-semibold text-sm hover:opacity-90"
          >
            Về Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2 rounded-full border border-paper-cream/20 text-paper-cream/80 text-sm hover:bg-paper-cream/5"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  )
}
