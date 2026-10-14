import { NextRequest, NextResponse } from "next/server";
import { getCreators, getCreatorById } from "@/lib/services/creators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const query = searchParams.get("query") || undefined;
    const specialization = searchParams.get("specialization") || undefined;
    const aiTool = searchParams.get("aiTool") || undefined;
    const contentType = searchParams.get("contentType") || undefined;
    const availabilityOnly = searchParams.get("availabilityOnly") === "true";

    if (id) {
      const result = await getCreatorById(id);
      if (!result.data) {
        return NextResponse.json({ error: "Creator not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, creator: result.data });
    }

    const result = await getCreators({
      query,
      specialization: specialization === "all" ? undefined : specialization,
      aiTool: aiTool === "all" ? undefined : aiTool,
      contentType: contentType === "all" ? undefined : contentType,
      availabilityOnly,
    });

    return NextResponse.json({
      success: true,
      creators: result.data,
      isMock: result.isMock,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch creators" },
      { status: 500 }
    );
  }
}
