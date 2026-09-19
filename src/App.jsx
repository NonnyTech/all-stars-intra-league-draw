import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import { io } from 'socket.io-client'
import './App.css'

const socket = io()

const fallbackTeams = [
  { id: 'wisdom', name: 'Seat of Wisdom', color: '#8ee88e', logo: '/team-logos/seat-of-wisdom.jpg' },
  { id: 'star', name: 'Morning Star', color: '#050505', logo: '/team-logos/morning-star.jpg' },
  { id: 'tower', name: 'Tower of David', color: '#e32227', logo: '/team-logos/tower-of-david.jpg' },
  { id: 'mirror', name: 'Mirror of Justice', color: '#4cc9ff', logo: '/team-logos/mirror-of-justice.jpg' },
]

const teamLogoById = Object.fromEntries(fallbackTeams.map((team) => [team.id, team.logo]))
const leagueTable = [
  { teamId: 'wisdom', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  { teamId: 'star', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  { teamId: 'tower', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  { teamId: 'mirror', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
]

const fixtures = [
  {
    date: '12 Sept 2026',
    matches: [
      { time: '8:45 AM', homeTeamId: 'wisdom', awayTeamId: 'mirror' },
      { time: '10:00 AM', homeTeamId: 'tower', awayTeamId: 'star' },
    ],
  },
  {
    date: '19 Sept 2026',
    matches: [
      { time: '8:45 AM', homeTeamId: 'mirror', awayTeamId: 'star' },
      { time: '10:00 AM', homeTeamId: 'tower', awayTeamId: 'wisdom' },
    ],
  },
  {
    date: '26 Sept 2026',
    matches: [
      { time: '10:15 AM', homeTeamId: 'wisdom', awayTeamId: 'star' },
      { time: '11:30 AM', homeTeamId: 'mirror', awayTeamId: 'tower' },
    ],
  },
  {
    date: '1 Oct 2026',
    matches: [
      { time: '8:45 AM', homeTeamId: 'star', awayTeamId: 'tower' },
      { time: '10:00 AM', homeTeamId: 'mirror', awayTeamId: 'wisdom' },
    ],
  },
  {
    date: '3 Oct 2026',
    matches: [
      { time: '8:45 AM', homeTeamId: 'wisdom', awayTeamId: 'tower' },
      { time: '10:00 AM', homeTeamId: 'star', awayTeamId: 'mirror' },
    ],
  },
  {
    date: '10 Oct 2026',
    matches: [
      { time: '8:45 AM', homeTeamId: 'tower', awayTeamId: 'mirror' },
      { time: '10:00 AM', homeTeamId: 'star', awayTeamId: 'wisdom' },
    ],
  },
]

function flattenFixtureGroups(fixtureGroups) {
  return fixtureGroups.flatMap((fixtureGroup) =>
    fixtureGroup.matches.map((match) => ({
      ...match,
      date: fixtureGroup.date,
      id: fixtureIdFor(fixtureGroup.date, match.time, match.homeTeamId, match.awayTeamId),
    })),
  )
}

function fixtureIdFor(date, time, homeTeamId, awayTeamId) {
  const normalizedDate = date
    .replace('Sept', '09')
    .replace('Oct', '10')
    .replace(/\s+/g, '-')
    .replace(/-2026$/, '')
  const [day, month] = normalizedDate.split('-')
  const normalizedTime = time.replace(':', '').replace(/\s+/g, '').replace(/[ap]m/i, '').padStart(4, '0')

  return `2026-${month}-${day.padStart(2, '0')}-${normalizedTime}-${homeTeamId}-${awayTeamId}`
}

const finalTeamPlayers = {
  wisdom: [
    'Afam',
    'Victor Dumbri',
    'Solar',
    'Monday  (C)',
    'Pius',
    'Edwin',
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
    'Amaechi Dominic   (GK)',
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
    'Kenneth Okechukwu   (GK)',
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
    'Chief Onwa',
    'Ogar Friday  (GK)',
  ],
}

function buildFinalAssignments() {
  return fallbackTeams.flatMap((team) =>
    finalTeamPlayers[team.id].map((player) => ({
      player,
      team,
    })),
  )
}

const initialState = {
  assignments: buildFinalAssignments(),
  currentGroupAssignments: [],
  currentPlayerIndex: 0,
  isSpinning: false,
  lastWinnerId: null,
  players: ['', '', '', ''],
  remainingTeams: fallbackTeams,
  rotation: 0,
  teams: fallbackTeams,
  completedResults: [],
  fixtures: flattenFixtureGroups(fixtures),
  leagueTable,
  matchState: {
    fixtureId: '2026-09-12-0845-wisdom-mirror',
    homeTeamId: 'wisdom',
    awayTeamId: 'mirror',
    homeScore: 0,
    awayScore: 0,
    status: 'Not started',
    minute: '',
    events: [],
  },
}

function App() {
  const [drawState, setDrawState] = useState(initialState)
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [loginMode, setLoginMode] = useState('member')
  const [loginError, setLoginError] = useState('')
  const [memberView, setMemberView] = useState('home')
  const [adminView, setAdminView] = useState('dashboard')
  const [eventForm, setEventForm] = useState({
    assist: '',
    minute: '',
    note: '',
    scorer: '',
    teamId: initialState.matchState.homeTeamId,
    type: 'Goal',
  })
  const isAdmin = role === 'admin'
  const isLoggedIn = role === 'admin' || role === 'member'

  const {
    assignments,
    currentGroupAssignments,
    currentPlayerIndex,
    isSpinning,
    lastWinnerId,
    players,
    remainingTeams,
    rotation,
    teams,
    completedResults = [],
    fixtures: matchFixtures = initialState.fixtures,
    leagueTable: currentLeagueTable = leagueTable,
    matchState = initialState.matchState,
  } = drawState

  const normalizedTeams = teams.map((team) => ({
    ...team,
    logo: team.logo || teamLogoById[team.id] || '',
  }))
  const teamById = useMemo(
    () => Object.fromEntries(normalizedTeams.map((team) => [team.id, team])),
    [normalizedTeams],
  )
  const visibleRemainingTeams = remainingTeams.map((team) => teamById[team.id] ?? team)
  const currentPlayerName = players[currentPlayerIndex]?.trim()
  const isGroupComplete = currentGroupAssignments.length === normalizedTeams.length
  const canSpin = isAdmin && Boolean(currentPlayerName) && remainingTeams.length > 0 && !isSpinning
  const finalAssignments = buildFinalAssignments()
  const liveTeamRosters = normalizedTeams.map((team) => ({
    ...team,
    players: assignments.filter((assignment) => assignment.team.id === team.id),
  }))
  const finalTeamRosters = normalizedTeams.map((team) => ({
    ...team,
    players: finalAssignments.filter((assignment) => assignment.team.id === team.id),
  }))
  const teamRosters = isAdmin ? liveTeamRosters : finalTeamRosters
  const activeFixtures = matchFixtures.length > 0 ? matchFixtures : initialState.fixtures
  const displayedLeagueTable = currentLeagueTable.length > 0 ? currentLeagueTable : leagueTable
  const goalScorers = useMemo(() => {
    const scorers = new Map()

    completedResults.forEach((result) => {
      ;(result.events ?? []).forEach((event) => {
        if (event.type !== 'Goal' || !event.scorer?.trim()) return

        const player = event.scorer.trim()
        const key = `${event.teamId}:${player.toLowerCase()}`
        const current = scorers.get(key)
        scorers.set(key, {
          goals: (current?.goals ?? 0) + 1,
          player,
          teamId: event.teamId,
        })
      })
    })

    return [...scorers.values()].sort(
      (a, b) => b.goals - a.goals || a.player.localeCompare(b.player),
    )
  }, [completedResults])

  useEffect(() => {
    function handleConnect() {
      setIsConnected(true)
    }

    function handleDisconnect() {
      setIsConnected(false)
    }

    function handleDrawState(nextState) {
      setDrawState(nextState)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('draw-state', handleDrawState)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('draw-state', handleDrawState)
    }
  }, [])

  const wheelGradient = useMemo(() => {
    if (visibleRemainingTeams.length === 0) {
      return 'conic-gradient(#334155 0 360deg)'
    }

    if (visibleRemainingTeams.length === 1) {
      return `conic-gradient(${visibleRemainingTeams[0].color} 0 360deg)`
    }

    const slice = 360 / visibleRemainingTeams.length
    return `conic-gradient(${visibleRemainingTeams
      .map((team, index) => {
        const start = index * slice
        const end = (index + 1) * slice
        return `${team.color} ${start}deg ${end}deg`
      })
      .join(', ')})`
  }, [visibleRemainingTeams])

  function login(event) {
    event.preventDefault()
    setLoginError('')

    const attemptedMode = loginMode

    socket.emit('login', { role: attemptedMode, password }, (response) => {
      if (response?.ok) {
        setRole(attemptedMode)
        setMemberView('home')
        setAdminView('dashboard')
        setPassword('')
        return
      }

      setLoginError(`Incorrect ${attemptedMode} password.`)
    })
  }

  function changeLoginMode(nextMode) {
    setLoginMode(nextMode)
    setLoginError('')
    setPassword('')
  }

  function updatePlayer(index, value) {
    socket.emit('update-player', { index, value })
  }

  function spinWheel() {
    socket.emit('spin-wheel')
  }

  function startNextGroup() {
    socket.emit('start-next-group')
  }

  function resetTournament() {
    socket.emit('reset-tournament')
  }

  function logout() {
    setRole('')
    setPassword('')
    setLoginError('')
    setLoginMode('member')
    setMemberView('home')
    setAdminView('dashboard')
  }

  function updateMatch(nextMatchState) {
    socket.emit('update-match', nextMatchState)
  }

  function addMatchEvent(event) {
    socket.emit('add-match-event', event)
  }

  function deleteMatchEvent(eventId) {
    socket.emit('delete-match-event', eventId)
  }

  function resetLiveMatch() {
    socket.emit('reset-live-match')
  }

  function saveMatchResult() {
    socket.emit('save-match-result')
  }

  async function imageToDataUrl(url) {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }

  async function exportTeamList(team) {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 42
    const teamRgb = hexToRgb(team.color)

    pdf.setFillColor(6, 43, 29)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')
    pdf.setDrawColor(244, 201, 93)
    pdf.setLineWidth(1.4)
    pdf.roundedRect(24, 24, pageWidth - 48, pageHeight - 48, 8, 8)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(244, 201, 93)
    pdf.text('ALL STARS INTRA LEAGUE', pageWidth / 2, 58, { align: 'center' })

    pdf.setFontSize(28)
    pdf.setTextColor(255, 255, 255)
    pdf.text('2026 All Stars League', pageWidth / 2, 94, { align: 'center' })

    pdf.setFillColor(teamRgb.r, teamRgb.g, teamRgb.b)
    pdf.roundedRect(margin, 120, pageWidth - margin * 2, 54, 6, 6, 'F')
    pdf.setFontSize(22)
    pdf.setTextColor(team.id === 'star' ? 255 : 7, team.id === 'star' ? 255 : 27, team.id === 'star' ? 255 : 18)
    pdf.text(team.name, pageWidth / 2, 154, { align: 'center' })

    if (team.logo) {
      try {
        const logo = await imageToDataUrl(team.logo)
        pdf.setFillColor(255, 255, 255)
        pdf.roundedRect(pageWidth / 2 - 92, 196, 184, 184, 8, 8, 'F')
        pdf.addImage(logo, 'JPEG', pageWidth / 2 - 76, 210, 152, 152)
      } catch {
        // Keep the PDF downloadable even if the browser cannot read the image.
      }
    }

    const rosterTop = 410
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin, rosterTop, pageWidth - margin * 2, 330, 8, 8, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.setTextColor(17, 24, 39)
    pdf.text(`Players (${team.players.length})`, margin + 24, rosterTop + 34)

    pdf.setDrawColor(teamRgb.r, teamRgb.g, teamRgb.b)
    pdf.setLineWidth(2)
    pdf.line(margin + 24, rosterTop + 48, pageWidth - margin - 24, rosterTop + 48)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(12.5)
    pdf.setTextColor(17, 24, 39)

    const firstColumnX = margin + 28
    const secondColumnX = pageWidth / 2 + 8
    let leftY = rosterTop + 78
    let rightY = rosterTop + 78

    team.players.forEach((assignment, index) => {
      const x = index < 8 ? firstColumnX : secondColumnX
      const currentY = index < 8 ? leftY : rightY
      const player = parsePlayerRole(assignment.player)

      pdf.setFont('helvetica', 'normal')
      pdf.text(`${index + 1}.`, x, currentY)

      if (player.role) {
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${player.role} -`, x + 24, currentY)
        pdf.setFont('helvetica', 'normal')
        pdf.text(player.name, x + 66, currentY)
      } else {
        pdf.text(player.name, x + 24, currentY)
      }

      if (index < 8) {
        leftY += 28
      } else {
        rightY += 28
      }
    })

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(244, 201, 93)
    pdf.text('Generated from the 2026 All Stars League portal', pageWidth / 2, pageHeight - 48, {
      align: 'center',
    })

    pdf.save(`${team.name.toLowerCase().replaceAll(' ', '-')}-team-list.pdf`)
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', '')
    const numericValue = Number.parseInt(value, 16)

    return {
      r: (numericValue >> 16) & 255,
      g: (numericValue >> 8) & 255,
      b: numericValue & 255,
    }
  }

  function parsePlayerRole(playerName) {
    const normalizedName = playerName.replace(/\s+/g, ' ').trim()

    if (/\(GK\)$/i.test(normalizedName)) {
      return { role: 'GK', name: normalizedName.replace(/\s*\(GK\)$/i, '').trim() }
    }

    if (/\(C\)$/i.test(normalizedName)) {
      return { role: 'C', name: normalizedName.replace(/\s*\(C\)$/i, '').trim() }
    }

    if (/ GK$/i.test(normalizedName)) {
      return { role: 'GK', name: normalizedName.replace(/\s+GK$/i, '').trim() }
    }

    if (/ C$/i.test(normalizedName)) {
      return { role: 'C', name: normalizedName.replace(/\s+C$/i, '').trim() }
    }

    if (/^GK /i.test(normalizedName)) {
      return { role: 'GK', name: normalizedName.replace(/^GK\s+/i, '').trim() }
    }

    if (/^C /i.test(normalizedName)) {
      return { role: 'C', name: normalizedName.replace(/^C\s+/i, '').trim() }
    }

    return { role: '', name: normalizedName }
  }

  function teamInitials(teamName) {
    return teamName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 3)
  }

  function TeamLogo({ team }) {
    if (team.logo) {
      return <img src={team.logo} alt={`${team.name} logo`} />
    }

    return <span>{teamInitials(team.name)}</span>
  }

  function FixtureLogo({ team }) {
    if (team.logo) {
      return <img className="fixture-logo" src={team.logo} alt="" />
    }

    return <span className="fixture-logo initials">{teamInitials(team.name)}</span>
  }

  function getTeamPlayers(teamId) {
    return finalTeamRosters.find((team) => team.id === teamId)?.players ?? []
  }

  function getFixtureResult(fixtureGroup, fixture) {
    const fixtureId = fixtureIdFor(fixtureGroup.date, fixture.time, fixture.homeTeamId, fixture.awayTeamId)

    return completedResults.find((result) => result.id === fixtureId)
  }

  function goalEventsForResult(result) {
    return (result?.events ?? []).filter((event) => event.type === 'Goal' && event.scorer)
  }

  // eslint-disable-next-line no-unused-vars
  function goalEventsForTeam(result, teamId) {
    return goalEventsForResult(result).filter((event) => event.teamId === teamId)
  }

  // eslint-disable-next-line no-unused-vars
  function scorerText(event) {
    return `⚽ ${event.scorer}${event.minute ? ` ${event.minute}` : ''}${
      event.assist && event.assist !== 'No assist' ? `, assist ${event.assist}` : ''
    }`
  }

  function matchEventsForTeam(result, teamId) {
    return (result?.events ?? []).filter(
      (event) => event.teamId === teamId && event.scorer && ['Goal', 'Yellow Card', 'Red Card'].includes(event.type),
    )
  }

  function matchEventText(event) {
    const labelByType = {
      Goal: '\u26BD Goal',
      'Yellow Card': '\u{1F7E8} Yellow card',
      'Red Card': '\u{1F7E5} Red card',
    }
    const label = labelByType[event.type] ?? '\u26BD Goal'
    const assist = event.type === 'Goal' && event.assist && event.assist !== 'No assist' ? `, assist ${event.assist}` : ''

    return `${label}: ${event.scorer}${event.minute ? ` ${event.minute}` : ''}${assist}`
  }

  function splitFixtureGroups(hasResult) {
    return fixtures
      .map((fixtureGroup) => ({
        ...fixtureGroup,
        matches: fixtureGroup.matches.filter((fixture) => Boolean(getFixtureResult(fixtureGroup, fixture)) === hasResult),
      }))
      .filter((fixtureGroup) => fixtureGroup.matches.length > 0)
  }

  function FixtureCard({ fixtureGroup, fixture }) {
    const homeTeam = teamById[fixture.homeTeamId]
    const awayTeam = teamById[fixture.awayTeamId]
    const result = getFixtureResult(fixtureGroup, fixture)

    return (
      <div className={`fixture-card ${result ? 'completed' : ''}`} key={`${fixtureGroup.date}-${fixture.time}`}>
        <div className="fixture-time">{fixture.time}</div>
        <div className="fixture-body">
          <div className="fixture-line">
            <div className="fixture-team">
              <FixtureLogo team={homeTeam} />
              <strong>{homeTeam.name}</strong>
            </div>
            <span className={`fixture-vs ${result ? 'score' : ''}`}>
              {result ? `${result.homeScore} - ${result.awayScore}` : 'vs'}
            </span>
            <div className="fixture-team">
              <FixtureLogo team={awayTeam} />
              <strong>{awayTeam.name}</strong>
            </div>
          </div>
          {result && (
            <div className="fixture-result-summary">
              <strong>Full time</strong>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderLiveMatchView({ admin = false } = {}) {
    const homeTeam = teamById[matchState.homeTeamId] ?? normalizedTeams[0]
    const awayTeam = teamById[matchState.awayTeamId] ?? normalizedTeams[1]
    const selectedFixture =
      activeFixtures.find((fixture) => fixture.id === matchState.fixtureId) ??
      activeFixtures.find(
        (fixture) => fixture.homeTeamId === matchState.homeTeamId && fixture.awayTeamId === matchState.awayTeamId,
      )
    const matchTeams = [homeTeam, awayTeam]
    const selectedTeamPlayers = getTeamPlayers(eventForm.teamId)

    function submitMatchEvent(event) {
      event.preventDefault()
      addMatchEvent(eventForm)
      setEventForm({
        assist: '',
        minute: '',
        note: '',
        scorer: '',
        teamId: matchState.homeTeamId,
        type: 'Goal',
      })
    }

    if (!admin && matchState.status === 'Not started') {
      return (
        <section className="member-message live-empty-state">
          <p className="eyebrow">Live Match</p>
          <h2>No live match yet.</h2>
          <p>The scoreboard will appear when the admin starts a match.</p>
          <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
            Back
          </button>
        </section>
      )
    }

    return (
      <section className="member-teams live-match-panel">
        <div className="member-section-header">
          <div>
            <p className="eyebrow">Live Match</p>
            <h2>Scoreboard</h2>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => (admin ? setAdminView('dashboard') : setMemberView('home'))}
          >
            Back
          </button>
        </div>

        <div className="scoreboard">
          <div className="score-team">
            <FixtureLogo team={homeTeam} />
            <strong>{homeTeam.name}</strong>
          </div>
          <div className="score-main">
            <span>{matchState.status}</span>
            <strong>
              {matchState.homeScore} - {matchState.awayScore}
            </strong>
            <em>{matchState.minute || 'Time not set'}</em>
          </div>
          <div className="score-team">
            <FixtureLogo team={awayTeam} />
            <strong>{awayTeam.name}</strong>
          </div>
        </div>

        {admin && (
          <div className="match-admin-card">
            <div className="match-admin-grid">
              <label className="wide-field">
                <span>Current fixture</span>
                <select
                  value={selectedFixture?.id ?? matchState.fixtureId}
                  onChange={(event) => updateMatch({ fixtureId: event.target.value })}
                >
                  {activeFixtures.map((fixture) => (
                    <option key={fixture.id} value={fixture.id}>
                      {fixture.date} {fixture.time} - {teamById[fixture.homeTeamId]?.name} vs{' '}
                      {teamById[fixture.awayTeamId]?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={matchState.status} onChange={(event) => updateMatch({ status: event.target.value })}>
                  <option>Not started</option>
                  <option>First half</option>
                  <option>Half time</option>
                  <option>Second half</option>
                  <option>Full time</option>
                </select>
              </label>
              <label>
                <span>Home score</span>
                <input
                  min="0"
                  type="number"
                  value={matchState.homeScore}
                  onChange={(event) => updateMatch({ homeScore: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Away score</span>
                <input
                  min="0"
                  type="number"
                  value={matchState.awayScore}
                  onChange={(event) => updateMatch({ awayScore: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="match-quick-actions">
              <button className="ghost-button compact-button" type="button" onClick={() => updateMatch({ status: 'First half' })}>
                Start match
              </button>
              <button className="ghost-button compact-button" type="button" onClick={() => updateMatch({ status: 'Half time' })}>
                Half time
              </button>
              <button className="ghost-button compact-button" type="button" onClick={() => updateMatch({ status: 'Second half' })}>
                Second half
              </button>
              <button className="ghost-button compact-button" type="button" onClick={() => updateMatch({ status: 'Full time' })}>
                Full time
              </button>
              <button className="primary-button compact-button" type="button" onClick={saveMatchResult}>
                Save result
              </button>
              <button className="ghost-button compact-button" type="button" onClick={resetLiveMatch}>
                Reset live match
              </button>
            </div>

            <form className="match-event-form" onSubmit={submitMatchEvent}>
              <input
                value={eventForm.minute}
                onChange={(event) => setEventForm({ ...eventForm, minute: event.target.value })}
                placeholder="Min"
              />
              <select
                value={eventForm.type}
                onChange={(event) =>
                  setEventForm({
                    ...eventForm,
                    assist: event.target.value === 'Goal' ? eventForm.assist : '',
                    type: event.target.value,
                  })
                }
              >
                <option>Goal</option>
                <option>Yellow Card</option>
                <option>Red Card</option>
              </select>
              <select
                value={eventForm.teamId}
                onChange={(event) =>
                  setEventForm({ ...eventForm, assist: '', scorer: '', teamId: event.target.value })
                }
              >
                {matchTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select
                value={eventForm.scorer}
                onChange={(event) => setEventForm({ ...eventForm, scorer: event.target.value })}
              >
                <option value="">{eventForm.type === 'Goal' ? 'Scorer' : 'Player'}</option>
                {selectedTeamPlayers.map((assignment) => (
                  <option key={assignment.player} value={parsePlayerRole(assignment.player).name}>
                    {parsePlayerRole(assignment.player).name}
                  </option>
                ))}
              </select>
              <select
                disabled={eventForm.type !== 'Goal'}
                value={eventForm.assist}
                onChange={(event) => setEventForm({ ...eventForm, assist: event.target.value })}
              >
                <option value="">Assist</option>
                <option value="No assist">No assist</option>
                {selectedTeamPlayers.map((assignment) => (
                  <option key={assignment.player} value={parsePlayerRole(assignment.player).name}>
                    {parsePlayerRole(assignment.player).name}
                  </option>
                ))}
              </select>
              <input
                value={eventForm.note}
                onChange={(event) => setEventForm({ ...eventForm, note: event.target.value })}
                placeholder="Other update"
              />
              <button className="primary-button" type="submit">
                Add update
              </button>
            </form>
          </div>
        )}

        <div className="match-events">
          <div className="panel-heading">
            <h2>Match updates</h2>
            <span>{matchState.events.length} updates</span>
          </div>
          <div className="event-list">
            {matchState.events.length === 0 && <p className="empty-state">No match update yet.</p>}
            {matchState.events.map((event) => {
              const eventTeam = teamById[event.teamId]

              return (
                <div className="event-card" key={event.id}>
                  <strong>{event.minute || '--'}</strong>
                  <div>
                    <span>{eventTeam?.name}</span>
                    {event.scorer && <p>{event.type}: {event.scorer}</p>}
                    {event.type === 'Goal' && event.assist && <p>Assist: {event.assist}</p>}
                    {event.note && <p>{event.note}</p>}
                  </div>
                  {admin && (
                    <button className="ghost-button" type="button" onClick={() => deleteMatchEvent(event.id)}>
                      Delete
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  function TeamRosterList({ variant = 'compact' }) {
    return (
      <div className={`roster-list ${variant === 'showcase' ? 'showcase' : ''}`}>
        {teamRosters.map((team) => (
          <div className="roster-card" key={team.id} style={{ '--team-color': team.color }}>
            <div className="roster-title">
              <i></i>
              <strong>{team.name}</strong>
              <span>{team.players.length}</span>
            </div>
            {variant === 'showcase' && (
              <div className="team-logo" style={{ '--team-color': team.color }}>
                <TeamLogo team={team} />
              </div>
            )}
            {team.players.length === 0 ? (
              <p className="empty-state">Awaiting player list</p>
            ) : (
              <ol>
                {team.players.map((assignment, index) => (
                  <li key={`${assignment.player}-${team.id}-${index}`}>
                    {parsePlayerRole(assignment.player).role && (
                      <strong className="player-role">{parsePlayerRole(assignment.player).role} -</strong>
                    )}
                    <span>{parsePlayerRole(assignment.player).name}</span>
                  </li>
                ))}
              </ol>
            )}
            {variant === 'showcase' && (
              <button className="ghost-button full team-download" type="button" onClick={() => exportTeamList(team)}>
                Download PDF
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="eyebrow">All Stars Intra League</p>
          <h1>2026 All Stars League</h1>
          <p className="save-status">
            {isConnected ? 'Login to enter the league portal.' : 'Connecting to league portal...'}
          </p>

          <form className="login-form" onSubmit={login}>
            <div className="login-toggle" role="group" aria-label="Login role">
              <button
                className={loginMode === 'member' ? 'active' : ''}
                type="button"
                onClick={() => changeLoginMode('member')}
              >
                Member
              </button>
              <button
                className={loginMode === 'admin' ? 'active' : ''}
                type="button"
                onClick={() => changeLoginMode('admin')}
              >
                Admin
              </button>
            </div>

            <label>
              <span>{loginMode === 'admin' ? 'Admin password' : 'Member password'}</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                type="password"
              />
            </label>

            <button className="primary-button full" type="submit">
              Enter dashboard
            </button>
            {loginError && <p className="login-error">{loginError}</p>}
          </form>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="app-shell">
        <section className="header-band">
          <div>
            <p className="eyebrow">All Stars Intra League</p>
            <h1>2026 All Stars League</h1>
            <p className="save-status">
              {isConnected ? 'Post-draw portal connected.' : 'Reconnecting to portal...'}
            </p>
          </div>
          <div className="header-actions">
            <span className="role-badge">Member view</span>
            <button className="ghost-button" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </section>

        {memberView === 'home' && (
          <section className="member-home">
            <div>
              <p className="eyebrow">All Stars Intra League</p>
              <h2>Welcome to 2026 All Stars Intra League</h2>
            </div>
            <div className="member-actions">
              <button className="primary-button" type="button" onClick={() => setMemberView('draws')}>
                View draws
              </button>
              <button className="ghost-button" type="button" onClick={() => setMemberView('teams')}>
                View team list
              </button>
              <button className="ghost-button" type="button" onClick={() => setMemberView('fixtures')}>
                View fixtures
              </button>
              <button className="ghost-button" type="button" onClick={() => setMemberView('table')}>
                League Standing
              </button>
              <button className="ghost-button" type="button" onClick={() => setMemberView('results')}>
                Match Results
              </button>
              <button className="ghost-button" type="button" onClick={() => setMemberView('scorers')}>
                Goal Scorers
              </button>
              <button className="ghost-button" type="button" onClick={() => setMemberView('live')}>
                Watch live match
              </button>
            </div>
          </section>
        )}

        {memberView === 'draws' && (
          <section className="member-message">
            <p className="eyebrow">Draw Status</p>
            <h2>Draws have been completed.</h2>
            <p>The 2026 All Stars Intra League team draw is now closed.</p>
            <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
              Back
            </button>
          </section>
        )}

        {memberView === 'teams' && (
          <section className="member-teams printable-team-list">
            <div className="member-section-header">
              <div>
                <p className="eyebrow">Team Rosters</p>
                <h2>Full team list</h2>
              </div>
              <div className="section-actions">
                <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
                  Back
                </button>
              </div>
            </div>
            <TeamRosterList variant="showcase" />
          </section>
        )}

        {memberView === 'fixtures' && (
          <section className="member-teams">
            <div className="member-section-header">
              <div>
                <p className="eyebrow">Fixtures</p>
                <h2>Match fixtures</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
                Back
              </button>
            </div>

            <div className="fixture-section-title">
              <p className="eyebrow">Completed matches</p>
            </div>
            <div className="fixture-list">
              {splitFixtureGroups(true).length === 0 && <p className="empty-state">No completed match yet.</p>}
              {splitFixtureGroups(true).map((fixtureGroup) => (
                <div className="fixture-day" key={fixtureGroup.date}>
                  <h3>{fixtureGroup.date}</h3>
                  {fixtureGroup.matches.map((fixture) => (
                    <FixtureCard fixture={fixture} fixtureGroup={fixtureGroup} key={`${fixtureGroup.date}-${fixture.time}`} />
                  ))}
                </div>
              ))}
            </div>

            <div className="fixture-section-title upcoming">
              <p className="eyebrow">Upcoming matches</p>
            </div>
            <div className="fixture-list">
              {splitFixtureGroups(false).length === 0 && <p className="empty-state">No upcoming match left.</p>}
              {splitFixtureGroups(false).map((fixtureGroup) => (
                <div className="fixture-day" key={fixtureGroup.date}>
                  <h3>{fixtureGroup.date}</h3>
                  {fixtureGroup.matches.map((fixture) => (
                    <FixtureCard fixture={fixture} fixtureGroup={fixtureGroup} key={`${fixtureGroup.date}-${fixture.time}`} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {memberView === 'table' && (
          <section className="member-teams">
            <div className="member-section-header">
              <div>
                <p className="eyebrow">League Standing</p>
                <h2>League standings</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
                Back
              </button>
            </div>
            <div className="table-wrap">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLeagueTable.map((row) => {
                    const team = teamById[row.teamId] ?? normalizedTeams.find((item) => item.id === row.teamId)

                    return (
                      <tr key={row.teamId}>
                        <td>
                          <span className="table-team-dot" style={{ background: team.color }}></span>
                          {team.name}
                        </td>
                        <td>{row.played}</td>
                        <td>{row.won}</td>
                        <td>{row.drawn}</td>
                        <td>{row.lost}</td>
                        <td>{row.goalsFor}</td>
                        <td>{row.goalsAgainst}</td>
                        <td>{row.goalDifference}</td>
                        <td>{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {memberView === 'results' && (
          <section className="member-teams">
            <div className="member-section-header">
              <div>
                <p className="eyebrow">Match Results</p>
                <h2>Completed results</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
                Back
              </button>
            </div>
            <div className="result-history">
              <div className="panel-heading">
                <h2>Full-time results</h2>
                <span>{completedResults.length} saved</span>
              </div>
              {completedResults.length === 0 ? (
                <p className="empty-state">No completed match result yet.</p>
              ) : (
                <div className="result-list">
                  {completedResults.map((result) => {
                    const homeTeam = teamById[result.homeTeamId]
                    const awayTeam = teamById[result.awayTeamId]
                    const homeEvents = matchEventsForTeam(result, result.homeTeamId)
                    const awayEvents = matchEventsForTeam(result, result.awayTeamId)

                    return (
                    <div className="result-card" key={result.id}>
                      <div className="result-meta">
                        <span>{result.date}</span>
                        <strong>{result.time}</strong>
                        <em>Full time</em>
                      </div>
                      <div className="result-scoreboard">
                        <div className="result-team">
                          <FixtureLogo team={homeTeam} />
                          <strong>{homeTeam?.name}</strong>
                        </div>
                        <div className="result-score">
                          <b>{result.homeScore}</b>
                          <span>-</span>
                          <b>{result.awayScore}</b>
                        </div>
                        <div className="result-team away">
                          <FixtureLogo team={awayTeam} />
                          <strong>{awayTeam?.name}</strong>
                        </div>
                      </div>
                      <div className="result-scorers match-scorers">
                        {homeEvents.length + awayEvents.length === 0 ? (
                          <em>No match event recorded.</em>
                        ) : (
                          <>
                            <div>
                              <b>{homeTeam?.name}</b>
                              {homeEvents.length === 0 && <small>No events</small>}
                              {homeEvents.map((event) => (
                                <span key={event.id}>{matchEventText(event)}</span>
                              ))}
                            </div>
                            <div>
                              <b>{awayTeam?.name}</b>
                              {awayEvents.length === 0 && <small>No events</small>}
                              {awayEvents.map((event) => (
                                <span key={event.id}>{matchEventText(event)}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {memberView === 'scorers' && (
          <section className="member-teams">
            <div className="member-section-header">
              <div>
                <p className="eyebrow">Player Statistics</p>
                <h2>Goal scorers</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
                Back
              </button>
            </div>
            {goalScorers.length === 0 ? (
              <p className="empty-state">No goals have been recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="standings-table scorers-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Player</th>
                      <th>Team</th>
                      <th>Goals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goalScorers.map((scorer, index) => {
                      const team = teamById[scorer.teamId]
                      const rank = index > 0 && goalScorers[index - 1].goals === scorer.goals
                        ? goalScorers.findIndex((item) => item.goals === scorer.goals) + 1
                        : index + 1

                      return (
                        <tr key={`${scorer.teamId}-${scorer.player}`}>
                          <td>{rank}</td>
                          <td className="scorer-player">{scorer.player}</td>
                          <td>
                            <span className="table-team-dot" style={{ background: team?.color }}></span>
                            {team?.name ?? 'Unknown team'}
                          </td>
                          <td><strong className="goal-total">{scorer.goals}</strong></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {memberView === 'live' && renderLiveMatchView()}

      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="header-band">
        <div>
          <p className="eyebrow">All Stars Intra League</p>
          <h1>2026 All Stars League</h1>
          <p className="save-status">
            {isConnected ? 'Live draw connected for admins and viewers.' : 'Reconnecting to live draw...'}
          </p>
        </div>
        <div className="header-actions">
          <span className={`role-badge ${isAdmin ? 'admin' : ''}`}>
            {isAdmin ? 'Admin control' : 'Member view'}
          </span>
          {isAdmin && (
            <button className="ghost-button" type="button" onClick={resetTournament}>
              Reset tournament
            </button>
          )}
          {adminView === 'dashboard' && (
            <button className="ghost-button" type="button" onClick={() => setAdminView('live')}>
              Live match
            </button>
          )}
          <button className="ghost-button" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {adminView === 'live' ? (
        renderLiveMatchView({ admin: true })
      ) : (
      <section className="workspace">
        <aside className="panel player-panel" aria-label="Seeded player names">
          <div className="panel-heading">
            <h2>Current Seeded Group</h2>
            <span>{currentGroupAssignments.length}/4 assigned</span>
          </div>

          <div className="player-list">
            {players.map((player, index) => {
              const assigned = currentGroupAssignments[index]
              const isActive = index === currentPlayerIndex && !isGroupComplete

              return (
                <label
                  className={`player-row ${isActive ? 'active' : ''} ${assigned ? 'done' : ''}`}
                  key={index}
                >
                  <span>Player {index + 1}</span>
                  <input
                    value={player}
                    disabled={!isAdmin || Boolean(assigned) || isSpinning}
                    onChange={(event) => updatePlayer(index, event.target.value)}
                    placeholder={isAdmin ? 'Enter name' : 'Waiting for admin'}
                  />
                  {assigned && <strong>{assigned.team.name}</strong>}
                </label>
              )
            })}
          </div>
        </aside>

        <section className="draw-stage" aria-label="Team draw wheel">
          <div className="active-player">
            <span>{isSpinning ? 'Live spin in progress' : 'Tournament draw'}</span>
            <strong>{isGroupComplete ? 'Group complete' : currentPlayerName || 'Enter next player name'}</strong>
          </div>

          <div className="wheel-wrap">
            <div className="pointer" aria-hidden="true"></div>
            <button
              className="wheel"
              disabled={!canSpin}
              onClick={spinWheel}
              style={{
                background: wheelGradient,
                transform: `rotate(${rotation}deg)`,
              }}
              type="button"
              aria-label="Spin the team wheel"
            >
              {visibleRemainingTeams.map((team, index) => (
                <span
                  className="wheel-label"
                  key={team.id}
                  style={{
                    transform: `rotate(${index * (360 / visibleRemainingTeams.length) + 360 / visibleRemainingTeams.length / 2}deg)`,
                  }}
                >
                  <em>{team.name}</em>
                </span>
              ))}
            </button>
            <div className="wheel-center">{isSpinning ? 'Rolling' : 'Spin'}</div>
          </div>

          {isAdmin ? (
            <button className="primary-button" disabled={!canSpin} onClick={spinWheel} type="button">
              {isSpinning ? 'Rolling...' : remainingTeams.length === 1 ? 'Assign final team' : 'Spin wheel'}
            </button>
          ) : (
            <p className="viewer-note">Watching live. Admin controls the draw.</p>
          )}

          <div className="remaining-teams">
            {visibleRemainingTeams.map((team) => (
              <span className={lastWinnerId === team.id ? 'selected' : ''} key={team.id}>
                <i style={{ background: team.color }}></i>
                {team.name}
              </span>
            ))}
          </div>
        </section>

        <aside className="panel result-panel" aria-label="Team assignments">
          <div className="panel-heading">
            <h2>Team Rosters</h2>
            <span>{assignments.length} players drawn</span>
          </div>

          <TeamRosterList />

          {isAdmin && isGroupComplete && (
            <button className="primary-button full" type="button" onClick={startNextGroup}>
              Start next four players
            </button>
          )}

          <button
            className="ghost-button full export-button"
            type="button"
            onClick={() => window.print()}
            disabled={assignments.length === 0}
          >
            Export team list PDF
          </button>
        </aside>
      </section>
      )}
    </main>
  )
}

export default App
