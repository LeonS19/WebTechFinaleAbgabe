import { env } from '../../config/env.js';
import { createPasskey, findPasskey } from '../../models/sql/passkey.model.js'
import { createChallenge, findChallenge, deleteChallenge } from '../../models/sql/webauthnChallenge.model.js'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { generateToken } from './token.service.js';
import { isoUint8Array } from '@simplewebauthn/server/helpers';


export async function startRegistration(userId, userEmail) {
    const options = await generateRegistrationOptions({
        rpName: env.WEBAUTHN_RP_NAME,
        rpID: env.WEBAUTHN_RP_ID,
        userName: userEmail,        // String
        userID: isoUint8Array.fromUTF8String(userId),     // WICHTIG: kein String, sondern ein Uint8Array!
    });

    const challenge = await createChallenge(userId, options.challenge, "REGISTRATION", new Date(Date.now() + 5 * 60 * 1000))

    return {    
        options,
        challengeId: challenge.id
    }
}

export async function verifyRegistration(challengeId, response, userId, deviceName) {
    const challenge = await findChallenge(challengeId);
    if(!challenge){
        throw new Error("Challenge konnte nicht gefunden werden")
    }

    const verification = await verifyRegistrationResponse({
        response,                              // die signierte Antwort vom Frontend
        expectedChallenge: challenge.challenge,  // die challenge, die DU generiert hattest
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
    });

    if(!verification.verified){
        throw new Error("Registration verification failed")
    }

    const credential = verification.registrationInfo.credential
    const passkey = await createPasskey(userId, credential.id, credential.publicKey, credential.counter, deviceName)
    await deleteChallenge(challengeId)

    return passkey
}

export async function startLogin(){
    const options = await generateAuthenticationOptions({
        rpID: env.WEBAUTHN_RP_ID,
    });

    const challenge = await createChallenge(null, options.challenge, "AUTHENTICATION", new Date(Date.now() + 5 * 60 * 1000))

    return {    
        options,
        challengeId: challenge.id
    }
}

export async function verifyLogin(challengeId, response) {
    const challenge = await findChallenge(challengeId);
    if(!challenge){
        throw new Error("Challenge konnte nicht gefunden werden")
    }

    const passkey = await findPasskey(response.id)
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
            publicKey: passkey.public_key,
            counter: passkey.counter,
        },
    })
    if(!verification.verified){
        throw new Error("Login verification failed")
    }

    const token = generateToken({userId: passkey.user_id})
    await deleteChallenge(challengeId)

    return token
}

