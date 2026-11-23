// Mobilya GLB'lerinin sınır kutusunu ölçer → src/world/furnitureDims.json
// Değerler en büyük boyut 1 olacak şekilde normalize edilmiştir (Prop.jsx ile aynı); [genişlik x, yükseklik y, derinlik z].
// Çalıştır: node scripts/measure-furniture.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'furniture')
const out = {}
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb')).sort()) {
  const buf = readFileSync(path.join(dir, f))
  const jsonLen = buf.readUInt32LE(12)
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives) {
      const a = gltf.accessors[prim.attributes.POSITION]
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], a.min[i])
        max[i] = Math.max(max[i], a.max[i])
      }
    }
  }
  const size = max.map((v, i) => v - min[i])
  const big = Math.max(...size)
  out[f.replace('.glb', '')] = size.map((v) => +(v / big).toFixed(3))
}
writeFileSync(path.join(dir, '..', '..', '..', 'src', 'world', 'furnitureDims.json'), JSON.stringify(out, null, 2) + '\n')
console.log(out)
