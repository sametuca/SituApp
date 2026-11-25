import { useEffect, useRef, useState } from 'react'
import Prop from './Prop'
import { PlacedGift } from './Gifts'
import { GIFT_BY_ID } from './cosmeticsData'
import { FURNITURE, FURNITURE_BY_ID, FURNITURE_SETS, furnitureUrl } from './furniture'
import { Ico } from '../components/Icon'
import { clampToRoom, footprint, isValid, snap } from './homeLayout'
import { HOME_ROOM } from './layout'

const glass = 'border-2 border-white bg-white/85 shadow-soft backdrop-blur-md'

/**
 * Odanın mobilyaları. editing açıkken bir mobilyaya basıp sürükleyerek taşırsın; bırakınca geçersiz yerdeyse
 * eski yerine döner. Seçili mobilyanın altında yeşil (geçerli) ya da kırmızı (çakışıyor) bir iz görünür.
 *
 * items/setItems: ev düzeni (homeLayout.js). selected/setSelected: seçili uid.
 * controlsRef: sürüklerken kamera kontrolünü kapatmak için.
 */
export function FurnitureLayer({ items, setItems, editing, selected, setSelected, controlsRef }) {
  const drag = useRef(null) // { uid, start: {x,z}, origin: {x,z}|null }
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const endDrag = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (controlsRef.current) controlsRef.current.enabled = true
    // geçersiz yerde bıraktıysa eski yerine dön
    if (!isValid(itemsRef.current, d.uid)) {
      setItems((list) => list.map((i) => (i.uid === d.uid ? { ...i, x: d.start.x, z: d.start.z } : i)))
    }
  }
  useEffect(() => {
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!editing) drag.current = null
  }, [editing])

  const grab = (e, it) => {
    if (!editing) return
    e.stopPropagation?.()
    setSelected(it.uid)
    drag.current = { uid: it.uid, start: { x: it.x, z: it.z }, origin: null, base: { x: it.x, z: it.z } }
    if (controlsRef.current) controlsRef.current.enabled = false
  }

  // zemin düzlemi: sürükleme konumunu verir (yalnızca düzenlerken)
  const onFloorDown = (e) => {
    const d = drag.current
    if (d && !d.origin) d.origin = { x: e.point.x, z: e.point.z }
    else if (!d) setSelected(null)
  }
  const onFloorMove = (e) => {
    const d = drag.current
    if (!d) return
    if (!d.origin) d.origin = { x: e.point.x, z: e.point.z }
    const [x, z] = clampToRoom(snap(d.base.x + e.point.x - d.origin.x), snap(d.base.z + e.point.z - d.origin.z))
    setItems((list) => list.map((i) => (i.uid === d.uid ? { ...i, x, z } : i)))
  }

  return (
    <group>
      {items.map((it) => {
        const def = FURNITURE_BY_ID[it.id] ?? GIFT_BY_ID[it.id] // hediyeler ayrı katalogdan (cosmeticsData)
        if (!def) return null
        const isSel = editing && selected === it.uid
        const f = footprint(it.id)
        return (
          <group key={it.uid}>
            {isSel && (
              <mesh position={[it.x, 0.035, it.z]} rotation={[-Math.PI / 2, 0, -it.ry]}>
                <planeGeometry args={[f.w + 0.3, f.d + 0.3]} />
                <meshBasicMaterial color={isValid(items, it.uid) ? '#7be0a8' : '#fdb94e'} transparent opacity={0.55} />
              </mesh>
            )}
            <group onPointerDown={(e) => grab(e, it)}>
              {GIFT_BY_ID[it.id] ? <PlacedGift id={it.id} x={it.x} z={it.z} ry={it.ry} from={it.from} /> : <Prop model={furnitureUrl(it.id)} x={it.x} z={it.z} ry={it.ry} scale={def.size} />}
            </group>
          </group>
        )
      })}
      {editing && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onFloorDown} onPointerMove={onFloorMove}>
          <planeGeometry args={[HOME_ROOM.hw * 2 + 6, HOME_ROOM.hd * 2 + 6]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  )
}

// ---------- ekran paneli ----------
export function EditToggle({ onClick, touch }) {
  return (
    <button
      onClick={onClick}
      className={`absolute right-3 z-10 flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-extrabold text-[#4a3b5c] transition hover:bg-white ${glass} ${touch ? 'top-[5rem]' : 'top-[5rem]'}`}
    >
      <Ico name="sofa" size={26} /> Döşe
    </button>
  )
}

/**
 * Alttan açılan döşeme çekmecesi: katalog + seçili mobilya düğmeleri.
 * tabs (özellik modüllerinden): [{ key, label, render(tabApi) }]; tabApi = { furn, place } — "Dekor", "Hediyeler" gibi ek sekmeler.
 */
