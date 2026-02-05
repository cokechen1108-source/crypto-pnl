// src/leaderboard.ts
export interface Creator {
  id: string;
  handle: string;
  followers: number;
  tweetsCount: number;
  contentScore: number;
  contentBreakdown: Record<string, number>;
  derivativeScore: number;
  contentDepthScore: number;
  communityEngagementScore: number;
  influenceScore: number;
  activityScore: number;
  totalScore: number;
}

export const demoLeaderboard: Creator[] = [
  {
    id: "creator_high_quality",
    handle: "@alpha_minara",
    followers: 12800,
    tweetsCount: 3,
    contentScore: 70.83,
    contentBreakdown: {
      originalityScore: 100,
      insightScore: 16.67,
      engagementQualityScore: 100,
      minaraAffinityScore: 100,
    },
    derivativeScore: 17.34,
    contentDepthScore: 85.5,
    communityEngagementScore: 92.3,
    influenceScore: 78.9,
    activityScore: 65.2,
    totalScore: 49.43,
  },
  {
    id: "creator_low_quality",
    handle: "@spam_minara",
    followers: 230,
    tweetsCount: 3,
    contentScore: 45,
    contentBreakdown: {
      originalityScore: 100,
      insightScore: 0,
      engagementQualityScore: 20,
      minaraAffinityScore: 100,
    },
    derivativeScore: 4.35,
    contentDepthScore: 22.1,
    communityEngagementScore: 15.8,
    influenceScore: 8.5,
    activityScore: 42.6,
    totalScore: 28.74,
  },
];

/** 从链接中解析 handle（支持 x.com / twitter.com 个人页） */
export function parseHandleFromLink(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (!host.includes("twitter.com") && !host.includes("x.com")) return null;
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const handle = parts[0];
    return handle.startsWith("@") ? handle : `@${handle}`;
  } catch {
    return null;
  }
}

/** 模拟根据链接分析创作者（实操时替换为真实 API） */
export function mockAnalyzeFromLink(
  link: string,
  overrides: { followers?: number; tweetsCount?: number } = {}
): Promise<Creator> {
  const handle = parseHandleFromLink(link);
  const displayHandle = handle || "@unknown";
  const seed =
    displayHandle.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 10000;

  return new Promise((resolve) => {
    setTimeout(() => {
      const contentScore = 30 + (seed % 55);
      const derivativeScore = 2 + (seed % 18);
      const contentDepthScore = 20 + (seed % 65);
      const communityEngagementScore = 10 + (seed % 85);
      const influenceScore = 5 + (seed % 75);
      const activityScore = 25 + (seed % 55);
      const totalScore =
        contentScore * 0.35 +
        derivativeScore * 0.25 +
        contentDepthScore * 0.15 +
        communityEngagementScore * 0.1 +
        influenceScore * 0.08 +
        activityScore * 0.07;

      resolve({
        id: `analyzed_${Date.now()}_${displayHandle.replace("@", "")}`,
        handle: displayHandle,
        followers: overrides.followers ?? (500 + (seed * 31) % 50000),
        tweetsCount: overrides.tweetsCount ?? (3 + (seed % 50)),
        contentScore: Math.round(contentScore * 100) / 100,
        contentBreakdown: {
          originalityScore: 50 + (seed % 50),
          insightScore: 20 + (seed % 80),
          engagementQualityScore: 30 + (seed % 70),
          minaraAffinityScore: 60 + (seed % 40),
        },
        derivativeScore: Math.round(derivativeScore * 100) / 100,
        contentDepthScore: Math.round(contentDepthScore * 100) / 100,
        communityEngagementScore:
          Math.round(communityEngagementScore * 100) / 100,
        influenceScore: Math.round(influenceScore * 100) / 100,
        activityScore: Math.round(activityScore * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
      });
    }, 1200);
  });
}
