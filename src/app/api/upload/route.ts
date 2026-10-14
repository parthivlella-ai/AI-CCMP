import { NextRequest, NextResponse } from "next/server";
import { getClientEnv } from "@/lib/env";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("userId") as string) || "anonymous";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Try Supabase Storage if configured
    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = await createServerSupabase();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `${userId}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("portfolio-media")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("portfolio-media")
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            return NextResponse.json({
              success: true,
              url: urlData.publicUrl,
              storage: "supabase",
            });
          }
        }
      } catch (err) {
        console.warn("[Upload API] Supabase storage upload failed, falling back to local storage:", err);
      }
    }

    // 2. Local public file fallback for cross-browser accessibility
    try {
      const publicUploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(publicUploadsDir)) {
        fs.mkdirSync(publicUploadsDir, { recursive: true });
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${Date.now()}_${safeName}`;
      const filePath = path.join(publicUploadsDir, filename);

      fs.writeFileSync(filePath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/${filename}`,
        storage: "local-public",
      });
    } catch (fsErr) {
      // In read-only serverless environment where filesystem cannot be written:
      const base64 = buffer.toString("base64");
      const mime = file.type || "video/mp4";
      return NextResponse.json({
        success: true,
        url: `data:${mime};base64,${base64}`,
        storage: "inline",
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process upload" },
      { status: 500 }
    );
  }
}
