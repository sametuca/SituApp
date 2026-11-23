// Özellik modülleri. Her modül (ctx) => { api?, handlers?, onJoin?, onLeave?, welcome? } döndürür:
//   handlers: { <mesaj tipi>: (me, msg) => void }   istemciden gelen mesajlar
//   onJoin(me) / onLeave(me)                        oyuncu girince / çıkınca
//   welcome(me) → nesne                             'welcome' mesajına eklenecek alanlar
//   api                                             diğer modüllerin/çekirdeğin kullanacağı işlevler
// Yeni özellik: server/features/<ad>.js yaz, buraya bir satır ekle.
import moderation from './moderation.js'
import games from './games.js'
import friends from './friends.js'
import profile from './profile.js'

export const FEATURE_FACTORIES = [moderation, games, friends, profile]
