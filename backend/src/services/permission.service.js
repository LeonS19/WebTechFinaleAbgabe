import { findOne } from "../models/sql/membership.model.js"

export async function checkPermission(userId, studyGroupId, requiredRoles) {

    const membership = await findOne(userId, studyGroupId)
    if(!membership){
        throw new Error('Nicht Mitglied dieser Lerngruppe')
    }
    if(!requiredRoles.includes(membership.role)){
        throw new Error('Keine Berechtigung mit dieser Rolle')
    }
}