declare const process: { argv: string[] } | undefined

export function isSameLocalDay(value: Date, reference = new Date()) {
  return value.getFullYear() === reference.getFullYear()
    && value.getMonth() === reference.getMonth()
    && value.getDate() === reference.getDate()
}

if (typeof process !== 'undefined' && import.meta.url.endsWith(process.argv[1]?.replaceAll('\\', '/') ?? '')) {
  const reference = new Date(2026, 7, 18, 12)
  if (!isSameLocalDay(new Date(2026, 7, 18, 0), reference)) throw new Error('Same-day check failed')
  if (isSameLocalDay(new Date(2026, 7, 17, 23, 59), reference)) throw new Error('Previous-day check failed')
  console.log('Date checks passed')
}
