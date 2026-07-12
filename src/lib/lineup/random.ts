// シード付き擬似乱数生成器 (mulberry32)
// 同じシードなら同じ結果を再現できる。再生成時は新しいシードを使う。
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 重み付きランダム選択: weights[i] に比例した確率で index を返す
export function weightedPick(weights: number[], rng: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return Math.floor(rng() * weights.length);
  }
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
