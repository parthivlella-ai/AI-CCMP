import { getClientEnv } from "../env";
import { createClient as createBrowserSupabase } from "../supabase/client";
import { INITIAL_POSTS } from "../data/seed-posts";
import { SEED_CREATORS } from "../data/seed-creators";
import { getSharedPosts, addSharedPost, updateSharedPost as updateSharedPostInStore, deleteSharedPost as deleteSharedPostInStore } from "../data/shared-posts";
import type { MarketplacePost, Conversation, Message, AccountRole } from "@/types";

// Helper to get all posts (from localStorage if available, or initial seed)
function getStoredPosts(): MarketplacePost[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("prismora_all_posts");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
  }
  return [...INITIAL_POSTS];
}

function saveStoredPosts(posts: MarketplacePost[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("prismora_all_posts", JSON.stringify(posts));
    } catch {
      // Ignore
    }
  }
}

export const KNOWN_PROFILES: Record<
  string,
  { display_name: string; handle: string; avatar_url?: string; role: AccountRole; bio?: string }
> = {
  // Clients
  "usr-client-001": {
    display_name: "Velvet Luxe Agency",
    handle: "velvetluxe",
    role: "client",
    bio: "Prestige food & beverage brand commissioning next-gen commercials.",
  },
  // Freelancers / Creators (by custom ID and by UUID)
  "usr-freelancer-elena-01": {
    display_name: "Aetheris Studios",
    handle: "aetheris",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "Cinematic commercial director specializing in photorealistic luxury & fashion campaigns.",
  },
  "00000000-0000-0000-0000-000000000001": {
    display_name: "Aetheris Studios",
    handle: "aetheris",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "Next-generation cinematic AI commercials & photorealistic VFX.",
  },
  "usr-freelancer-marcus-02": {
    display_name: "Horizon AI Films",
    handle: "horizonfilms",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "Food & beverage AI stylist creating mouth-watering gourmet commercials.",
  },
  "00000000-0000-0000-0000-000000000003": {
    display_name: "SonicAether Labs",
    handle: "sonicaether",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "Generative sound design & adaptive audio landscape synthesis.",
  },
  "usr-freelancer-chloe-03": {
    display_name: "VoxelForge Labs",
    handle: "voxelforge",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "High-intensity sports & fitness visual effects pipeline.",
  },
  "00000000-0000-0000-0000-000000000002": {
    display_name: "SynthCraft Studio",
    handle: "synthcraft",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "Virtual influencer design & hyper-realistic character consistency.",
  },
  "usr-freelancer-kai-04": {
    display_name: "Kroma Motion FX",
    handle: "kromafx",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "High-octane commercial video edits & anime-inspired stylistic transformations.",
  },
  "00000000-0000-0000-0000-000000000004": {
    display_name: "Kurogane FX Tokyo",
    handle: "tanakavfx",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    role: "freelancer",
    bio: "Hyper-stylized anime-to-realism transformation and product motion.",
  },
};

