import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { createAuthCode } from './authCode.service.js';
import * as oAuthModel from '../../models/sql/oauth.model.js'
import { createUser } from '../../models/sql/user.model.js'
import { withTransaction } from '../../config/db.postgres.js';

// OAuth2Client-Instanz mit Google-Credentials aus der .env
const client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

/**
 * Generiert die Google OAuth Consent-URL.
 * Synchron — kein Netzwerk-Request, nur URL-Generierung.
 */
export function getGoogleAuthUrl() {
  return client.generateAuthUrl({
    access_type: 'offline',   // gibt Refresh Token zurück
    scope: ['email', 'profile', 'openid'],
  });
}

/**
 * Verarbeitet den Google OAuth Callback nach erfolgreichem Login.
 * 
 * Flow:
 * 1. Tauscht den einmaligen Google-Code gegen Google-Tokens
 * 2. Verifiziert das ID-Token und liest User-Daten aus
 * 3. Findet oder legt User + oauth_account an (in Transaktion!)
 * 4. Erzeugt einen kurzlebigen Einmal-Code (NICHT das JWT selbst)
 * 
 * Der Einmal-Code wird per Redirect als Query-Parameter ans Frontend
 * übergeben: FRONTEND_URL/auth/callback?code=...
 * Das Frontend tauscht den Code serverseitig über POST /auth/exchange
 * gegen das eigentliche JWT. Dadurch landet das JWT nie in der URL,
 * Browser-History oder Server-Logs.
 */
export async function handleGoogleCallback(code){
    // Code gegen Google-Tokens tauschen
    const { tokens } = await client.getToken(code);
    if(!tokens){
        throw new Error("tokens konnten nicht gefunden werden");
    }

    // ID-Token verifizieren und User-Daten extrahieren
    const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID
    });
    if(!ticket){
        throw new Error("ticket konnten nicht gefunden werden")
    }

    const payload = ticket.getPayload();
    // payload.sub = Google's eindeutige User-ID (NICHT unsere eigene UUID!)

    // User finden oder anlegen — in Transaktion gegen Race Conditions
    const userId = await withTransaction(async (client) => {
        const oauthAccount = await oAuthModel.findOAuthAccount("google", payload.sub, client);

        if(!oauthAccount){
            // Erster Login → User + oauth_account anlegen
            const newUser = await createUser(payload.name, payload.email, client);
            await oAuthModel.createOAuthAccount(
                newUser.id,
                'google',
                payload.sub,
                tokens.access_token,
                tokens.refresh_token,
                client
            );
            return newUser.id;
        } else {
            // Bekannter User
            return oauthAccount.userId;
        }
    });

    // Kurzlebigen Einmal-Code ausstellen — das eigentliche JWT wird erst
    // beim Exchange-Call erzeugt, nie in dieser Funktion.
    const authCode = createAuthCode(userId);
    return authCode;
}