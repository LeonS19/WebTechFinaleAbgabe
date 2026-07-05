<template>
  <div class="dashboard">
    <GroupSwitcher
      :groups="studyGroups"
      :selectedGroupId="selectedGroup?.id"
      @select="selectGroup"
      @create="showCreateGroup = true"
      @search="showJoinGroup = true"
    />

    <div class="main">
      <DashboardHeader
        :groupName="selectedGroup?.name"
        :user="currentUser"
        :role="currentMemberRole"
        :menuOpen="userMenuOpen"
        :hasGroup="!!selectedGroup"
        @toggleMenu="userMenuOpen = !userMenuOpen"
        @leaveGroup="leaveGroup"
        @logout="logout"
      />

      <div class="content-wrapper">
        <ContentNav
          :activeView="activeView"
          :visible="!!selectedGroup"
          @change="activeView = $event"
          @startRun="startRun"
        />

        <main class="content-area">
          <p v-if="!selectedGroup" class="placeholder">Wähle eine Lerngruppe aus</p>
          <RunView
            v-else-if="activeView === 'run'"
            :studyGroupId="selectedGroup.id"
            @runEnded="onRunEnded"
          />
          <IndexCardsView
            v-else-if="activeView === 'karteikarten'"
            :studyGroupId="selectedGroup.id"
            :cards="indexCards"
            :userRole="currentMemberRole"
            @cardCreated="refetchCards()"
          />
          <RankingView v-else-if="activeView === 'bestenliste'" :studyGroupId="selectedGroup.id" />
          <RunHistoryView v-else-if="activeView === 'historie'" :studyGroupId="selectedGroup.id" />
        </main>

        <MembersSidebar
          :members="members"
          :visible="!!selectedGroup"
          :currentUserRole="currentMemberRole"
          :studyGroupId="selectedGroup?.id"
          @openChat="chatOpen = true"
          @membersChanged="refetchGroup()"
        />
      </div>
    </div>

    <ChatPanel :visible="chatOpen" :chatId="selectedGroup?.chatId" :username="currentUser?.name" />

    <CreateStudyGroupModal
      v-if="showCreateGroup"
      @close="showCreateGroup = false"
      @created="onGroupCreated"
    />

    <JoinStudyGroupModal
      v-if="showJoinGroup"
      :joinedGroupIds="studyGroups.map((g) => g.id)"
      @close="showJoinGroup = false"
      @joined="onGroupJoined"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { useSubscription } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import GroupSwitcher from '../components/layout/GroupSwitcher.vue'
import DashboardHeader from '../components/layout/DashboardHeader.vue'
import ContentNav from '../components/layout/ContentNav.vue'
import MembersSidebar from '../components/layout/MembersSidebar.vue'
import ChatPanel from '../components/layout/ChatPanel.vue'
import IndexCardsView from '../components/content/IndexCardsView.vue'
import RankingView from '../components/content/RankingView.vue'
import RunHistoryView from '../components/content/RunHistoryView.vue'
import CreateStudyGroupModal from '../components/layout/CreateStudyGroupModal.vue'
import JoinStudyGroupModal from '../components/layout/JoinStudyGroupModal.vue'
import RunView from '../components/content/RunView.vue'
import '../assets/dashboard.css'
import { useOfflineAwareQuery } from '../composables/useOfflineAwareQuery.js'
import { getAllCachedStudyGroups, getCachedStudyGroup, getCachedIndexCards } from '../services/offlineStorage.service.js'

const router = useRouter()

const studyGroups = ref([])
const selectedGroup = ref(null)
const members = ref([])
const activeView = ref('karteikarten')
const userMenuOpen = ref(false)
const chatOpen = ref(false)
const showCreateGroup = ref(false)
const newGroupName = ref('')
const currentUser = ref(null)
const showJoinGroup = ref(false)

