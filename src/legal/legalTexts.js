// Hukuki metinler: KVKK Aydınlatma Metni, Kullanım Şartları, Yurt Dışına Aktarım Açık Rızası.
//
// ÖNEMLİ: Bunlar bir TASLAKTIR (şablon). Yayına almadan önce bir avukata/KVKK danışmanına okutulmalı; veri sorumlusu bilgileri
// aşağıdaki ortam değişkenleriyle doldurulmalıdır (yoksa metinde köşeli parantezli yer tutucular görünür):
//   VITE_LEGAL_CONTROLLER  veri sorumlusunun unvanı / adı soyadı
//   VITE_LEGAL_ADDRESS     adres
//   VITE_LEGAL_EMAIL       başvuru e-postası (KEP ya da kurumsal e-posta)
// Metin değişince LEGAL_VERSION'ı artır: mevcut kullanıcılar bir sonraki girişte yeniden onay verir.

export const LEGAL_VERSION = '2026-11-v1'

const env = import.meta.env ?? {}
export const CONTROLLER = {
  name: env.VITE_LEGAL_CONTROLLER || '[Veri sorumlusu unvanı / adı soyadı]',
  address: env.VITE_LEGAL_ADDRESS || '[Veri sorumlusu adresi]',
  email: env.VITE_LEGAL_EMAIL || '[Başvuru e-posta adresi]',
}
export const LEGAL_READY = Boolean(env.VITE_LEGAL_CONTROLLER && env.VITE_LEGAL_ADDRESS && env.VITE_LEGAL_EMAIL)

const C = CONTROLLER

