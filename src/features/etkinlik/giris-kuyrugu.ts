/**
 * Görevli tarayıcısının saf mantığı (birim testli): QR metninden bilet token'ı ayıklama,
 * art arda aynı kareyi tekrar göndermeme ve çevrimdışı kuyruk. DOM/kamera/ağ giris.astro'da.
 * Sunucu idempotent olduğu için (ADR K1.4) kuyruk "en az bir kez" gönderir; çift gönderim
 * "zaten geldi" döner, yeni puan üretmez (AC-18).
 */
export type KuyrukOgesi = { token: string; at: number };

/** QR içeriği (HTTPS://HOST/T/{TOKEN}, /t/q/{token}) ya da çıplak token → büyük harf token */
export function tokenAyikla(metin: string): string | null {
  const m = metin.trim().match(/(?:^|\/)(\d{1,9}\.[0-9A-Za-z]{16})(?:[/?#]|$)/);
  return m ? m[1]!.toUpperCase() : null;
}

/** Kamera aynı QR'ı saniyede birçok kez görür: aynı token `araMs` içinde yeniden işlenmez */
export function yeniOkumaMi(son: Map<string, number>, token: string, simdi: number, araMs = 4000): boolean {
  const onceki = son.get(token);
  if (onceki !== undefined && simdi - onceki < araMs) return false;
  son.set(token, simdi);
  return true;
}

export function kuyrukOku(ham: string | null | undefined): KuyrukOgesi[] {
  try {
    const d: unknown = JSON.parse(ham ?? "[]");
    return Array.isArray(d)
      ? d.filter((o): o is KuyrukOgesi => typeof o?.token === "string" && typeof o?.at === "number")
      : [];
  } catch {
    return [];
  }
}

/** Aynı bilet kuyruğa bir kez girer (bağlantı yokken iki kez okutulsa da tek istek) */
export function kuyrugaEkle(kuyruk: KuyrukOgesi[], token: string, at: number): KuyrukOgesi[] {
  return kuyruk.some((o) => o.token === token) ? kuyruk : [...kuyruk, { token, at }];
}

export function kuyruktanCikar(kuyruk: KuyrukOgesi[], token: string): KuyrukOgesi[] {
  return kuyruk.filter((o) => o.token !== token);
}
