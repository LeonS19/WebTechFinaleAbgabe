<template>
  <div class="dashboard">
    <GroupSwitcher
      :groups="studyGroups"
      :selectedGroupId="selectedGroup?.id"
      @select="selectGroup"
      @create="showCreateGroup = true"
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
            :cards="placeholderCards"
            :userRole="currentMemberRole"
          />
          <RankingView v-else-if="activeView === 'bestenliste'" :studyGroupId="selectedGroup.id" />
          <RunHistoryView v-else-if="activeView === 'historie'" :studyGroupId="selectedGroup.id" />
        </main>

        <MembersSidebar :members="members" :visible="!!selectedGroup" @openChat="chatOpen = true" />
      </div>
    </div>

    <ChatPanel :visible="chatOpen" />

    <!-- Create Group Modal -->
    <div v-if="showCreateGroup" class="modal-overlay" @click.self="showCreateGroup = false">
      <div class="modal">
        <h2>Neue Lerngruppe</h2>
        <input v-model="newGroupName" type="text" placeholder="Gruppenname" />
        <button @click="createGroup">Erstellen</button>
        <button class="cancel-btn" @click="showCreateGroup = false">Abbrechen</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import GroupSwitcher from '../components/layout/GroupSwitcher.vue'
import DashboardHeader from '../components/layout/DashboardHeader.vue'
import ContentNav from '../components/layout/ContentNav.vue'
import MembersSidebar from '../components/layout/MembersSidebar.vue'
import ChatPanel from '../components/layout/ChatPanel.vue'
import IndexCardsView from '../components/content/IndexCardsView.vue'
import RankingView from '../components/content/RankingView.vue'
import RunHistoryView from '../components/content/RunHistoryView.vue'
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

onMounted(() => {
  // TODO: Auth wieder einschalten nach Merge mit Person A
  // const token = localStorage.getItem('token');
  // if (!token) {
  //   router.push('/login');
  //   return;
  // }
  // try {
  //   const payload = JSON.parse(atob(token.split('.')[1]));
  //   currentUser.value = { id: payload.id, name: payload.name, email: payload.email };
  // } catch {
  //   router.push('/login');
  // }

  currentUser.value = { id: '1', name: 'Test User', email: 'test@test.com' }
  // TODO: per GraphQL laden
  studyGroups.value = [
    { id: '1', name: 'Webtech' },
    { id: '2', name: 'Datenbanken' },
  ]
})

const currentMemberRole = computed(() => {
  if (!selectedGroup.value) return null
  const me = members.value.find((m) => m.userId === currentUser.value?.id)
  return me?.role || 'MEMBER'
})

const placeholderCards = ref([
  {
    id: '1',
    question: 'Was ist eine REST API?',
    answer: 'Ein Architekturstil für verteilte Systeme der auf HTTP basiert.',
    tags: ['REST', 'API', 'Backend'],
    creator: { id: '1', name: 'Anna' },
    createdAt: '2026-06-01T10:00:00Z',
    attachments: [],
    groupStats: [{ studyGroupId: '1', totalAttempts: 10, correctAnswers: 7 }],
    userStats: [{ userId: '1', totalAttempts: 5, correctAnswers: 4 }],
  },
  {
    id: '2',
    question: 'Was ist GraphQL?',
    answer: 'Eine Abfragesprache für APIs entwickelt von Facebook.',
    tags: ['GraphQL', 'API'],
    creator: { id: '2', name: 'Ben' },
    createdAt: '2026-06-02T10:00:00Z',
    attachments: [],
    groupStats: [],
    userStats: [],
  },
  {
    id: '3',
    question: 'Was ist Vue.js?',
    answer: 'Ein progressives JavaScript Framework für Benutzeroberflächen.',
    tags: ['Vue', 'Frontend'],
    creator: { id: '1', name: 'Anna' },
    createdAt: '2026-06-03T10:00:00Z',
    attachments: [],
    groupStats: [],
    userStats: [],
  },
])

function selectGroup(group) {
  selectedGroup.value = group
  activeView.value = 'karteikarten'
  // TODO: per GraphQL laden
  members.value = [
    { userId: '1', user: { name: 'Anna' }, role: 'ADMIN' },
    { userId: '2', user: { name: 'Ben' }, role: 'MEMBER' },
  ]
}

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}

function leaveGroup() {
  // TODO: leaveStudyGroup Mutation aufrufen
  selectedGroup.value = null
  members.value = []
  userMenuOpen.value = false
}

function createGroup() {
  if (!newGroupName.value.trim()) return
  // TODO: createStudyGroup Mutation aufrufen
  studyGroups.value.push({ id: Date.now().toString(), name: newGroupName.value })
  newGroupName.value = ''
  showCreateGroup.value = false
}

function startRun() {
  // TODO: startRun Mutation aufrufen
}
</script>
