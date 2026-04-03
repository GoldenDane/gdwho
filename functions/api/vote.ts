interface Env {
  DB: D1Database;
}

type VoteTag =
  | "respectful"
  | "genuine"
  | "friendly"
  | "safe_vibes"
  | "spammy"
  | "pushy"
  | "misleading"
  | "boundary_ignoring";

const TAGS: Record<
  VoteTag,
  { label: string; weight: number; kind: "positive" | "caution" }
> = {
  respectful: { label: "Respectful", weight: 2, kind: "positive" },
  genuine: { label: "Genuine", weight: 2, kind: "positive" },
  friendly: { label: "Friendly", weight: 1, kind: "positive" },
  safe_vibes: { label: "Safe vibes", weight: 1, kind: "positive" },
  spammy: { label: "Spammy", weight: -2, kind: "caution" },
  pushy: { label: "Pushy", weight: -3, kind: "caution" },
  misleading: { label: "Misleading", weight: -3, kind: "caution" },
  boundary_ignoring: {
    label: "Boundary-ignoring",
    weight: -4,
    kind: "caution",
  },
};

function normalizeHandle(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

function isVoteTag(value: string): value is VoteTag {
  return value in TAGS;
}

async function getOrCreateProfile(env: Env, rawHandle: string) {
  const handle = normalizeHandle(rawHandle);
  if (!handle) throw new Error("Invalid handle");

  await env.DB.prepare(`INSERT OR IGNORE INTO profiles (handle) VALUES (?)`)
    .bind(handle)
    .run();

  const profile = await env.DB.prepare(
    `SELECT id, handle, created_at, updated_at FROM profiles WHERE handle = ?`
  )
    .bind(handle)
    .first<{
      id: number;
      handle: string;
      created_at: string;
      updated_at: string;
    }>();

  if (!profile) throw new Error("Profile lookup failed");

  for (const tag of Object.keys(TAGS) as VoteTag[]) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO profile_tag_counts (profile_id, tag, count) VALUES (?, ?, 0)`
    )
      .bind(profile.id, tag)
      .run();
  }

  return profile;
}

async function getProfileResponse(env: Env, rawHandle: string) {
  const profile = await getOrCreateProfile(env, rawHandle);

  const rows = await env.DB.prepare(
    `SELECT tag, count FROM profile_tag_counts WHERE profile_id = ?`
  )
    .bind(profile.id)
    .all<{ tag: VoteTag; count: number }>();

  const counts: Record<VoteTag, number> = {
    respectful: 0,
    genuine: 0,
    friendly: 0,
    safe_vibes: 0,
    spammy: 0,
    pushy: 0,
    misleading: 0,
    boundary_ignoring: 0,
  };

  for (const row of rows.results ?? []) {
    if (row.tag in counts) counts[row.tag] = row.count;
  }

  const totalVotes = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const rawScore = (Object.keys(TAGS) as VoteTag[]).reduce(
    (sum, tag) => sum + counts[tag] * TAGS[tag].weight,
    0
  );

  const min = -4 * Math.max(totalVotes, 1);
  const max = 2 * Math.max(totalVotes, 1);

  const weightedScore =
    totalVotes === 0
      ? 0
      : Math.max(
          0,
          Math.min(100, Math.round(((rawScore - min) / (max - min)) * 100))
        );

  const confidence =
    totalVotes >= 20 ? "high" : totalVotes >= 8 ? "medium" : "low";

  const signal =
    totalVotes < 3
      ? "low_data"
      : weightedScore >= 70
      ? "mostly_positive"
      : weightedScore >= 45
      ? "mixed"
      : "caution";

  return {
    profile: {
      id: profile.id,
      handle: profile.handle,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    totals: {
      totalVotes,
      weightedScore,
      confidence,
      signal,
    },
    rows: (Object.keys(TAGS) as VoteTag[]).map((tag) => ({
      tag,
      label: TAGS[tag].label,
      kind: TAGS[tag].kind,
      count: counts[tag],
      percentage: totalVotes === 0 ? 0 : Math.round((counts[tag] / totalVotes) * 100),
    })),
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      handle?: string;
      tag?: string;
      voterKey?: string;
    };

    const handle = normalizeHandle(body.handle ?? "");
    const tag = body.tag ?? "";
    const voterKey = (body.voterKey ?? "").trim().toLowerCase();

    if (!handle) {
      return Response.json({ error: "handle is required" }, { status: 400 });
    }

    if (!isVoteTag(tag)) {
      return Response.json({ error: "tag is invalid" }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(voterKey)) {
      return Response.json({ error: "valid email is required" }, { status: 400 });
    }

    const profile = await getOrCreateProfile(context.env, handle);

    const existingVote = await context.env.DB.prepare(
      `SELECT id FROM votes WHERE profile_id = ? AND voter_key = ?`
    )
      .bind(profile.id, voterKey)
      .first();

    if (existingVote) {
      return Response.json(
        { error: "one vote per email per profile" },
        { status: 409 }
      );
    }

    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO votes (profile_id, voter_key, tag) VALUES (?, ?, ?)`
      ).bind(profile.id, voterKey, tag),
      context.env.DB.prepare(
        `UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(profile.id),
      context.env.DB.prepare(
        `UPDATE profile_tag_counts SET count = count + 1 WHERE profile_id = ? AND tag = ?`
      ).bind(profile.id, tag),
    ]);

    return Response.json(await getProfileResponse(context.env, handle));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
};