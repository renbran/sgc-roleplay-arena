import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const persona = searchParams.get("persona") || "p1_faisal";

    const livekitUrl = process.env.LIVEKIT_URL?.trim();
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    const enableDispatch = process.env.LIVEKIT_ENABLE_DISPATCH?.trim() === "true";
    const agentName = process.env.LIVEKIT_AGENT_NAME?.trim() || "test-agent";

    if (!livekitUrl || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured", code: "MISSING_CREDENTIALS" },
        { status: 500 }
      );
    }

    // Validate URL format
    if (!livekitUrl.startsWith("wss://") && !livekitUrl.startsWith("ws://")) {
      return NextResponse.json(
        { error: "LIVEKIT_URL must start with wss:// or ws://", code: "INVALID_URL" },
        { status: 500 }
      );
    }

    // Sanitize persona ID (alphanumeric + underscore only)
    const sanitizedPersona = persona.replace(/[^a-zA-Z0-9_]/g, "");
    if (!sanitizedPersona) {
      return NextResponse.json(
        { error: "Invalid persona ID", code: "INVALID_PERSONA" },
        { status: 400 }
      );
    }

    // Generate unique room and identity
    const roomName = `roleplay-${sanitizedPersona}-${crypto.randomUUID().slice(0, 8)}`;
    const identity = `user-${crypto.randomUUID().slice(0, 8)}`;

    // Create LiveKit token
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      metadata: JSON.stringify({ persona: sanitizedPersona }),
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    // Create session record
    const session = await db.session.create({
      data: {
        personaId: sanitizedPersona,
        roomName,
        identity,
        status: "pending",
      },
    });

    // Attempt agent dispatch
    let dispatchId: string | null = null;
    let dispatchCreated = false;
    let dispatchError: string | null = null;

    if (enableDispatch) {
      try {
        const { AgentDispatchClient } = await import("livekit-server-sdk");

        const dispatchClient = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
        // createDispatch positional args: (room, agentName, metadata)
        // Use empty agentName to match the default worker registration
        const dispatch = await dispatchClient.createDispatch(
          roomName,
          "",
          JSON.stringify({
            persona: sanitizedPersona,
            user_identity: identity,
          }),
        );

        dispatchId = dispatch.id || dispatch.dispatchId || null;
        dispatchCreated = true;

        // Update session status
        await db.session.update({
          where: { id: session.id },
          data: { status: "active" },
        });
      } catch (err: unknown) {
        dispatchError = err instanceof Error ? err.message : "Dispatch failed";
        console.error("[roleplay-token] Dispatch error:", dispatchError);

        await db.session.update({
          where: { id: session.id },
          data: { status: "pending" },
        });
      }
    }

    const response = {
      wsUrl: livekitUrl,
      room: roomName,
      identity,
      token: jwt,
      expiresIn: "15m",
      sessionId: session.id,
      persona: sanitizedPersona,
      dispatch: {
        dispatchId,
        dispatchCreated,
        dispatchError,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("[roleplay-token] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate session token",
        detail: error instanceof Error ? error.message : "Unknown error",
        code: "TOKEN_GENERATION_FAILED",
      },
      { status: 500 }
    );
  }
}
