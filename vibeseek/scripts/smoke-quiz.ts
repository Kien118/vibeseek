import { generateQuizzesForCards } from '@/lib/ai/quiz'
const cards = [
  { title: 'Bubble Sort', content: 'Thuật toán sắp xếp đơn giản, so sánh từng cặp phần tử liền kề.' },
  { title: 'Quick Sort', content: 'Thuật toán chia để trị, dùng pivot để chia mảng thành 2 phần.' },
]
generateQuizzesForCards(cards).then(console.log)
