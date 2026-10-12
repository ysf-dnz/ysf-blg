/** İç rotalar — tek kaynak. String-literal href dağınıklığını önler. */
export const R = {
  home: "/",
  kutuphane: "/kutuphane",
  kitap: (id: string) => `/kutuphane/kitap/${id}`,
  quiz: (bookId: string) => `/kitap/${bookId}/quiz`,
  topluluk: "/topluluk",
  yazi: (slug: string) => `/topluluk/${slug}`,
  profil: (handle: string) => `/u/${handle}`,
  gundem: "/gundem",
  kampanya: (id: number) => `/kampanya/${id}`,
  kulupler: "/kulupler",
  kulup: (slug: string) => `/kulup/${slug}`,
  kulupKur: "/kulup-kur",
  kurslar: "/kurslar",
  kurs: (slug: string) => `/kurslar/${slug}`,
  lider: "/lider",
  etkinlikler: "/etkinlikler",
  etkinlik: (slug: string) => `/etkinlik/${slug}`,
  etkinlikGiris: (slug: string) => `/etkinlik/${slug}/giris`,
  etkinlikEkran: (slug: string) => `/etkinlik/${slug}/ekran`,
  etkinlikTakvim: (slug: string) => `/etkinlik/${slug}/takvim.ics`,
  etkinlikCsv: (slug: string) => `/etkinlik/${slug}/katilimcilar.csv`,
  uyeler: "/uyeler",
  harita: "/harita",
  aramizaKatil: "/aramiza-katil",
  uye: {
    panel: "/uye",
    hosgeldin: "/uye/hosgeldin",
    /** Yönlendirmeli yazı akışı: kitap paramıyla editör o kitaba kurulur */
    yaz: (kitapId?: string) =>
      kitapId ? `/uye/yaz?kitap=${encodeURIComponent(kitapId)}` : "/uye/yaz",
    profil: "/uye/profil",
    admin: "/uye/admin",
    quizOlustur: "/uye/quiz-olustur",
    egitimOlustur: "/uye/egitim-olustur",
    biletler: "/uye/biletler",
    mesajlar: "/uye/mesajlar",
    /** Birebir konuşma; handle [a-z0-9-] */
    mesaj: (handle: string) => `/uye/mesajlar/${handle}`,
  },
} as const;

/** Hediye kitabın Drive'da doğrudan açılış linki */
export const driveViewUrl = (fileId: string) =>
  `https://drive.google.com/file/d/${fileId}/view`;