export function resolvePartyProfile(
  partyId: string,
  fallback?: {
    display_name?: string;
    handle?: string;
    avatar_url?: string;
    role?: AccountRole;
  }
): { display_name: string; handle: string; avatar_url?: string; role: AccountRole } {
  if (KNOWN_PROFILES[partyId]) {
    return KNOWN_PROFILES[partyId];
  }

  // 1. Check seed creators
  const seedCreator = SEED_CREATORS.find((c) => c.id === partyId || c.profile.id === partyId);
  if (seedCreator) {
    return {
      display_name: seedCreator.profile.display_name || seedCreator.profile.full_name || "Creator",
      handle: seedCreator.profile.handle || "creator",
      avatar_url: seedCreator.profile.avatar_url || undefined,
      role: "freelancer",
    };
  }

  // 2. Check seed posts
  const seedPost = INITIAL_POSTS.find((p) => p.creator_id === partyId || p.creator?.id === partyId);
  if (seedPost?.creator) {
    return {
      display_name: seedPost.creator.display_name,
      handle: seedPost.creator.handle,
      avatar_url: seedPost.creator.avatar_url,
      role: "freelancer",
    };
  }

  // 3. Check registered users in localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("prismora_users_registry");
      if (stored) {
        const reg = JSON.parse(stored);
        for (const key of Object.keys(reg)) {
          if (reg[key]?.profile?.id === partyId) {
            const p = reg[key].profile;
            return {
              display_name: p.display_name || p.full_name || "User",
              handle: p.handle || "user",
              avatar_url: p.avatar_url || undefined,
              role: (p.role === "admin" ? "freelancer" : p.role) || "client",
            };
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  // 4. Clean fallback without false "Client" assignment
  const fallbackRole: AccountRole =
    fallback?.role ||
    (partyId.includes("creator") || partyId.includes("freelancer") ? "freelancer" : "client");

  return {
    display_name:
      fallback?.display_name ||
      (fallbackRole === "freelancer" ? "Verified Creator" : "Client Partner"),
    handle: fallback?.handle || (fallbackRole === "freelancer" ? "creator" : "client"),
    avatar_url: fallback?.avatar_url,
    role: fallbackRole,
  };
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-usr-client-001-usr-freelancer-elena-01",
    client_id: "usr-client-001",
    freelancer_id: "usr-freelancer-elena-01",
    last_message_at: "2026-10-09T18:30:00Z",
    created_at: "2026-10-09T18:00:00Z",
    last_message: "We can deliver 4K ProRes turnaround in 48 hours.",
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-001",
    conversation_id: "conv-usr-client-001-usr-freelancer-elena-01",
    sender_id: "usr-client-001",
    content: "Hi Elena! We love your liquid chrome sneaker video. Can you create a 30s version for our beverage launch?",
    created_at: "2026-10-09T18:00:00Z",
  },
  {
    id: "msg-002",
    conversation_id: "conv-usr-client-001-usr-freelancer-elena-01",
    sender_id: "usr-freelancer-elena-01",
    content: "We can deliver 4K ProRes turnaround in 48 hours. Let's align on your preferred color grade and bottle geometry!",
    created_at: "2026-10-09T18:30:00Z",
  },
];

function getStoredConversations(): Conversation[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("prismora_conversations");
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return [...INITIAL_CONVERSATIONS];
}

function saveStoredConversations(convs: Conversation[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("prismora_conversations", JSON.stringify(convs));
    } catch {}
  }
}

function getStoredMessages(): Message[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("prismora_messages");
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return [...INITIAL_MESSAGES];
}

function saveStoredMessages(msgs: Message[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("prismora_messages", JSON.stringify(msgs));
    } catch {}
  }
}

// In-memory working caches
let inMemoryPosts: MarketplacePost[] = getStoredPosts();
let inMemoryLikes: { postId: string; userId: string }[] = [];
let inMemorySaves: { postId: string; userId: string }[] = [];
let inMemoryConversations: Conversation[] = getStoredConversations();
let inMemoryMessages: Message[] = getStoredMessages();

export interface PostFilterOptions {
  search?: string;
  category?: string;
  hashtag?: string;
  mediaType?: "all" | "video" | "image";
  aiTool?: string;
  maxPrice?: number;
  clientBusinessCategory?: string;
  currentUserId?: string;
}

