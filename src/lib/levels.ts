/**
 * Seviye sistemi (Skool eşikleri, 1-9).
 * Seviye TOPLAM KAZANILAN puandan hesaplanır; harcamalar seviyeyi düşürmez.
 */
export const LEVEL_THRESHOLDS = [
  0, 5, 20, 65, 155, 515, 2015, 8015, 33015,
] as const;

/** Seviye 4 eşiği (kazanılan toplam): şikâyet ağırlığı ve bağsız mesaj başlatma şartı */
export const SV4_PUAN = LEVEL_THRESHOLDS[3];

export function levelFor(earnedPoints: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (earnedPoints >= LEVEL_THRESHOLDS[i]!) level = i + 1;
  }
  return level;
}

/** Bir sonraki seviyeye kalan puan; son seviyedeyse null */
export function pointsToNextLevel(earnedPoints: number): number | null {
  const level = levelFor(earnedPoints);
  if (level >= LEVEL_THRESHOLDS.length) return null;
  return LEVEL_THRESHOLDS[level]! - earnedPoints;
}
