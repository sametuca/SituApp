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
import venues from './venues.js'
import collect from './collect.js'
import economy from './economy.js'
import dj from './dj.js'
import housing from './housing.js'
import rental from './rental.js'
import pets from './pets.js'
import beach from './beach.js'
import jobs from './jobs.js'
import surf from './surf.js'
import minigames from './minigames.js'
import fitness from './fitness.js'
import inventory from './inventory.js'
import dating from './dating.js'
import duo from './duo.js'
import away from './away.js'

export const FEATURE_FACTORIES = [moderation, games, friends, profile, progress, media, together, cosmetics, npcs, venues, collect, economy, dj, housing, rental, pets, beach, jobs, surf, minigames, fitness, inventory, dating, duo, away]