export async function getMarketplacePosts(options: PostFilterOptions = {}): Promise<MarketplacePost[]> {
  const env = getClientEnv();
  let posts: MarketplacePost[] = [];

  // 1. In browser environment: query shared API route to ensure cross-user / cross-session visibility
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams();
      if (options.search) params.set("search", options.search);
      if (options.category && options.category !== "All") params.set("category", options.category);
      if (options.hashtag && options.hashtag !== "all") params.set("hashtag", options.hashtag);
      if (options.mediaType && options.mediaType !== "all") params.set("mediaType", options.mediaType);
      if (options.aiTool && options.aiTool !== "all") params.set("aiTool", options.aiTool);
      if (options.maxPrice && options.maxPrice > 0) params.set("maxPrice", String(options.maxPrice));

      const res = await fetch(`/api/posts?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.posts && Array.isArray(json.posts)) {
          posts = json.posts as MarketplacePost[];
        }
      }
    } catch {
      // Fallback to local / Supabase query
    }
  }

  // 2. Fallback / Server-side resolution: Supabase + Shared server posts + Stored posts
  if (posts.length === 0) {
    if (env.isConfigured) {
      try {
        const supabase = createBrowserSupabase() as any;
        const { data, error } = await supabase
          .from("posts")
          .select(`
            *,
            creator:profiles(*)
          `)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          posts = data as unknown as MarketplacePost[];
        }
      } catch {
        // Fallback cleanly
      }
    }

    const shared = getSharedPosts();
    if (posts.length === 0) {
      inMemoryPosts = getStoredPosts();
      posts = [...inMemoryPosts];
      const existingIds = new Set(posts.map((p) => p.id));
      for (const sp of shared) {
        if (!existingIds.has(sp.id)) {
          posts.unshift(sp);
        }
      }
    } else {
      const existingIds = new Set(posts.map((p) => p.id));
      for (const sp of shared) {
        if (!existingIds.has(sp.id)) {
          posts.push(sp);
        }
      }
    }

    // Apply Search Filter
    if (options.search && options.search.trim() !== "") {
      const q = options.search.toLowerCase().trim();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.hashtags.some((h) => h.toLowerCase().includes(q)) ||
          p.ai_tools.some((t) => t.toLowerCase().includes(q)) ||
          (p.creator && p.creator.display_name.toLowerCase().includes(q)) ||
          (p.creator && p.creator.handle?.toLowerCase().includes(q))
      );
    }

    // Category Filter
    if (options.category && options.category !== "All") {
      posts = posts.filter((p) => p.category.toLowerCase() === options.category!.toLowerCase());
    }

    // Hashtag Filter
    if (options.hashtag && options.hashtag !== "all") {
      const targetTag = options.hashtag.startsWith("#") ? options.hashtag.toLowerCase() : `#${options.hashtag.toLowerCase()}`;
      posts = posts.filter((p) => p.hashtags.some((h) => h.toLowerCase() === targetTag));
    }

    // Media Type Filter
    if (options.mediaType && options.mediaType !== "all") {
      posts = posts.filter((p) => p.media_type === options.mediaType);
    }

    // AI Tool Filter
    if (options.aiTool && options.aiTool !== "all") {
      posts = posts.filter((p) => p.ai_tools.includes(options.aiTool!));
    }

    // Max Price Filter
    if (options.maxPrice && options.maxPrice > 0) {
      posts = posts.filter((p) => p.price_cents <= options.maxPrice! * 100);
    }
  }

  // Mark is_liked and is_saved for current user
  if (options.currentUserId) {
    posts = posts.map((post) => ({
      ...post,
      is_liked: inMemoryLikes.some((l) => l.postId === post.id && l.userId === options.currentUserId),
      is_saved: inMemorySaves.some((s) => s.postId === post.id && s.userId === options.currentUserId),
    }));
  }

  // Business-Relevant Prioritization
  if (options.clientBusinessCategory && options.clientBusinessCategory !== "All" && (!options.category || options.category === "All")) {
    const clientCat = options.clientBusinessCategory.toLowerCase();
    posts = [...posts].sort((a, b) => {
      const aMatches = a.category.toLowerCase().includes(clientCat) ? 1 : 0;
      const bMatches = b.category.toLowerCase().includes(clientCat) ? 1 : 0;
      return bMatches - aMatches;
    });
  }

  // Update inMemory cache and local storage
  inMemoryPosts = posts;
  saveStoredPosts(posts);

  return posts;
}

export async function getPostById(id: string, currentUserId?: string): Promise<MarketplacePost | null> {
  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      const { data, error } = await supabase
        .from("posts")
        .select(`*, creator:profiles(*)`)
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          is_liked: currentUserId ? inMemoryLikes.some((l) => l.postId === id && l.userId === currentUserId) : false,
          is_saved: currentUserId ? inMemorySaves.some((s) => s.postId === id && s.userId === currentUserId) : false,
        };
      }
    } catch {
      // Fallback
    }
  }

  // Look in shared posts first
  const shared = getSharedPosts();
  let post = shared.find((p) => p.id === id);

  if (!post) {
    inMemoryPosts = getStoredPosts();
    post = inMemoryPosts.find((p) => p.id === id);
  }

  if (!post) return null;

  return {
    ...post,
    is_liked: currentUserId ? inMemoryLikes.some((l) => l.postId === post.id && l.userId === currentUserId) : false,
    is_saved: currentUserId ? inMemorySaves.some((s) => s.postId === post.id && s.userId === currentUserId) : false,
  };
}

/**
 * Returns posts created by creatorId.
 */
