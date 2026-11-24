// Özellik modülleri. Her modül (ctx) => { api?, handlers?, onJoin?, onLeave?, welcome? } döndürür:
//   handlers: { <mesaj tipi>: (me, msg) => void }   istemciden gelen mesajlar
//   onJoin(me) / onLeave(me)                        oyuncu girince / çıkınca
//   welcome(me) → nesne                             'welcome' mesajına eklenecek alanlar
//   api                                             diğer modüllerin/çekirdeğin kullanacağı işlevler
// Yeni özellik: server/features/<ad>.js yaz, buraya bir satır ekle.
import moderation from './moderation.js'
import cosmetics from './cosmetics.js'
import games from './games.js'
import friends from './friends.js'
import profile from './profile.js'
import progress from './progress.js'
import media from './media.js'
import together from './together.js'
import npcs from './npcs.js'
import weather from './weather.js'
import venues from './venues.js'
import collect from './collect.js'
import neighborhood from './neighborhood.js'

export const FEATURE_FACTORIES = [moderation, games, friends, profile, progress, media, together, cosmetics, npcs, weather, venues, collect, neighborhood]