export const DOCS = {
  kvkk: {
    title: 'KVKK Aydınlatma Metni',
    intro: `Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (“KVKK”) 10. maddesi ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, Rastla'yı kullanırken kişisel verilerinin nasıl işlendiğini açıklamak için hazırlanmıştır.`,
    sections: [
      {
        h: '1. Veri sorumlusu',
        p: [`Veri sorumlusu: ${C.name}`, `Adres: ${C.address}`, `İletişim / başvuru: ${C.email}`],
      },
      {
        h: '2. İşlenen kişisel veriler',
        p: [
          'Kimlik ve iletişim: kullanıcı adın ve e-posta adresin.',
          'Hesap ve güvenlik: şifren (yalnızca geri döndürülemez özet olarak), oturum bilgileri, IP adresin, tarayıcı/cihaz bilgisi, giriş ve işlem kayıtları (log).',
          'Oyun içi veriler: seçtiğin karakter ve görünüm, oyun içindeki konumun (harita koordinatı; cihazının gerçek coğrafi konumu DEĞİLDİR), ilerleme, görev, rozet, altın ve envanter bilgilerin, arkadaş/engelleme listelerin.',
          'İçerik: oyunda yazdığın sohbet ve özel mesajlar, sesli mesajlar, jest/emoji tepkilerin, geri bildirimlerin ve şikâyetlerin.',
          'Görsel: yüklemeyi seçersen profil fotoğrafın (isteğe bağlıdır).',
        ],
      },
      {
        h: '3. İşleme amaçları',
        p: [
          'Hesabını oluşturmak, kimliğini doğrulamak ve oyun hizmetini sunmak.',
          'Diğer oyuncularla etkileşimini (sohbet, arkadaşlık, ev ziyareti, mini oyunlar, meslekler vb.) sağlamak ve ilerlemeni saklamak.',
          'Hesap ve oyun güvenliğini sağlamak; hile, bot, taciz ve kötüye kullanımı önlemek; şikâyetleri incelemek.',
          'Hukuki yükümlülüklerimizi yerine getirmek ve olası uyuşmazlıklarda hakkımızı korumak.',
          'Hizmeti geliştirmek ve teknik sorunları gidermek.',
        ],
      },
      {
        h: '4. Hukuki sebepler',
        p: [
          'Verilerin KVKK m. 5/2 uyarınca; (c) sözleşmenin kurulması ve ifası için gerekli olması, (ç) hukuki yükümlülüğün yerine getirilmesi, (e) bir hakkın tesisi, kullanılması veya korunması, (f) ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaatlerimiz (güvenlik, kötüye kullanımın önlenmesi) sebeplerine dayanılarak işlenir.',
          'İsteğe bağlı verilerin (ör. profil fotoğrafı) işlenmesi ve yurt dışına aktarım için ayrıca açık rızan alınır; rızanı istediğin zaman geri çekebilirsin.',
        ],
      },
      {
        h: '5. Verilerin aktarılması',
        p: [
          'Verilerin; hizmetin sunulması için barındırma, veritabanı ve kimlik doğrulama hizmeti aldığımız tedarikçilere (Supabase Inc. ve altyapı sağlayıcıları — sunucuları yurt dışında bulunabilir), e-posta gönderim hizmeti sağlayıcılarına ve mevzuatın izin verdiği hâllerde yetkili kamu kurum ve kuruluşlarına aktarılabilir.',
          'Diğer oyuncular yalnızca oyunda paylaştığın bilgileri görür (karakterin, yazdığın mesajlar, kullanıcı adın, profilini herkese/arkadaşlara açık yaptıysan fotoğrafın). E-posta adresin diğer oyunculara gösterilmez.',
          'Kişisel verilerin satılmaz ve reklam amacıyla üçüncü kişilerle paylaşılmaz.',
        ],
      },
      {
        h: '6. Toplama yöntemi',
        p: ['Verilerin; kayıt formu, oyun içi etkileşimlerin ve tarayıcı/sunucu kayıtları aracılığıyla otomatik veya kısmen otomatik yollarla elektronik ortamda toplanır.'],
      },
      {
        h: '7. Saklama süresi',
        p: [
          'Hesabın açık kaldığı sürece ve hesabını kapattıktan sonra mevzuatın öngördüğü zamanaşımı/saklama süreleri boyunca (en fazla 10 yıl) saklanır; süre sonunda silinir, yok edilir veya anonim hâle getirilir.',
          'Güvenlik günlükleri (IP, işlem kayıtları) en fazla 2 yıl tutulur.',
        ],
      },
      {
        h: '8. KVKK m. 11 kapsamındaki haklarınız',
        p: [
          'Kişisel verilerinin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK m. 7 kapsamında silinmesini veya yok edilmesini isteme; bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme; işlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhine bir sonucun ortaya çıkmasına itiraz etme; kanuna aykırı işleme nedeniyle zarara uğraman hâlinde zararın giderilmesini talep etme.',
          `Başvurularını ${C.email} adresine ya da yukarıdaki adrese yazılı olarak iletebilirsin. Başvurun, niteliğine göre en geç 30 gün içinde ücretsiz sonuçlandırılır. Ayrıca Kişisel Verileri Koruma Kurumu'na şikâyet hakkın saklıdır.`,
        ],
      },
    ],
  },

  terms: {
    title: 'Kullanım Şartları',
    intro: 'Rastla hesabı oluşturarak ve oyunu kullanarak aşağıdaki şartları kabul etmiş olursun.',
    sections: [
      {
        h: '1. Yaş sınırı',
        p: ['Rastla 18 yaş ve üzeri kullanıcılar içindir. Kayıt olarak 18 yaşını doldurduğunu beyan edersin. 18 yaşından küçük olduğu anlaşılan hesaplar kapatılabilir.'],
      },
      {
        h: '2. Hesap',
        p: ['Verdiğin bilgilerin doğru olmasından ve hesap güvenliğinden (şifren) sen sorumlusun. Hesabını başkasına devredemez, satamazsın. Her hesap yalnızca bir karakter oluşturabilir; yeni karakter yeni üyelik gerektirir.'],
      },
      {
        h: '3. Davranış kuralları',
        p: [
          'Diğer oyunculara hakaret, taciz, tehdit, nefret söylemi, cinsel içerikli veya rahatsız edici davranış yasaktır. Engelleme ve şikâyet araçlarını kullanabilirsin; bir kişinin “rahatsız etme” tercihlerine saygı göster.',
          'Başkasının kişisel bilgilerini (adres, telefon, fotoğraf vb.) izinsiz paylaşamazsın.',
          'Hile, bot, otomasyon, açık istismarı, oyun sunucusuna veya diğer kullanıcılara zarar verecek her türlü müdahale yasaktır. Tespit edilen hesaplar uyarı yapılmadan süresiz kapatılabilir.',
          'Yasa dışı, yanıltıcı veya telif hakkını ihlal eden içerik yükleyemez/paylaşamazsın.',
        ],
      },
      {
        h: '4. Sanal ürünler ve altın',
        p: ['Oyundaki altın, eşya ve ilerleme yalnızca oyun içinde geçerlidir; gerçek para değeri yoktur, nakde çevrilemez, satılamaz ve devredilemez. Hileli kazanımlar silinebilir.'],
      },
      {
        h: '5. Moderasyon',
        p: ['Şikâyetler incelenir; kuralları ihlal eden içerik kaldırılabilir, hesaplar geçici veya süresiz kısıtlanabilir.'],
      },
      {
        h: '6. Hizmetin sürekliliği ve sorumluluk',
        p: ['Hizmet “olduğu gibi” sunulur; kesintisiz veya hatasız olacağı garanti edilmez. Sürüm aşamasındaki (pre-alpha) özellikler değişebilir veya kaldırılabilir. Kullanıcılar arasındaki etkileşimlerden ve diğer kullanıcıların içeriğinden kullanıcıların kendileri sorumludur; mevzuatın izin verdiği ölçüde sorumluluğumuz sınırlıdır.'],
      },
      {
        h: '7. Kişisel veriler',
        p: ['Kişisel verilerin KVKK Aydınlatma Metni'+"'nde açıklandığı şekilde işlenir."],
      },
      {
        h: '8. Değişiklik ve iletişim',
        p: [`Şartlar güncellenebilir; önemli değişikliklerde yeniden onayın istenir. Sorular için: ${C.email}`],
      },
    ],
  },

  transfer: {
    title: 'Yurt Dışına Aktarım Açık Rızası',
    intro: 'KVKK m. 9 kapsamında ayrıca bilgilendirme ve açık rıza metnidir.',
    sections: [
      {
        h: 'Açık rıza beyanı',
        p: [
          'Hesabımın oluşturulması, kimlik doğrulamam, verilerimin barındırılması ve oyun hizmetinin sunulması için; kullanıcı adım, e-posta adresim, oyun içi verilerim, mesajlarım ve (yüklersem) profil fotoğrafımın; sunucuları yurt dışında bulunan hizmet sağlayıcılara (Supabase Inc. ve altyapı sağlayıcıları) aktarılıp orada saklanmasına ve işlenmesine, KVKK Aydınlatma Metni'+"'nde açıklandığı kapsamda, özgür irademle ve bilgilendirilmiş olarak açık rıza veriyorum.",
          'Bu rızayı istediğim zaman geri çekebileceğimi, geri çekmem hâlinde hizmetin sunulamayabileceğini ve hesabımın kapatılabileceğini biliyorum.',
        ],
      },
    ],
  },
}

