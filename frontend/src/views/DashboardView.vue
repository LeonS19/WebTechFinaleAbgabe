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
          <IndexCardsView
            v-else-if="activeView === 'karteikarten'"
            :studyGroupId="selectedGroup.id"
            :cards="indexCards"
            :userRole="currentMemberRole"
          />
          <RankingView v-else-if="activeView === 'bestenliste'" :studyGroupId="selectedGroup.id" />
          <RunHistoryView v-else-if="activeView === 'historie'" :studyGroupId="selectedGroup.id" />
        </main>

        <MembersSidebar :members="members" :visible="!!selectedGroup" @openChat="chatOpen = true" />
      </div>
    </div>

    <ChatPanel :visible="chatOpen" />

    <CreateStudyGroupModal
      v-if="showCreateGroup"
      @close="showCreateGroup = false"
      @created="onGroupCreated"
    />

    <JoinStudyGroupModal
      v-if="showJoinGroup"
      :joinedGroupIds="studyGroups.map(g => g.id)"
      @close="showJoinGroup = false"
      @joined="onGroupJoined"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, useMutation } from '@vue/apollo-composable'
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
import '../assets/dashboard.css'

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
  const token = localStorage.getItem('token');
  if (!token) {
    router.push('/login');
    return;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUser.value = { id: payload.id, name: payload.name, email: payload.email };
  } catch {
    router.push('/login');
  }

})

const GET_STUDY_GROUP = gql`
  query GetStudyGroup($id: ID!) {
    getStudyGroup(id: $id) {
      members {
        userId
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

const currentMemberRole = computed(() => {
  if (!selectedGroup.value) return null
  const me = members.value.find((m) => m.userId === currentUser.value?.id)
  return me?.role || 'MEMBER'
})

const studyGroupIdForQuery = computed(() => selectedGroup.value?.id ?? null)

const { result: cardsResult, refetch: refetchCards } = useQuery(
  GET_INDEX_CARDS,
  () => ({ studyGroupId: studyGroupIdForQuery.value }),
  () => ({ enabled: !!studyGroupIdForQuery.value }),
)

const indexCards = computed(() => cardsResult.value?.getIndexCards ?? [])

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}

const { mutate: leaveStudyGroupMutation } = useMutation(LEAVE_STUDY_GROUP)
const groupIdToLoad = ref(null)

const { result: groupResult } = useQuery(
  GET_STUDY_GROUP,
  () => ({ id: groupIdToLoad.value }),
  () => ({ enabled: !!groupIdToLoad.value })
)

watch(groupResult, (val) => {
  members.value = val?.getStudyGroup?.members ?? []
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
    studyGroups.value = studyGroups.value.filter(g => g.id !== selectedGroup.value.id)
    selectedGroup.value = null
    members.value = []
    userMenuOpen.value = false
  } catch (err) {
    console.error('Fehler beim Verlassen:', err)
  }
}

function onGroupCreated(group) {
  studyGroups.value.push(group);
  selectedGroup.value = group;
  activeView.value = 'karteikarten';
}

function onGroupJoined(group) {
  if (!studyGroups.value.find(g => g.id === group.id)) {
    studyGroups.value.push(group);
  }
  selectedGroup.value = group;
  showJoinGroup.value = false;
  activeView.value = 'karteikarten';
}

const { result: myGroupsResult } = useQuery(GET_MY_STUDY_GROUPS)

watch(myGroupsResult, (val) => {
  studyGroups.value = val?.getMyStudyGroups ?? []
})

function startRun() {
  // TODO: startRun Mutation aufrufen
}
</script>