export async function getPostsByCreator(creatorId: string): Promise<MarketplacePost[]> {
  if (!creatorId) return [];

  // In browser: fetch from API endpoint
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/posts?creatorId=${encodeURIComponent(creatorId)}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.posts && Array.isArray(json.posts)) {
          return json.posts as MarketplacePost[];
        }
      }
    } catch {
      // Fallback
    }
  }

  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      const { data, error } = await supabase
        .from("posts")
        .select(`*, creator:profiles(*)`)
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as unknown as MarketplacePost[];
      }
    } catch {
      // Fallback
    }
  }

  const shared = getSharedPosts();
  const matchedShared = shared.filter((p) => p.creator_id === creatorId);
  if (matchedShared.length > 0) return matchedShared;

  inMemoryPosts = getStoredPosts();
  return inMemoryPosts.filter((p) => p.creator_id === creatorId);
}

export async function createMarketplacePost(
  data: Omit<MarketplacePost, "id" | "likes_count" | "created_at" | "updated_at">
): Promise<MarketplacePost> {
  // Always use a valid UUID for database compatibility
  const postId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;

  const now = new Date().toISOString();
  const newPost: MarketplacePost = {
    ...data,
    id: postId,
    likes_count: 0,
    created_at: now,
    updated_at: now,
  };

  // 1. Try HTTP API route in browser
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPost,
          creator_id: newPost.creator_id,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.post) {
          inMemoryPosts = getStoredPosts();
          inMemoryPosts.unshift(json.post);
          saveStoredPosts(inMemoryPosts);
          return json.post;
        }
      }
    } catch (err) {
      console.warn("[Marketplace Service] /api/posts fetch failed, proceeding with direct persistence:", err);
    }
  }

  // 2. Direct persistence to Supabase if configured
  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;

      // Upsert profile and creator_profile to satisfy foreign keys
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newPost.creator_id);
      if (isUuid) {
        await supabase.from("profiles").upsert({
          id: newPost.creator_id,
          display_name: newPost.creator?.display_name || "Creator",
          full_name: newPost.creator?.display_name || "Creator",
          handle: newPost.creator?.handle || `creator_${newPost.creator_id.slice(0, 8)}`,
          account_type: "freelancer",
          role: "creator",
        });

        await supabase.from("creator_profiles").upsert({
          id: newPost.creator_id,
          tagline: newPost.description?.slice(0, 100) || "AI Creator",
          primary_ai_tools: newPost.ai_tools,
          specializations: [newPost.category ? newPost.category.toLowerCase().replace(/[^a-z0-9]/g, "_") : "cinematic_video"],
          starting_rate_cents: newPost.price_cents,
          currency: newPost.currency,
          verification_status: "verified",
          is_available: true,
        });

        const { error: postError } = await supabase.from("posts").insert({
          id: newPost.id,
          creator_id: newPost.creator_id,
          title: newPost.title,
          description: newPost.description,
          media_url: newPost.media_url,
          thumbnail_url: newPost.thumbnail_url,
          media_type: newPost.media_type,
          price_cents: newPost.price_cents,
          currency: newPost.currency,
          category: newPost.category,
          hashtags: newPost.hashtags,
          ai_tools: newPost.ai_tools,
        });

        if (postError) {
          console.warn("[Marketplace Service] Supabase insert warning:", postError.message);
        }

        await supabase.from("portfolio_items").insert({
          id: newPost.id,
          creator_id: newPost.creator_id,
          title: newPost.title,
          description: newPost.description,
          content_type: newPost.media_type === "video" ? "video" : "image",
          media_url: newPost.media_url,
          thumbnail_url: newPost.thumbnail_url,
          aspect_ratio: "16:9",
          ai_tools_used: newPost.ai_tools,
          commercial_rights_granted: "full_buyout",
          is_featured: true,
        });
      }
    } catch (err) {
      console.warn("[Marketplace Service] Direct Supabase persistence warning:", err);
    }
  }

  // 3. Update server and local caches
  addSharedPost(newPost);
  inMemoryPosts = getStoredPosts();
  inMemoryPosts.unshift(newPost);
  saveStoredPosts(inMemoryPosts);

  return newPost;
}

