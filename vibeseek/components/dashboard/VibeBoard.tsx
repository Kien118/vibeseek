import Link from 'next/link'

interface RecentCard {
  id: string
  documentId: string
  cardType: 'concept' | 'quote' | 'tip' | 'fact' | 'summary'
  title: string
  content: string
  emoji: string
  tags: string[]
  vibePoints: number
}

interface Props {
  cards: RecentCard[]
}

const CARD_TYPE_STYLES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  concept: {
    border: 'border-terracotta/28',
    bg: 'bg-[linear-gradient(160deg,rgba(217,108,79,0.08),transparent_70%)]',
    badge: 'bg-terracotta/15 text-terracotta-soft border border-terracotta/25',
    text: 'text-terracotta-soft',
  },
  fact: {
    border: 'border-lapis/28',
    bg: 'bg-[linear-gradient(160deg,rgba(91,137,176,0.08),transparent_70%)]',
    badge: 'bg-lapis/15 text-lapis-soft border border-lapis/25',
    text: 'text-lapis-soft',
  },
  tip: {
    border: 'border-sage/28',
    bg: 'bg-[linear-gradient(160deg,rgba(122,155,126,0.08),transparent_70%)]',
    badge: 'bg-sage/15 text-sage-bright border border-sage/25',
    text: 'text-sage-bright',
  },
  quote: {
    border: 'border-sunflower/28',
    bg: 'bg-[linear-gradient(160deg,rgba(245,184,62,0.08),transparent_70%)]',
    badge: 'bg-sunflower/15 text-sunflower border border-sunflower/25',
    text: 'text-sunflower',
  },
  summary: {
    border: 'border-sunflower/28',
    bg: 'bg-[linear-gradient(160deg,rgba(245,184,62,0.08),transparent_70%)]',
    badge: 'bg-sunflower/15 text-sunflower border border-sunflower/25',
    text: 'text-sunflower',
  },
}

const HOVER_SHADOW: Record<string, string> = {
  concept: 'hover:shadow-[0_0_28px_rgba(217,108,79,0.2)]',
  fact:    'hover:shadow-[0_0_28px_rgba(91,137,176,0.2)]',
  tip:     'hover:shadow-[0_0_28px_rgba(122,155,126,0.2)]',
  quote:   'hover:shadow-[0_0_28px_rgba(245,184,62,0.2)]',
  summary: 'hover:shadow-[0_0_28px_rgba(245,184,62,0.2)]',
}

const TYPE_LABEL: Record<string, string> = {
  concept: 'Concept',
  fact: 'Fact',
  tip: 'Tip',
  quote: 'Quote',
  summary: 'Summary',
}

export default function VibeBoard({ cards }: Props) {
  const headingLink = cards.length > 0 ? `/chat/${cards[0].documentId}` : '#'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-bold text-paper-cream text-lg">Hôm nay cho bạn · {cards.length} thẻ mới</h2>
          <p className="text-stone text-xs font-mono mt-0.5">Những vibe cards DOJO nhặt ra từ tài liệu của bạn</p>
        </div>
        <Link href={headingLink} className="text-xs text-sunflower font-mono hover:underline">Xem tất cả →</Link>
      </div>

      {cards.length === 0 ? (
        <div className="glass rounded-2xl border border-paper-cream/10 p-6 text-center text-stone text-sm">
          Chưa có thẻ nào. Upload PDF để DOJO tạo Vibe Cards.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {cards.map((card) => {
            const style = CARD_TYPE_STYLES[card.cardType] ?? CARD_TYPE_STYLES.summary
            const hoverShadow = HOVER_SHADOW[card.cardType] ?? HOVER_SHADOW.summary
            const visibleTags = card.tags.slice(0, 2)
            const isQuote = card.cardType === 'quote'

            return (
              <div
                key={card.id}
                className={`relative p-4 rounded-2xl border bg-ink-surface/55 overflow-hidden transition-transform duration-200 hover:-translate-y-1 ${style.border} ${style.bg} ${hoverShadow}`}
              >
                {/* Head row */}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{card.emoji}</span>
                  <span className={`text-[10.5px] font-mono font-bold tracking-wider uppercase px-2 py-1 rounded-md ${style.badge}`}>
                    {TYPE_LABEL[card.cardType] ?? card.cardType}
                  </span>
                  <span className="ml-auto font-mono font-bold text-[11px] text-sunflower">⚡ +{card.vibePoints}</span>
                </div>

                {/* Title */}
                <h3 className="font-display font-bold text-base mt-2 mb-1.5 leading-tight tracking-tight text-paper-cream">
                  {card.title}
                </h3>

                {/* Body */}
                <p className="text-[13px] text-paper-cream/72 leading-relaxed line-clamp-3">
                  {card.content}
                </p>

                {/* Foot */}
                <div className="flex justify-between items-center mt-3.5 pt-3 border-t border-paper-cream/6">
                  <div className="flex gap-1.5 flex-wrap">
                    {visibleTags.map((tag) => (
                      <span key={tag} className="text-[10.5px] px-2 py-0.5 rounded-full bg-paper-cream/6 text-paper-cream/55 font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  {isQuote ? (
                    <Link
                      href={`/chat/${card.documentId}`}
                      className="font-mono text-[10.5px] font-bold tracking-wider px-2 py-1 rounded-md border border-paper-cream/10 hover:text-sunflower hover:border-sunflower/40 transition text-paper-cream/70"
                    >
                      DẠY LẠI →
                    </Link>
                  ) : (
                    <Link
                      href={`/quiz/${card.documentId}`}
                      className="font-mono text-[10.5px] font-bold tracking-wider px-2 py-1 rounded-md border border-paper-cream/10 hover:text-sunflower hover:border-sunflower/40 transition text-paper-cream/70"
                    >
                      QUIZ ME →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