/** Kayıtta/ilk girişte alınan onaylar (hepsi zorunlu: hizmet bu onaylar olmadan sunulamaz). */
export const CONSENT_ITEMS = [
  { id: 'terms', doc: 'terms', label: '18 yaşından büyüğüm; Kullanım Şartları’nı okudum ve kabul ediyorum.' },
  { id: 'kvkk', doc: 'kvkk', label: 'KVKK Aydınlatma Metni’ni okudum, kişisel verilerimin işlenmesi hakkında bilgilendirildim.' },
  { id: 'transfer', doc: 'transfer', label: 'Verilerimin yurt dışındaki hizmet sağlayıcılara aktarılmasına açık rıza veriyorum.' },
]

export const emptyConsent = () => ({ terms: false, kvkk: false, transfer: false })
export const consentComplete = (c) => CONSENT_ITEMS.every((i) => c?.[i.id] === true)
/** Kullanıcının kaydındaki onay güncel sürümle verilmiş mi? */
export const consentCurrent = (stored) => Boolean(stored && stored.version === LEGAL_VERSION && consentComplete(stored))
export const makeConsentRecord = (c) => ({ version: LEGAL_VERSION, at: new Date().toISOString(), terms: c.terms === true, kvkk: c.kvkk === true, transfer: c.transfer === true })