export async function updateMarketplacePost(
  id: string,
  data: Partial<MarketplacePost>,
  authenticatedUserId?: string
): Promise<MarketplacePost | null> {
  // Authorization check: User must own the post
  const shared = getSharedPosts();
  const existing = shared.find((p) => p.id === id) || inMemoryPosts.find((p) => p.id === id);

  if (authenticatedUserId && existing && existing.creator_id !== authenticatedUserId) {
    throw new Error("Unauthorized: You do not own this post.");
  }

  if (typeof window !== "undefined") {
    try {
      await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: authenticatedUserId, ...data }),
      });
    } catch {}
  }

  const updatedInStore = updateSharedPostInStore(id, data);

  inMemoryPosts = getStoredPosts();
  const index = inMemoryPosts.findIndex((p) => p.id === id);
  if (index !== -1) {
    inMemoryPosts[index] = {
      ...inMemoryPosts[index],
      ...data,
      updated_at: new Date().toISOString(),
    };
    saveStoredPosts(inMemoryPosts);
  }

  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      await supabase.from("posts").update(data).eq("id", id);
    } catch {}
  }

  return updatedInStore || (index !== -1 ? inMemoryPosts[index] : null);
}

export async function deleteMarketplacePost(
  id: string,
  authenticatedUserId?: string
): Promise<boolean> {
  const shared = getSharedPosts();
  const existing = shared.find((p) => p.id === id) || inMemoryPosts.find((p) => p.id === id);

  // Authorization check: User must own the post
  if (authenticatedUserId && existing && existing.creator_id !== authenticatedUserId) {
    throw new Error("Unauthorized: You cannot delete another creator's post.");
  }

  if (typeof window !== "undefined" && authenticatedUserId) {
    try {
      await fetch(`/api/posts?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(authenticatedUserId)}`, {
        method: "DELETE",
      });
    } catch {}
  }

  const deletedFromShared = deleteSharedPostInStore(id);

  inMemoryPosts = getStoredPosts();
  const initialLength = inMemoryPosts.length;
  inMemoryPosts = inMemoryPosts.filter((p) => p.id !== id);
  saveStoredPosts(inMemoryPosts);

  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      await supabase.from("posts").delete().eq("id", id);
      await supabase.from("portfolio_items").delete().eq("id", id);
    } catch {}
  }

  return deletedFromShared || inMemoryPosts.length < initialLength;
}

export async function toggleLikePost(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
  inMemoryPosts = getStoredPosts();
  const existingIdx = inMemoryLikes.findIndex((l) => l.postId === postId && l.userId === userId);
  const post = inMemoryPosts.find((p) => p.id === postId);

  if (existingIdx >= 0) {
    inMemoryLikes.splice(existingIdx, 1);
    if (post) post.likes_count = Math.max(0, post.likes_count - 1);
    saveStoredPosts(inMemoryPosts);
    return { liked: false, likesCount: post?.likes_count || 0 };
  } else {
    inMemoryLikes.push({ postId, userId });
    if (post) post.likes_count += 1;
    saveStoredPosts(inMemoryPosts);
    return { liked: true, likesCount: post?.likes_count || 1 };
  }
}

export async function toggleSavePost(postId: string, userId: string): Promise<{ saved: boolean }> {
  const existingIdx = inMemorySaves.findIndex((s) => s.postId === postId && s.userId === userId);

  if (existingIdx >= 0) {
    inMemorySaves.splice(existingIdx, 1);
    return { saved: false };
  } else {
    inMemorySaves.push({ postId, userId });
    return { saved: true };
  }
}

export async function getSavedPosts(userId: string): Promise<MarketplacePost[]> {
  if (!userId) return [];
  inMemoryPosts = getStoredPosts();
  const savedIds = inMemorySaves.filter((s) => s.userId === userId).map((s) => s.postId);
  return inMemoryPosts
    .filter((p) => savedIds.includes(p.id))
    .map((p) => ({
      ...p,
      is_saved: true,
      is_liked: inMemoryLikes.some((l) => l.postId === p.id && l.userId === userId),
    }));
}

// =============================================================================
// CONVERSATIONS & MESSAGING (Guaranteed 1-to-1 Association & Data Integrity)
// =============================================================================

export async function getConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];

  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      const { data, error } = await supabase
        .from("conversations")
        .select(`*`)
        .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
        .order("last_message_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return (data as Conversation[]).map((c) => {
          const otherId = c.client_id === userId ? c.freelancer_id : c.client_id;
          const profile = resolvePartyProfile(otherId, c.other_party);
          return {
            ...c,
            other_party: {
              id: otherId,
              display_name: profile.display_name,
              handle: profile.handle,
              avatar_url: profile.avatar_url,
              role: profile.role,
            },
          };
        });
      }
    } catch {
      // Continue to local storage
    }
  }

  inMemoryConversations = getStoredConversations();
  const userConvs = inMemoryConversations.filter(
    (c) => c.client_id === userId || c.freelancer_id === userId
  );

  return userConvs.map((c) => {
    const otherId = c.client_id === userId ? c.freelancer_id : c.client_id;
    const profile = resolvePartyProfile(otherId, c.other_party);
    return {
      ...c,
      other_party: {
        id: otherId,
        display_name: profile.display_name,
        handle: profile.handle,
        avatar_url: profile.avatar_url,
        role: profile.role,
      },
    };
  });
}

