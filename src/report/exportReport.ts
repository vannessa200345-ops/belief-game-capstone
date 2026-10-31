import { formatSeconds } from '@/domain/format'
import type { SessionReport } from '@/domain/report'

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = src
    await image.decode()
    return image
  } catch {
    return null
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

export async function downloadSessionReport(report: SessionReport, format: 'png' | 'jpeg', lang: 'zh' | 'en') {
  const width = 840
  const pad = 48
  const inner = width - pad * 2
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return
  const font = '"Noto Sans TC", "PingFang TC", sans-serif'
  const blocks: { lines: string[]; size: number; gap: number; color: string }[] = []
  const push = (text: string, size: number, gap = 8, color = '#2a2430') => {
    measure.font = `${size}px ${font}`
    const lines = wrap(measure, text, inner)
    blocks.push({ lines, size, gap, color })
  }

  const zh = lang !== 'en'
  push(zh ? `${report.name} · 呢一場整理` : `${report.name} · this session`, 28, 16)
  push(
    zh
      ? `答中 ${report.correct} · 與參考方向不同 ${report.wrong} · 還沒選 ${report.missed} · 平均用了 ${formatSeconds(report.avgMs, lang)}`
      : `Matched ${report.correct} · Differed from reference ${report.wrong} · Not chosen ${report.missed} · Average time ${formatSeconds(report.avgMs, lang)}`,
    18,
    18,
    '#6b6570',
  )
  push(zh ? '時間只係分析，唔會扣分。' : 'Time is analysis only. It is not a penalty.', 16, 22, '#6b6570')

  if (report.sure.length > 0) {
    push(zh ? '最有把握（用時最短）' : 'Most sure (shortest time)', 20, 10)
    for (const card of report.sure) {
      push(zh ? `第 ${card.number} 張 · ${formatSeconds(card.ms, lang)} · ${card.text}` : `Card ${card.number} · ${formatSeconds(card.ms, lang)} · ${card.text}`, 16, 6)
    }
  }
  if (report.hesitant.length > 0) {
    push(zh ? '最猶豫（用時最長）' : 'Most hesitant (longest time)', 20, 10)
    for (const card of report.hesitant) {
      push(zh ? `第 ${card.number} 張 · ${formatSeconds(card.ms, lang)} · ${card.text}` : `Card ${card.number} · ${formatSeconds(card.ms, lang)} · ${card.text}`, 16, 6)
    }
  }

  push(zh ? '每一組用咗幾耐' : 'Time by group', 20, 12)
  for (const group of report.groups) {
    push(
      zh
        ? `${group.label} · ${group.answered} 句 · 平均用了 ${formatSeconds(group.avgMs, lang)}${group.watch ? ' · 要注意' : ''}`
        : `${group.label} · ${group.answered} lines · average ${formatSeconds(group.avgMs, lang)}${group.watch ? ' · pause here' : ''}`,
      16,
      6,
    )
  }

  if (report.watch.length > 0) {
    push(zh ? '要注意' : 'Pause here', 20, 12)
    for (const group of report.watch) push(group.suggestion, 16, 8)
  }

  push(zh ? '你較需要再停一停的地方' : 'Lines to pause on', 22, 12)
  if (!report.graded) {
    push(
      zh ? '呢一場仲未有完整對照，所以未列出答錯嘅卡。' : 'This session does not have a full check yet, so wrong cards are not listed.',
      16,
      8,
      '#6b6570',
    )
  } else if (report.wrongCards.length === 0) {
    push(zh ? '呢一場已核對嘅選擇都同參考方向相近。' : 'Every checked choice in this session was close to the reference.', 16, 8)
  }

  const images = await Promise.all(report.wrongCards.map((card) => loadImage(card.imageSrc)))
  let height = pad
  for (const block of blocks) height += block.lines.length * (block.size + 8) + block.gap
  height += report.wrongCards.length * 280 + pad

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.max(height + report.wrongCards.length * 220, 640)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#fff9f2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  let y = pad
  const paint = (text: string, size: number, gap: number, color: string) => {
    ctx.fillStyle = color
    ctx.font = `${size}px ${font}`
    ctx.textBaseline = 'top'
    for (const line of wrap(ctx, text, inner)) {
      ctx.fillText(line, pad, y)
      y += size + 8
    }
    y += gap
  }
  for (const block of blocks) {
    let first = true
    for (const line of block.lines) {
      paint(line, block.size, first ? 0 : 0, block.color)
      first = false
    }
    y += block.gap
  }

  for (const [index, card] of report.wrongCards.entries()) {
    const image = images[index]
    if (image) {
      const drawWidth = 220
      const drawHeight = Math.min(260, (image.height / image.width) * drawWidth)
      ctx.drawImage(image, pad, y, drawWidth, drawHeight)
      y += drawHeight + 12
    }
    paint(
      zh ? `第 ${card.number} 張 · ${card.text}` : `Card ${card.number} · ${card.text}`,
      18,
      4,
      '#2a2430',
    )
    paint(card.why, 15, 16, '#6b6570')
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((file) => resolve(file), format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92)
  })
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `belief-session.${format === 'jpeg' ? 'jpg' : 'png'}`
  link.click()
  URL.revokeObjectURL(url)
}
