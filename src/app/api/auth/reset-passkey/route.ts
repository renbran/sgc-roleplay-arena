import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/auth/reset-passkey
 *
 * Resets the app passkey. Protected by the ADMIN_PASSWORD server-side env var.
 * Updates the password in the database (AppConfig) for instant effect.
 * Optionally also updates Vercel's NEXT_PUBLIC_APP_PASSWORD env var for
 * persistence across re-deployments (if VERCEL_TOKEN is configured).
 *
 * Headers:
 *   Authorization: Bearer <ADMIN_PASSWORD>
 *
 * Body: { newPasskey: string, alsoUpdateVercel?: boolean }
 * Returns: { success: true, method: "db" | "db+vercel" }
 */
export async function POST(req: NextRequest) {
  // ── Auth Guard ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── Validate Input ──────────────────────────────────────────────────────
  let body: { newPasskey?: string; alsoUpdateVercel?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { newPasskey, alsoUpdateVercel } = body;

  if (!newPasskey || typeof newPasskey !== "string" || !newPasskey.trim()) {
    return NextResponse.json(
      { success: false, error: "newPasskey is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  if (newPasskey.length < 4) {
    return NextResponse.json(
      { success: false, error: "Passkey must be at least 4 characters" },
      { status: 400 }
    );
  }

  // ── Update Database ────────────────────────────────────────────────────
  try {
    await db.appConfig.upsert({
      where: { key: "app_password" },
      update: { value: newPasskey.trim() },
      create: { key: "app_password", value: newPasskey.trim() },
    });
  } catch (err) {
    console.error("Failed to update passkey in DB:", err);
    return NextResponse.json(
      { success: false, error: "Database update failed" },
      { status: 500 }
    );
  }

  // ── Optional: Update Vercel Env Var ─────────────────────────────────────
  let vercelUpdated = false;
  if (alsoUpdateVercel) {
    try {
      vercelUpdated = await updateVercelEnvVar(newPasskey.trim());
    } catch (err) {
      console.error("Vercel API update failed (non-fatal):", err);
      // Non-fatal — DB was already updated
    }
  }

  return NextResponse.json({
    success: true,
    method: vercelUpdated ? "db+vercel" : "db",
  });
}

/**
 * Updates NEXT_PUBLIC_APP_PASSWORD on Vercel via their REST API.
 * Requires VERCEL_TOKEN, VERCEL_PROJECT_ID env vars.
 * Falls back silently if they're not set.
 */
async function updateVercelEnvVar(newValue: string): Promise<boolean> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    console.warn(
      "VERCEL_TOKEN and/or VERCEL_PROJECT_ID not set — skipping Vercel API update."
    );
    return false;
  }

  const baseUrl = "https://api.vercel.com";
  const teamParam = teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";

  // 1. Find the existing env var to get its ID
  const listUrl = `${baseUrl}/v10/projects/${encodeURIComponent(projectId)}/env?gitBranch=main${teamParam}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Vercel list env failed: ${listRes.status} ${text}`);
  }

  const listData = (await listRes.json()) as { envs: Array<{ id: string; key: string }> };
  const existing = listData.envs?.find((e) => e.key === "NEXT_PUBLIC_APP_PASSWORD");

  // 2. Update or create the env var
  if (existing) {
    // PATCH to update existing
    const patchUrl = `${baseUrl}/v10/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(existing.id)}${teamParam ? `?teamId=${encodeURIComponent(teamId!)}` : ""}`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: newValue }),
    });

    if (!patchRes.ok) {
      const text = await patchRes.text();
      throw new Error(`Vercel patch env failed: ${patchRes.status} ${text}`);
    }
  } else {
    // POST to create new
    const postUrl = `${baseUrl}/v10/projects/${encodeURIComponent(projectId)}/env${teamParam ? `?teamId=${encodeURIComponent(teamId!)}` : ""}`;
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "NEXT_PUBLIC_APP_PASSWORD",
        value: newValue,
        type: "encrypted",
        target: ["production"],
      }),
    });

    if (!postRes.ok) {
      const text = await postRes.text();
      throw new Error(`Vercel post env failed: ${postRes.status} ${text}`);
    }
  }

  // 3. Trigger a re-deployment so the change takes effect
  const deployUrl = `${baseUrl}/v1/deployments${teamParam ? `?teamId=${encodeURIComponent(teamId!)}` : ""}`;
  const deployRes = await fetch(deployUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectId,
      target: "production",
      // Use an empty deployment to force a rebuild with new env vars
      deploymentId: (await listRes.json() as any)?.id,
    }),
  });

  if (!deployRes.ok) {
    const text = await deployRes.text();
    // Don't throw — env var was updated, deploy might still work
    console.warn(`Vercel deploy trigger warning: ${deployRes.status} ${text}`);
  }

  return true;
}
