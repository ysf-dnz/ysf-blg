/**
 * Site animasyon motoru (~1.5 KB):
 * - [data-reveal] / [data-stagger]: IntersectionObserver ile scroll-reveal
 * - [data-ticker]: sayılar görünüme girince 0→N sayar (21st "Number Ticker")
 * - .read-progress: okuma ilerleme çubuğu (rAF, --progress)
 * - .site-header: scroll'da gölge
 * View Transitions ile uyum: astro:page-load'da yeniden bağlanır.
 */

import { prefersReducedMotion } from "./waapi.ts";

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function initReveal() {
  const targets = document.querySelectorAll<HTMLElement>(
    "[data-reveal]:not(.in), [data-stagger]:not(.in)",
  );
  if (targets.length === 0) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  for (const el of targets) {
    if (el.hasAttribute("data-stagger")) {
      [...el.children].forEach((c, i) =>
        (c as HTMLElement).style.setProperty("--i", String(i)),
      );
    }
    io.observe(el);
  }
}

function initTicker() {
  const els = document.querySelectorAll<HTMLElement>("[data-ticker]:not([data-done])");
  if (els.length === 0) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      io.unobserve(el);
      el.dataset.done = "1";
      const target = parseInt(el.textContent ?? "0", 10);
      if (!Number.isFinite(target) || prefersReducedMotion()) continue;
      const start = performance.now();
      const dur = 1200;
      const tick = (now: number) => {
        const t = Math.min((now - start) / dur, 1);
        el.textContent = String(Math.round(easeOutExpo(t) * target));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
  els.forEach((el) => io.observe(el));
}

function initProgress() {
  const bar = document.querySelector<HTMLElement>(".read-progress");
  if (!bar) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const doc = document.documentElement;
    const max = doc.scrollHeight - innerHeight;
    bar.style.setProperty("--progress", String(max > 0 ? Math.min(scrollY / max, 1) : 0));
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  addEventListener("scroll", onScroll, { passive: true });
  update();
}

function initHeader() {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

export function initMotion() {
  document.documentElement.classList.add("motion-ok");
  initReveal();
  initTicker();
  initProgress();
  initHeader();
}
