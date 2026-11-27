// Oyuncu portresi: profil fotoğrafı varsa o, yoksa avatar portresi.
import { useState } from 'react'
import { usePhoto } from './photoStore'

/**
 * Yuvarlak portre: oyuncunun profil fotoğrafı (izin verdiyse) yoksa avatar kartı.
 * Fotoğraf yüklenemezse güvenli geri dönüş olarak avatar portresi gösterilir.
 * peer: { key, avatar } ya da doğrudan { photoKey, avatar }.
 */
export default function Portrait({ peer, size = 44, className = '', alt = '' }) {
  const photo = usePhoto(peer?.key)
  const [failed, setFailed] = useState(null) // yüklenemeyen adres
  const src = photo && failed !== photo ? photo : `/avatars/${peer?.avatar || 'zeynep'}.png`
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => photo && setFailed(photo)}
      className={`shrink-0 rounded-full border-2 border-white bg-white/60 object-cover object-top ${className}`}
    />
  )
}
