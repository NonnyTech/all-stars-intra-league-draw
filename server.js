import express from 'express'
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import pg from 'pg'
import { Server } from 'socket.io'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

const PORT = process.env.PORT || 3000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AllStars@2026$'
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || 'watch2026'
const DATA_FILE = path.join(__dirname, 'league-state.json')
const DATABASE_URL = process.env.DATABASE_URL
const DATABASE_SSL = process.env.DATABASE_SSL ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')
const LEAGUE_TEST_MODE = process.env.LEAGUE_TEST_MODE === 'true'
const { Pool } = pg
const db = DATABASE_URL && !LEAGUE_TEST_MODE
  ? new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 10000,
      ssl: DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    })
  : null
let storageReady = false

const TEAMS = [
  { id: 'wisdom', name: 'Seat of Wisdom', color: '#8ee88e', logo: '/team-logos/seat-of-wisdom.jpg' },
  { id: 'star', name: 'Morning Star', color: '#050505', logo: '/team-logos/morning-star.jpg' },
  { id: 'tower', name: 'Tower of David', color: '#e32227', logo: '/team-logos/tower-of-david.jpg' },
  { id: 'mirror', name: 'Mirror of Justice', color: '#4cc9ff', logo: '/team-logos/mirror-of-justice.jpg' },
]

const initialPlayers = ['', '', '', '']
const FIXTURES = [
  { id: '2026-09-12-0845-wisdom-mirror', date: '12 Sept 2026', time: '8:45 AM', homeTeamId: 'wisdom', awayTeamId: 'mirror' },
  { id: '2026-09-12-1000-tower-star', date: '12 Sept 2026', time: '10:00 AM', homeTeamId: 'tower', awayTeamId: 'star' },
  { id: '2026-09-19-0845-mirror-star', date: '19 Sept 2026', time: '8:45 AM', homeTeamId: 'mirror', awayTeamId: 'star' },
  { id: '2026-09-19-1000-tower-wisdom', date: '19 Sept 2026', time: '10:00 AM', homeTeamId: 'tower', awayTeamId: 'wisdom' },
  { id: '2026-09-26-1015-wisdom-star', date: '26 Sept 2026', time: '10:15 AM', homeTeamId: 'wisdom', awayTeamId: 'star' },
  { id: '2026-09-26-1130-mirror-tower', date: '26 Sept 2026', time: '11:30 AM', homeTeamId: 'mirror', awayTeamId: 'tower' },
  { id: '2026-10-01-0845-star-tower', date: '1 Oct 2026', time: '8:45 AM', homeTeamId: 'star', awayTeamId: 'tower' },
  { id: '2026-10-01-1000-mirror-wisdom', date: '1 Oct 2026', time: '10:00 AM', homeTeamId: 'mirror', awayTeamId: 'wisdom' },
  { id: '2026-10-03-0845-wisdom-tower', date: '3 Oct 2026', time: '8:45 AM', homeTeamId: 'wisdom', awayTeamId: 'tower' },
  { id: '2026-10-03-1000-star-mirror', date: '3 Oct 2026', time: '10:00 AM', homeTeamId: 'star', awayTeamId: 'mirror' },
  { id: '2026-10-10-0845-tower-mirror', date: '10 Oct 2026', time: '8:45 AM', homeTeamId: 'tower', awayTeamId: 'mirror' },
  { id: '2026-10-10-1000-star-wisdom', date: '10 Oct 2026', time: '10:00 AM', homeTeamId: 'star', awayTeamId: 'wisdom' },
]
const FINAL_TEAM_PLAYERS = {
  wisdom: [
    'Afam',
    'Victor',
    'Solar',
    'Monday  (C)',
    'Pius',
    'Okekpe',
    'Stanley Njoku',
    'Jerome',
    'Princewill',
    'Dickson',
    'Ifeanyi Onyeguli',
    'Ebuka Ukah',
    'Cosmos',
    'David Omana',
    'Arinze Ugboeke',
    'Kizito Ugbeda  (GK)',
  ],
  star: [
    'Obinna',
    'Emeka Ekediegwu   (C)',
    'Erike',
    'Nonny',
    'Barrister',
    'Stanley Ugwu',
    'Uche oriaku',
    'Obiorah Ani',
    'Ifeanyi Akume',
    'Tobby Ekwueme',
    'Bernard',
    'Nelson',
    'Bert Nwaru',
    'Austine Adeyemi',
    'Austine Chukwu',
    'Amaechi Dominic (GK)',
  ],
  tower: [
    'Inzaghi   (C)',
    'Anyanwu U',
    'Miracle',
    'Yemi',
    'Sir kay',
    'Kevin ani',
    'Alex Nwaru',
    'Patrick Kolu',
    'Epa',
    'Destiny',
    'Chuba Okoli',
    'Ebuka Ani',
    'Chief Emeruwa',
    'Ifeanyi Ebieye',
    'Remi Agim',
    'Kenneth Okechukwu   (GK)'
  ],
  mirror: [
    'Martins',
    'Adebayo philip',
    'Collins',
    'Michael',
    'Nonso Ike  (C)',
    'Nwakanobi',
    'Henry ike',
    'Emma Anyanwu',
    'Hyginus',
    'Chisom',
    'Charles Onochie',
    'Sunday Okoro',
    'Oti',
    'Hilary nsofor',
    'Onwa',
    'Ogar Friday  (GK)',
  ],
}