onMounted(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
    return
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    // Nur die userId kommt zuverlässig aus dem Token — name/email werden gleich
    // per Query nachgeladen (JWT enthält laut Konvention nur { userId, ... }).
    currentUser.value = { id: payload.userId, name: null, email: null }
  } catch {
    router.push('/login')
  }
})

const ME_QUERY = gql`
  query Me {
    me {
      id
      name
      email
    }
  }
`
const { result: meResult } = useQuery(ME_QUERY)

watch(meResult, (val) => {
  if (val?.me) {
    currentUser.value = val.me
  }
})

const GET_STUDY_GROUP = gql`
  query GetStudyGroup($id: ID!) {
    getStudyGroup(id: $id) {
      members {
        role
        user {
          id
          name
        }
      }
    }
  }
`

const GET_MY_STUDY_GROUPS = gql`
  query GetMyStudyGroups {
    getMyStudyGroups {
      id
      name
      chatId
      createdAt
    }
  }
`

const GET_INDEX_CARDS = gql`
  query GetIndexCards($studyGroupId: ID!) {
    getIndexCards(studyGroupId: $studyGroupId) {
      id
      studyGroupId
      question
      answer
      tags
      createdAt
      creator {
        id
        name
      }
      attachments {
        id
        filename
        mimeType
        sizeInBytes
        uploadedAt
      }
      groupStats {
        studyGroupId
        totalAttempts
        correctAnswers
      }
      userStats {
        userId
        totalAttempts
        correctAnswers
        lastSeenAt
      }
    }
  }
`

const LEAVE_STUDY_GROUP = gql`
  mutation LeaveStudyGroup($studyGroupId: ID!) {
    leaveStudyGroup(studyGroupId: $studyGroupId)
  }
`

const ON_INDEX_CARD_CREATED = gql`
  subscription OnIndexCardCreated($studyGroupId: ID!) {
    onIndexCardCreated(studyGroupId: $studyGroupId) {
      id
      studyGroupId
      question
      answer
      tags
      createdAt
      creator {
        id
        name
      }
      attachments {
        id
        filename
      }
      groupStats {
        studyGroupId
        totalAttempts
        correctAnswers
      }
      userStats {
        userId
        totalAttempts
        correctAnswers
        lastSeenAt
      }
    }
  }
`

const ON_INDEX_CARD_UPDATED = gql`
  subscription OnIndexCardUpdated($studyGroupId: ID!) {
    onIndexCardUpdated(studyGroupId: $studyGroupId) {
      id
      studyGroupId
      question
      answer
      tags
      createdAt
      creator {
        id
        name
      }
      attachments {
        id
        filename
        mimeType
        sizeInBytes
        uploadedAt
      }
      groupStats {
        studyGroupId
        totalAttempts
        correctAnswers
      }
      userStats {
        userId
        totalAttempts
        correctAnswers
        lastSeenAt
      }
    }
  }
`

const { result: newCardResult } = useSubscription(
  ON_INDEX_CARD_CREATED,
  () => ({ studyGroupId: selectedGroup.value?.id }),
  () => ({ enabled: !!selectedGroup.value?.id }),
)

watch(newCardResult, (val) => {
  const newCard = val?.onIndexCardCreated
  if (newCard && !indexCards.value.find((c) => c.id === newCard.id)) {
    // Apollo Cache wird automatisch aktualisiert durch refetch
    refetchCards()
  }
})

const currentMemberRole = computed(() => {
  if (!selectedGroup.value) return null
  const me = members.value.find((m) => m.user?.id === currentUser.value?.id)
  return me?.role || 'MEMBER'
})

const studyGroupIdForQuery = computed(() => selectedGroup.value?.id ?? null)

const { data: cardsData, refetch: refetchCards } = useOfflineAwareQuery(
  GET_INDEX_CARDS,
  () => ({ studyGroupId: studyGroupIdForQuery.value }),
  () => ({ enabled: !!studyGroupIdForQuery.value }),
  {
    dataKey: 'getIndexCards',
    cacheFn: () => getCachedIndexCards(studyGroupIdForQuery.value),
  },
)

