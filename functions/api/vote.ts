interface Env {
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

    const existingVote = await context.env.DB.prepare(`SELECT id FROM votes WHERE profile_id = ? AND voter_key = ?`)
      .bind(profile.id, voterKey)
      .first();

    if (existingVote) {
      return Response.json({ error: "one vote per email per profile" }, { status: 409 });
    }

    await context.env.DB.batch([
      context.env.DB.prepare(`INSERT INTO votes (profile_id, voter_key, tag) VALUES (?, ?, ?)`)
        .bind(profile.id, voterKey, tag),
      context.env.DB.prepare(`UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(profile.id),
      context.env.DB.prepare(`UPDATE profile_tag_counts SET count = count + 1 WHERE profile_id = ? AND tag = ?`)
        .bind(profile.id, tag),
    ]);

    return Response.json(await getProfileResponse(context.env, handle));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
};