import { ApolloLink } from '@apollo/client/core'
import {
  cacheStudyGroups,
  patchStudyGroupMembers,
  cacheIndexCards,
  cacheRanking,
} from '../services/offlineStorage.service.js'

export const offlineCacheLink = new ApolloLink((operation, forward) => {
  return forward(operation).map((response) => {
    const data = response.data
    if (!data) return response

    if (data.getMyStudyGroups) {
      cacheStudyGroups(data.getMyStudyGroups)
    }
    if (data.getStudyGroup) {
      // GET_STUDY_GROUP liefert keine id zurück -> aus den Operation-Variablen nehmen
      patchStudyGroupMembers(operation.variables.id, data.getStudyGroup.members)
    }
    if (data.getIndexCards) {
      cacheIndexCards(data.getIndexCards)
    }
    
    if (data.getRanking) {
      cacheRanking(operation.variables.studyGroupId, data.getRanking)
    }

    return response
  })
})