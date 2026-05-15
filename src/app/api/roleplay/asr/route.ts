import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json();

    if (!audio) {
      return NextResponse.json({ error: "Audio data is required" }, { status: 400 });
    }

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.audio.asr.create({
      file_base64: audio,
    });

    return NextResponse.json({
      success: true,
      text: response.text || "",
    });
  } catch (error) {
    console.error("[asr] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech recognition failed" },
      { status: 500 }
    );
  }
}
