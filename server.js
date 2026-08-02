import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const TEAMS = [
  { id: 'wisdom', name: 'Seat of Wisdom', color: '#8ee88e', logo: '/team-logos/seat-of-wisdom.jpg' },
  { id: 'star', name: 'Morning Star', color: '#050505', logo: '/team-logos/morning-star.jpg' },
  { id: 'tower', name: 'Tower of David', color: '#e32227', logo: '/team-logos/tower-of-david.jpg' },
  { id: 'mirror', name: 'Mirror of Justice', color: '#4cc9ff', logo: '/team-logos/mirror-of-justice.jpg' },
]

const initialPlayers = ['', '', '', '']
const FINAL_TEAM_PLAYERS = {
  wisdom: [
    'Afam',
    'Victor',
    'Solar',
    'Monday',
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
  ],
  star: [
    'Obinna',
    'Emeka Eke',
    'Erike',
    'Nonny',
    'Barristrs',
    'Stanley Ugwu',
    'Uche oriaku',
    'Obiorah Ani',
    'Ifeanyi Akume',
    'Tobby Ekwueme',
    'Bernard',
    'Nelson',
    'Beer Nwaru',
    'Austine Adeyemi',
    'Austine Chukwu',
  ],
  tower: [
    'Inzaghi',
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
  ],
  mirror: [
    'Martins',
    'Adebayo philip',
    'Collins',
    'Michael',
    'Nonso Ike',
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

function publicState() {
  return {
    ...drawState,
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
})

httpServer.listen(PORT, () => {
  console.log(`All Stars draw server running on port ${PORT}`)
})