function buildFinalAssignments() {
  return TEAMS.flatMap((team) =>
    FINAL_TEAM_PLAYERS[team.id].map((player) => ({
      player,
      team,
    })),
  )
}

let drawState = {
  assignments: buildFinalAssignments(),
  currentGroupAssignments: [],
  currentPlayerIndex: 0,
  isSpinning: false,
  lastWinnerId: null,
  players: initialPlayers,
  remainingTeams: TEAMS,
  rotation: 0,
  spinEndsAt: null,
}

const firstFixture = FIXTURES[0]
const defaultMatchState = {
  fixtureId: firstFixture.id,
  homeTeamId: firstFixture.homeTeamId,
  awayTeamId: firstFixture.awayTeamId,
  homeScore: 0,
  awayScore: 0,
  status: 'Not started',
  minute: '',
  clockStartedAt: null,
  elapsedSeconds: 0,
  events: [],
}

const SEEDED_COMPLETED_RESULTS = [
  {
    id: '2026-09-12-0845-wisdom-mirror',
    date: '12 Sept 2026',
    time: '8:45 AM',
    homeTeamId: 'wisdom',
    awayTeamId: 'mirror',
    homeScore: 2,
    awayScore: 1,
    status: 'Full time',
    savedAt: '2026-09-12T00:00:00.000Z',
    events: [
      { id: 'wisdom-mirror-afam', assist: '', minute: '', note: '', scorer: 'Afam', teamId: 'wisdom', type: 'Goal' },
      { id: 'wisdom-mirror-stanley', assist: '', minute: '', note: '', scorer: 'Stanley Njoku', teamId: 'wisdom', type: 'Goal' },
      { id: 'wisdom-mirror-martins', assist: '', minute: '', note: '', scorer: 'Martins', teamId: 'mirror', type: 'Goal' },
      { id: 'wisdom-mirror-yellow-dickson', assist: '', minute: '', note: '', scorer: 'Dickson', teamId: 'wisdom', type: 'Yellow Card' },
      { id: 'wisdom-mirror-yellow-pius', assist: '', minute: '', note: '', scorer: 'Pius', teamId: 'wisdom', type: 'Yellow Card' },
      { id: 'wisdom-mirror-yellow-victor', assist: '', minute: '', note: '', scorer: 'Victor', teamId: 'wisdom', type: 'Yellow Card' },
      { id: 'wisdom-mirror-yellow-henry-ike', assist: '', minute: '', note: '', scorer: 'Henry Ike', teamId: 'mirror', type: 'Yellow Card' },
    ],
  },
  {
    id: '2026-09-12-1000-tower-star',
    date: '12 Sept 2026',
    time: '10:00 AM',
    homeTeamId: 'tower',
    awayTeamId: 'star',
    homeScore: 1,
    awayScore: 2,
    status: 'Full time',
    savedAt: '2026-09-12T00:00:00.000Z',
    events: [
      { id: 'tower-star-inzaghi', assist: '', minute: '', note: '', scorer: 'Inzaghi', teamId: 'tower', type: 'Goal' },
      { id: 'tower-star-uche-oriaku', assist: '', minute: '', note: '', scorer: 'Uche oriaku', teamId: 'star', type: 'Goal' },
      { id: 'tower-star-obinna', assist: '', minute: '', note: '', scorer: 'Obinna', teamId: 'star', type: 'Goal' },
      { id: 'tower-star-yellow-yemi', assist: '', minute: '', note: '', scorer: 'Yemi', teamId: 'tower', type: 'Yellow Card' },
      { id: 'tower-star-yellow-tobby-ekwueme', assist: '', minute: '', note: '', scorer: 'Tobby Ekwueme', teamId: 'star', type: 'Yellow Card' },
    ],
  },
]

