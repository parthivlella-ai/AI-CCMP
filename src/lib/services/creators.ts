/**
 * Creator Profile & AI Portfolio Data Access & Filtering Service
 *
 * Implements persistent database access via Supabase with transparent
 * fallback to seed demonstration data and shared server posts, plus
 * multi-dimensional search and filtering engine.
 */

import { getClientEnv } from "../env";
import { createClient as createServerSupabase } from "../supabase/server";
import { SEED_CREATORS } from "../data/seed-creators";
import { INITIAL_POSTS } from "../data/seed-posts";
import { filterCreators, type CreatorFilterCriteria } from "../filters/creators";
import { getSharedPosts } from "../data/shared-posts";
import type { CreatorWithDetails, PortfolioItemRow, MarketplacePost } from "../../types";

export type { CreatorFilterCriteria };
export { filterCreators };

export interface CreatorFetchResult<T> {
  data: T;
  isMock: boolean;
  error?: string | null;
}

function convertPostToPortfolioItem(post: MarketplacePost): PortfolioItemRow {
  return {
    id: post.id,
    creator_id: post.creator_id,
    title: post.title,
    description: post.description || null,
    content_type: (post.media_type === "video" ? "video" : "image") as any,
    media_url: post.media_url,
    thumbnail_url: post.thumbnail_url || null,
    aspect_ratio: "16:9",
    ai_tools_used: post.ai_tools || [],
    generation_parameters: {},
    workflow_breakdown: post.workflow || null,
    commercial_rights_granted: "full_buyout",
    is_featured: true,
    view_count: post.likes_count || 0,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

/**
 * Fetches all creator profiles along with their user profile and portfolio items.
 * Seamlessly integrates dynamically registered creators and their uploaded portfolio works.
 */
export async function getCreators(
  criteria?: CreatorFilterCriteria
): Promise<CreatorFetchResult<CreatorWithDetails[]>> {
  const env = getClientEnv();
  let creators: CreatorWithDetails[] = [];
  let isMock = true;

  if (env.isConfigured) {
    try {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase
        .from("creator_profiles")
        .select(`
          *,
          profile:profiles(*),
          portfolio_items(*),
          verifications:creator_verifications(*)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[Prismora] Supabase query failed, falling back to seed data:", error.message);
      } else if (data && data.length > 0) {
        creators = data as unknown as CreatorWithDetails[];
        isMock = false;
      }
    } catch (err) {
      console.warn("[Prismora] Unexpected Supabase error, falling back to seed data:", err);
    }
  }

  // Fallback to demonstration seed data if Supabase unconfigured or query returned empty
  if (creators.length === 0) {
    creators = [...SEED_CREATORS];
  }

function matchesCreator(creator: CreatorWithDetails, post: MarketplacePost): boolean {
  if (post.creator_id === creator.id || post.creator_id === creator.profile.id) return true;
  if (post.creator?.handle && post.creator.handle.toLowerCase() === creator.profile.handle.toLowerCase()) return true;
  const cId = post.creator_id.toLowerCase();
  const handle = creator.profile.handle.toLowerCase();
  if (cId.includes("elena") && handle === "aetheris") return true;
  return false;
}

  // Integrate dynamically published works from real users
  const sharedPosts = getSharedPosts();
  const initialPostIds = new Set(INITIAL_POSTS.map((p) => p.id));
  const dynamicPosts = sharedPosts.filter((p) => !initialPostIds.has(p.id));

  const knownCreatorIds = new Set<string>();

  creators = creators.map((creator) => {
    knownCreatorIds.add(creator.id);
    knownCreatorIds.add(creator.profile.id);

    // Merge any new dynamic posts published by this creator
    const creatorPosts = dynamicPosts.filter((p) => matchesCreator(creator, p));
    for (const p of creatorPosts) {
      knownCreatorIds.add(p.creator_id);
    }

    if (creatorPosts.length === 0) return creator;

    const existingItemIds = new Set(creator.portfolio_items.map((item) => item.id));
    const newItems = creatorPosts
      .filter((p) => !existingItemIds.has(p.id))
      .map(convertPostToPortfolioItem);

    return {
      ...creator,
      portfolio_items: [...newItems, ...creator.portfolio_items],
    };
  });

  // Synthesize entries for dynamically registered creators who have published posts
  const dynamicCreatorsMap = new Map<string, MarketplacePost[]>();
  for (const post of dynamicPosts) {
    if (!knownCreatorIds.has(post.creator_id)) {
      if (!dynamicCreatorsMap.has(post.creator_id)) {
        dynamicCreatorsMap.set(post.creator_id, []);
      }
      dynamicCreatorsMap.get(post.creator_id)!.push(post);
    }
  }

  for (const [creatorId, posts] of Array.from(dynamicCreatorsMap.entries())) {
    const primaryPost = posts[0];
    const creatorName = primaryPost.creator?.display_name || "Creator";
    const creatorHandle = primaryPost.creator?.handle || `creator_${creatorId.slice(0, 8)}`;
    const avatarUrl = primaryPost.creator?.avatar_url;
    const bio = primaryPost.creator?.bio || "Verified AI Content Creator";

    const allTools = Array.from(new Set(posts.flatMap((p) => p.ai_tools || [])));
    const allCategories = Array.from(
      new Set(
        posts.map((p) =>
          p.category ? p.category.toLowerCase().replace(/[^a-z0-9]/g, "_") : "cinematic_video"
        )
      )
    );

    const dynamicCreator: CreatorWithDetails = {
      id: creatorId,
      tagline: primaryPost.description || bio,
      specializations: allCategories.length > 0 ? allCategories : ["cinematic_video"],
      primary_ai_tools: allTools.length > 0 ? allTools : ["runway_gen3"],
      custom_workflow_summary: primaryPost.workflow || "Advanced Generative AI Pipeline",
      hardware_specs: "Dedicated GPU Studio Rig",
      commercial_terms: primaryPost.commercial_license || "Commercial advertising rights included",
      starting_rate_cents: primaryPost.price_cents || 45000,
      currency: primaryPost.currency || "USD",
      verification_status: "verified",
      is_available: true,
      created_at: primaryPost.created_at,
      updated_at: primaryPost.updated_at,
      profile: {
        id: creatorId,
        role: "creator",
        full_name: creatorName,
        display_name: creatorName,
        handle: creatorHandle,
        avatar_url: avatarUrl || null,
        bio,
        location: "Global",
        website_url: "",
        created_at: primaryPost.created_at,
        updated_at: primaryPost.updated_at,
      },
      portfolio_items: posts.map(convertPostToPortfolioItem),
    };

    creators.push(dynamicCreator);
    knownCreatorIds.add(creatorId);
  }

  // Apply filters if criteria provided
  if (criteria) {
    creators = filterCreators(creators, criteria);
  }

  return {
    data: creators,
    isMock,
  };
}

/**
 * Fetches a single creator profile by ID or handle with full portfolio items.
 */
export async function getCreatorById(
  idOrHandle: string
): Promise<CreatorFetchResult<CreatorWithDetails | null>> {
  const env = getClientEnv();
  const cleanIdOrHandle = idOrHandle.toLowerCase().trim();

  let creator: CreatorWithDetails | null = null;
  let isMock = true;

  if (env.isConfigured) {
    try {
      const supabase = await createServerSupabase();

      // Check if parameter is UUID or handle
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrHandle
      );

      let query = supabase
        .from("creator_profiles")
        .select(`
          *,
          profile:profiles(*),
          portfolio_items(*),
          verifications:creator_verifications(*)
        `);

      if (isUuid) {
        query = query.eq("id", idOrHandle);
      } else {
        query = query.eq("profile.handle", idOrHandle);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        creator = data as unknown as CreatorWithDetails;
        isMock = false;
      }
    } catch (err) {
      console.warn("[Prismora] Unexpected Supabase lookup error:", err);
    }
  }

  // Fallback lookup in demonstration seed data
  if (!creator) {
    const matchedSeed = SEED_CREATORS.find(
      (c) =>
        c.id.toLowerCase() === cleanIdOrHandle ||
        c.profile.id.toLowerCase() === cleanIdOrHandle ||
        c.profile.handle.toLowerCase() === cleanIdOrHandle ||
        (cleanIdOrHandle.includes("elena") && c.profile.handle === "aetheris") ||
        (cleanIdOrHandle.includes("marcus") && (c.profile.handle === "horizonfilms" || c.profile.handle === "sonicaether")) ||
        (cleanIdOrHandle.includes("chloe") && (c.profile.handle === "synthcraft" || c.profile.handle === "voxelforge")) ||
        (cleanIdOrHandle.includes("kai") && (c.profile.handle === "tanakavfx" || c.profile.handle === "voxelsurge"))
    );
    if (matchedSeed) {
      creator = {
        ...matchedSeed,
        id: (cleanIdOrHandle.startsWith("usr-") || cleanIdOrHandle.includes("-")) ? idOrHandle : matchedSeed.id,
      };
    }
  }

  // Lookup in shared posts store (covers dynamically created creators)
  const sharedPosts = getSharedPosts();
  const creatorPosts = sharedPosts.filter(
    (p) =>
      p.creator_id.toLowerCase() === cleanIdOrHandle ||
      p.creator?.id?.toLowerCase() === cleanIdOrHandle ||
      p.creator?.handle?.toLowerCase() === cleanIdOrHandle
  );

  if (!creator && creatorPosts.length > 0) {
    const primaryPost = creatorPosts[0];
    const creatorName = primaryPost.creator?.display_name || "Creator";
    const creatorHandle = primaryPost.creator?.handle || `creator_${primaryPost.creator_id.slice(0, 8)}`;

    creator = {
      id: primaryPost.creator_id,
      tagline: primaryPost.description || "Verified AI Content Creator",
      specializations: ["cinematic_video", "product_render"],
      primary_ai_tools: primaryPost.ai_tools || ["runway_gen3"],
      custom_workflow_summary: primaryPost.workflow || "Advanced Generative AI Pipeline",
      hardware_specs: "Dedicated GPU Workstation",
      commercial_terms: primaryPost.commercial_license || "Commercial rights included",
      starting_rate_cents: primaryPost.price_cents || 45000,
      currency: primaryPost.currency || "USD",
      verification_status: "verified",
      is_available: true,
      created_at: primaryPost.created_at,
      updated_at: primaryPost.updated_at,
      profile: {
        id: primaryPost.creator_id,
        role: "creator",
        full_name: creatorName,
        display_name: creatorName,
        handle: creatorHandle,
        avatar_url: primaryPost.creator?.avatar_url || null,
        bio: primaryPost.creator?.bio || "Commercial generative director",
        location: "Global",
        website_url: "",
        created_at: primaryPost.created_at,
        updated_at: primaryPost.updated_at,
      },
      portfolio_items: [],
    };
  }

  // If creator found, merge in any newly uploaded shared posts
  if (creator) {
    const matchingPosts = sharedPosts.filter(
      (p) => p.creator_id === creator!.id || p.creator_id === creator!.profile.id
    );
    const existingItemIds = new Set(creator.portfolio_items.map((i) => i.id));
    const extraItems = matchingPosts
      .filter((p) => !existingItemIds.has(p.id))
      .map(convertPostToPortfolioItem);

    creator = {
      ...creator,
      portfolio_items: [...extraItems, ...creator.portfolio_items],
    };
  }

  return {
    data: creator,
    isMock,
  };
}
