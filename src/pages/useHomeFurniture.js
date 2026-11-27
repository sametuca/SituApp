// Kendi evimin mobilya düzeni: sunucuyla eşitleme (bağlanınca al, değişince kısa beklemeyle yolla), yerel önbellek ve Döşe modu eylemleri.
import { useEffect, useRef, useState } from 'react'
import { findFreeSpot, isValid, loadHome, newUid, saveHome } from '../world/homeLayout'

export function useHomeFurniture({ homeOwner, net, say, maxItems, editing, selected, setEditing, setSelected }) {
  const [furn, setFurn] = useState(() => loadHome(homeOwner))
  const synced = useRef(null) // sunucuyla en son eşleşen düzen (JSON); değişmediyse tekrar yollama
  // sunucudaki evim: bağlanınca (ve yeniden bağlanınca) onu al; sunucuda yoksa buradakini yükle
  const editingRef = useRef(false)
  useEffect(() => {
    editingRef.current = editing
  }, [editing])
  const sync = net.homeSync
  useEffect(() => {
    if (!sync || editingRef.current) return
    if (sync.items) {
      synced.current = JSON.stringify(sync.items)
      setFurn(sync.items)
    } else if (furn.length && net.saveHome(furn)) synced.current = JSON.stringify(furn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync?.n])
  // düzen değişince: önbelleğe yaz, kısa beklemeyle sunucuya yolla (sunucudakiyle aynıysa yollama)
  useEffect(() => {
    saveHome(homeOwner, furn)
    const json = JSON.stringify(furn)
    if (synced.current === null) synced.current = json // ilk açılış: henüz sunucuyla eşleşmedik, yollama
    if (json === synced.current) return
    const t = setTimeout(() => {
      if (net.saveHome(furn)) synced.current = json
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeOwner, furn])

  // extra: hediye yerleştirirken { uid, from } (hediyeler envanterden gelir, features/cosmetics)
  const addFurn = (id, extra) => {
    if (furn.length >= maxItems) return say(`Bu evde en fazla ${maxItems} eşya olur. Evini büyütürsen daha fazla koyabilirsin 🏡`)
    if (extra?.uid && furn.some((i) => i.uid === extra.uid)) return say('Bu hediye zaten odada.')
    const spot = findFreeSpot(furn, id)
    if (!spot) return say('Odada boş yer kalmadı 🛋️')
    const uid = extra?.uid ?? newUid()
    setFurn((l) => [...l, { uid, id, x: spot.x, z: spot.z, ry: 0, ...(extra?.from ? { from: extra.from } : {}) }])
    setSelected(uid)
  }
  const rotateFurn = () => {
    const next = furn.map((i) => (i.uid === selected ? { ...i, ry: (i.ry + Math.PI / 2) % (Math.PI * 2) } : i))
    if (!isValid(next, selected)) return say('Burada dönmeye yer yok.')
    setFurn(next)
  }
  const removeFurn = () => {
    setFurn((l) => l.filter((i) => i.uid !== selected))
    setSelected(null)
  }
  const stopEditing = () => {
    setEditing(false)
    setSelected(null)
  }

  return { furn, setFurn, addFurn, rotateFurn, removeFurn, stopEditing }
}
