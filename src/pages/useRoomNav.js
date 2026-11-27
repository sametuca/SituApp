// Oda gezinmesi: eve gir/çık, ziyaret, mekâna gir/çık, kanal değiştir, havalimanı başlangıç denetimi (World.jsx'ten ayrıldı).
import { useCallback, useEffect, useRef } from 'react'
import { VENUE_BY_ID } from '../world/venues'
import { START_VENUE } from './worldConfig'

export function useRoomNav({ beginTransition, home, name, net, say, setFade, setInteractId, setInvite, swapScene, swapVenue, venue, venueRef, visitPending }) {
  const goTo = useCallback(
    (target) => {
      swapScene(target)
      net.enterRoom(target === 'city' ? 'city' : { owner: target.owner })
    },
    [net, swapScene],
  )
  const visit = useCallback(
    (owner) => {
      setInvite(null)
      visitPending.current = true
      if (!net.enterRoom({ owner })) {
        visitPending.current = false
        say('Şu an çevrimdışısın, ziyaret edemezsin.')
      }
    },
    [net, say],
  )
  const enterVenue = useCallback(
    (id) => {
      if (!VENUE_BY_ID[id]) return
      net.enterRoom({ venue: id })
    },
    [net],
  )
  const switchVenueChannel = useCallback(
    (ch) => {
      if (!venue || ch === net.venueChannel) return
      beginTransition()
      setInteractId(null)
      net.enterRoom({ venue, ch })
      setTimeout(() => setFade(false), 260)
    },
    [beginTransition, venue, net],
  )
  const leaveVenue = useCallback(() => {
    swapVenue('city')
    net.enterRoom('city')
  }, [net, swapVenue])
  // sunucu hesabın yeni olup olmadığını söyler (welcome.first): havalimanı yalnızca yeni hesapta
  const airportChecked = useRef(false)
  useEffect(
    () =>
      net.on('welcome', (m) => {
        if (airportChecked.current) return
        airportChecked.current = true
        if (m.first && !venueRef.current) enterVenue(START_VENUE)
        else if (!m.first && venueRef.current === START_VENUE) leaveVenue()
      }),
    [net, enterVenue, leaveVenue],
  )
  const ownHome = useCallback(() => ({ owner: net.homeKey ?? undefined, ownerName: name, isOwn: true }), [net.homeKey, name])
  const doorGo = useCallback(() => (venue ? leaveVenue() : goTo(home ? 'city' : ownHome())), [goTo, home, ownHome, venue, leaveVenue])

  return { doorGo, enterVenue, goTo, leaveVenue, ownHome, switchVenueChannel, visit }
}
