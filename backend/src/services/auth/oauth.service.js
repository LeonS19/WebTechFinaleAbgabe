import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { generateToken } from './token.service.js';
import * as oAuthModel from '../../models/sql/oauth.model.js'
import { createUser } from '../../models/sql/user.model.js'

const client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

export function getGoogleAuthUrl() {
  return client.generateAuthUrl({
                    access_type: 'offline', //refreshToken
                    scope: ['email', 'profile', 'openid'], //scope: Welche Daten will, ich von dem User von Google haben
                });
}

export async function handleGoogleCallback(code){
    const { tokens } = await client.getToken(code);
    if(!tokens){
        throw new Error("tokens konnten nicht gefunden werden");
    }

    const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID
    });
    if(!ticket){
        throw new Error("ticket konnten nicht gefunden werden")
    }

    const payload = ticket.getPayload();
    const oauthAccount = await oAuthModel.findOAuthAccount("google", payload.sub);

    let userId

    if(!oauthAccount){
        const newUser = await createUser(payload.name, payload.email);
        await oAuthModel.createOAuthAccount(newUser.id, 'google', payload.sub, tokens.access_token, tokens.refresh_token);
        userId = newUser.id;
    }else{
        userId = oauthAccount.userId;
    }

    const token = generateToken({ userId });
    return token;

}