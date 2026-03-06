type RateCheckResult = {
    allowed: boolean;
    retryAfterMs: number;
    count: number;
};

const nowMs = () => Date.now();

export const checkLocalRateLimit = (
    actor: string,
    action: string,
    scope: string,
    maxCount: number,
    windowMs: number
): RateCheckResult => {
    if (typeof window === "undefined") return { allowed: true, retryAfterMs: 0, count: 0 };

    const key = `isgucu_rl_${String(action)}_${String(actor)}_${String(scope)}`;
    const now = nowMs();
    let stamps: number[] = [];
    try {
        const raw = localStorage.getItem(key);
        stamps = raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
        stamps = [];
    }

    const filtered = stamps.filter((t) => Number.isFinite(t) && now - t <= windowMs);
    if (filtered.length >= maxCount) {
        const oldest = filtered[0] || now;
        const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
        return { allowed: false, retryAfterMs, count: filtered.length };
    }

    const next = [...filtered, now];
    localStorage.setItem(key, JSON.stringify(next));
    return { allowed: true, retryAfterMs: 0, count: next.length };
};

export const humanizeMs = (ms: number) => {
    const totalSec = Math.max(1, Math.ceil(ms / 1000));
    if (totalSec < 60) return `${totalSec} saniye`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${min} dk ${sec} sn` : `${min} dakika`;
};

