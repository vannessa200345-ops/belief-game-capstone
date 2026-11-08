import { useLang } from '@/i18n/lang'

const INSTAGRAM = 'https://www.instagram.com/andykwokx144/'
const THREADS = 'https://www.threads.net/@andykwokx144'

export function AndyPublicFacts() {
  const { tx } = useLang()
  const facts = [
    tx('美國官方認證希塔療癒師', 'Officially certified Theta Healing practitioner, United States'),
    tx('美國記憶學院（喚醒明亮之心工作坊學員）', 'Memory Academy, United States (student of the Awakening the Bright Heart workshop)'),
    tx('瑪雅圖騰 PSI：260 宇宙的黃太陽', 'Mayan totem PSI: 260, Yellow Sun of the cosmos'),
    tx('144000 星際種子之一（昴宿星）', 'One of the 144000 starseeds (Pleiades)'),
  ]

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink">
        {tx('身心靈諮詢｜希塔療癒 光語療癒', 'Mind-body-spirit consultation | Theta Healing and light-language healing')}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={INSTAGRAM} className="text-ink underline decoration-line underline-offset-4" target="_blank" rel="noopener noreferrer">
          Instagram @andykwokx144
        </a>
        <a href={THREADS} className="text-ink underline decoration-line underline-offset-4" target="_blank" rel="noopener noreferrer">
          Threads @andykwokx144
        </a>
      </p>
    </div>
  )
}
