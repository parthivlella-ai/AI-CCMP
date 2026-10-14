"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Film,
  Image as ImageIcon,
  DollarSign,
  Tag,
  Eye,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createMarketplacePost } from "@/lib/services/marketplace";
import { MARKETPLACE_CATEGORIES, SUPPORTED_AI_TOOLS } from "@/types";

export default function NewPostPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState<"video" | "image">("video");
  const [mediaUrl, setMediaUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [customCoverUrl, setCustomCoverUrl] = useState("");
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [price, setPrice] = useState("450");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState("Advertising & Commercials");
  const [hashtagsInput, setHashtagsInput] = useState("#cinematic, #commercial, #product");
  const [selectedTools, setSelectedTools] = useState<string[]>(["runway_gen3", "flux_1"]);

  // Upload Simulation / File Handling
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Status
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Handle local file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 50MB
    if (file.size > 50 * 1024 * 1024) {
      setErrors({ media: "File size exceeds 50MB limit." });
      return;
    }

    setUploadFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaUrl(objectUrl);

    // If small file, read as dataURL for persistent session reload
    if (file.size < 6 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setMediaUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }

    if (file.type.startsWith("video") || file.name.endsWith(".mp4") || file.name.endsWith(".webm")) {
      setMediaType("video");
      setIsGeneratingThumb(true);

      // Safe client-side video frame capture for authentic thumbnail
      try {
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        tempVideo.src = objectUrl;
        tempVideo.muted = true;
        tempVideo.playsInline = true;

        tempVideo.onloadeddata = () => {
          tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
        };

        tempVideo.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            // Standard small canvas size to prevent localStorage quota exhaustion
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(tempVideo, 0, 0, 480, 270);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
              setThumbnailUrl(dataUrl);
            }
          } catch {
            // Canvas security or codec fallback: leave thumbnail empty so native video poster is used
          } finally {
            setIsGeneratingThumb(false);
          }
        };

        tempVideo.onerror = () => {
          setIsGeneratingThumb(false);
        };
      } catch {
        setIsGeneratingThumb(false);
      }
    } else {
      setMediaType("image");
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setThumbnailUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }

    // Simulate upload progress
    setUploadProgress(20);
    setTimeout(() => setUploadProgress(65), 200);
    setTimeout(() => {
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 500);
    }, 500);
  }

  function handleCoverFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomCoverUrl(reader.result);
        setThumbnailUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function toggleTool(toolId: string) {
    if (selectedTools.includes(toolId)) {
      setSelectedTools(selectedTools.filter((t) => t !== toolId));
    } else {
      setSelectedTools([...selectedTools, toolId]);
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!title.trim() || title.length < 3) errs.title = "Title is required (min 3 characters).";
    if (!description.trim() || description.length < 10) errs.description = "Description is required (min 10 characters).";
    if (!mediaUrl.trim()) errs.media = "Please upload or specify a video or image URL.";
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) errs.price = "Price must be a positive number.";
    if (selectedTools.length === 0) errs.tools = "Select at least one AI tool used.";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const parsedHashtags = hashtagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

    if (!user || user.role !== "freelancer") {
      setErrors({ auth: "You must be signed in as a freelancer to upload work." });
      setIsSubmitting(false);
      return;
    }

    const creatorId = user.id;
    const creatorDisplay = user.display_name || user.full_name || "Creator";
    const creatorHandle = user.handle || "creator";

    let finalMediaUrl = mediaUrl;
    let finalThumbnailUrl = thumbnailUrl || (mediaType === "image" ? mediaUrl : undefined);

    if (uploadFile) {
      try {
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("userId", creatorId);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          if (uploadJson.url) {
            finalMediaUrl = uploadJson.url;
            if (mediaType === "image") {
              finalThumbnailUrl = uploadJson.url;
            }
          }
        }
      } catch (uploadErr) {
        console.warn("[Upload] Server upload fallback:", uploadErr);
      }
    }

    try {
      const newPost = await createMarketplacePost({
        creator_id: creatorId,
        creator: {
          id: creatorId,
          display_name: creatorDisplay,
          handle: creatorHandle,
          avatar_url: user.avatar_url,
          bio: user.bio || "Verified AI Content Creator",
          rating: 5.0,
        },
        title: title.trim(),
        description: description.trim(),
        media_url: finalMediaUrl,
        thumbnail_url: finalThumbnailUrl,
        media_type: mediaType,
        price_cents: Math.round(parseFloat(price) * 100),
        currency,
        category,
        hashtags: parsedHashtags,
        ai_tools: selectedTools,
      });

      setIsSubmitting(false);
      setSuccess(true);

      setTimeout(() => {
        router.push("/portfolio");
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrors({ submit: err.message || "Failed to publish post. Please try again." });
    }
  }

  if (authLoading) {
    return (
      <div className="flex-1 w-full bg-[#0b0914] min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="w-8 h-8 text-[#9d7bf5] animate-pulse" />
          <p className="text-xs font-mono text-[#9b92b6]">Verifying creator permissions...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "freelancer") {
    return (
      <div className="flex-1 w-full bg-[#0b0914] min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-[#271f43] bg-[#140f26] p-8 text-center">
          <Film className="w-10 h-10 text-[#7e749e] mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Freelancer Studio Required</h2>
          <p className="text-xs text-[#9b92b6] mt-2 leading-relaxed">
            Uploading and publishing work to the marketplace is exclusively available to authenticated creator accounts.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2 rounded-full bg-[#9d7bf5] text-[#0b0914] text-xs font-bold"
            >
              Sign In as Creator
            </Link>
            <Link
              href="/marketplace"
              className="px-5 py-2 rounded-full bg-[#1e163b] text-[#c4b5fd] text-xs font-medium border border-[#3b2d66]"
            >
              Browse Works
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#0b0914] min-h-[calc(100vh-4rem)] py-8 md:py-12 px-6">
      <div className="max-w-6xl mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 text-xs font-mono tracking-wider uppercase font-semibold text-[#8c82ab] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO MY PORTFOLIO
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Upload Your AI Work
          </h1>
          <p className="mt-1 text-sm text-[#9b92b6]">
            Showcase your generative visuals to brands and agencies ready to commission custom commercial work.
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Work published successfully!</p>
              <p className="text-xs text-emerald-300/80">
                Your post is now live in the marketplace feed. Redirecting to your portfolio...
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form (7 cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
            
            {/* 1. Title */}
            <div className="rounded-2xl border border-[#271f43] bg-[#140f26] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Work Details</h3>
              
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] block mb-1.5 font-medium">
                  Work Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Liquid Gold Watch Commercial / High-Speed Hyperlapse"
                  className="w-full px-4 py-3 rounded-xl bg-[#0b0914] border border-[#271f43] text-sm text-white placeholder-[#7e749e] focus:outline-none focus:border-[#9d7bf5] transition-colors"
                />
                {errors.title && <p className="text-xs text-rose-400 mt-1">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] block mb-1.5 font-medium">
                  Description *
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the creative execution, camera angles, color grading, and commercial readiness..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0b0914] border border-[#271f43] text-sm text-white placeholder-[#7e749e] focus:outline-none focus:border-[#9d7bf5] transition-colors resize-none"
                />
                {errors.description && <p className="text-xs text-rose-400 mt-1">{errors.description}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] block mb-1.5 font-medium">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0b0914] border border-[#271f43] text-sm text-white focus:outline-none focus:border-[#9d7bf5] transition-colors"
                >
                  {MARKETPLACE_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <option key={cat} value={cat} className="bg-[#140f26] text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Media Upload / URL */}
            <div className="rounded-2xl border border-[#271f43] bg-[#140f26] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Media & Asset</h3>

              {/* Media Type Switcher */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMediaType("video")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    mediaType === "video"
                      ? "bg-[#281e4a] text-white border border-[#9d7bf5]"
                      : "bg-[#0b0914] text-[#8c82ab] border border-[#271f43]"
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                  Video Commercial (.mp4)
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType("image")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    mediaType === "image"
                      ? "bg-[#281e4a] text-white border border-[#9d7bf5]"
                      : "bg-[#0b0914] text-[#8c82ab] border border-[#271f43]"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  Keyframe Image
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-[#2f2452] rounded-2xl p-6 text-center bg-[#0b0914]/50 hover:bg-[#140f26] transition-colors relative">
                <input
                  type="file"
                  accept={mediaType === "video" ? "video/mp4,video/webm" : "image/*"}
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-[#9d7bf5] mx-auto mb-2 pointer-events-none" />
                <p className="text-sm font-semibold text-white pointer-events-none">
                  {uploadFile ? uploadFile.name : "Click to select or drop your file here"}
                </p>
                <p className="text-xs text-[#7e749e] mt-1 pointer-events-none">
                  MP4, WebM, PNG, JPG up to 50MB
                </p>
              </div>

              {uploadProgress !== null && (
                <div className="w-full bg-[#1b1433] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#9d7bf5] h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Direct Media URL Alternative */}
              <div>
                <label className="text-[11px] font-mono text-[#7e749e] block mb-1">
                  Or provide direct media URL:
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value);
                    if (mediaType === "image" && !thumbnailUrl) {
                      setThumbnailUrl(e.target.value);
                    }
                  }}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0b0914] border border-[#271f43] text-xs text-white placeholder-[#7e749e] focus:outline-none focus:border-[#9d7bf5] transition-colors font-mono"
                />
                {errors.media && <p className="text-xs text-rose-400 mt-1">{errors.media}</p>}
              </div>

              {/* Optional Cover Image / Video Thumbnail */}
              {mediaType === "video" && (
                <div className="pt-3 border-t border-[#201838] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] font-medium">
                      Video Cover Thumbnail
                    </label>
                    {isGeneratingThumb && (
                      <span className="text-[10px] font-mono text-[#9d7bf5] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Capturing frame...
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {thumbnailUrl ? (
                      <div className="relative w-28 aspect-video rounded-xl overflow-hidden border border-[#3b2d66] bg-black shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnailUrl}
                          alt="Cover preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-28 aspect-video rounded-xl border border-dashed border-[#2f2452] bg-[#0b0914] flex items-center justify-center text-[10px] font-mono text-[#7e749e] shrink-0">
                        Auto-capture
                      </div>
                    )}

                    <div className="flex-1 space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b1433] hover:bg-[#251b47] border border-[#3b2d66] text-xs font-semibold text-[#c4b5fd] cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Custom Cover</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverFileSelect}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-[#7e749e]">
                        A representative frame is automatically captured from your video, or you can upload a custom cover.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Pricing, Tools & Hashtags */}
            <div className="rounded-2xl border border-[#271f43] bg-[#140f26] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Pricing & Technology</h3>

              {/* Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] block mb-1.5 font-medium">
                    Expected Price ($ USD) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-[#7e749e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min="50"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="450"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0b0914] border border-[#271f43] text-sm text-white placeholder-[#7e749e] focus:outline-none focus:border-[#9d7bf5] transition-colors"
                    />
                  </div>
                  {errors.price && <p className="text-xs text-rose-400 mt-1">{errors.price}</p>}
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] block mb-1.5 font-medium">
                    Relevant Hashtags
                  </label>
                  <input
                    type="text"
                    value={hashtagsInput}
                    onChange={(e) => setHashtagsInput(e.target.value)}
                    placeholder="#cinematic, #sneakers, #food"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-[#271f43] text-sm text-white placeholder-[#7e749e] focus:outline-none focus:border-[#9d7bf5] transition-colors"
                  />
                </div>
              </div>

              {/* AI Tools Selection */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#9b92b6] block mb-2 font-medium">
                  AI Technologies Used *
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_AI_TOOLS.map((tool) => {
                    const isSelected = selectedTools.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-[#9d7bf5] text-[#0b0914] font-bold shadow-sm"
                            : "bg-[#0b0914] text-[#8c82ab] border border-[#271f43] hover:text-white"
                        }`}
                      >
                        {tool.name}
                      </button>
                    );
                  })}
                </div>
                {errors.tools && <p className="text-xs text-rose-400 mt-1">{errors.tools}</p>}
              </div>
            </div>

            {/* Publish CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl bg-[#9d7bf5] hover:bg-[#b094fa] disabled:opacity-50 text-[#0b0914] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#9d7bf5]/25"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing Work...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Publish to Marketplace
                </>
              )}
            </button>
          </form>

          {/* Right Live Preview Card (5 cols) */}
          <div className="lg:col-span-5 sticky top-24 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#9b92b6]">
              <Eye className="w-3.5 h-3.5 text-[#9d7bf5]" />
              Live Marketplace Card Preview
            </div>

            {/* Preview Card */}
            <div className="rounded-2xl border border-[#261e40] bg-[#140f26] overflow-hidden shadow-2xl">
              <div className="relative bg-black aspect-video overflow-hidden flex items-center justify-center">
                {mediaType === "video" && mediaUrl ? (
                  <video
                    src={mediaUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : mediaUrl ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={mediaUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-[#7e749e]">No media selected</div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white border border-white/10 uppercase">
                    {mediaType}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-medium text-[#c4b5fd]">
                    {category}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h4 className="font-bold text-base text-white line-clamp-1">
                    {title || "Untitled Work"}
                  </h4>
                  <p className="text-xs text-[#9b92b6] line-clamp-2 mt-1">
                    {description || "Your work description will appear here."}
                  </p>
                </div>

                {/* Hashtags preview */}
                <div className="flex flex-wrap gap-1">
                  {hashtagsInput
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-mono text-[#a89ec4] bg-[#0b0914] px-1.5 py-0.5 rounded border border-[#271f43]"
                      >
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                </div>

                <div className="pt-3 border-t border-[#221a3b] flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-[#7e749e] block">
                      STARTING AT
                    </span>
                    <span className="text-base font-extrabold text-white">
                      ${price || "0"}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    Live Preview
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
