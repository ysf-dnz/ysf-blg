/** Kitap koleksiyonu → Map; sayfalardaki tekrarlı books.find'ları kaldırır. */
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export type BookData = CollectionEntry<"books">["data"];

export async function getBookMap(): Promise<Map<string, BookData>> {
  const books = await getCollection("books");
  return new Map(books.map((b) => [b.data.id, b.data]));
}

export const bookTitle = (b?: BookData): string =>
  b ? (b.titleTr ?? b.title) : "";

/** Kitapları kategoriye göre grupla (seçicilerde <optgroup> için).
 *  Kategori sırası KATEGORILER'den gelir; boşlar atlanır. */
export function groupByCategory<T extends BookData | undefined>(
  books: T[],
  kategoriler: { key: string; ad: string }[],
): { ad: string; books: NonNullable<T>[] }[] {
  const dolu = books.filter(Boolean) as NonNullable<T>[];
  return kategoriler
    .map((k) => ({
      ad: k.ad,
      books: dolu.filter((b) => (b.category ?? "diger") === k.key),
    }))
    .filter((g) => g.books.length > 0);
}
