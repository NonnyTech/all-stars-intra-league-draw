import { useEffect, useMemo, useState } from 'react'
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

const finalTeamPlayers = {
  wisdom: [
    'Afam',
    'Victor Dumbri',
    'Solar',
    'Monday',
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
  ],
  star: [
    'Obinna',
    'Emeka Ekediegwu',
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
    'Chief Onwa',
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
}

function App() {
  const [drawState, setDrawState] = useState(initialState)
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [loginMode, setLoginMode] = useState('member')
  const [loginError, setLoginError] = useState('')
  const [memberView, setMemberView] = useState('home')
  const [printTeamId, setPrintTeamId] = useState('')
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
  }

  useEffect(() => {
    function clearPrintTeam() {
      setPrintTeamId('')
    }

    window.addEventListener('afterprint', clearPrintTeam)

    return () => {
      window.removeEventListener('afterprint', clearPrintTeam)
    }
  }, [])

  function exportTeamList(teamId = '') {
    setPrintTeamId(teamId)
    window.setTimeout(() => window.print(), 0)
  }

  function exportAllTeamLists() {
    window.print()
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

  function TeamRosterList({ variant = 'compact' }) {
    return (
      <div className={`roster-list ${variant === 'showcase' ? 'showcase' : ''}`}>
        {teamRosters.map((team) => (
          <div
            className={`roster-card ${printTeamId === team.id ? 'print-target' : ''}`}
            key={team.id}
            style={{ '--team-color': team.color }}
          >
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
                  <li key={`${assignment.player}-${team.id}-${index}`}>{assignment.player}</li>
                ))}
              </ol>
            )}
            {variant === 'showcase' && (
              <button className="ghost-button full team-download" type="button" onClick={() => exportTeamList(team.id)}>
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
                Match results
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
          <section className="member-message">
            <p className="eyebrow">Fixtures</p>
            <h2>Fixtures are not yet ready.</h2>
            <p>The match schedule will be published here once it is available.</p>
            <button className="ghost-button" type="button" onClick={() => setMemberView('home')}>
              Back
            </button>
          </section>
        )}

        {memberView === 'table' && (
          <section className="member-teams">
            <div className="member-section-header">
              <div>
                <p className="eyebrow">Match Results</p>
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
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueTable.map((row) => {
                    const team = teamById[row.teamId]

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
                        <td>{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
          <button className="ghost-button" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

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
            onClick={exportAllTeamLists}
            disabled={assignments.length === 0}
          >
            Export team list PDF
          </button>
        </aside>
      </section>
    </main>
  )
}

export default App
