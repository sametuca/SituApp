// Şehir ↔ ev/mekân sahne geçişleri (karartma, ışınlama, kamera) ve sunucunun 'room' yanıtına tepki (World.jsx'ten ayrıldı).
import { useCallback, useRef } from 'react'
import { VENUE_ROOM } from '../world/venues'
import { venueDoor } from '../world/venueDoors'
import { BEACH_START, HOME_DOOR, HOME_ROOM, SPAWN } from '../world/layout'
import { START_VENUE } from './worldConfig'

export function useSceneSwap({ beginTransition, controlsRef, focusRef, moveTargetRef, seenKey, setEditing, setFade, setHome, setInteractId, setIntroActive, setNearDoor, setNearVenue, setPanel, setSelected, setVenue, venueRef }) {
  // Şehir ↔ ev geçişi: ekran kısa süre kararır, sonra oyuncu yeni yere ışınlanır.
  const swapScene = useCallback((target) => {
    moveTargetRef.current = null
    beginTransition()
    setEditing(false)
    setSelected(null)
    setTimeout(() => {
      setNearDoor(false)
      setVenue(null)
      venueRef.current = null
      if (target === 'city') {
        setHome(null)
        // Konut Mahallesi kapısından girildiyse o kapının önüne, aksi halde lobideki Evim kapısına dön
        focusRef.current.teleport = [HOME_DOOR.x, HOME_DOOR.z, 0] // evden çıkınca sahile dönük Evim kapısına dön
      } else {
        setHome(target)
        if (target?.isOwn && !target?.withGuest) setEditing(true)
        focusRef.current.teleport = [HOME_ROOM.spawn[0], HOME_ROOM.spawn[1], Math.PI]
      }
      setTimeout(() => setFade(false), 120)
    }, 220)
  }, [beginTransition])

  // Şehir ↔ mekân geçişi (ev geçişinin paralelidir). Girerken kamera güneye sıfırlanır (oyuncak evi kesiti).
  const swapVenue = useCallback((target, serverSpawn = null) => {
    moveTargetRef.current = null
    const from = venueRef.current
    beginTransition()
    setEditing(false)
    setSelected(null)
    setTimeout(() => {
      setNearDoor(false)
      setNearVenue(null)
      if (target === 'city') {
        venueRef.current = null
        setVenue(null)
        if (from === START_VENUE) {
          try {
            localStorage.setItem(seenKey, '1')
          } catch {
            /* önemli değil */
          }
          setIntroActive(true)
        }
        const d = from && venueDoor(from)
        focusRef.current.teleport = d ? d.exit : from === START_VENUE ? [BEACH_START.x, BEACH_START.z, BEACH_START.ry] : [SPAWN.x, SPAWN.z, Math.PI] // havalimanından çıkış: kumsal
      } else {
        venueRef.current = target
        setHome(null)
        setVenue(target)
        const spawn =
          Array.isArray(serverSpawn) && serverSpawn.length === 2 && serverSpawn.every(Number.isFinite)
            ? serverSpawn
            : VENUE_ROOM.spawn
        const [sx, sz] = spawn
        focusRef.current.teleport = [sx, sz, Math.PI]
        setTimeout(() => {
          const c = controlsRef.current
          if (!c) return
          c.object.position.set(sx, 6.4, sz + 9.4)
          c.target.set(sx, 0.8, sz)
          c.update()
        }, 60)
      }
      setTimeout(() => setFade(false), 160)
    }, 220)
  }, [beginTransition, seenKey])

  // Başkasının evine girerken sahne, sunucu izin verince ('room' mesajı) değişir; reddedilirse olduğun yerde kalırsın.
  // Mekân girişinde/salon değişiminde sunucunun verdiği dağılımlı kapı konumu uygulanır (üst üste binmeyi önler).
  const visitPending = useRef(false)
  const onRoom = useCallback(
    (m) => {
      if (m.venue && Array.isArray(m.spawn) && m.spawn.length === 2) {
        if (venueRef.current !== m.venue) {
          swapVenue(m.venue, m.spawn)
        } else {
          const [sx, sz] = m.spawn
          focusRef.current.teleport = [sx, sz, Math.PI]
          setTimeout(() => {
            const c = controlsRef.current
            if (!c) return
            c.object.position.set(sx, 6.4, sz + 9.4)
            c.target.set(sx, 0.8, sz)
            c.update()
          }, 60)
        }
      }
      if (m.autoJoin && m.owner) {
        visitPending.current = false
        setInteractId?.(null)
        setPanel?.(null)
        swapScene({ owner: m.owner, ownerName: m.ownerName, isOwn: true, withGuest: true })
        return
      }
      if (!visitPending.current || !m.owner) return
      visitPending.current = false
      swapScene({ owner: m.owner, ownerName: m.ownerName })
    },
    [setInteractId, setPanel, swapScene, swapVenue],
  )

  return { onRoom, swapScene, swapVenue, visitPending }
}
