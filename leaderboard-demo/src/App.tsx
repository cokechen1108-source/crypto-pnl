import { useState, useRef } from "react";
import { demoLeaderboard, mockAnalyzeFromLink } from "./leaderboard";
import type { Creator } from "./leaderboard";

const rankStyle = (rank: number) => {
  if (rank === 1)
    return {
      background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
      color: "#1c1917",
      fontWeight: 700,
      boxShadow: "0 2px 8px rgba(251, 191, 36, 0.35)",
    };
  if (rank === 2)
    return {
      background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
      color: "#fff",
      fontWeight: 700,
      boxShadow: "0 2px 8px rgba(148, 163, 184, 0.3)",
    };
  if (rank === 3)
    return {
      background: "linear-gradient(135deg, #b45309 0%, #92400e 100%)",
      color: "#fff",
      fontWeight: 700,
      boxShadow: "0 2px 8px rgba(180, 83, 9, 0.35)",
    };
  return {
    background: "rgba(51, 65, 85, 0.8)",
    color: "#94a3b8",
    fontWeight: 600,
  };
};

function formatNumber(n: number, decimals = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function App() {
  const [creators, setCreators] = useState<Creator[]>(() => [...demoLeaderboard]);
  const [linkInput, setLinkInput] = useState("");
  const [followersInput, setFollowersInput] = useState("");
  const [tweetsInput, setTweetsInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [hoveredContentId, setHoveredContentId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<Creator | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedCreators = [...creators].sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const shareRank =
    shareTarget ? sortedCreators.findIndex((c) => c.id === shareTarget.id) + 1 : null;
  const shareHandle = shareTarget?.handle ?? "";
  const shareAvatarUrl =
    shareHandle && shareHandle.startsWith("@")
      ? `https://unavatar.io/twitter/${shareHandle.slice(1)}`
      : "";

  const clampScore = (value: number) => Math.max(0, Math.min(100, value));

  const buildRadarPoints = (
    scores: number[],
    radius: number,
    centerX: number,
    centerY: number
  ) => {
    const step = (Math.PI * 2) / scores.length;
    return scores
      .map((score, i) => {
        const r = radius * (clampScore(score) / 100);
        const angle = -Math.PI / 2 + i * step;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  const downloadShareImage = async () => {
    if (!shareTarget) return;
    const svg = document.getElementById("radar-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 700;
      canvas.height = 700;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${shareTarget.handle.replace("@", "")}-score.png`;
      a.click();
      URL.revokeObjectURL(svgUrl);
    };
    image.src = svgUrl;
  };

  const openTwitterShare = () => {
    if (!shareTarget) return;
    const text = `我的创作者评分：${shareTarget.handle} 总分 ${formatNumber(
      shareTarget.totalScore,
      2
    )}。#Minara #CreatorScore`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const backup = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      creators,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreFromFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const list = data?.creators ?? (Array.isArray(data) ? data : null);
        if (Array.isArray(list) && list.length > 0) {
          setCreators(list);
        }
      } catch (_) {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const analyze = async () => {
    const url = linkInput.trim();
    if (!url) {
      setAnalyzeError("请输入链接");
      return;
    }
    const followersValue = followersInput.trim();
    const tweetsValue = tweetsInput.trim();
    const followers =
      followersValue === "" ? undefined : Number(followersValue);
    const tweetsCount = tweetsValue === "" ? undefined : Number(tweetsValue);

    if (
      (followers !== undefined &&
        (!Number.isFinite(followers) || followers < 0)) ||
      (tweetsCount !== undefined &&
        (!Number.isFinite(tweetsCount) || tweetsCount < 0))
    ) {
      setAnalyzeError("粉丝数和推文数需为非负数字");
      return;
    }
    setAnalyzeError(null);
    setAnalyzing(true);
    try {
      const creator = await mockAnalyzeFromLink(url, {
        followers: followers !== undefined ? Math.floor(followers) : undefined,
        tweetsCount:
          tweetsCount !== undefined ? Math.floor(tweetsCount) : undefined,
      });
      setCreators((prev) => [...prev, creator]);
      setLinkInput("");
      setFollowersInput("");
      setTweetsInput("");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1400,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 8 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#f8fafc",
          }}
        >
          Creator Leaderboard
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          Multi-dimensional creator evaluation
        </p>
      </header>

      <section
        style={{
          width: "100%",
          maxWidth: 640,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={backup}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(51, 65, 85, 0.8)",
              background: "rgba(30, 41, 59, 0.9)",
              color: "#e2e8f0",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            备份当前数据
          </button>
          <button
            type="button"
            onClick={restoreFromFile}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(51, 65, 85, 0.8)",
              background: "rgba(30, 41, 59, 0.9)",
              color: "#e2e8f0",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            从备份恢复
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onFileChange}
            style={{ display: "none" }}
            aria-hidden
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="url"
            placeholder="输入 X/Twitter 个人页链接，如 https://x.com/username"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            disabled={analyzing}
            style={{
              flex: "1 1 280px",
              minWidth: 0,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(51, 65, 85, 0.8)",
              background: "rgba(15, 23, 42, 0.9)",
              color: "#f1f5f9",
              fontSize: 14,
            }}
          />
          <input
            type="number"
            min={0}
            placeholder="粉丝数（可选）"
            value={followersInput}
            onChange={(e) => setFollowersInput(e.target.value)}
            disabled={analyzing}
            style={{
              width: 150,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(51, 65, 85, 0.8)",
              background: "rgba(15, 23, 42, 0.9)",
              color: "#f1f5f9",
              fontSize: 14,
            }}
          />
          <input
            type="number"
            min={0}
            placeholder="推文数（可选）"
            value={tweetsInput}
            onChange={(e) => setTweetsInput(e.target.value)}
            disabled={analyzing}
            style={{
              width: 150,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(51, 65, 85, 0.8)",
              background: "rgba(15, 23, 42, 0.9)",
              color: "#f1f5f9",
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: analyzing
                ? "rgba(100, 116, 139, 0.5)"
                : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: analyzing ? "not-allowed" : "pointer",
            }}
          >
            {analyzing ? "分析中…" : "分析链接"}
          </button>
        </div>
        {analyzeError && (
          <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>
            {analyzeError}
          </p>
        )}
      </section>

      <section
        style={{
          width: "100%",
          maxWidth: "100%",
          background: "rgba(15, 23, 42, 0.85)",
          borderRadius: 16,
          border: "1px solid rgba(51, 65, 85, 0.6)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.03)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 1000,
              borderCollapse: "collapse",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.9))",
                  borderBottom: "1px solid rgba(51, 65, 85, 0.8)",
                }}
              >
                {[
                  "Rank",
                  "Handle",
                  "Followers",
                  "Tweets",
                  "Content",
                  "Derivative",
                  "Depth",
                  "Engagement",
                  "Influence",
                  "Activity",
                  "Total",
                  "Share",
                ].map((label) => (
                  <th
                    key={label}
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#94a3b8",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCreators.map((creator: Creator, index: number) => (
                <tr
                  key={creator.id}
                  style={{
                    background:
                      index % 2 === 0
                        ? "rgba(15, 23, 42, 0.5)"
                        : "rgba(30, 41, 59, 0.25)",
                    borderBottom:
                      index < sortedCreators.length - 1
                        ? "1px solid rgba(51, 65, 85, 0.4)"
                        : "none",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(51, 65, 85, 0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      index % 2 === 0
                        ? "rgba(15, 23, 42, 0.5)"
                        : "rgba(30, 41, 59, 0.25)";
                  }}
                >
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        fontSize: 13,
                        ...rankStyle(index + 1),
                      }}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "#f1f5f9",
                      fontSize: 15,
                    }}
                  >
                    {creator.handle}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#cbd5e1",
                      fontSize: 14,
                    }}
                  >
                    {formatNumber(creator.followers)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#cbd5e1",
                      fontSize: 14,
                    }}
                  >
                    {creator.tweetsCount}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#a5b4fc",
                      fontSize: 14,
                      position: "relative",
                    }}
                    onMouseEnter={() => setHoveredContentId(creator.id)}
                    onMouseLeave={() => setHoveredContentId(null)}
                  >
                    {formatNumber(creator.contentScore, 2)}
                    {hoveredContentId === creator.id && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          marginTop: 8,
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "rgba(15, 23, 42, 0.98)",
                          border: "1px solid rgba(51, 65, 85, 0.9)",
                          boxShadow:
                            "0 10px 25px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03)",
                          color: "#e2e8f0",
                          fontSize: 12,
                          lineHeight: 1.5,
                          whiteSpace: "pre-line",
                          minWidth: 180,
                          zIndex: 20,
                        }}
                      >
                        {`原创性: ${formatNumber(creator.contentBreakdown.originalityScore, 2)}\n` +
                          `洞察力: ${formatNumber(creator.contentBreakdown.insightScore, 2)}\n` +
                          `互动质量: ${formatNumber(creator.contentBreakdown.engagementQualityScore, 2)}\n` +
                          `Minara 亲和: ${formatNumber(creator.contentBreakdown.minaraAffinityScore, 2)}\n` +
                          `内容深度: ${formatNumber(creator.contentDepthScore, 2)}\n` +
                          `社群互动: ${formatNumber(creator.communityEngagementScore, 2)}`}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#a5b4fc",
                      fontSize: 14,
                    }}
                  >
                    {formatNumber(creator.derivativeScore, 2)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#86efac",
                      fontSize: 14,
                    }}
                  >
                    {formatNumber(creator.contentDepthScore, 2)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#fbbf24",
                      fontSize: 14,
                    }}
                  >
                    {formatNumber(creator.communityEngagementScore, 2)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#f472b6",
                      fontSize: 14,
                    }}
                  >
                    {formatNumber(creator.influenceScore, 2)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#60a5fa",
                      fontSize: 14,
                    }}
                  >
                    {formatNumber(creator.activityScore, 2)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      fontSize: 15,
                      color:
                        index === 0 ? "#fbbf24" : "rgba(196, 181, 253, 0.95)",
                    }}
                  >
                    {formatNumber(creator.totalScore, 2)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      type="button"
                      onClick={() => setShareTarget(creator)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(59, 130, 246, 0.6)",
                        background: "rgba(59, 130, 246, 0.15)",
                        color: "#93c5fd",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      分享
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {shareTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
          onClick={() => setShareTarget(null)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "rgba(15, 23, 42, 0.98)",
              borderRadius: 16,
              border: "1px solid rgba(51, 65, 85, 0.8)",
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03)",
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid rgba(59, 130, 246, 0.6)",
                    boxShadow: "0 0 12px rgba(59,130,246,0.4)",
                    background: "rgba(15, 23, 42, 0.8)",
                  }}
                >
                  {shareAvatarUrl ? (
                    <img
                      src={shareAvatarUrl}
                      alt={shareHandle}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#93c5fd",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {shareHandle
                        ? shareHandle.replace("@", "").slice(0, 2).toUpperCase()
                        : "NA"}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
                    {shareHandle} Score Breakdown
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    {shareRank ? `Rank #${shareRank} · ` : ""}Total Score{" "}
                    {formatNumber(shareTarget.totalScore, 2)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg
                id="radar-svg"
                width="520"
                height="520"
                viewBox="0 0 520 520"
              >
                <defs>
                  <radialGradient id="radarBg" cx="50%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="1" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="1" />
                  </radialGradient>
                  <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.35" />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <clipPath id="avatarClip">
                    <circle cx="60" cy="64" r="24" />
                  </clipPath>
                </defs>
                <rect width="520" height="520" fill="url(#radarBg)" rx="18" />
                <text
                  x="26"
                  y="36"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="600"
                  letterSpacing="0.08em"
                >
                  MINARA CREATOR SCORECARD
                </text>
                {shareAvatarUrl && (
                  <image
                    href={shareAvatarUrl}
                    x="36"
                    y="40"
                    width="48"
                    height="48"
                    clipPath="url(#avatarClip)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                )}
                <text x="96" y="64" fill="#e2e8f0" fontSize="14" fontWeight="700">
                  {shareHandle}
                </text>
                <text x="96" y="84" fill="#94a3b8" fontSize="11">
                  Creator performance snapshot
                </text>
                {shareRank && (
                  <>
                    <circle cx="470" cy="56" r="22" fill="rgba(251, 191, 36, 0.15)" />
                    <circle cx="470" cy="56" r="21" fill="none" stroke="#fbbf24" />
                    <text
                      x="470"
                      y="60"
                      fill="#fbbf24"
                      fontSize="13"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      #{shareRank}
                    </text>
                  </>
                )}
                {[
                  [80, 80, 1.4],
                  [440, 110, 1.2],
                  [380, 420, 1.6],
                  [120, 410, 1.1],
                ].map(([x, y, r], idx) => (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={r}
                    fill="rgba(148, 163, 184, 0.35)"
                  />
                ))}
                {[1, 0.8, 0.6, 0.4, 0.2].map((ratio) => {
                  const r = 200 * ratio;
                  const points = buildRadarPoints(
                    [100, 100, 100, 100, 100, 100],
                    r,
                    260,
                    260
                  );
                  return (
                    <polygon
                      key={ratio}
                      points={points}
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.25)"
                      strokeWidth="1"
                    />
                  );
                })}
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const angle = -Math.PI / 2 + i * (Math.PI * 2) / 6;
                  const x = 260 + 200 * Math.cos(angle);
                  const y = 260 + 200 * Math.sin(angle);
                  return (
                    <line
                      key={i}
                      x1="260"
                      y1="260"
                      x2={x}
                      y2={y}
                      stroke="rgba(148, 163, 184, 0.25)"
                      strokeWidth="1"
                    />
                  );
                })}
                <polygon
                  points={buildRadarPoints(
                    [
                      shareTarget.contentScore,
                      shareTarget.derivativeScore,
                      shareTarget.contentDepthScore,
                      shareTarget.communityEngagementScore,
                      shareTarget.influenceScore,
                      shareTarget.activityScore,
                    ],
                    200,
                    260,
                    260
                  )}
                  fill="url(#radarFill)"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  filter="url(#glow)"
                />
                {[
                  { label: "内容", score: shareTarget.contentScore, color: "#60a5fa" },
                  { label: "衍生", score: shareTarget.derivativeScore, color: "#f59e0b" },
                  { label: "深度", score: shareTarget.contentDepthScore, color: "#34d399" },
                  { label: "互动", score: shareTarget.communityEngagementScore, color: "#f472b6" },
                  { label: "影响力", score: shareTarget.influenceScore, color: "#a855f7" },
                  { label: "活跃度", score: shareTarget.activityScore, color: "#22d3ee" },
                ].map((item, i) => {
                  const angle = -Math.PI / 2 + i * (Math.PI * 2) / 6;
                  const r = 200 * (clampScore(item.score) / 100);
                  const x = 260 + r * Math.cos(angle);
                  const y = 260 + r * Math.sin(angle);
                  return (
                    <circle
                      key={item.label}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={item.color}
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="1"
                    />
                  );
                })}
                <text
                  x="260"
                  y="240"
                  fill="#e2e8f0"
                  fontSize="12"
                  textAnchor="middle"
                >
                  TOTAL SCORE
                </text>
                <text
                  x="260"
                  y="270"
                  fill="#fbbf24"
                  fontSize="28"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {formatNumber(shareTarget.totalScore, 2)}
                </text>
                {[
                  "Content",
                  "Derivative",
                  "Depth",
                  "Engagement",
                  "Influence",
                  "Activity",
                ].map((label, i) => {
                  const angle = -Math.PI / 2 + i * (Math.PI * 2) / 6;
                  const x = 260 + 225 * Math.cos(angle);
                  const y = 260 + 225 * Math.sin(angle);
                  return (
                    <text
                      key={label}
                      x={x}
                      y={y}
                      fill="#cbd5e1"
                      fontSize="12"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {label}
                    </text>
                  );
                })}
                <text
                  x="26"
                  y="494"
                  fill="rgba(148, 163, 184, 0.7)"
                  fontSize="11"
                >
                  Share-ready visual • Auto-generated
                </text>
              </svg>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={downloadShareImage}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(51, 65, 85, 0.8)",
                  background: "rgba(30, 41, 59, 0.9)",
                  color: "#e2e8f0",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Download image
              </button>
              <button
                type="button"
                onClick={openTwitterShare}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Share on X
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
              Tip: download the image and upload it in your post.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
