interface Env {
    if (!handle) {
      return Response.json({ error: "handle is required" }, { status: 400 });
    }

    const profile = await getOrCreateProfile(context.env, handle);

    const rows = await context.env.DB.prepare(`SELECT tag, count FROM profile_tag_counts WHERE profile_id = ?`)
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
    const rawScore = (Object.keys(TAGS) as VoteTag[]).reduce((sum, tag) => sum + counts[tag] * TAGS[tag].weight, 0);
    const min = -4 * Math.max(totalVotes, 1);
    const max = 2 * Math.max(totalVotes, 1);
    const weightedScore = totalVotes === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((rawScore - min) / (max - min)) * 100)));
    const confidence = totalVotes >= 20 ? "high" : totalVotes >= 8 ? "medium" : "low";
    const signal = totalVotes < 3 ? "low_data" : weightedScore >= 70 ? "mostly_positive" : weightedScore >= 45 ? "mixed" : "caution";

    return Response.json({
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
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
};