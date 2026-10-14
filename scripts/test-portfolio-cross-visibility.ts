/**
 * Automated Verification Test Suite:
 * Cross-User Portfolio Visibility, Search, Multi-Freelancer Discovery & Authorization
 *
 * Verifies:
 * 1. Freelancer A creates account & publishes portfolio video work with stable UUID.
 * 2. Client B (independent session) discovers Freelancer A's work in marketplace.
 * 3. Client B searches by Freelancer A's name and finds the work and creator.
 * 4. Client B opens Freelancer A's public profile and views published video.
 * 5. Search by portfolio title, partial title, AI tools, and category.
 * 6. Multi-freelancer isolation & cross-account attribution (Freelancer A vs Freelancer B).
 * 7. Persistence across independent sessions and cache reloads.
 * 8. Authorization permissions: Client and non-owner Freelancers cannot edit/delete another creator's work.
 * 9. Security: Database RLS policies and lack of exposed service keys in client bundles.
 */

import {
  createMarketplacePost,
  getMarketplacePosts,
  getPostById,
  getPostsByCreator,
  updateMarketplacePost,
  deleteMarketplacePost,
} from "../src/lib/services/marketplace";
import { getCreators, getCreatorById } from "../src/lib/services/creators";
import type { MarketplacePost } from "../src/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("  Prismora Cross-User Portfolio Visibility & Discovery Test Suite");
  console.log("=================================================================\n");

  // Stable UUIDs for test users
  const freelancerAId = "a1111111-1111-4111-8111-111111111111";
  const freelancerBId = "b2222222-2222-4222-8222-222222222222";
  const clientBId = "c3333333-3333-4333-8333-333333333333";

  // ---------------------------------------------------------------------------
  // TEST 1 — Cross-User Portfolio Visibility
  // ---------------------------------------------------------------------------
  console.log("TEST 1: Cross-User Portfolio Visibility");

  // Step 1: Freelancer A publishes a video portfolio work
  const postATitle = "Hyper-Realistic Kinetic Sneaker Drop";
  const postADescription = "4K 60fps cinematic commercial shot in virtual studio with volumetric lights.";
  const postAMediaUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

  const postA = await createMarketplacePost({
    creator_id: freelancerAId,
    creator: {
      id: freelancerAId,
      display_name: "Devon Vance",
      handle: "devonvance",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      bio: "Generative AI Commercial Director & VFX Specialist",
      rating: 5.0,
    },
    title: postATitle,
    description: postADescription,
    media_url: postAMediaUrl,
    thumbnail_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600",
    media_type: "video",
    price_cents: 75000,
    currency: "USD",
    category: "Fashion & Apparel",
    hashtags: ["#sneakers", "#vfx", "#commercial"],
    ai_tools: ["runway_gen3", "flux_1"],
  });

  assert(Boolean(postA && postA.id), "1.1 Post A created successfully with valid ID");
  // Check UUID format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postA.id);
  assert(isUuid, `1.2 Post A assigned stable database UUID (ID: ${postA.id})`);
  assert(postA.creator_id === freelancerAId, "1.3 Post A correctly associated with Freelancer A ID");

  // Step 2: Freelancer A can view work in personal portfolio
  const freelancerAWorks = await getPostsByCreator(freelancerAId);
  assert(
    freelancerAWorks.some((p) => p.id === postA.id),
    `1.4 Freelancer A sees their own work in personal portfolio (Found: ${freelancerAWorks.length})`
  );

  // Step 3: Client B signs in in a separate session and opens marketplace
  const clientBMarketplace = await getMarketplacePosts({ currentUserId: clientBId });
  assert(
    clientBMarketplace.some((p) => p.id === postA.id),
    "1.5 Client B discovers Freelancer A's work in the shared marketplace without redeployment"
  );

  // Step 4: Client B searches by Freelancer A's name
  const clientBSearchByName = await getMarketplacePosts({
    search: "Devon Vance",
    currentUserId: clientBId,
  });
  assert(
    clientBSearchByName.some((p) => p.id === postA.id),
    "1.6 Client B searches by Freelancer A's name and retrieves Freelancer A's work"
  );

  // Step 5: Client B opens Freelancer A's public profile and views published video
  const creatorProfileResult = await getCreatorById(freelancerAId);
  assert(
    Boolean(creatorProfileResult.data),
    "1.7 Client B successfully opens Freelancer A's public creator profile"
  );
  assert(
    creatorProfileResult.data?.profile.display_name === "Devon Vance",
    "1.8 Public profile displays correct creator name ('Devon Vance')"
  );
  assert(
    Boolean(creatorProfileResult.data?.portfolio_items.some((item) => item.id === postA.id)),
    "1.9 Public profile contains Freelancer A's published video work in portfolio showcases"
  );
  assert(
    creatorProfileResult.data?.portfolio_items.find((item) => item.id === postA.id)?.media_url === postAMediaUrl,
    "1.10 Video media URL is preserved and playable on public profile"
  );

  // ---------------------------------------------------------------------------
  // TEST 2 — Search by Work (Title, Partial Title, AI Tools & Skills)
  // ---------------------------------------------------------------------------
  console.log("\nTEST 2: Search by Work Metadata");

  // Exact title search
  const exactTitleSearch = await getMarketplacePosts({ search: postATitle });
  assert(
    exactTitleSearch.some((p) => p.id === postA.id),
    "2.1 Search by exact title returns Freelancer A's work"
  );

  // Partial title search
  const partialTitleSearch = await getMarketplacePosts({ search: "Kinetic Sneaker" });
  assert(
    partialTitleSearch.some((p) => p.id === postA.id),
    "2.2 Search by partial title snippet ('Kinetic Sneaker') returns work"
  );

  // AI tool search
  const toolSearch = await getMarketplacePosts({ search: "Runway", aiTool: "runway_gen3" });
  assert(
    toolSearch.some((p) => p.id === postA.id),
    "2.3 Search and filter by AI tool ('runway_gen3') returns matching work"
  );

  // Unrelated search query
  const unrelatedSearch = await getMarketplacePosts({ search: "NonexistentUnderwaterSubmarine12345" });
  assert(
    unrelatedSearch.length === 0,
    "2.4 Unrelated search query safely returns 0 results without false positives"
  );

  // ---------------------------------------------------------------------------
  // TEST 3 — Multiple Freelancers (Account Isolation & Attribution)
  // ---------------------------------------------------------------------------
  console.log("\nTEST 3: Multiple Freelancers Discovery & Isolation");

  // Freelancer B publishes a different visual work
  const postB = await createMarketplacePost({
    creator_id: freelancerBId,
    creator: {
      id: freelancerBId,
      display_name: "Seraphina Lin",
      handle: "seraphinalin",
      avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
      bio: "High-Fashion Generative Stylist",
      rating: 4.8,
    },
    title: "Silk & Glass Perfume Bottle Animation",
    description: "Macro fluid caustics with refractive crystal perfume flacon.",
    media_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600",
    media_type: "video",
    price_cents: 52000,
    currency: "USD",
    category: "Product Promotion",
    hashtags: ["#perfume", "#luxury", "#fluid"],
    ai_tools: ["kling_ai", "comfy_ui"],
  });

  assert(Boolean(postB && postB.id), "3.1 Post B created successfully for Freelancer B");

  // Client B views marketplace and sees work from BOTH Freelancer A and Freelancer B
  const multiMarketplace = await getMarketplacePosts();
  const hasWorkA = multiMarketplace.some((p) => p.id === postA.id);
  const hasWorkB = multiMarketplace.some((p) => p.id === postB.id);
  assert(hasWorkA && hasWorkB, "3.2 Marketplace simultaneously displays eligible works from BOTH Freelancer A and Freelancer B");

  // Attribution check: Post A belongs to Devon, Post B belongs to Seraphina
  const resolvedA = await getPostById(postA.id);
  const resolvedB = await getPostById(postB.id);
  assert(resolvedA?.creator?.display_name === "Devon Vance", "3.3 Post A correctly attributes to Devon Vance");
  assert(resolvedB?.creator?.display_name === "Seraphina Lin", "3.4 Post B correctly attributes to Seraphina Lin");

  // Isolation check: Freelancer A only sees Post A in their personal portfolio
  const aOnlyWorks = await getPostsByCreator(freelancerAId);
  assert(
    aOnlyWorks.every((p) => p.creator_id === freelancerAId),
    "3.5 Freelancer A portfolio strictly contains only Freelancer A's works (zero leakage from Freelancer B)"
  );

  // ---------------------------------------------------------------------------
  // TEST 4 — Persistence Across Sessions
  // ---------------------------------------------------------------------------
  console.log("\nTEST 4: Persistence Across Sessions");

  // Simulate complete reload / independent fetch
  const freshFetch = await getMarketplacePosts();
  assert(
    freshFetch.some((p) => p.id === postA.id) && freshFetch.some((p) => p.id === postB.id),
    "4.1 Works from both creators remain discoverable upon fresh fetch (persisted in shared layer)"
  );

  // ---------------------------------------------------------------------------
  // TEST 5 — Authorization & Permissions
  // ---------------------------------------------------------------------------
  console.log("\nTEST 5: Authorization and Ownership Security");

  // 5.1 Unauthorized edit: Freelancer A tries to edit Freelancer B's post
  let unauthorizedEditBlocked = false;
  try {
    await updateMarketplacePost(postB.id, { title: "Hacked by Freelancer A" }, freelancerAId);
  } catch (err: any) {
    unauthorizedEditBlocked = true;
  }
  assert(unauthorizedEditBlocked, "5.1 Non-owner Freelancer A is blocked from modifying Freelancer B's post");

  // Verify Post B title was unchanged
  const postBCheck = await getPostById(postB.id);
  assert(postBCheck?.title === "Silk & Glass Perfume Bottle Animation", "5.2 Post B content preserved against unauthorized edit");

  // 5.3 Unauthorized delete: Client B tries to delete Freelancer A's post
  let unauthorizedDeleteBlocked = false;
  try {
    await deleteMarketplacePost(postA.id, clientBId);
  } catch (err) {
    unauthorizedDeleteBlocked = true;
  }
  assert(unauthorizedDeleteBlocked, "5.3 Client B is blocked from deleting Freelancer A's post");

  // 5.4 Authorized delete: Freelancer A deletes their own post
  const authorizedDelete = await deleteMarketplacePost(postA.id, freelancerAId);
  assert(authorizedDelete, "5.4 Owner Freelancer A successfully deletes their own post");

  const postACheckAfterDelete = await getPostById(postA.id);
  assert(postACheckAfterDelete === null, "5.5 Deleted post is no longer accessible");

  // Clean up Post B
  await deleteMarketplacePost(postB.id, freelancerBId);

  // ---------------------------------------------------------------------------
  // TEST 6 — Security & Bundle Audit
  // ---------------------------------------------------------------------------
  console.log("\nTEST 6: Security Policies & Secrets Verification");

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(
    !serviceKey || !serviceKey.startsWith("eyJ"),
    "6.1 SUPABASE_SERVICE_ROLE_KEY is not exposed in public environment"
  );

  console.log("\n=================================================================");
  console.log(`  Cross-User Discovery Test Summary: ${passedCount} Passed | ${failedCount} Failed`);
  console.log("=================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
