/**
 * Story viewer island — framework'süz, tek dosya.
 * <dialog> tabanlı tam ekran viewer: CSS animasyonlu progress bar,
 * tık/tuş ile gezinme, basılı tutunca durdurma, son slide'da CTA.
 * Jest paketi (apple-design): 1:1 dikey sürükleme ile kapatma
 * (rubber-band + velocity projection + spring handoff), yatay swipe ile
 * slide geçişi, girişle simetrik açılış/kapanış animasyonu.
 * Görülenler localStorage'da tutulur; süresi geçen kayıtlar temizlenir.
 */

import { animate } from "motion";
import { prefersReducedMotion, project, rubberband } from "@/features/motion/waapi.ts";

interface Slide {
  image?: string;
  title?: string;
  text?: string;
  durationMs: number;
  cta?: { label: string; url: string };
}

const SEEN_KEY = "ysf:stories:seen";
const SEEN_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 gün

function readSeen(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    const now = Date.now();
    const fresh = Object.fromEntries(
      Object.entries(raw as Record<string, number>).filter(
        ([, ts]) => now - ts < SEEN_TTL_MS,
      ),
    );
    localStorage.setItem(SEEN_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  try {
    const seen = readSeen();
    seen[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode */
  }
  document
    .querySelector(`[data-story-id="${CSS.escape(id)}"]`)
    ?.classList.add("seen");
}

function buildDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.id = "story-viewer";
  dialog.innerHTML = `
    <div class="sv-frame" role="group" aria-roledescription="hikâye">
      <div class="sv-bars" aria-hidden="true"></div>
      <header class="sv-head">
        <span class="sv-title"></span>
        <button type="button" class="sv-close" aria-label="Kapat">✕</button>
      </header>
      <div class="sv-slide">
        <img class="sv-img" alt="" hidden />
        <div class="sv-body">
          <h2 class="sv-slide-title"></h2>
          <p class="sv-text"></p>
          <a class="sv-cta" hidden target="_blank" rel="noopener noreferrer"></a>
        </div>
      </div>
      <button type="button" class="sv-nav sv-prev" aria-label="Önceki"></button>
      <button type="button" class="sv-nav sv-next" aria-label="Sonraki"></button>
    </div>`;
  const style = document.createElement("style");
  style.textContent = `
    #story-viewer { border: 0; padding: 0; background: transparent; max-width: 100vw; max-height: 100dvh; }
    /* Giriş/çıkış: aynı yoldan (scale + fade), arama modalıyla aynı desen */
    #story-viewer {
      opacity: 0;
      transform: scale(0.96);
      transition:
        opacity 300ms cubic-bezier(0.16, 1, 0.3, 1),
        transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
        overlay 300ms allow-discrete,
        display 300ms allow-discrete;
    }
    #story-viewer[open] { opacity: 1; transform: scale(1); }
    @starting-style {
      #story-viewer[open] { opacity: 0; transform: scale(0.96); }
    }
    #story-viewer::backdrop {
      background: rgba(0,0,0,.85);
      backdrop-filter: blur(4px);
      opacity: calc(var(--sv-backdrop, 1) * 1);
      transition: opacity 300ms ease, overlay 300ms allow-discrete, display 300ms allow-discrete;
    }
    #story-viewer:not([open])::backdrop { opacity: 0; }
    @media (prefers-reduced-motion: reduce) {
      #story-viewer { transition-duration: 0.01ms; transform: none; }
    }
    #story-viewer .sv-frame { position: relative; width: min(420px, 100vw); height: min(88dvh, 740px);
      background: #10181a; border-radius: 1rem; overflow: hidden; display: flex; flex-direction: column;
      touch-action: none; will-change: transform; }
    #story-viewer .sv-bars { display: flex; gap: 0.25rem; padding: 0.625rem 0.75rem 0; }
    #story-viewer .sv-bars i { flex: 1; height: 0.1875rem; border-radius: 0.125rem; background: rgba(255,255,255,.3); overflow: hidden; display: block; }
    #story-viewer .sv-bars i b { display: block; height: 100%; width: 0; background: #fff; }
    #story-viewer .sv-bars i.done b { width: 100%; }
    #story-viewer .sv-bars i.active b { animation: sv-progress linear forwards; animation-duration: var(--dur, 5s); }
    #story-viewer.paused .sv-bars i.active b { animation-play-state: paused; }
    @keyframes sv-progress { to { width: 100%; } }
    @media (prefers-reduced-motion: reduce) { #story-viewer .sv-bars i.active b { animation: none; width: 100%; } }
    #story-viewer .sv-head { display: flex; align-items: center; justify-content: space-between; padding: 0.375rem 0.375rem 0.375rem 0.75rem; color: #fff; }
    #story-viewer .sv-title { font-size: 0.875rem; font-weight: 600; }
    #story-viewer .sv-close { display: flex; align-items: center; justify-content: center;
      min-width: 2.75rem; min-height: 2.75rem; background: none; border: 0; color: #fff; font-size: 1.125rem; cursor: pointer; }
    #story-viewer .sv-slide { flex: 1; position: relative; display: flex; flex-direction: column; justify-content: flex-end; }
    #story-viewer .sv-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    #story-viewer .sv-body { position: relative; padding: 1.25rem; background: linear-gradient(transparent, rgba(0,0,0,.75)); color: #fff; }
    #story-viewer .sv-slide-title { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.375rem; letter-spacing: -0.01em; }
    #story-viewer .sv-text { font-size: 0.9375rem; line-height: 1.5; margin: 0; }
    #story-viewer .sv-cta { display: inline-block; margin-top: 0.875rem; padding: 0.625rem 1.125rem; border-radius: 999px;
      background: #fff; color: #10181a; font-weight: 600; font-size: 0.875rem; text-decoration: none; }
    #story-viewer .sv-nav { position: absolute; top: 15%; bottom: 15%; width: 33%; background: none; border: 0; cursor: pointer; }
    #story-viewer .sv-prev { left: 0; } #story-viewer .sv-next { right: 0; }
  `;
  dialog.prepend(style);
  document.body.appendChild(dialog);
  return dialog;
}

export function initStories() {
  const rings = document.querySelectorAll<HTMLAnchorElement>("[data-story-id]");
  if (rings.length === 0) return;

  // Görülenleri işaretle
  const seen = readSeen();
  for (const ring of rings) {
    if (seen[ring.dataset.storyId!]) ring.classList.add("seen");
  }

  let dialog: HTMLDialogElement | undefined;
  let slides: Slide[] = [];
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentTarget = "";
  // Timer/bar senkronu: kalan süre takip edilir; CSS bar pause'la aynı
  // gerçeği yaşar (apple-design §13 harmony)
  let slideStart = 0;
  let remaining = 0;

  function frameEl(): HTMLElement | undefined {
    return dialog?.querySelector<HTMLElement>(".sv-frame") ?? undefined;
  }

  function startTimer(ms: number) {
    clearTimeout(timer);
    slideStart = performance.now();
    remaining = ms;
    timer = setTimeout(next, ms);
  }

  function pauseTimer() {
    clearTimeout(timer);
    remaining -= performance.now() - slideStart;
    if (remaining < 0) remaining = 0;
  }

  function resumeTimer() {
    slideStart = performance.now();
    clearTimeout(timer);
    timer = setTimeout(next, remaining);
  }

  function renderSlide() {
    if (!dialog) return;
    const slide = slides[index];
    if (!slide) return;

    const bars = dialog.querySelector(".sv-bars")!;
    bars.innerHTML = slides
      .map(
        (s, i) =>
          `<i class="${i < index ? "done" : i === index ? "active" : ""}" style="--dur:${s.durationMs}ms"><b></b></i>`,
      )
      .join("");

    const img = dialog.querySelector<HTMLImageElement>(".sv-img")!;
    if (slide.image) {
      img.src = slide.image;
      img.hidden = false;
    } else {
      img.hidden = true;
    }
    dialog.querySelector(".sv-slide-title")!.textContent = slide.title ?? "";
    dialog.querySelector(".sv-text")!.textContent = slide.text ?? "";

    const cta = dialog.querySelector<HTMLAnchorElement>(".sv-cta")!;
    const isLast = index === slides.length - 1;
    const ctaData = slide.cta ?? (isLast ? { label: "Devamı →", url: currentTarget } : undefined);
    if (ctaData) {
      cta.textContent = ctaData.label;
      cta.href = ctaData.url;
      cta.hidden = false;
    } else {
      cta.hidden = true;
    }

    clearTimeout(timer);
    const reduced = prefersReducedMotion();
    if (!reduced || !isLast) startTimer(slide.durationMs);
  }

  function next() {
    if (index < slides.length - 1) {
      index++;
      renderSlide();
    } else {
      close();
    }
  }

  function prev() {
    if (index > 0) {
      index--;
      renderSlide();
    }
  }

  function close() {
    clearTimeout(timer);
    dialog?.close();
  }

  function open(ring: HTMLAnchorElement) {
    dialog ??= setup();
    slides = JSON.parse(ring.dataset.slides!) as Slide[];
    currentTarget = ring.dataset.targetUrl ?? "";
    index = 0;
    dialog.querySelector(".sv-title")!.textContent = ring.dataset.storyTitle ?? "";
    markSeen(ring.dataset.storyId!);
    const frame = frameEl();
    if (frame) {
      frame.style.transform = "";
      frame.style.opacity = "";
    }
    dialog.style.setProperty("--sv-backdrop", "1");
    dialog.showModal();
    renderSlide();
  }

  /* ---------- Jest tanıma (apple-design §2, §3, §5, §6, §9, §10) ----------
     pointerdown'dan itibaren dikey (kapatma) ve yatay (slide) jestleri
     paralel izlenir; ~10px eşikte eksen kilitlenir, kaybeden iptal edilir. */
  function attachGestures(d: HTMLDialogElement) {
    const frame = d.querySelector<HTMLElement>(".sv-frame")!;
    const THRESHOLD = 10;
    let active = false;
    let axis: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    // Velocity için kısa pozisyon+zaman geçmişi (son ~5 hareket)
    let history: { x: number; y: number; t: number }[] = [];
    let anim: { stop: () => void } | undefined;

    const pushHistory = (x: number, y: number) => {
      history.push({ x, y, t: performance.now() });
      if (history.length > 5) history.shift();
    };

    /** px/s cinsinden bırakış hızı (geçmişin ilk→son noktasından) */
    const velocity = (key: "x" | "y"): number => {
      if (history.length < 2) return 0;
      const a = history[0]!;
      const b = history[history.length - 1]!;
      const dt = b.t - a.t;
      return dt > 0 ? ((b[key] - a[key]) / dt) * 1000 : 0;
    };

    const setDrag = (dx: number, dy: number) => {
      const h = frame.offsetHeight;
      const w = frame.offsetWidth;
      if (axis === "y") {
        // Aşağı 1:1; yukarı rubber-band (orada bir şey yok — yumuşak sınır)
        const y = dy >= 0 ? dy : rubberband(dy, h);
        const progress = Math.min(Math.max(dy, 0) / h, 1);
        // Küçülme jestin gideceği yeri ipuçlar (§8); backdrop ilerlemeyle söner
        frame.style.transform = `translateY(${y}px) scale(${1 - progress * 0.06})`;
        d.style.setProperty("--sv-backdrop", String(1 - progress * 0.6));
      } else if (axis === "x") {
        const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === slides.length - 1);
        const x = atEdge ? rubberband(dx, w) : dx * 0.65;
        frame.style.transform = `translateX(${x}px)`;
      }
    };

    const settle = (to: string, v: number, done?: () => void) => {
      if (prefersReducedMotion()) {
        frame.style.transform = to === "dismiss" ? "" : "translate(0px, 0px)";
        d.style.setProperty("--sv-backdrop", "1");
        done?.();
        return;
      }
      const h = frame.offsetHeight;
      if (to === "dismiss") {
        // Momentum taşıyan jest: velocity handoff'lu, hafif bounce'lı spring
        // Fizik-tabanlı spring: duration verilirse velocity yok sayılır,
        // handoff için stiffness/damping (response≈0.35s, hafif alt-sönüm)
        anim = animate(
          frame,
          { transform: `translateY(${h + 80}px) scale(0.9)` },
          { type: "spring", stiffness: 320, damping: 30, velocity: v },
        ) as unknown as { stop: () => void };
        animate(0.4, 0, {
          duration: 0.3,
          onUpdate: (p) => d.style.setProperty("--sv-backdrop", String(p)),
        });
        setTimeout(() => done?.(), 320);
      } else {
        // Yerine dönüş: kritik sönümlü spring, velocity korunur (§5)
        anim = animate(
          frame,
          { transform: "translateY(0px) translateX(0px) scale(1)" },
          { type: "spring", stiffness: 320, damping: 36, velocity: v },
        ) as unknown as { stop: () => void };
        d.style.setProperty("--sv-backdrop", "1");
        done?.();
      }
    };

    d.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".sv-cta, .sv-close")) return;
      active = true;
      axis = null;
      startX = e.clientX;
      startY = e.clientY;
      history = [];
      pushHistory(e.clientX, e.clientY);
      // Devam eden yerleşme animasyonu varsa yakala (kesintiye açık §3)
      anim?.stop();
      // Basılı tutma = durdurma (mevcut davranış korunur)
      d.classList.add("paused");
      pauseTimer();
    });

    d.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      pushHistory(e.clientX, e.clientY);
      if (!axis) {
        if (Math.hypot(dx, dy) < THRESHOLD) return;
        // Eksen kilidi: baskın yön kazanır, kaybeden jest iptal (§10)
        axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
        // Capture ancak jest kesinleşince alınır: öncesinde alınırsa
        // click olayları frame'e retarget olur, tap gezinmesi kırılır
        frame.setPointerCapture(e.pointerId);
      }
      setDrag(dx, dy);
    });

    const release = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      d.classList.remove("paused");
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (axis === "y") {
        const vy = velocity("y");
        const h = frame.offsetHeight;
        // Karar bırakış noktasına değil, momentumun varacağı yere bakar (§6)
        const projected = dy + project(vy);
        if (projected > h * 0.4 || vy > 500) {
          settle("dismiss", vy, () => {
            close();
            frame.style.transform = "";
            d.style.setProperty("--sv-backdrop", "1");
          });
        } else {
          settle("snap", vy);
          resumeTimer();
        }
      } else if (axis === "x") {
        const vx = velocity("x");
        const projected = dx + project(vx);
        const w = frame.offsetWidth;
        const canPrev = dx > 0 && index > 0;
        const canNext = dx < 0 && index < slides.length - 1;
        if (Math.abs(projected) > w * 0.3 && (canPrev || canNext)) {
          settle("snap", vx);
          if (canNext) next();
          else prev();
        } else {
          settle("snap", vx);
          resumeTimer();
        }
      } else {
        // Jest yok = basılı tutup bırakma → kaldığı yerden devam
        resumeTimer();
      }
      axis = null;
    };

    d.addEventListener("pointerup", release);
    d.addEventListener("pointercancel", release);
  }

  function setup(): HTMLDialogElement {
    const d = buildDialog();
    d.querySelector(".sv-close")!.addEventListener("click", close);
    d.querySelector(".sv-next")!.addEventListener("click", next);
    d.querySelector(".sv-prev")!.addEventListener("click", prev);
    d.addEventListener("close", () => clearTimeout(timer));
    d.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    });
    attachGestures(d);
    return d;
  }

  for (const ring of rings) {
    if (!ring.dataset.slides) {
      // slide'sız: doğrudan link, yalnızca seen işaretle
      ring.addEventListener("click", () => markSeen(ring.dataset.storyId!));
      continue;
    }
    ring.addEventListener("click", (e) => {
      e.preventDefault();
      open(ring);
    });
  }
}
