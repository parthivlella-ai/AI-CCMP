import { INITIAL_POSTS } from "./seed-posts";
import type { MarketplacePost } from "@/types";

// Cross-request in-memory shared cache using globalThis for Node.js server persistence
const globalShared = globalThis as unknown as {
  __prismora_server_posts__?: MarketplacePost[];
};

if (!globalShared.__prismora_server_posts__) {
  globalShared.__prismora_server_posts__ = [...INITIAL_POSTS];
}

export function getSharedPosts(): MarketplacePost[] {
  if (!globalShared.__prismora_server_posts__) {
    globalShared.__prismora_server_posts__ = [...INITIAL_POSTS];
  }
  return [...globalShared.__prismora_server_posts__];
}

export function addSharedPost(post: MarketplacePost): MarketplacePost {
  const current = getSharedPosts();
  const filtered = current.filter((p) => p.id !== post.id);
  filtered.unshift(post);
  globalShared.__prismora_server_posts__ = filtered;
  return post;
}

export function updateSharedPost(id: string, updates: Partial<MarketplacePost>): MarketplacePost | null {
  const current = getSharedPosts();
  const index = current.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const updated: MarketplacePost = {
    ...current[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  current[index] = updated;
  globalShared.__prismora_server_posts__ = current;
  return updated;
}

export function deleteSharedPost(id: string): boolean {
  const current = getSharedPosts();
  const initialLength = current.length;
  const filtered = current.filter((p) => p.id !== id);
  globalShared.__prismora_server_posts__ = filtered;
  return filtered.length < initialLength;
}
