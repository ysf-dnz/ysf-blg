/** GET /etkinlik/[slug]/katilimcilar.csv — katılım listesi (yalnız düzenleyen ve admin). */
import type { APIRoute } from "astro";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { etkinlikBul, yonetebilirMi } from "@/lib/etkinlik.ts";
import { csvUret, trSaat, trTarih } from "@/lib/etkinlik-kural.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { getUsersMap } from "@/lib/social.ts";

export const prerender = false;

const YONTEM = { ticket: "bilet", rotating: "dönen QR", manual: "elle" } as const;
const an = (d: Date | null) => (d ? `${trTarih(d)} ${trSaat(d)}` : "");

export const GET: APIRoute = async (context) => {
  const e = await etkinlikBul(context.params.slug ?? "");
  const member = await getOrCreateMember(context);
  if (!e || !(await yonetebilirMi(e, member))) return new Response("Bulunamadı", { status: 404 });
  const kayitlar = await db.query.eventRsvps.findMany({
    where: eq(schema.eventRsvps.eventId, e.id),
    orderBy: asc(schema.eventRsvps.createdAt),
  });
  const kodIdler = kayitlar.map((k) => k.inviteCodeId).filter((id): id is number => !!id);
  const kodlar = kodIdler.length
    ? await db.query.inviteCodes.findMany({ where: inArray(schema.inviteCodes.id, kodIdler) })
    : [];
  const davetEden = new Map(kodlar.map((k) => [k.id, k.inviterId]));
  const kisiler = await getUsersMap([...kayitlar.map((k) => k.userId), ...kodlar.map((k) => k.inviterId)]);
  const csv = csvUret(
    ["Ad", "Kullanıcı adı", "Kayıt", "Öncelikli", "Giriş", "Yöntem", "Davet eden"],
    kayitlar.map((k) => {
      const u = kisiler.get(k.userId);
      const d = k.inviteCodeId ? kisiler.get(davetEden.get(k.inviteCodeId) ?? 0) : undefined;
      return [
        u?.name,
        u?.handle,
        an(k.createdAt),
        k.priority ? "evet" : "",
        an(k.checkedInAt),
        k.checkinMethod ? YONTEM[k.checkinMethod] : "",
        d?.handle,
      ];
    }),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="katilimcilar-${e.id}.csv"`,
      "cache-control": "no-store",
    },
  });
};
