// Buluşma daveti seçici ve gelen davet penceresi.
import { MEETUP_BY_ID, MEETUP_OPTIONS } from '../datingData'
import { Modal } from '../Hud'

export function MeetupPicker({ peer, onPick, onClose }) {
  return (
    <Modal onClose={onClose} label="Buluşma seç">
      <h2 className="text-xl font-black text-[#4a3b5c]">{peer.name} ile nereye gidelim?</h2>
      <p className="mt-1 text-xs font-semibold text-[#8a7a9c]">Bir plan seç. Kabul ederse ikiniz de aynı mekâna geçersiniz.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MEETUP_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onPick(option)}
            className="flex min-h-20 items-center gap-2 rounded-2xl border-2 border-white bg-[#faf6ff] p-2.5 text-left shadow-soft transition hover:border-[#a88bff] hover:bg-[#f3ebff] active:scale-95"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-2xl">{option.emoji}</span>
            <span className="min-w-0">
              <span className="block text-xs font-black text-[#4a3b5c]">{option.label}</span>
              <span className="mt-0.5 block truncate text-[11px] font-bold text-[#8a7a9c]">{option.place}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose} className="mt-3 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#f6f0ff]">
        Vazgeç
      </button>
    </Modal>
  )
}

export function MeetupInviteModal({ invite, onReply }) {
  const option = Object.hasOwn(MEETUP_BY_ID, invite.activity) ? MEETUP_BY_ID[invite.activity] : null
  if (!option) return null
  return (
    <Modal onClose={() => onReply(false)} label="Buluşma daveti">
      <div className="text-center">
        <span className="text-5xl" aria-hidden>{option.emoji}</span>
        <h2 className="mt-2 text-xl font-black text-[#4a3b5c]">{invite.fromName} seni davet ediyor</h2>
        <p className="mt-1 text-sm font-bold text-[#8a7a9c]">{option.label} · {option.place}</p>
        <p className="mt-2 text-xs font-semibold text-[#8a7a9c]">Kabul ederseniz ikiniz de birlikte bu mekâna geçersiniz.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onReply(false)} className="rounded-2xl bg-[#f3ecff] py-3 text-sm font-black text-[#6b4fc0]">
            Şimdi değil
          </button>
          <button type="button" onClick={() => onReply(true)} className="rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-3 text-sm font-black text-white active:translate-y-0.5 active:border-b-2">
            Kabul et
          </button>
        </div>
      </div>
    </Modal>
  )
}
