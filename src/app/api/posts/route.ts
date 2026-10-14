import { NextRequest, NextResponse } from "next/server";
import { getClientEnv } from "@/lib/env";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getSharedPosts, addSharedPost, updateSharedPost, deleteSharedPost } from "@/lib/data/shared-posts";
import type { MarketplacePost } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "All";
    const hashtag = searchParams.get("hashtag") || "all";
    const mediaType = searchParams.get("mediaType") || "all";
    const aiTool = searchParams.get("aiTool") || "all";
    const maxPrice = Number(searchParams.get("maxPrice")) || 0;
    const creatorId = searchParams.get("creatorId") || "";

    const env = getClientEnv();
    let posts: MarketplacePost[] = [];

    // 1. Fetch from Supabase if configured
    if (env.isConfigured) {
      try {
        const supabase = (await createServerSupabase()) as any;
        let query = supabase
          .from("posts")
          .select(`
            *,
            creator:profiles(*)
          `)
          .order("created_at", { ascending: false });

        if (creatorId) {
          query = query.eq("creator_id", creatorId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          posts = data as unknown as MarketplacePost[];
        }
      } catch (err) {
        console.warn("[Posts API] Supabase query fallback to shared store:", err);
      }
    }

    // 2. Combine with / fallback to shared server store
    const shared = getSharedPosts();
    if (posts.length === 0) {
      posts = shared;
    } else {
      // Merge any shared posts that are not yet in Supabase
      const existingIds = new Set(posts.map((p) => p.id));
      for (const sp of shared) {
        if (!existingIds.has(sp.id)) {
          if (!creatorId || sp.creator_id === creatorId) {
            posts.push(sp);
          }
        }
      }
    }

    // 3. Filter by creator if specified
    if (creatorId) {
      posts = posts.filter((p) => p.creator_id === creatorId);
    }

    // 4. Search Filter (Title, description, category, hashtags, AI tools, creator name, handle)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
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

    // 5. Category Filter
    if (category !== "All") {
      posts = posts.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    // 6. Hashtag Filter
    if (hashtag !== "all") {
      const targetTag = hashtag.startsWith("#") ? hashtag.toLowerCase() : `#${hashtag.toLowerCase()}`;
      posts = posts.filter((p) =>
        p.hashtags.some((h) => h.toLowerCase() === targetTag)
      );
    }

    // 7. Media Type Filter
    if (mediaType !== "all") {
      posts = posts.filter((p) => p.media_type === mediaType);
    }

    // 8. AI Tool Filter
    if (aiTool !== "all") {
      posts = posts.filter((p) => p.ai_tools.includes(aiTool));
    }

    // 9. Price Filter
    if (maxPrice > 0) {
      posts = posts.filter((p) => p.price_cents <= maxPrice * 100);
    }

    return NextResponse.json({ success: true, posts });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      creator_id,
      creator,
      title,
      description,
      media_url,
      thumbnail_url,
      media_type = "video",
      price_cents = 45000,
      currency = "USD",
      category = "Advertising & Commercials",
      hashtags = [],
      ai_tools = [],
    } = body;

    if (!creator_id) {
      return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
    }
    if (!title || title.trim().length < 3) {
      return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
    }
    if (!media_url) {
      return NextResponse.json({ error: "media_url is required" }, { status: 400 });
    }

    // Generate guaranteed valid UUID for database integrity
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newPost: MarketplacePost = {
      id: postId,
      creator_id,
      creator: creator || {
        id: creator_id,
        display_name: "AI Creator",
        handle: "creator",
        bio: "Verified AI Content Creator",
        rating: 5.0,
      },
      title: title.trim(),
      description: description?.trim() || "",
      media_url,
      thumbnail_url: thumbnail_url || (media_type === "image" ? media_url : undefined),
      media_type,
      price_cents: Number(price_cents) || 0,
      currency,
      category,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      ai_tools: Array.isArray(ai_tools) ? ai_tools : [],
      likes_count: 0,
      created_at: now,
      updated_at: now,
    };

    // 1. Persist to Supabase if configured
    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = (await createServerSupabase()) as any;

        // Check if creator profile exists, upsert to satisfy foreign key
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creator_id);
        if (isUuid) {
          await supabase.from("profiles").upsert({
            id: creator_id,
            display_name: newPost.creator?.display_name || "Creator",
            full_name: newPost.creator?.display_name || "Creator",
            handle: newPost.creator?.handle || `creator_${creator_id.slice(0, 8)}`,
            account_type: "freelancer",
            role: "creator",
          });

          await supabase.from("creator_profiles").upsert({
            id: creator_id,
            tagline: newPost.description?.slice(0, 100) || "AI Creator",
            primary_ai_tools: newPost.ai_tools,
            specializations: [newPost.category ? newPost.category.toLowerCase().replace(/[^a-z0-9]/g, "_") : "cinematic_video"],
            starting_rate_cents: newPost.price_cents,
            currency: newPost.currency,
            verification_status: "verified",
            is_available: true,
          });

          // Insert into posts
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
            console.warn("[Posts API] Supabase posts insert error:", postError.message);
          }

          // Insert into portfolio_items for public profile & matcher evidence
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
      } catch (dbErr) {
        console.warn("[Posts API] Error during Supabase synchronization:", dbErr);
      }
    }

    // 2. Persist to shared server store
    addSharedPost(newPost);

    return NextResponse.json({ success: true, post: newPost });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create post" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json({ error: "id and userId are required" }, { status: 400 });
    }

    const posts = getSharedPosts();
    const existing = posts.find((p) => p.id === id);

    // Permission check
    if (existing && existing.creator_id !== userId) {
      return NextResponse.json({ error: "Unauthorized: You do not own this post." }, { status: 403 });
    }

    // 1. Delete from Supabase if configured
    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = (await createServerSupabase()) as any;
        await supabase.from("posts").delete().eq("id", id).eq("creator_id", userId);
        await supabase.from("portfolio_items").delete().eq("id", id).eq("creator_id", userId);
      } catch {}
    }

    // 2. Delete from shared store
    deleteSharedPost(id);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete post" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId, ...updates } = body;

    if (!id || !userId) {
      return NextResponse.json({ error: "id and userId are required" }, { status: 400 });
    }

    const posts = getSharedPosts();
    const existing = posts.find((p) => p.id === id);

    if (existing && existing.creator_id !== userId) {
      return NextResponse.json({ error: "Unauthorized: You do not own this post." }, { status: 403 });
    }

    // 1. Update in Supabase if configured
    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = (await createServerSupabase()) as any;
        await supabase.from("posts").update(updates).eq("id", id).eq("creator_id", userId);
        if (updates.title || updates.description || updates.media_url) {
          await supabase.from("portfolio_items").update({
            title: updates.title,
            description: updates.description,
            media_url: updates.media_url,
            thumbnail_url: updates.thumbnail_url,
          }).eq("id", id).eq("creator_id", userId);
        }
      } catch {}
    }

    // 2. Update in shared store
    const updated = updateSharedPost(id, updates);

    return NextResponse.json({ success: true, post: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update post" },
      { status: 500 }
    );
  }
}
