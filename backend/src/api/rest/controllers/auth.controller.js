import { deletePasskey } from "../../../models/sql/passkey.model.js";
import { env } from '../../../config/env.js';
import * as passkeyService from "../../../services/auth/passkey.service.js"
import * as oauthService from '../../../services/auth/oauth.service.js';
import { generateToken } from '../../../services/auth/token.service.js';

// ============================================
// PASSKEY
// ============================================
export async function registerOptions(req, res) {
    const userId = req.body.userId
    const userEmail = req.body.userEmail

    if(!userId){
        return res.status(400).json({ error: 'Unauthorized', message: 'userId ist erforderlich' });
    }
    if(!userEmail){
        return res.status(400).json({ error: 'Unauthorized', message: 'email ist erforderlich' });
    }

    try{
        const registrationOptions  = await passkeyService.startRegistration(userId, userEmail);
        return res.json(registrationOptions)
    }catch(err){
        return res.status(400).json({ error: err.message })
    }
}

export async function registerVerify(req, res){
    const challengeId = req.body.challengeId
    const response = req.body.response
    const userId = req.body.userId
    const deviceName = req.body.deviceName || 'Unbekanntes Gerät'

    if (!challengeId) {
        return res.status(400).json({ error: 'challengeId ist erforderlich' });
    }
    if (!response) {
        return res.status(400).json({ error: 'response ist erforderlich' });
    }
    if (!userId) {
        return res.status(400).json({ error: 'userId ist erforderlich' });
    }

    try{
        const passkey = await passkeyService.verifyRegistration(challengeId, response, userId, deviceName)
        const token = generateToken({ userId: passkey.userId })
        return res.json({ passkey, token })
    }catch(err){
        return res.status(400).json({ error: err.message }) 
    }
}

export async function loginOptions(req, res) {
    try {
        const loginOptions = await passkeyService.startLogin()
        return res.json(loginOptions)
    } catch (err) {
        return res.status(400).json({ error: err.message }) 
    }
}

export async function loginVerify(req, res) {
    const challengeId = req.body.challengeId
    const response = req.body.response

    if (!challengeId) {
        return res.status(400).json({ error: 'challengeId ist erforderlich' });
    }
    if (!response) {
        return res.status(400).json({ error: 'response ist erforderlich' });
    }

    try{
        const token = await passkeyService.verifyLogin(challengeId, response);
        return res.json(token)
    }catch(err){
        return res.status(400).json({ error: err.message }) 
    }
    
}

export async function removePasskeyHandler(req, res) {
    const user = req.user
    const passkeyId = req.params.id 

    if(!user){
        return res.status(400).json({ error: 'user ist erforderlich' });
    }
    if(!passkeyId){
        return res.status(400).json({ error: 'passkeyId ist erforderlich' });
    }

    try{
        await passkeyService.removePasskey(passkeyId, user.userId)
        return res.status(204).send()
    }catch(err){
        return res.status(400).json({ error: err.message }) 
    }
}

export async function getOrCreateUser(req, res) {
  const { name, email } = req.body;
  if (!email){
    return res.status(400).json({ error: 'email ist erforderlich' });
  }
  if (!name){
    return res.status(400).json({ error: 'name ist erforderlich' });
  }

  try {
    const user = await passkeyService.findOrCreateUser(name, email);
    return res.json({ userId: user.id });
  } catch(err) {
    return res.status(400).json({ error: err.message });
  }
}


// ============================================
// OAUTH
// ============================================

export function googleAuth(req, res) {
  const url = oauthService.getGoogleAuthUrl();
  res.redirect(url);
}

export async function googleCallback(req, res) {
  // 1. code aus Query-Parameter lesen
  const code = req.query.code

  // 2. try/catch
  try {
    const token = await oauthService.handleGoogleCallback(code)
    // 3. Browser zum Frontend weiterleiten mit token
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`)
  } catch(err) {
    // 4. Bei Fehler: zurück zum Frontend mit Fehler
    res.redirect(`${env.FRONTEND_URL}/auth/error?message=${err.message}`);
  }
}