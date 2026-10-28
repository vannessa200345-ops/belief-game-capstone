/** URL for a file in `public/`, under Vite `base`. */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

/** Browser pathname including the GitHub Pages project prefix. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}
