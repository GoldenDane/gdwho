import { useEffect, useMemo, useState } from "react";
              <div className="section-label">Caution signals</div>
              <div className="bar-group">
                {grouped.caution.map((row) => (
                  <div className="bar-row" key={row.tag}>
                    <div className="bar-head">
                      <span>{row.label}</span>
                      <span className="subtle">{row.count} • {row.percentage}%</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${row.percentage}%` }} />
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
                  className={`vote-option ${selectedTag === row.tag ? "active" : ""}`}
                  onClick={() => setSelectedTag(row.tag)}
                >
                  <div style={{ fontWeight: 600 }}>{row.label}</div>
                  <div className="small" style={{ opacity: selectedTag === row.tag ? 0.9 : 0.7 }}>
                    {row.kind === "positive" ? "Positive signal" : "Caution signal"}
                  </div>
                </button>
              ))}
            </div>
            <button className="button" style={{ width: "100%" }} onClick={submitVote} disabled={submitting || loading || !profileData}>
              {submitting ? "Submitting..." : "Submit vote"}
            </button>

            {message && <div className="notice success small" style={{ marginTop: 12 }}>{message}</div>}
            {error && <div className="notice error small" style={{ marginTop: 12 }}>{error}</div>}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>How it works</h2>
            <div className="small subtle">• Search for a username</div>
            <div className="small subtle">• If it exists, the page loads</div>
            <div className="small subtle">• If it does not exist, the app creates it instantly</div>
            <div className="small subtle">• Users vote using fixed tags only</div>
            <div className="small subtle">• One email can vote once per profile</div>
          </div>
        </div>
      </div>
    </div>
  );
}