import { publicAsset } from '@/lib/base.ts'

export interface MusicTrack {
  id: string
  title: string
  artist: string
  /** Human-readable license name. */
  license: string
  licenseUrl: string
  /** Page or file the original track was taken from. */
  sourceUrl: string
  file: string
  /** What we changed for the classroom copy. CC BY requires noting adaptations. */
  edit: string
}

/**
 * Add a track by placing an audio file in `public/music/` and appending one entry.
 * Playback stays in sync because every client loads the same URL.
 * A file chosen on one device cannot be shared with the other devices.
 */
export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'meditation-impromptu',
    title: 'Meditation Impromptu 01',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2001.mp3',
    file: 'meditation-impromptu.mp3',
    edit: 'Classroom copy: mono, 64 kbps, first 2 minutes 30 seconds, short fade.',
  },
  {
    id: 'water-lily',
    title: 'Water Lily',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Water%20Lily.mp3',
    file: 'water-lily.mp3',
    edit: 'Classroom copy: mono, 64 kbps, short fade at the end.',
  },
  {
    id: 'gymnopedie',
    title: 'Gymnopedie No. 1',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Gymnopedie%20No%201.mp3',
    file: 'gymnopedie.mp3',
    edit: 'Classroom copy: mono, 64 kbps, first 2 minutes 30 seconds, short fade.',
  },
  {
    id: 'dreamy-flashback',
    title: 'Dreamy Flashback',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dreamy%20Flashback.mp3',
    file: 'dreamy-flashback.mp3',
    edit: 'Classroom copy: mono, 64 kbps, short fade at the end.',
  },
  {
    id: 'deliberate-thought',
    title: 'Deliberate Thought',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deliberate%20Thought.mp3',
    file: 'deliberate-thought.mp3',
    edit: 'Classroom copy: mono, 64 kbps, first 2 minutes 30 seconds, short fade.',
  },
  {
    id: 'healing',
    title: 'Healing',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Healing.mp3',
    file: 'healing.mp3',
    edit: 'Classroom copy: mono, 64 kbps, first 2 minutes 30 seconds, short fade.',
  },
]

export function musicSrc(track: MusicTrack): string {
  return publicAsset(`music/${track.file}`)
}

export function findTrack(id: string | null | undefined): MusicTrack | null {
  if (!id) return null
  return MUSIC_TRACKS.find((track) => track.id === id) ?? null
}