let matchState = { ...defaultMatchState }
let completedResults = []

function buildLeagueTable() {
  const table = Object.fromEntries(
    TEAMS.map((team) => [
      team.id,
      {
        teamId: team.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  )

  completedResults.forEach((result) => {
    const home = table[result.homeTeamId]
    const away = table[result.awayTeamId]
    if (!home || !away) return

    const homeScore = Number(result.homeScore) || 0
    const awayScore = Number(result.awayScore) || 0

    home.played += 1
    away.played += 1
    home.goalsFor += homeScore
    home.goalsAgainst += awayScore
    away.goalsFor += awayScore
    away.goalsAgainst += homeScore

    if (homeScore > awayScore) {
      home.won += 1
      away.lost += 1
      home.points += 3
    } else if (awayScore > homeScore) {
      away.won += 1
      home.lost += 1
      away.points += 3
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  })

  return Object.values(table)
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return TEAMS.find((team) => team.id === a.teamId).name.localeCompare(
        TEAMS.find((team) => team.id === b.teamId).name,
      )
    })
}

async function initDatabase() {
  if (!db) return

  await db.query(`
    create table if not exists league_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `)
}

async function saveLeagueState() {
  if (LEAGUE_TEST_MODE) return { ok: true, storage: 'memory' }

  const nextState = { completedResults, matchState }

  if (db) {
    try {
      await db.query(
        `
          insert into league_state (id, data, updated_at)
          values ($1, $2, now())
          on conflict (id)
          do update set data = excluded.data, updated_at = now()
        `,
        ['main', nextState],
      )
      storageReady = true
      return { ok: true, storage: 'database' }
    } catch (error) {
      storageReady = false
      console.error('Unable to save league state to database:', error)
    }
  }

  writeFileSync(DATA_FILE, JSON.stringify({ completedResults, matchState }, null, 2))
  return { ok: !db, storage: 'file' }
}

async function loadLeagueState() {
  if (LEAGUE_TEST_MODE) return

  if (db) {
    try {
      const result = await db.query('select data from league_state where id = $1', ['main'])
      const savedState = result.rows[0]?.data

      if (savedState?.matchState) {
        matchState = { ...defaultMatchState, ...savedState.matchState }
      }
      if (Array.isArray(savedState?.completedResults)) {
        completedResults = savedState.completedResults
      }
      return
    } catch (error) {
      console.error('Unable to load league state from database:', error)
    }
  }

  if (!existsSync(DATA_FILE)) return

  try {
    const savedState = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    if (savedState.matchState) {
      matchState = { ...defaultMatchState, ...savedState.matchState }
    }
    if (Array.isArray(savedState.completedResults)) {
      completedResults = savedState.completedResults
    }
  } catch (error) {
    console.error('Unable to load league state:', error)
  }
}

function mergeSeededResults() {
  const savedResultIds = new Set(completedResults.map((result) => result.id))
  completedResults = [
    ...completedResults,
    ...SEEDED_COMPLETED_RESULTS.filter((result) => !savedResultIds.has(result.id)),
  ]
}

function currentElapsedSeconds() {
  const savedSeconds = Number(matchState.elapsedSeconds) || 0
  if (!matchState.clockStartedAt) return savedSeconds

  return savedSeconds + Math.max(0, Math.floor((Date.now() - matchState.clockStartedAt) / 1000))
}

function formatMatchClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function publicMatchState() {
  return {
    ...matchState,
    minute: matchState.status === 'Not started' ? '' : formatMatchClock(currentElapsedSeconds()),
  }
}

function applyMatchStatus(status) {
  if (status === matchState.status) return

  const elapsedSeconds = currentElapsedSeconds()

  if (status === 'First half') {
    matchState = {
      ...matchState,
      status,
      elapsedSeconds: matchState.status === 'Not started' ? 0 : elapsedSeconds,
      clockStartedAt: Date.now(),
    }
    return
  }

  if (status === 'Second half') {
    matchState = {
      ...matchState,
      status,
      elapsedSeconds: Math.max(elapsedSeconds, 45 * 60),
      clockStartedAt: Date.now(),
    }
    return
  }

  matchState = {
    ...matchState,
    status,
    elapsedSeconds,
    clockStartedAt: null,
  }
}

function publicState() {
  return {
    ...drawState,
    completedResults,
    fixtures: FIXTURES,
    leagueTable: buildLeagueTable(),
    matchState: publicMatchState(),
    teams: TEAMS,
  }
}

function requireAdmin(socket) {
  return socket.data.isAdmin === true
}

function isAuthorized(socket) {
  return socket.data.role === 'admin' || socket.data.role === 'member'
}

function emitState() {
  io.emit('draw-state', publicState())
}

app.use(express.static(path.join(__dirname, 'dist')))

app.use((_request, response) => {
  response.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

io.on('connection', (socket) => {
  socket.emit('draw-state', publicState())

  socket.on('login', ({ role, password }, callback) => {
    const isAdminLogin = role === 'admin'
    const isMemberLogin = role === 'member'
    const ok =
      (isAdminLogin && password === ADMIN_PASSWORD) || (isMemberLogin && password === MEMBER_PASSWORD)

    socket.data.isAdmin = ok && isAdminLogin
    socket.data.role = ok ? role : null
    callback?.({ ok })
    socket.emit('draw-state', publicState())
  })

  socket.on('update-player', ({ index, value }) => {
    if (!isAuthorized(socket) || !requireAdmin(socket) || drawState.isSpinning) return
    if (!Number.isInteger(index) || index < 0 || index >= initialPlayers.length) return

    const players = [...drawState.players]
    players[index] = String(value ?? '')
    drawState = { ...drawState, players }
    emitState()
  })

  socket.on('spin-wheel', () => {
    if (!isAuthorized(socket) || !requireAdmin(socket) || drawState.isSpinning) return

    const currentPlayerName = drawState.players[drawState.currentPlayerIndex]?.trim()
    if (!currentPlayerName || drawState.remainingTeams.length === 0) return

    if (drawState.remainingTeams.length === 1) {
      const finalTeam = drawState.remainingTeams[0]
      const assignment = { player: currentPlayerName, team: finalTeam }

      drawState = {
        ...drawState,
        assignments: [...drawState.assignments, assignment],
        currentGroupAssignments: [...drawState.currentGroupAssignments, assignment],
        currentPlayerIndex: Math.min(drawState.currentPlayerIndex + 1, TEAMS.length - 1),
        lastWinnerId: finalTeam.id,
        remainingTeams: [],
      }
      emitState()
      return
    }

    const winningIndex = Math.floor(Math.random() * drawState.remainingTeams.length)
    const winningTeam = drawState.remainingTeams[winningIndex]
    const slice = 360 / drawState.remainingTeams.length
    const targetMiddle = winningIndex * slice + slice / 2
    const pointerAngle = 270
    const fullTurns = 55 + Math.floor(Math.random() * 16)
    const finalRotation = drawState.rotation + fullTurns * 360 + pointerAngle - targetMiddle
    const spinEndsAt = Date.now() + 15000

    drawState = {
      ...drawState,
      isSpinning: true,
      lastWinnerId: null,
      rotation: finalRotation,
      spinEndsAt,
    }
    emitState()

    setTimeout(() => {
      const assignment = { player: currentPlayerName, team: winningTeam }
      drawState = {
        ...drawState,
        assignments: [...drawState.assignments, assignment],
        currentGroupAssignments: [...drawState.currentGroupAssignments, assignment],
        currentPlayerIndex: Math.min(drawState.currentPlayerIndex + 1, TEAMS.length - 1),
        isSpinning: false,
        lastWinnerId: winningTeam.id,
        remainingTeams: drawState.remainingTeams.filter((team) => team.id !== winningTeam.id),
        spinEndsAt: null,
      }
      emitState()
    }, 15000)
  })

  socket.on('start-next-group', () => {
    if (!isAuthorized(socket) || !requireAdmin(socket) || drawState.isSpinning) return

    drawState = {
      ...drawState,
      currentGroupAssignments: [],
      currentPlayerIndex: 0,
      lastWinnerId: null,
      players: initialPlayers,
      remainingTeams: TEAMS,
      rotation: 0,
      spinEndsAt: null,
    }
    emitState()
  })

  socket.on('reset-tournament', () => {
    if (!isAuthorized(socket) || !requireAdmin(socket) || drawState.isSpinning) return

    drawState = {
      assignments: [],
      currentGroupAssignments: [],
      currentPlayerIndex: 0,
      isSpinning: false,
      lastWinnerId: null,
      players: initialPlayers,
      remainingTeams: TEAMS,
      rotation: 0,
      spinEndsAt: null,
    }
    emitState()
  })

  socket.on('update-match', async (nextMatchState) => {
    if (!isAuthorized(socket) || !requireAdmin(socket)) return

    const selectedFixture = FIXTURES.find((fixture) => fixture.id === nextMatchState.fixtureId)
    if (selectedFixture && selectedFixture.id !== matchState.fixtureId) {
      matchState = {
        ...defaultMatchState,
        fixtureId: selectedFixture.id,
        homeTeamId: selectedFixture.homeTeamId,
        awayTeamId: selectedFixture.awayTeamId,
      }
      emitState()
      await saveLeagueState()
      return
    }

    const { status, minute: _minute, ...matchUpdates } = nextMatchState
    matchState = { ...matchState, ...matchUpdates }
    if (status) applyMatchStatus(status)
    emitState()
    await saveLeagueState()
  })

  socket.on('add-match-event', async (event) => {
    if (!isAuthorized(socket) || !requireAdmin(socket)) return

    const nextEvent = {
      id: Date.now(),
      assist: String(event.assist ?? '').trim(),
      minute:
        String(event.minute ?? '').trim() ||
        (matchState.status === 'Not started' ? '' : `${Math.max(1, Math.ceil(currentElapsedSeconds() / 60))}'`),
      note: String(event.note ?? '').trim(),
      scorer: String(event.scorer ?? '').trim(),
      teamId: event.teamId,
      type: event.type || 'Goal',
    }

    if (!nextEvent.scorer && !nextEvent.note) return

    matchState = {
      ...matchState,
      events: [nextEvent, ...matchState.events],
    }
    emitState()
    await saveLeagueState()
  })

  socket.on('delete-match-event', async (eventId) => {
    if (!isAuthorized(socket) || !requireAdmin(socket)) return

    matchState = {
      ...matchState,
      events: matchState.events.filter((event) => event.id !== eventId),
    }
    emitState()
    await saveLeagueState()
  })

  socket.on('reset-live-match', async () => {
    if (!isAuthorized(socket) || !requireAdmin(socket)) return

    const selectedFixture = FIXTURES.find((fixture) => fixture.id === matchState.fixtureId) ?? firstFixture
    matchState = {
      ...defaultMatchState,
      fixtureId: selectedFixture.id,
      homeTeamId: selectedFixture.homeTeamId,
      awayTeamId: selectedFixture.awayTeamId,
    }
    emitState()
    await saveLeagueState()
  })

  socket.on('save-match-result', async (callback) => {
    if (!isAuthorized(socket) || !requireAdmin(socket)) return

    const selectedFixture = FIXTURES.find((fixture) => fixture.id === matchState.fixtureId) ?? firstFixture
    const homeScore = Number(matchState.homeScore) || 0
    const awayScore = Number(matchState.awayScore) || 0
    const homeGoals = matchState.events.filter(
      (event) => event.type === 'Goal' && event.teamId === selectedFixture.homeTeamId,
    ).length
    const awayGoals = matchState.events.filter(
      (event) => event.type === 'Goal' && event.teamId === selectedFixture.awayTeamId,
    ).length

    if (homeGoals !== homeScore || awayGoals !== awayScore) {
      const homeTeam = TEAMS.find((team) => team.id === selectedFixture.homeTeamId)
      const awayTeam = TEAMS.find((team) => team.id === selectedFixture.awayTeamId)
      callback?.({
        ok: false,
        reason: 'goal-mismatch',
        message: `Recorded goals do not match the score. ${homeTeam.name}: ${homeScore} score, ${homeGoals} scorers. ${awayTeam.name}: ${awayScore} score, ${awayGoals} scorers.`,
      })
      return
    }

    const result = {
      id: selectedFixture.id,
      date: selectedFixture.date,
      events: matchState.events,
      homeScore,
      homeTeamId: selectedFixture.homeTeamId,
      savedAt: new Date().toISOString(),
      status: 'Full time',
      time: selectedFixture.time,
      awayScore,
      awayTeamId: selectedFixture.awayTeamId,
    }

    completedResults = [result, ...completedResults.filter((item) => item.id !== result.id)]
    applyMatchStatus('Full time')
    emitState()
    const saveResult = await saveLeagueState()
    callback?.({
      ok: saveResult.ok,
      storage: saveResult.storage,
    })
  })

  socket.on('update-completed-result', async (updatedResult, callback) => {
    if (!isAuthorized(socket) || !requireAdmin(socket)) return

    const existingResult = completedResults.find((result) => result.id === updatedResult?.id)
    if (!existingResult) {
      callback?.({ ok: false, message: 'This completed result could not be found.' })
      return
    }

    const homeScore = Math.max(0, Number(updatedResult.homeScore) || 0)
    const awayScore = Math.max(0, Number(updatedResult.awayScore) || 0)
    const validTeamIds = [existingResult.homeTeamId, existingResult.awayTeamId]
    const events = Array.isArray(updatedResult.events)
      ? updatedResult.events
          .filter((event) => validTeamIds.includes(event.teamId) && ['Goal', 'Yellow Card', 'Red Card'].includes(event.type))
          .map((event, index) => ({
            id: event.id || `${Date.now()}-${index}`,
            assist: String(event.assist ?? '').trim(),
            minute: String(event.minute ?? '').trim(),
            note: String(event.note ?? '').trim(),
            scorer: String(event.scorer ?? '').trim(),
            teamId: event.teamId,
            type: event.type,
          }))
          .filter((event) => event.scorer)
      : []
    const homeGoals = events.filter((event) => event.type === 'Goal' && event.teamId === existingResult.homeTeamId).length
    const awayGoals = events.filter((event) => event.type === 'Goal' && event.teamId === existingResult.awayTeamId).length

    if (homeGoals !== homeScore || awayGoals !== awayScore) {
      callback?.({
        ok: false,
        message: `The scorer entries must match the score (${homeGoals}-${awayGoals} entered, ${homeScore}-${awayScore} score).`,
      })
      return
    }

    const correctedResult = { ...existingResult, awayScore, events, homeScore, savedAt: new Date().toISOString() }
    completedResults = completedResults.map((result) =>
      result.id === correctedResult.id ? correctedResult : result,
    )
    emitState()
    const saveResult = await saveLeagueState()
    callback?.({
      ok: saveResult.ok,
      storage: saveResult.storage,
      message: saveResult.ok && saveResult.storage === 'database'
        ? 'Result updated permanently in PostgreSQL.'
        : 'PostgreSQL update failed. Check the server logs.',
    })
  })
})

setInterval(() => {
  if (matchState.clockStartedAt) emitState()
}, 1000)

async function startServer() {
  if (LEAGUE_TEST_MODE) {
    console.log('League test mode enabled: changes will not be saved')
  }

  try {
    await initDatabase()
    await loadLeagueState()
    if (!LEAGUE_TEST_MODE) mergeSeededResults()
    const saveResult = await saveLeagueState()
    storageReady = saveResult.storage === 'database'
  } catch (error) {
    console.error('Unable to initialize league storage:', error)
    await loadLeagueState()
    mergeSeededResults()
    storageReady = !db
  }

  httpServer.listen(PORT, () => {
    console.log(`All Stars draw server running on port ${PORT}`)
    console.log(
      `League storage: ${LEAGUE_TEST_MODE ? 'test memory only (not saved)' : db && storageReady ? 'PostgreSQL database' : 'local JSON file'}`,
    )
  })
}

startServer()
