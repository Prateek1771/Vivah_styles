import { deriveAttrs } from './attributes';
import type { ScoredItem } from './types';

export type Bucket =
  | 'Best Overall'
  | 'Most Premium'
  | 'Most Trending'
  | 'Safest Choice'
  | "Editor's Pick"
  | 'Hidden Gem';

// Order is meaningful — buckets render left-to-right in this order.
export const BUCKETS: Bucket[] = [
  'Best Overall',
  'Most Premium',
  'Most Trending',
  'Safest Choice',
  "Editor's Pick",
  'Hidden Gem',
];

// Pick one standout per bucket, greedily in BUCKETS priority order without
// replacement — each item wins at most one bucket. On a small catalogue the
// pool runs out and later buckets are simply omitted.
export function categorize(scored: ScoredItem[]): Partial<Record<Bucket, string>> {
  if (!scored.length) return {};
  const attrs = new Map(scored.map((s) => [s.item.id, deriveAttrs(s.item)]));
  const a = (s: ScoredItem) => attrs.get(s.item.id)!;
  const rankers: Record<Bucket, (s: ScoredItem) => number> = {
    'Best Overall': (s) => s.matchScore,
    'Most Premium': (s) => a(s).luxuryScore * 1000 + s.matchScore,
    'Most Trending': (s) => a(s).trendScore * 1000 + s.matchScore,
    'Safest Choice': (s) => s.components.occasion * 1000 + s.matchScore,
    "Editor's Pick": (s) => a(s).embroideryLevel * 1000 + s.matchScore,
    'Hidden Gem': (s) => s.matchScore - a(s).trendScore * 3,
  };
  const result: Partial<Record<Bucket, string>> = {};
  const used = new Set<string>();
  for (const bucket of BUCKETS) {
    const pool = scored.filter((s) => !used.has(s.item.id));
    if (!pool.length) break;
    const rank = rankers[bucket];
    const winner = pool.reduce((best, s) => (rank(s) > rank(best) ? s : best));
    result[bucket] = winner.item.id;
    used.add(winner.item.id);
  }
  return result;
}
