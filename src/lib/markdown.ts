/**
 * Üye içeriği markdown'ı: inline HTML'e izin verilmez (XSS koruması).
 * `<` escape edilir → yalnızca saf markdown sözdizimi render olur.
 */
import { marked } from "marked";

export function renderMemberMarkdown(src: string): string {
  const safe = src.replace(/</g, "&lt;");
  return marked.parse(safe, { async: false }) as string;
}

export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[ışğüöç]/g, (c) =>
        ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c] ?? c,
      )
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "yazi"
  );
}
