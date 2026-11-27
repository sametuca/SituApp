// Ses efektleri (tamamen procedural). Her efekt: (ac, out, t, opt?) → nominal süre (sn). Kısa, pastel, oyuncak tınılı.
//
// Dışarıdan istenebilecek adlar (window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'ad' }))):
//   click      düğme tıklaması              open / close   panel açılış / kapanış
//   door       kapı (giriş/çıkış)           sit            oturma
//   pop        emoji tepkisi                heart, flower, kiss, wink, wave, dance   jestler
//   match      eşleşme fanfarı              msg            özel mesaj bildirimi      whisper   fısıltı
//   bell       arkadaş isteği / davet zili  mail           yeni posta
//   quest      görev tamamlandı             badge          rozet kazanıldı
//   beep       geri sayım bip               shutter        fotoğraf deklanşörü
//   move       oyun hamlesi                 win / lose     oyun sonucu
//   gift       hediye açma                  error          olumsuz / reddedildi
//   step       adım (opt.surface: city|grass|sand|wood, opt.run)  — yürürken otomatik çalar
import { bell, mallet, musicBox, noise, pick, rnd, tone, mtof } from './synth'

const N = (m) => mtof(m)

export const SFX = {
  click(ac, o, t) {
    tone(ac, o, t, { f: 880, f2: 620, a: 0.002, d: 0.05, g: 0.16 })
    return 0.08
  },
  open(ac, o, t) {
    tone(ac, o, t, { f: 520, f2: 940, a: 0.004, d: 0.11, g: 0.14 })
    tone(ac, o, t + 0.05, { f: 1320, a: 0.003, d: 0.12, g: 0.07 })
    return 0.2
  },
  close(ac, o, t) {
    tone(ac, o, t, { f: 900, f2: 480, a: 0.004, d: 0.1, g: 0.13 })
    return 0.15
  },
  door(ac, o, t) {
    noise(ac, o, t, { type: 'lowpass', f: 700, f2: 250, a: 0.004, d: 0.14, g: 0.3 })
    tone(ac, o, t, { f: 150, f2: 70, a: 0.003, d: 0.16, g: 0.28 })
    tone(ac, o, t + 0.1, { f: N(79), a: 0.003, d: 0.35, g: 0.07 })
    tone(ac, o, t + 0.17, { f: N(84), a: 0.003, d: 0.4, g: 0.06 })
    return 0.6
  },
  sit(ac, o, t) {
    noise(ac, o, t, { type: 'lowpass', f: 500, a: 0.01, d: 0.16, g: 0.28 })
    tone(ac, o, t, { f: 110, f2: 62, a: 0.005, d: 0.2, g: 0.25 })
    return 0.3
  },
  pop(ac, o, t) {
    tone(ac, o, t, { f: 420, f2: 1000, a: 0.002, d: 0.08, g: 0.2 })
    return 0.12
  },
  heart(ac, o, t) {
    bell(ac, o, t, N(79), 0.14, 0.9)
    bell(ac, o, t + 0.13, N(86), 0.12, 1.1)
    return 1.3
  },
  flower(ac, o, t) {
    ;[84, 88, 91, 96].forEach((m, i) => bell(ac, o, t + i * 0.07, N(m), 0.07, 0.8))
    return 1.1
  },
  kiss(ac, o, t) {
    tone(ac, o, t, { f: 600, f2: 1500, a: 0.004, d: 0.07, g: 0.2 })
    noise(ac, o, t + 0.07, { type: 'bandpass', f: 2500, q: 2, a: 0.001, d: 0.03, g: 0.1 })
    bell(ac, o, t + 0.1, N(88), 0.1, 0.7)
    return 0.9
  },
  wink(ac, o, t) {
    tone(ac, o, t, { f: N(91), a: 0.002, d: 0.05, g: 0.14 })
    tone(ac, o, t + 0.07, { f: N(98), a: 0.002, d: 0.12, g: 0.12 })
    return 0.25
  },
  wave(ac, o, t) {
    ;[79, 83, 86].forEach((m, i) => mallet(ac, o, t + i * 0.09, N(m), 0.15, 0.3))
    return 0.6
  },
  dance(ac, o, t) {
    ;[72, 76, 79, 76, 84].forEach((m, i) => mallet(ac, o, t + i * 0.085, N(m), 0.14, 0.3))
    return 0.75
  },
  match(ac, o, t) {
    ;[72, 76, 79, 84].forEach((m, i) => {
      bell(ac, o, t + i * 0.12, N(m), 0.11, 1.2)
      musicBox(ac, o, t + i * 0.12, N(m + 12), 0.05, 0.9)
    })
    ;[76, 79, 84, 88].forEach((m) => bell(ac, o, t + 0.55, N(m), 0.07, 1.8))
    return 2.4
  },
  msg(ac, o, t) {
    mallet(ac, o, t, N(88), 0.16, 0.3)
    mallet(ac, o, t + 0.1, N(95), 0.14, 0.4)
    return 0.55
  },
  whisper(ac, o, t) {
    noise(ac, o, t, { type: 'bandpass', f: 4500, q: 1.2, a: 0.08, d: 0.22, g: 0.1 })
    tone(ac, o, t + 0.1, { f: N(96), a: 0.01, d: 0.25, g: 0.07 })
    return 0.45
  },
  bell(ac, o, t) {
    bell(ac, o, t, N(84), 0.15, 1.2)
    bell(ac, o, t + 0.16, N(88), 0.13, 1.4)
    return 1.6
  },
  mail(ac, o, t) {
    bell(ac, o, t, N(91), 0.13, 0.8)
    bell(ac, o, t + 0.12, N(96), 0.11, 1.0)
    return 1.2
  },
  quest(ac, o, t) {
    ;[67, 72, 76, 79].forEach((m, i) => mallet(ac, o, t + i * 0.1, N(m + 12), 0.17, 0.5))
    bell(ac, o, t + 0.42, N(88), 0.12, 1.4)
    return 1.8
  },
  badge(ac, o, t) {
    ;[72, 76, 79, 83, 88].forEach((m, i) => {
      bell(ac, o, t + i * 0.11, N(m), 0.11, 1.2)
      mallet(ac, o, t + i * 0.11, N(m - 12), 0.1, 0.3)
    })
    ;[72, 79, 84, 88].forEach((m) => bell(ac, o, t + 0.7, N(m), 0.08, 2.0))
    return 2.8
  },
  beep(ac, o, t, opt) {
    tone(ac, o, t, { f: opt?.final ? 1320 : 880, a: 0.003, d: opt?.final ? 0.22 : 0.09, g: 0.18 })
    return opt?.final ? 0.3 : 0.15
  },
  shutter(ac, o, t) {
    noise(ac, o, t, { type: 'highpass', f: 3500, a: 0.001, d: 0.025, g: 0.3 })
    tone(ac, o, t, { f: 1800, f2: 900, a: 0.001, d: 0.03, g: 0.12 })
    noise(ac, o, t + 0.05, { type: 'bandpass', f: 1400, q: 1.5, a: 0.001, d: 0.05, g: 0.22 })
    tone(ac, o, t + 0.05, { f: 700, f2: 350, a: 0.001, d: 0.06, g: 0.12 })
    return 0.2
  },
  move(ac, o, t) {
    mallet(ac, o, t, N(pick([72, 74, 76])), 0.17, 0.25)
    return 0.3
  },
  win(ac, o, t) {
    ;[72, 76, 79, 84, 79, 84, 88].forEach((m, i) => mallet(ac, o, t + i * 0.1, N(m + 12), 0.15, 0.5))
    bell(ac, o, t + 0.7, N(84), 0.1, 1.6)
    return 2.0
  },
  lose(ac, o, t) {
    ;[76, 74, 71, 67].forEach((m, i) => mallet(ac, o, t + i * 0.16, N(m + 7), 0.14, 0.5))
    return 1.0
  },
  gift(ac, o, t) {
    noise(ac, o, t, { type: 'bandpass', f: 900, f2: 3000, q: 2, a: 0.01, d: 0.18, g: 0.12 })
    tone(ac, o, t + 0.14, { f: 400, f2: 1100, a: 0.004, d: 0.1, g: 0.14 })
    ;[84, 88, 91, 96].forEach((m, i) => bell(ac, o, t + 0.25 + i * 0.07, N(m), 0.09, 1.0))
    return 1.5
  },
  error(ac, o, t) {
    tone(ac, o, t, { f: 300, f2: 230, type: 'triangle', a: 0.005, d: 0.15, g: 0.16 })
    return 0.2
  },
  // boks: savurma (slash/whoosh), isabetli yumruk (punch) ve blok kalkanı (block)
  slash(ac, o, t) {
    const v = rnd(0.92, 1.1)
    noise(ac, o, t, { type: 'bandpass', f: 2400 * v, f2: 680 * v, q: 1.4, a: 0.003, d: 0.13, g: 0.26 })
    tone(ac, o, t, { f: 880 * v, f2: 240 * v, type: 'sine', a: 0.002, d: 0.11, g: 0.12 })
    return 0.18
  },
  punch(ac, o, t, opt) {
    const heavy = opt?.heavy ? 1.22 : 1
    const v = rnd(0.94, 1.08)
    noise(ac, o, t, { type: 'bandpass', f: 2600 * v, f2: 750, q: 1.3, a: 0.002, d: 0.09, g: 0.22 * heavy })
    tone(ac, o, t + 0.015, { f: 175 * v, f2: 46, type: 'triangle', a: 0.002, d: 0.16, g: 0.34 * heavy })
    noise(ac, o, t + 0.015, { type: 'lowpass', f: 950, f2: 260, a: 0.002, d: 0.11, g: 0.28 * heavy })
    if (opt?.heavy) bell(ac, o, t + 0.03, N(84), 0.08, 0.45)
    return 0.26
  },
  block(ac, o, t) {
    tone(ac, o, t, { f: 320, f2: 190, type: 'triangle', a: 0.002, d: 0.11, g: 0.22 })
    bell(ac, o, t + 0.01, N(79), 0.09, 0.38)
    return 0.24
  },
  // adım: yumuşak gürültü + alçak tok ses; zemine göre tını. Hafif perde/ses rastgeleliği.
  step(ac, o, t, opt) {
    const s = opt?.surface ?? 'city'
    const run = opt?.run ? 1.15 : 1
    const v = rnd(0.85, 1.15)
    if (s === 'grass') {
      noise(ac, o, t, { type: 'lowpass', f: 1100 * v, q: 0.5, a: 0.012, d: 0.09, g: 0.16 * run })
      tone(ac, o, t, { f: 90 * v, f2: 60, a: 0.004, d: 0.07, g: 0.1 })
    } else if (s === 'sand') {
      noise(ac, o, t, { type: 'lowpass', f: 1500 * v, q: 0.4, a: 0.02, d: 0.13, g: 0.15 * run })
      noise(ac, o, t + 0.03, { type: 'highpass', f: 3500, a: 0.01, d: 0.06, g: 0.04 })
    } else if (s === 'wood') {
      tone(ac, o, t, { f: 180 * v, f2: 110, a: 0.002, d: 0.07, g: 0.2 * run })
      noise(ac, o, t, { type: 'bandpass', f: 800 * v, q: 1.5, a: 0.001, d: 0.04, g: 0.1 })
    } else {
      noise(ac, o, t, { type: 'bandpass', f: 1800 * v, q: 0.9, a: 0.002, d: 0.045, g: 0.14 * run })
      tone(ac, o, t, { f: 120 * v, f2: 70, a: 0.002, d: 0.06, g: 0.14 })
    }
    return 0.15
  },
}

export const SFX_NAMES = Object.keys(SFX)
