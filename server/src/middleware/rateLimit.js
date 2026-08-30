const rateState = new Map();

export const chatRateLimit = { windowMs: 60_000, max: 20 };
export const uploadRateLimit = { windowMs: 60_000, max: 8 };

export function checkRateLimit(key, rule) {
  const bucketKey = `${key}:${Math.floor(Date.now() / rule.windowMs)}`;
  const count = rateState.get(bucketKey) || 0;
  rateState.set(bucketKey, count + 1);
  return count < rule.max;
}

