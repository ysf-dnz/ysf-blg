/**
 * Story viewer island — framework'süz, tek dosya.
 * <dialog> tabanlı tam ekran viewer: CSS animasyonlu progress bar,
 * tık/tuş ile gezinme, basılı tutunca durdurma, son slide'da CTA.
 * Görülenler localStorage'da tutulur; süresi geçen kayıtlar temizlenir.
 */

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
    #story-viewer::backdrop { background: rgba(0,0,0,.85); backdrop-filter: blur(4px); }
    #story-viewer .sv-frame { position: relative; width: min(420px, 100vw); height: min(88dvh, 740px);
      background: #10181a; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
    #story-viewer .sv-bars { display: flex; gap: 4px; padding: 10px 12px 0; }
    #story-viewer .sv-bars i { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,.3); overflow: hidden; display: block; }
    #story-viewer .sv-bars i b { display: block; height: 100%; width: 0; background: #fff; }
    #story-viewer .sv-bars i.done b { width: 100%; }
    #story-viewer .sv-bars i.active b { animation: sv-progress linear forwards; animation-duration: var(--dur, 5s); }
    #story-viewer.paused .sv-bars i.active b { animation-play-state: paused; }
    @keyframes sv-progress { to { width: 100%; } }
    @media (prefers-reduced-motion: reduce) { #story-viewer .sv-bars i.active b { animation: none; width: 100%; } }
    #story-viewer .sv-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; color: #fff; }
    #story-viewer .sv-title { font-size: 14px; font-weight: 600; }
    #story-viewer .sv-close { background: none; border: 0; color: #fff; font-size: 18px; cursor: pointer; padding: 4px 8px; }
    #story-viewer .sv-slide { flex: 1; position: relative; display: flex; flex-direction: column; justify-content: flex-end; }
    #story-viewer .sv-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    #story-viewer .sv-body { position: relative; padding: 20px; background: linear-gradient(transparent, rgba(0,0,0,.75)); color: #fff; }
    #story-viewer .sv-slide-title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
    #story-viewer .sv-text { font-size: 15px; line-height: 1.5; margin: 0; }
    #story-viewer .sv-cta { display: inline-block; margin-top: 14px; padding: 10px 18px; border-radius: 999px;
      background: #fff; color: #10181a; font-weight: 600; font-size: 14px; text-decoration: none; }
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
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced || !isLast) {
      timer = setTimeout(next, slide.durationMs);
    }
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
    dialog.showModal();
    renderSlide();
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
    // Basılı tutunca durdur
    for (const evt of ["pointerdown", "pointerup", "pointercancel"] as const) {
      d.addEventListener(evt, (e) => {
        if ((e.target as HTMLElement).closest(".sv-cta, .sv-close")) return;
        const paused = evt === "pointerdown";
        d.classList.toggle("paused", paused);
        if (paused) clearTimeout(timer);
        else {
          // Kalan süreyi hassas takip etmeden basitçe yeniden başlat
          const slide = slides[index];
          if (slide) timer = setTimeout(next, slide.durationMs);
        }
      });
    }
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
