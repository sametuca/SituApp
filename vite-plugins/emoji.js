// Vite eklentisi: src/**/*.jsx içindeki JSX çocuklarını (metin ve {ifade}) emojify()'dan geçirir.
// Böylece kodda yazılan, veriden ya da sunucudan gelen tüm emojiler Fluent 3D ikon olarak çizilir (src/components/emoji.jsx).
// Öznitelikler (title, aria-label, placeholder…) düz metin kalır.
import { parseSync } from 'rolldown/utils'
import MagicString from 'magic-string'

const QUICK = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u

/** JSX'in metin boşluğu kuralı: satırları kırp, boşları at, ' ' ile birleştir. */
function cleanJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  const last = lines.length - 1
  const out = []
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ')
    if (i !== 0) l = l.replace(/^ +/, '')
    if (i !== last) l = l.replace(/ +$/, '')
    if (l) out.push(l)
  })
  return out.join(' ')
}

export default function emojiPlugin() {
  return {
    name: 'situapp-emoji',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!/[\\/]src[\\/].*\.jsx$/.test(file) || /[\\/]components[\\/]emoji\.jsx$/.test(file)) return null
      if (!code.includes('<')) return null
      let ast
      try {
        ast = parseSync(file, code, { lang: 'jsx' })
      } catch {
        return null
      }
      const ms = new MagicString(code)
      let changed = false

      const visit = (node) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) return node.forEach(visit)
        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
          for (const ch of node.children) {
            if (ch.type === 'JSXText') {
              if (!QUICK.test(ch.value)) continue
              const text = cleanJsxText(ch.value)
              if (!text) continue
              ms.overwrite(ch.start, ch.end, `{__em(${JSON.stringify(text)})}`)
              changed = true
            } else if (ch.type === 'JSXExpressionContainer') {
              const t = ch.expression?.type
              if (!t || t === 'JSXEmptyExpression' || t === 'JSXElement' || t === 'JSXFragment' || t === 'ArrowFunctionExpression' || t === 'FunctionExpression') continue
              ms.appendLeft(ch.start + 1, '__em(')
              ms.prependRight(ch.end - 1, ')')
              changed = true
            }
          }
        }
        for (const k of Object.keys(node)) if (k !== 'parent' && k !== 'loc') visit(node[k])
      }
      visit(ast.program)
      if (!changed) return null
      ms.prepend(`import { emojify as __em } from '/src/components/emoji.jsx';\n`)
      return { code: ms.toString(), map: ms.generateMap({ hires: true, source: file }) }
    },
  }
}
