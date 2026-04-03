import { useEffect, useMemo, useState } from "react";

type VoteRow = {
  tag: string;
  label: string;
  kind: "positive" | "caution";
  count: number;
  percentage: number;
};

type ProfileResponse = {
  profile: {
    id: number;
    handle: string;
    createdAt: string;
    updatedAt: string;
  };
  totals: {
    totalVotes: number;
    weightedScore: number;
    confidence: string;
    signal: string;
  };
  rows: VoteRow[];
};

const signalClassMap: Record<string, string> = {
  low_data: "low",
  mostly_positive: "good",
  mixed: "mixed",
  caution: "bad",
};

const signalLabelMap: Record<string, string> = {
  low_data: "Low data",
  mostly_positive: "Mostly positive",
  mixed: "Mixed",
  caution: "Caution",
};

function normalizeHandle(raw: string) {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export default function App() {
  const [query, setQuery] = useState("alexsnap");
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [email, setEmail] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rows = profileData?.rows ?? [];

  const grouped = useMemo(() => {
    return {
      positive: rows.filter((row) => row.kind === "positive"),
      caution: rows.filter((row) => row.kind === "caution"),
    };
  }, [rows]);

  async function loadProfile(handleInput: string) {
    const handle = normalizeHandle(handleInput);
    if (!handle) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load profile");
      }

      setProfileData(data as ProfileResponse);
      setSelectedTag(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }

  async function submitVote() {
    if (!profileData || !selectedTag) {
      setMessage("Choose one option first.");
      return;
    }

    const voterKey = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(voterKey)) {
      setMessage("Enter a valid email to vote.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: profileData.profile.handle,
          tag: selectedTag,
          voterKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Vote failed");
      }

      setProfileData(data as ProfileResponse);
      setSelectedTag(null);
      setMessage("Vote submitted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadProfile("alexsnap");
  }, []);

  const signal = profileData?.totals.signal ?? "low_data";

  return (
    <div className="container">
      <div className="grid">
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="small subtle">
              No third-party data. Users search handles and vote.
            </div>

            <h1 className="title">gdwho</h1>

            <div className="subtle" style={{ marginBottom: 16 }}>
              Search a username. If the profile exists, it loads. If not, it is
              created instantly.
            </div>

            <div className="notice small" style={{ marginBottom: 16 }}>
              Community-submitted signals may be incomplete or inaccurate and
              should not be treated as verified fact.
            </div>

            <div className="search">
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadProfile(query);
                  }
                }}
                placeholder="Enter username, e.g. alexsnap"
              />

              <button
                className="button"
                onClick={() => {
                  void loadProfile(query);
                }}
                disabled={loading}
              >
                {loading ? "Loading..." : "Open profile"}
              </button>
            </div>
          </div>

          <div className="card">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.7rem" }}>
                  {profileData?.profile.handle ?? "@alexsnap"}
                </h2>
                <div className="subtle" style={{ marginTop: 8 }}>
                  Results are based on structured tag votes only.
                </div>
              </div>

              <div className={`badge ${signalClassMap[signal]}`}>
                {signalLabelMap[signal]}
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat-label">Weighted score</div>
                <div className="stat-value">
                  {profileData?.totals.weightedScore ?? 0}%
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">Total votes</div>
                <div className="stat-value">
                  {profileData?.totals.totalVotes ?? 0}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">Confidence</div>
                <div
                  className="stat-value"
                  style={{ textTransform: "capitalize" }}
                >
                  {profileData?.totals.confidence ?? "low"}
                </div>
              </div>
            </div>

            <hr className="sep" />

            <div style={{ marginBottom: 22 }}>
              <div className="section-label">Positive signals</div>
              <div className="bar-group">
                {grouped.positive.map((row) => (
                  <div className="bar-row" key={row.tag}>
                    <div className="bar-head">
                      <span>{row.label}</span>
                      <span className="subtle">
                        {row.count} • {row.percentage}%
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="section-label">Caution signals</div>
              <div className="bar-group">
                {grouped.caution.map((row) => (
                  <div className="bar-row" key={row.tag}>
                    <div className="bar-head">
                      <span>{row.label}</span>
                      <span className="subtle">
                        {row.count} • {row.percentage}%
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Vote on this profile</h2>

            <div className="subtle" style={{ marginBottom: 16 }}>
              One vote per email per profile in this launch version.
            </div>

            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              style={{ marginBottom: 12, width: "100%" }}
            />

            <div className="vote-grid" style={{ marginBottom: 14 }}>
              {rows.map((row) => (
                <button
                  key={row.tag}
                  className={`vote-option ${
                    selectedTag === row.tag ? "active" : ""
                  }`}
                  onClick={() => setSelectedTag(row.tag)}
                >
                  <div style={{ fontWeight: 600 }}>{row.label}</div>
                  <div
                    className="small"
                    style={{ opacity: selectedTag === row.tag ? 0.9 : 0.7 }}
                  >
                    {row.kind === "positive"
                      ? "Positive signal"
                      : "Caution signal"}
                  </div>
                </button>
              ))}
            </div>

            <button
              className="button"
              style={{ width: "100%" }}
              onClick={() => {
                void submitVote();
              }}
              disabled={submitting || loading || !profileData}
            >
              {submitting ? "Submitting..." : "Submit vote"}
            </button>

            {message && (
              <div className="notice success small" style={{ marginTop: 12 }}>
                {message}
              </div>
            )}

            {error && (
              <div className="notice error small" style={{ marginTop: 12 }}>
                {error}
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>How it works</h2>
            <div className="small subtle">• Search for a username</div>
            <div className="small subtle">• If it exists, the page loads</div>
            <div className="small subtle">
              • If it does not exist, the app creates it instantly
            </div>
            <div className="small subtle">
              • Users vote using fixed tags only
            </div>
            <div className="small subtle">
              • One email can vote once per profile
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}