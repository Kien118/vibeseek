'use client'

import { Trophy, Medal } from 'lucide-react'

export interface LeaderboardRow {
  rank: number
  anonId: string
  displayName: string
  totalPoints: number
  quizCorrectCount: number
}

interface Props {
  rows: LeaderboardRow[]
  highlightAnonId?: string | null
}

export default function LeaderboardTable({ rows, highlightAnonId }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-white/60 font-mono uppercase">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">{"Ng\u01b0\u1eddi ch\u01a1i"}</th>
            <th className="px-4 py-3 text-right">{"\u0110i\u1ec3m"}</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell">{"\u0110\u00fang"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="text-center py-10 text-white/40">{`Ch\u01b0a c\u00f3 ai ghi \u0111i\u1ec3m. L\u00e0m quiz \u0111\u1ea7u ti\u00ean \u0111i!`}</td></tr>
          )}
          {rows.map((row) => {
            const isMe = highlightAnonId && row.anonId === highlightAnonId
            return (
              <tr
                key={row.anonId}
                className={`border-t border-white/5 ${isMe ? 'bg-indigo-500/10' : ''}`}
              >
                <td className="px-4 py-3 font-mono">
                  {row.rank === 1 ? <Trophy className="w-4 h-4 text-yellow-400 inline" /> :
                   row.rank <= 3 ? <Medal className="w-4 h-4 text-white/70 inline" /> : row.rank}
                </td>
                <td className="px-4 py-3 text-white/90">{row.displayName}{isMe ? ' (b\u1ea1n)' : ''}</td>
                <td className="px-4 py-3 text-right font-bold text-yellow-300">{row.totalPoints}</td>
                <td className="px-4 py-3 text-right text-white/60 hidden sm:table-cell">{row.quizCorrectCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
