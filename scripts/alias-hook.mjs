import { pathToFileURL } from 'node:url'

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: 'json' },
    })
  }
  return nextLoad(url, context)
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(new URL(`../src/${specifier.slice(2)}`, import.meta.url).href, context)
  }
  if (specifier.startsWith('.') && specifier.endsWith('.ts')) {
    return nextResolve(new URL(specifier, context.parentURL ?? pathToFileURL('./')).href, context)
  }
  return nextResolve(specifier, context)
}
