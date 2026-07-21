import { getCollection, type CollectionEntry } from "astro:content";

export type Story = CollectionEntry<"stories">;

/** Süresi geçmemiş hikâyeler: pinned önce, sonra order, sonra yeni tarih. */
export async function getActiveStories(now = new Date()): Promise<Story[]> {
  const stories = await getCollection(
    "stories",
    ({ data }) => !data.expiresAt || data.expiresAt > now,
  );
  return stories.sort((a, b) => {
    if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf();
  });
}

export function hasSlides(story: Story): boolean {
  return (story.data.slides?.length ?? 0) > 0;
}
