import { clerkMiddleware } from "@clerk/astro/server";
import { belgeGezintisiMi } from "@/lib/urls.ts";

const KORUMALI = [/^\/uye(\/|$)/, /^\/api\/uye(\/|$)/];

export const onRequest = clerkMiddleware((auth, context) => {
  const url = new URL(context.request.url);

  // Davet linki: ?ref=handle 30 gün cookie'de tutulur, kayıt anında işlenir. Yalnız üst düzey belge
  // gezintisinde: aynı kökenli <img src="/kurslar?ref=X"> (kurs kapağı, markdown görseli) ya da prefetch
  // misafirin atfını ezemez (/d/ ile aynı kural). ClientRouter gezintisini Base.astro betiği karşılar.
  const ref = url.searchParams.get("ref");
  if (ref && /^[a-z0-9-]{2,40}$/.test(ref) && belgeGezintisiMi(context.request)) {
    context.cookies.set("ysf_ref", ref, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  if (KORUMALI.some((r) => r.test(url.pathname)) && !auth().userId) {
    return auth().redirectToSignIn();
  }
});