/**
 * Retrieves or creates a strictly isolated conversation between the authenticated client
 * and the specific intended freelancer.
 * Deterministic ID formula ensures no duplicate or cross-account pollution.
 */
export async function getOrCreateConversation(
  clientId: string,
  freelancerId: string,
  freelancerProfile?: { display_name?: string; handle?: string; avatar_url?: string; role?: AccountRole }
): Promise<Conversation> {
  if (!clientId || !freelancerId) {
    throw new Error("Both client ID and freelancer ID are required to open a conversation.");
  }

  // Deterministic canonical conversation ID
  const [p1, p2] = [clientId, freelancerId].sort();
  const canonicalId = `conv-${p1}-${p2}`;

  inMemoryConversations = getStoredConversations();

  // Check if conversation already exists
  let conv = inMemoryConversations.find(
    (c) =>
      c.id === canonicalId ||
      (c.client_id === clientId && c.freelancer_id === freelancerId) ||
      (c.client_id === freelancerId && c.freelancer_id === clientId)
  );

  const resolvedProfile = resolvePartyProfile(freelancerId, freelancerProfile);

  if (!conv) {
    conv = {
      id: canonicalId,
      client_id: clientId,
      freelancer_id: freelancerId,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      other_party: {
        id: freelancerId,
        display_name: resolvedProfile.display_name,
        handle: resolvedProfile.handle,
        avatar_url: resolvedProfile.avatar_url,
        role: "freelancer",
      },
      last_message: "Started conversation",
    };
    inMemoryConversations.unshift(conv);
    saveStoredConversations(inMemoryConversations);

    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = createBrowserSupabase() as any;
        await supabase.from("conversations").upsert({
          id: conv.id,
          client_id: clientId,
          freelancer_id: freelancerId,
          last_message_at: conv.last_message_at,
          created_at: conv.created_at,
        });
      } catch {}
    }
  } else {
    // Update other_party metadata with freshest known profile
    conv.other_party = {
      id: freelancerId,
      display_name: resolvedProfile.display_name,
      handle: resolvedProfile.handle,
      avatar_url: resolvedProfile.avatar_url,
      role: "freelancer",
    };
    saveStoredConversations(inMemoryConversations);
  }

  return {
    ...conv,
    other_party: {
      id: freelancerId,
      display_name: resolvedProfile.display_name,
      handle: resolvedProfile.handle,
      avatar_url: resolvedProfile.avatar_url,
      role: "freelancer",
    },
  };
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (!conversationId) return [];

  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      const { data, error } = await supabase
        .from("messages")
        .select(`*`)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        return data as Message[];
      }
    } catch {}
  }

  inMemoryMessages = getStoredMessages();
  return inMemoryMessages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<Message> {
  if (!conversationId || !senderId || !content.trim()) {
    throw new Error("Conversation ID, authenticated sender ID, and content are required.");
  }

  inMemoryMessages = getStoredMessages();
  inMemoryConversations = getStoredConversations();

  const newMessage: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversation_id: conversationId,
    sender_id: senderId,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };

  inMemoryMessages.push(newMessage);
  saveStoredMessages(inMemoryMessages);

  // Update conversation last_message_at and last_message
  const conv = inMemoryConversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.last_message_at = newMessage.created_at;
    conv.last_message = newMessage.content;
    saveStoredConversations(inMemoryConversations);
  }

  const env = getClientEnv();
  if (env.isConfigured) {
    try {
      const supabase = createBrowserSupabase() as any;
      await supabase.from("messages").insert({
        id: newMessage.id,
        conversation_id: conversationId,
        sender_id: senderId,
        content: newMessage.content,
        created_at: newMessage.created_at,
      });

      await supabase
        .from("conversations")
        .update({
          last_message_at: newMessage.created_at,
        })
        .eq("id", conversationId);
    } catch {}
  }

  return newMessage;
}
