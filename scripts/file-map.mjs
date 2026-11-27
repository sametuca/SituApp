// Kaynak dosya haritası üretir: docs/FILE_MAP.md (her dosyanın ilk açıklama satırı + satır sayısı).
// Çalıştır: node scripts/file-map.mjs   (yeni dosya/açıklama ekledikten sonra yenile)
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['server', 'src', 'scripts', 'vite-plugins']
const EXT = new Set(['.js', '.jsx', '.mjs', '.cjs'])
const SKIP = new Set(['node_modules', 'data', 'dist', 'assets'])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (EXT.has(path.extname(e.name))) out.push(p)
  }
  return out
}

function summary(src) {
  const lines = src.split('\n')
  for (const raw of lines.slice(0, 12)) {
    const l = raw.trim()
    if (!l || l.startsWith('import ') || l.startsWith("'use")) continue
    if (l.startsWith('//')) {
      const t = l.replace(/^\/\/+\s*/, '').trim()
      if (t && !/^[-=─\s]+$/.test(t)) return t
      continue
    }
    if (l.startsWith('/*')) {
      const t = l.replace(/^\/\*+\s*/, '').replace(/\*\/\s*$/, '').trim()
      if (t) return t
      continue
    }
    if (l.startsWith('*')) continue
    break
  }
  return ''
}

const groups = new Map()
let missing = 0
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue
  for (const f of walk(root).sort()) {
    const src = fs.readFileSync(f, 'utf8')
    const dir = path.dirname(f)
    if (!groups.has(dir)) groups.set(dir, [])
    const s = summary(src)
    if (!s) missing++
    groups.get(dir).push({ name: path.basename(f), lines: src.split('\n').length, s })
  }
}

let md = '# Dosya haritası\n\n> `node scripts/file-map.mjs` ile otomatik üretilir; elle düzenleme. Açıklama = dosyanın başındaki ilk yorum satırı.\n> Açıklaması olmayan dosyalar `—` ile gösterilir (yeni dosya yazarken başına tek satır açıklama ekle).\n'
for (const [dir, files] of [...groups.entries()].sort()) {
  md += `\n## ${dir}/\n\n| Dosya | Satır | Ne yapar |\n|---|---:|---|\n`
  for (const f of files) md += `| \`${f.name}\` | ${f.lines} | ${(f.s || '—').replace(/\|/g, '\\|').slice(0, 170)} |\n`
}
fs.mkdirSync('docs', { recursive: true })
fs.writeFileSync('docs/FILE_MAP.md', md)
console.log(`docs/FILE_MAP.md yazıldı (${[...groups.values()].flat().length} dosya, ${missing} açıklamasız)`)
