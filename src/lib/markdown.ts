/**
 * Üye içeriği markdown'ı: inline HTML'e izin verilmez (XSS koruması).
 * `<` escape edilir → yalnızca saf markdown sözdizimi render olur.
 * Bağlantı/görsel hedefi İZİN LİSTESİ: https?://, site içi `/…` (`//` ve `/\` değil), `#`, mailto:.
 * Gerisi (javascript:, data:, vbscript:, entity ile gizlenmiş şemalar) etkisizleştirilir — aynı kökende
 * çalışan tek bir betik niyet/çerez/POST ile rızasız katılım ve atıf yazabilirdi (inceleme 2026-10-12).
 */
import { Marked } from "marked";

const GUVENLI_HEDEF = /^(https?:\/\/|\/(?![\/\\])|#|mailto:)/i;
const uyeMarked = new Marked({
  walkTokens(t) {
    if ((t.type === "link" || t.type === "image") && !GUVENLI_HEDEF.test(t.href))
      t.href = t.type === "image" ? "" : "#";
  },
});

export function renderMemberMarkdown(src: string): string {
  const safe = src.replace(/</g, "&lt;");
  return uyeMarked.parse(safe, { async: false }) as string;
}

export function slugifyTitle(title: string): string {
  return (
    title
      .toLocaleLowerCase("tr")
      .replace(/[ışğüöç]/g, (c) =>
        ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c] ?? c,
      )
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "yazi"
  );
}
