import { env } from '../../config/env.js';
import { createPasskey, deletePasskey, findPasskeyByCredentialId, findPasskeyById } from '../../models/sql/passkey.model.js'
import { createChallenge, findChallenge, deleteChallenge } from '../../models/sql/webauthnChallenge.model.js'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { generateToken } from './token.service.js';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { findById, findByEmail, createUser } from '../../models/sql/user.model.js';
import { withTransaction } from '../../config/db.postgres.js';

// ============================================
// REGISTRATION
// ============================================

/**
 * Schritt 1 der Passkey-Registrierung:
 * Generiert WebAuthn-Optionen (inkl. zufälliger Challenge) und speichert
 * die Challenge in der DB. Gibt Options + challengeId ans Frontend zurück.
 */
export async function startRegistration(userId, userEmail) {
    const options = await generateRegistrationOptions({
        rpName: env.WEBAUTHN_RP_NAME,
        rpID: env.WEBAUTHN_RP_ID,
        userName: userEmail,
        // userID muss ein Uint8Array sein, kein String
        userID: isoUint8Array.fromUTF8String(userId),
    });

    // Challenge in DB speichern (läuft nach 5 Minuten ab)
    const challenge = await createChallenge(userId, options.challenge, "REGISTRATION", new Date(Date.now() + 5 * 60 * 1000))

    return {    
        options,
        challengeId: challenge.id  // interne DB-ID, nicht die WebAuthn-Challenge selbst
    }
}

/**
 * Schritt 2 der Passkey-Registrierung:
 * Verifiziert die signierte Antwort des Browsers kryptografisch.
 * createPasskey + deleteChallenge laufen in einer Transaktion —
 * entweder beide erfolgreich oder keines (kein verwaister Zustand).
 */
export async function verifyRegistration(challengeId, response, userId, deviceName) {
    // Challenge aus DB holen — abgelaufene werden automatisch gelöscht
    const challenge = await findChallenge(challengeId);
    if(!challenge){
        throw new Error("Challenge konnte nicht gefunden werden")
    }

    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
    });

    if(!verification.verified){
        throw new Error("Registration verification failed")
    }

    // Passkey speichern + Challenge löschen in einer Transaktion
    const credential = verification.registrationInfo.credential
    const passkey = await withTransaction(async (client) => {
        const newPasskey = await createPasskey(
            userId,
            credential.id,
            // Public Key als Base64-String speichern (Uint8Array → Base64)
            Buffer.from(credential.publicKey).toString('base64'),
            credential.counter,
            deviceName,
            client
        )
        // Challenge nach einmaligem Verbrauch löschen (Replay-Schutz)
        await deleteChallenge(challengeId, client)
        return newPasskey
    })

    return passkey
}

// ============================================
// LOGIN
// ============================================

/**
 * Schritt 1 des Passkey-Logins:
 * Generiert WebAuthn-Optionen für "usernameless" Login.
 * user_id ist nullable, weil der User beim Login noch unbekannt ist.
 */
export async function startLogin(){
    const options = await generateAuthenticationOptions({
        rpID: env.WEBAUTHN_RP_ID,
    });

    // user_id = null, weil wir beim Login noch nicht wissen welcher User sich einloggt
    const challenge = await createChallenge(null, options.challenge, "AUTHENTICATION", new Date(Date.now() + 5 * 60 * 1000))

    return {    
        options,
        challengeId: challenge.id
    }
}

/**
 * Schritt 2 des Passkey-Logins:
 * Verifiziert die Signatur gegen den gespeicherten Public Key
 * und gibt bei Erfolg ein JWT zurück.
 */
export async function verifyLogin(challengeId, response) {
    // Challenge aus DB holen — abgelaufene werden automatisch gelöscht
    const challenge = await findChallenge(challengeId);
    if(!challenge){
        throw new Error("Challenge konnte nicht gefunden werden")
    }

    // Passkey per credential_id finden (die der Browser in der Antwort mitschickt)
    const passkey = await findPasskeyByCredentialId(response.id)
    if(!passkey){
        throw new Error("Passkey konnte nicht gefunden werden")
    }

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
        credential: {
            id: passkey.credential_id,
            // Public Key zurück in Uint8Array konvertieren (war Base64 in der DB)
            publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
            counter: passkey.counter,
        },
    })

    if(!verification.verified){
        throw new Error("Login verification fehlgeschlagen")
    }

    const token = generateToken({userId: passkey.userId})
    // Challenge nach Verbrauch löschen (Replay-Schutz)
    await deleteChallenge(challengeId)

    return token
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Findet einen bestehenden User per Email oder legt einen neuen an.
 * Läuft in einer Transaktion — verhindert Race Conditions bei
 * gleichzeitigen Registrierungsversuchen mit derselben Email.
 */
export async function findOrCreateUser(name, email) {
  return await withTransaction(async (client) => {
    let user = await findByEmail(email, client);
    if (!user) {
      user = await createUser(name || email, email, client);
    }
    return user;
  });
}

/**
 * Löscht einen Passkey nach Owner-Check.
 * Wirft einen Fehler wenn der Passkey nicht dem anfragenden User gehört.
 */
export async function removePasskey(passkeyId, userId) {
    const passkey = await findPasskeyById(passkeyId)
    if(!passkey){
        throw new Error("Passkey nicht gefunden")
    }
    // Sicherheitscheck: nur der Besitzer darf seinen eigenen Passkey löschen
    if(userId !== passkey.userId){
        throw new Error("Nicht berechtigt")
    }
    await deletePasskey(passkeyId)
}