export function FurnitureSheet({ count, max, selected, selectedName, onAdd, onRotate, onRemove, onClose, tabs = [], tabApi }) {
  const [tab, setTab] = useState('items')
  const [set, setSet] = useState('classic') // eşya teması (Klasik / Romantik / Bahar / Retro)
  const [collapsed, setCollapsed] = useState(false)
  const shelfRef = useRef(null)
  const extra = tabs.find((t) => t.key === tab)
  const scrollShelf = (dir) => shelfRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })

  if (collapsed) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-2xl justify-center px-2 pb-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className={`pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 ${glass}`}>
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Döşeme panelini genişlet"
            className="flex items-center gap-2 text-xs font-black text-[#4a3b5c] transition hover:text-[#7a5af8] active:scale-95"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ede9fe] text-sm text-[#6d4aff]">▴</span>
            <span>Döşeme modu</span>
            <span className="text-[0.6875rem] font-bold text-[#8a7a9c]">{count}/{max}</span>
          </button>
          <button onClick={onClose} className="rounded-full bg-[#fdb252] px-3 py-1 text-xs font-extrabold text-white shadow-soft transition hover:brightness-105 active:scale-95">
            Bitti
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-2xl animate-pop px-2 pb-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className={`rounded-[1.75rem] border-2 border-white bg-white/92 p-3.5 shadow-[0_12px_32px_rgba(74,59,92,0.14)]`}>
        <div className="mb-2.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">
            {selected ? `${selectedName} seçili · sürükleyerek taşı` : 'Döşeme modu · bir eşyaya dokun'}
            <span className="ml-2 rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[0.6875rem] font-extrabold text-[#6d4aff]">
              {count}/{max}
            </span>
          </p>
          {selected && (
            <>
              <button onClick={onRotate} aria-label="Döndür" className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#e9ddff] text-base shadow-soft transition active:scale-95">
                ↻
              </button>
              <button onClick={onRemove} aria-label="Kaldır" className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#ffe4e6] text-xs font-black text-[#be123c] shadow-soft transition active:scale-95">
                Sil
              </button>
            </>
          )}
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Döşeme panelini gizle"
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#f3e8ff] text-sm font-black text-[#6d4aff] shadow-soft transition hover:bg-[#e9ddff] active:scale-95"
          >
            ▾
          </button>
          <button onClick={onClose} className="rounded-full border-b-4 border-[#e8952c] bg-[#fdb252] px-4 py-1.5 text-sm font-extrabold text-white shadow-soft active:translate-y-[2px] active:border-b-2">
            Bitti
          </button>
        </div>
        {tabs.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[{ key: 'items', label: 'Eşyalar' }, ...tabs].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full border-2 border-white px-3.5 py-1 text-xs font-extrabold transition active:scale-95 ${tab === t.key ? 'bg-[#a88bff] text-white shadow-sm' : 'bg-[#f6f0ff] text-[#4a3b5c] hover:bg-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {extra ? (
          extra.render(tabApi)
        ) : (
        <>
        <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FURNITURE_SETS.map((st) => (
            <button
              key={st.id}
              onClick={() => setSet(st.id)}
              aria-pressed={set === st.id}
              className={`shrink-0 rounded-full border-2 border-white px-3 py-1 text-[0.6875rem] font-extrabold transition active:scale-95 ${set === st.id ? 'bg-[#fdb252] text-white shadow-sm' : 'bg-[#fff6eb] text-[#4a3b5c] hover:bg-white'}`}
            >
              {st.name}
            </button>
          ))}
        </div>
        <div className="relative flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollShelf(-1)}
            aria-label="Sola kaydır"
            className="grid h-8 w-7 shrink-0 place-items-center rounded-full border border-white bg-[#f6f0ff] text-base font-black text-[#6d4aff] shadow-sm transition hover:bg-white active:scale-95"
          >
            ‹
          </button>
          <div ref={shelfRef} className="flex flex-1 gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FURNITURE.filter((f) => f.set === set).map((f) => (
              <button
                key={f.id}
                onClick={() => onAdd(f.id)}
                className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-white bg-white/90 p-1.5 shadow-sm transition hover:border-[#d8c8ff] hover:bg-white active:scale-95"
              >
                <img src={`/models/furniture/${f.id}.webp`} alt="" width="56" height="56" className="h-14 w-14 rounded-xl object-contain" loading="lazy" />
                <span className="w-full truncate text-center text-[0.6875rem] font-extrabold text-[#4a3b5c]">{f.name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollShelf(1)}
            aria-label="Sağa kaydır"
            className="grid h-8 w-7 shrink-0 place-items-center rounded-full border border-white bg-[#f6f0ff] text-base font-black text-[#6d4aff] shadow-sm transition hover:bg-white active:scale-95"
          >
            ›
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
