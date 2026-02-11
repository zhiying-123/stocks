type ResetEntry = { code: string; expires: number };

const store = new Map<string, ResetEntry>();

export function setResetCode(email: string, code: string, ttlSeconds = 900) {
    const expires = Date.now() + ttlSeconds * 1000;
    store.set(email, { code, expires });
}

export function verifyResetCode(email: string, code: string) {
    const entry = store.get(email);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
        store.delete(email);
        return false;
    }
    if (entry.code !== code) return false;
    // consume
    store.delete(email);
    return true;
}

export function peekCode(email: string) {
    return store.get(email)?.code ?? null;
}

export default { setResetCode, verifyResetCode, peekCode };