const indexCards = computed(() => cardsData.value ?? [])

const runActive = ref(false)

function startRun() {
  runActive.value = true
  activeView.value = 'run'
}

// Wird ausgelöst, wenn der komplette Run vorbei ist (Sieg über den Boss oder
// Niederlage) — nicht bei jedem einzelnen Kampfende. RunView wird dabei durch
// den View-Wechsel unmounted, ihr Zustand ist beim nächsten "Run starten" also
// automatisch wieder frisch.
function onRunEnded() {
  runActive.value = false
  activeView.value = 'historie'
}

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}

const { mutate: leaveStudyGroupMutation } = useMutation(LEAVE_STUDY_GROUP)
const groupIdToLoad = ref(null)

const { data: groupData, refetch: refetchGroup } = useOfflineAwareQuery(
  GET_STUDY_GROUP,
  () => ({ id: groupIdToLoad.value }),
  () => ({ enabled: !!groupIdToLoad.value }),
  {
    dataKey: 'getStudyGroup',
    cacheFn: async () => {
      const cached = await getCachedStudyGroup(groupIdToLoad.value)
      return { members: cached?.members ?? [] }
    },
  },
)

watch(groupData, (val) => {
  members.value = val?.members ?? []
})

const { result: updatedCardResult } = useSubscription(
  ON_INDEX_CARD_UPDATED,
  () => ({ studyGroupId: selectedGroup.value?.id }),
  () => ({ enabled: !!selectedGroup.value?.id }),
)

watch(updatedCardResult, () => {
  refetchCards()
})

const ON_INDEX_CARD_DELETED = gql`
  subscription OnIndexCardDeleted($studyGroupId: ID!) {
    onIndexCardDeleted(studyGroupId: $studyGroupId)
  }
`

const { result: deletedCardResult } = useSubscription(
  ON_INDEX_CARD_DELETED,
  () => ({ studyGroupId: selectedGroup.value?.id }),
  () => ({ enabled: !!selectedGroup.value?.id }),
)

watch(deletedCardResult, () => {
  refetchCards()
})

function selectGroup(group) {
  selectedGroup.value = group
  activeView.value = 'karteikarten'
  groupIdToLoad.value = group.id
}

async function leaveGroup() {
  if (!selectedGroup.value) return
  try {
    await leaveStudyGroupMutation({ studyGroupId: selectedGroup.value.id })
    studyGroups.value = studyGroups.value.filter((g) => g.id !== selectedGroup.value.id)
    selectedGroup.value = null
    members.value = []
    userMenuOpen.value = false
  } catch (err) {
    console.error('Fehler beim Verlassen:', err)
  }
}

function onGroupCreated(group) {
  studyGroups.value = [...studyGroups.value, group]
  selectedGroup.value = group
  groupIdToLoad.value = group.id
  activeView.value = 'karteikarten'
}

function onGroupJoined(group) {
  if (!studyGroups.value.find((g) => g.id === group.id)) {
    studyGroups.value = [...studyGroups.value, group]
  }
  selectedGroup.value = group
  groupIdToLoad.value = group.id
  showJoinGroup.value = false
  activeView.value = 'karteikarten'
}

const { data: myGroupsData, isOffline: groupsOffline } = useOfflineAwareQuery(
  GET_MY_STUDY_GROUPS,
  () => ({}),
  () => ({}),
  {
    dataKey: 'getMyStudyGroups',
    cacheFn: () => getAllCachedStudyGroups(),
  },
)

watch(myGroupsData, (val) => {
  studyGroups.value = [...(val ?? [])]
})

onMounted(() => {
  // ...bestehender Code...
  document.addEventListener('chat-close', () => {
    chatOpen.value = false
  })
})

onUnmounted(() => {
  document.removeEventListener('chat-close', () => {
    chatOpen.value = false
  })
})
</script>