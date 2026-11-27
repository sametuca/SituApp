// Dünya sayfası tam ekran katmanları: bağlantı/oturum uyarıları ve sahne geçişi karartması (World.jsx'ten ayrıldı).

/** Güvenlik doğrulanamadı / hesap başka yerde açıldı / oturum / yasak ekranları. */
export function ConnectionOverlays({ status, signOut }) {
  return (
    <>
      {(status === 'noguard') && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-white px-5" role="alertdialog">
          <div className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white p-6 text-center shadow-toy">
            <div className="text-5xl">🛡️</div>
            <h2 className="mt-2 text-xl font-black text-ink">Güvenlik doğrulanamadı</h2>
            <p className="mt-1 text-sm font-semibold text-ink-soft">Sunucunun hile koruması doğrulanamadığı için oyun yüklenmedi. Biraz sonra tekrar dene.</p>
          </div>
        </div>
      )}

      {(status === 'kicked' || status === 'auth' || status === 'banned') && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-white/70 px-5 backdrop-blur-sm" role="alertdialog">
          <div className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white p-6 text-center shadow-toy">
            <div className="text-5xl">{status === 'kicked' ? '🔌' : status === 'banned' ? '⛔' : '🔑'}</div>
            <h2 className="mt-2 text-xl font-black text-ink">{status === 'kicked' ? 'Hesabın başka yerde açıldı' : status === 'banned' ? 'Hesabın yasaklandı' : 'Oturumun geçersiz'}</h2>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {status === 'kicked' ? 'Aynı hesapla yalnızca tek yerden oynanabilir. Burada devam etmek için sayfayı yenile.' : status === 'banned' ? 'Oyunun kurallarına aykırı davranış (hile/otomasyon) algılandı. İtirazın için geri bildirim gönderebilirsin.' : 'Devam etmek için yeniden giriş yapmalısın.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {status === 'kicked' && (
                <button type="button" onClick={() => location.reload()} className="rounded-2xl bg-candy-pink px-4 py-2 text-sm font-extrabold text-ink shadow-soft">
                  Yeniden bağlan
                </button>
              )}
              <button type="button" onClick={() => signOut()} className="rounded-2xl bg-candy-lilac/60 px-4 py-2 text-sm font-extrabold text-ink shadow-soft">
                Çıkış yap
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Şehir/ev/mekân geçişinde kısa karartma + yükleme cümlesi. */
export function TransitionOverlay({ fade, line }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border-2 border-white bg-white/85 px-7 py-5 shadow-[0_14px_36px_rgba(104,79,145,0.16)] backdrop-blur-md">
        <div className="h-9 w-9 animate-spin rounded-full border-[3.5px] border-[#efe6ff] border-r-[#ff9ec7] border-t-[#a88bff]" />
        <p className="text-sm font-black tracking-wide text-[#5b4678]">{line}</p>
      </div>
    </div>
  )
}
