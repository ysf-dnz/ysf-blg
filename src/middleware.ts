import { clerkMiddleware } from "@clerk/astro/server";

const KORUMALI = [/^\/uye(\/|$)/, /^\/api\/uye(\/|$)/];

export const onRequest = clerkMiddleware((auth, context) => {
  const url = new URL(context.request.url);

  // Davet linki: ?ref=handle 30 gün cookie'de tutulur, kayıt anında işlenir
  const ref = url.searchParams.get("ref");
  if (ref && /^[a-z0-9-]{2,40}$/.test(ref)) {
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
