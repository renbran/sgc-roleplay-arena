export function buildSgcEmail(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]
  const last = parts[parts.length - 1]
  const initial = first[0].toLowerCase().replace(/[^a-z]/g, "")
  const lastName = last.toLowerCase().replace(/[^a-z]/g, "")
  return `${initial}.${lastName}@sgctech.ai`
}
// "Renbran Madelo"    → "r.madelo@sgctech.ai"
// "John Van Der Berg" → "j.berg@sgctech.ai"
// "Renbran"           → "r.renbran@sgctech.ai"
