import { NextResponse } from "next/server";
import { RegionCodeSchema, type RegionCode } from "@sylvia/core";
import { runSprout } from "@/server/sprout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** POST multipart: `image` (JPEG/PNG/WebP, ≤4 MB, EXIF stripped by the app) and `region` (e.g. CA-ON). */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => undefined);
  const image = form?.get("image");
  const region = RegionCodeSchema.safeParse(form?.get("region"));
  if (!(image instanceof Blob) || !region.success) {
    return NextResponse.json({ error: "Send a photo and a region code like CA-ON." }, { status: 400 });
  }
  if (!TYPES.includes(image.type) || image.size > MAX_BYTES) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo under 4 MB." }, { status: 400 });
  }
  try {
    return NextResponse.json(await runSprout(image, region.data as RegionCode));
  } catch (e) {
    console.error("Sprout failed", e);
    return NextResponse.json({ error: "I couldn't check that photo right now. Please try again in a minute." }, { status: 502 });
  }
}
