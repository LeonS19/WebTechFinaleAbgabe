import crypto from 'node:crypto';

// In-Memory Store für kurzlebige Einmal-Codes (OAuth Redirect Exchange).
// Analog zum webauthn_challenge Pattern (expires_at, Einmalgebrauch),
// aber ohne DB-Persistenz — der Code lebt nur wenige Sekunden und muss
// keinen Server-Neustart überleben.

const CODE_TTL_MS = 60 * 1000; // 60 Sekunden

// code -> { userId, expiresAt }
const pendingCodes = new Map();

/**
 * Erzeugt einen kurzlebigen Einmal-Code für einen User.
 * Wird nach erfolgreichem OAuth-Callback statt des JWT in die
 * Redirect-URL ans Frontend gehängt.
 */
export function createAuthCode(userId) {
    const code = crypto.randomUUID();
    pendingCodes.set(code, {
        userId,
        expiresAt: Date.now() + CODE_TTL_MS,
    });
    return code;
}

/**
 * Löst einen Einmal-Code auf und gibt die zugehörige userId zurück.
 * Der Code wird dabei sofort gelöscht (Einmalgebrauch / Replay-Schutz),
 * unabhängig davon ob er gültig war oder nicht.
 */
export function consumeAuthCode(code) {
    const entry = pendingCodes.get(code);
    pendingCodes.delete(code);

    if (!entry) {
        throw new Error('Ungültiger oder bereits verwendeter Code');
    }
    if (Date.now() > entry.expiresAt) {
        throw new Error('Code ist abgelaufen');
    }

    return entry.userId;
}

// Aufräumen abgelaufener, nie eingelöster Codes, damit die Map nicht
// unbegrenzt wächst (z.B. wenn ein User den Callback nie fertig lädt).
setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of pendingCodes) {
        if (now > entry.expiresAt) {
            pendingCodes.delete(code);
        }
    }
}, CODE_TTL_MS).unref();