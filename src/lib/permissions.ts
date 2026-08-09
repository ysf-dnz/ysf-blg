/** Yetki modeli — tek yer. */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import type { Member } from "./member.ts";

export type ClubRole = "president" | "mod" | "member" | null;

export async function clubRoleOf(
  member: Member | null,
  clubId: number,
): Promise<ClubRole> {
  if (!member) return null;
  if (member.role === "admin") return "president"; // admin her kulüpte tam yetkili
  const row = await db.query.clubMembers.findFirst({
    where: and(
      eq(schema.clubMembers.clubId, clubId),
      eq(schema.clubMembers.userId, member.id),
    ),
  });
  return (row?.role as ClubRole) ?? null;
}

/** Kampanya/görev/etkinlik/eğitim yönetimi: başkan + mod (+admin) */
export function canManage(role: ClubRole): boolean {
  return role === "president" || role === "mod";
}

/** Site-geneli kampanya açma: rep + admin */
export function canManageGlobal(member: Member | null): boolean {
  return member?.role === "rep" || member?.role === "admin";
}
