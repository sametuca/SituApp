// DJ'in çalacağı bağlantıların ortak (istemci + sunucu) ayrıştırıcısı. Yalnızca YouTube ve Spotify kabul edilir;
// ham bağlantı hiçbir yerde saklanmaz/yayılmaz, yalnızca doğrulanmış { p, kind, id } gider.
//   p: 'yt' | 'sp'   kind: 'video' | 'playlist' (yt)  ya da  track | album | playlist | episode | show | artist (sp)
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com'])
const SP_KINDS = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist'])
const YT_VIDEO = /^[A-Za-z0-9_-]{11}$/
const YT_LIST = /^[A-Za-z0-9_-]{10,64}$/
const SP_ID = /^[A-Za-z0-9]{22}$/

export function parseTrack(input) {
  const raw = String(input ?? '').trim().slice(0, 300)
  if (!raw) return null
  const uri = /^spotify:([a-z]+):([A-Za-z0-9]{22})$/.exec(raw)
  if (uri) return SP_KINDS.has(uri[1]) ? { p: 'sp', kind: uri[1], id: uri[2] } : null
  let u
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase()
  const parts = u.pathname.split('/').filter(Boolean)
  if (host === 'open.spotify.com') {
    if (parts[0]?.startsWith('intl-')) parts.shift()
    if (parts[0] === 'embed') parts.shift()
    const [kind, id] = parts
    return SP_KINDS.has(kind) && SP_ID.test(id ?? '') ? { p: 'sp', kind, id } : null
  }
  if (YT_HOSTS.has(host)) {
    let id = null
    if (host === 'youtu.be') id = parts[0]
    else if (parts[0] === 'watch') id = u.searchParams.get('v')
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1]
    if (YT_VIDEO.test(id ?? '')) return { p: 'yt', kind: 'video', id }
    const list = u.searchParams.get('list')
    if (YT_LIST.test(list ?? '')) return { p: 'yt', kind: 'playlist', id: list }
  }
  return null
}

/** Sunucudan gelen parçanın biçimini bir kez daha doğrular (istemci tarafı güvenlik kemeri). */
export function isTrack(t) {
  if (!t || typeof t !== 'object') return false
  if (t.p === 'yt') return (t.kind === 'video' && YT_VIDEO.test(t.id ?? '')) || (t.kind === 'playlist' && YT_LIST.test(t.id ?? ''))
  if (t.p === 'sp') return SP_KINDS.has(t.kind) && SP_ID.test(t.id ?? '')
  return false
}

export const trackLabel = (t) => (t?.p === 'yt' ? '🎬 YouTube' : t?.p === 'sp' ? '🎵 Spotify' : '')
