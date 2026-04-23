export function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const rx = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  return new RegExp(rx, 'i')
}

export function matchesWildcard(text: string, pattern: string): boolean {
  return wildcardToRegex(pattern).test(text)
}
