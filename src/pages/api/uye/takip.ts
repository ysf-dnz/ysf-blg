/** POST /api/uye/takip — yazar takip et/bırak + yazı beğen (Medium tarzı). */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "follow" || action === "unfollow") {
    const handle = String(form.get("handle") ?? "");
    const hedef = await db.query.users.findFirst({
      where: eq(schema.users.handle, handle),
    });
    if (!hedef || hedef.id === member.id)
      return context.redirect(`/u/${handle}`);
    if (action === "follow") {
      const [ins] = await db
        .insert(schema.follows)
        .values({ followerId: member.id, followedId: hedef.id })
        .onConflictDoNothing()
        .returning();
      if (ins) {
        await db.insert(schema.notifications).values({
          userId: hedef.id,
          kind: "follow",
          body: `${member.name} seni takip etmeye başladı 👋`,
          href: `/u/${member.handle}`,
        });
      }
    } else {
      await db
        .delete(schema.follows)
        .where(
          and(
            eq(schema.follows.followerId, member.id),
            eq(schema.follows.followedId, hedef.id),
          ),
        );
    }
    return context.redirect(`/u/${handle}`);
  }

  if (action === "yazi-begen") {
    const memberPostId = Number(form.get("memberPostId") ?? 0);
    const post = await db.query.memberPosts.findFirst({
      where: eq(schema.memberPosts.id, memberPostId),
    });
    if (post && post.userId !== member.id) {
      const [ins] = await db
        .insert(schema.likes)
        .values({ userId: member.id, memberPostId })
        .onConflictDoNothing()
        .returning();
      if (ins) {
        await db.insert(schema.pointsLedger).values({
          userId: post.userId,
          delta: PUAN.likeReceived,
          reason: "like_received",
          refId: `yazi:${memberPostId}`,
        });
      }
    }
    return context.redirect(`/topluluk/${post?.slug ?? ""}`);
  }

  return new Response("Bilinmeyen işlem", { status: 400 });
};
