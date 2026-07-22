/**
 * Admin panelde ham URL de yapıştırılsa, çıplak id de girilse çalışsın diye
 * embed hedeflerini normalize eden saf fonksiyonlar.
 */

/** watch?v=, youtu.be/, shorts/, embed/ veya çıplak 11 karakterlik id. */
export function youtubeId(input: string): string | undefined {
  const raw = input.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  const m = raw.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m?.[1];
}

/** open.spotify.com linkini (veya spotify: URI'sini) embed URL'sine çevirir. */
export function spotifyEmbedUrl(input: string): string | undefined {
  const raw = input.trim();
  const uri = raw.match(/^spotify:(track|album|playlist|episode|show):([\w]+)$/);
  if (uri) return `https://open.spotify.com/embed/${uri[1]}/${uri[2]}`;
  const m = raw.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(track|album|playlist|episode|show)\/([\w]+)/,
  );
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : undefined;
}

/** file/d/<id>, open?id=, uc?id= linkleri veya çıplak Drive dosya id'si. */
export function driveFileId(input: string): string | undefined {
  const raw = input.trim();
  const m =
    raw.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ??
    raw.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*id=([\w-]+)/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(raw) ? raw : undefined;
}
