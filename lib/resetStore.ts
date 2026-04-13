type ResetEntry = { code: string; expires: number };

const store = new Map<string, ResetEntry>();

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

export function setResetCode(email: string, code: string, ttlSeconds = 900) {
    const expires = Date.now() + ttlSeconds * 1000;
    store.set(normalizeEmail(email), { code, expires });
}

export function isResetCodeValid(email: string, code: string) {
    const entry = store.get(normalizeEmail(email));
    if (!entry) return false;
    if (Date.now() > entry.expires) {
        store.delete(normalizeEmail(email));
        return false;
    }
    return entry.code === code;
}

export function consumeResetCode(email: string, code: string) {
    const key = normalizeEmail(email);
    const valid = isResetCodeValid(key, code);
    if (!valid) return false;
    store.delete(key);
    return true;
}

export function verifyResetCode(email: string, code: string) {
    return consumeResetCode(email, code);
}

export function peekCode(email: string) {
    return store.get(normalizeEmail(email))?.code ?? null;
}

export default { setResetCode, isResetCodeValid, consumeResetCode, verifyResetCode, peekCode };
