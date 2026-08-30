/**
 * Hareket yardımcıları — apple-design skill'inin ortak temelleri.
 * - prefersReducedMotion: canlı sorgu (modül sabiti bayatlar)
 * - safeAnimate: reduced'da animasyonu atlayıp son kareyi uygular
 * - rubberband / project: Designing Fluid Interfaces formülleri
 * - closePop: panelleri girişleriyle simetrik kapatır (scale-out + fade)
 */

export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** WAAPI sarmalayıcı: hareket azaltılmışsa son kare anında uygulanır. */
export function safeAnimate(
  el: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | undefined {
  if (prefersReducedMotion()) {
    const last = keyframes[keyframes.length - 1];
    if (last && (options.fill === "forwards" || options.fill === "both")) {
      for (const [k, v] of Object.entries(last)) {
        if (k === "offset" || k === "easing" || k === "composite") continue;
        (el.style as unknown as Record<string, string>)[k] = String(v);
      }
    }
    return undefined;
  }
  return el.animate(keyframes, options);
}

/** Sınır ötesi sürüklemede ilerleyen direnç (yumuşak sınır). */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Bırakış hızından varış noktası öngörüsü (üstel yavaşlama). */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Girişte pop'la açılan paneli aynı yoldan kapatır: mevcut transform-origin'e
 * doğru küçülüp söner, bitince done() çağrılır (done içinde hidden/open ayarlanır).
 */
export function closePop(el: HTMLElement, done: () => void): void {
  const anim = safeAnimate(
    el,
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.92)" },
    ],
    { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
  if (!anim) return done();
  anim.addEventListener("finish", done, { once: true });
  anim.addEventListener("cancel", done, { once: true });
}
