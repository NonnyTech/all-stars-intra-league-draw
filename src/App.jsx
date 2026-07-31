import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io()

const fallbackTeams = [
  { id: 'wisdom', name: 'Seat of Wisdom', color: '#8ee88e' },
  { id: 'star', name: 'Morning Star', color: '#050505' },
  { id: 'tower', name: 'Tower of David', color: '#e32227' },
  { id: 'mirror', name: 'Mirror of Justice', color: '#4cc9ff' },
]

const initialState = {
  assignments: [],
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

  const teamById = useMemo(() => Object.fromEntries(teams.map((team) => [team.id, team])), [teams])
  const visibleRemainingTeams = remainingTeams.map((team) => teamById[team.id] ?? team)
  const currentPlayerName = players[currentPlayerIndex]?.trim()
  const isGroupComplete = currentGroupAssignments.length === teams.length
  const canSpin = isAdmin && Boolean(currentPlayerName) && remainingTeams.length > 0 && !isSpinning
  const teamRosters = teams.map((team) => ({
    ...team,
    players: assignments.filter((assignment) => assignment.team.id === team.id),
  }))

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
  }

  function exportTeamList() {
    window.print()
  }

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="eyebrow">Official Tournament Draw</p>
          <h1>2026 All Stars Intra League Draw</h1>
          <p className="save-status">
            {isConnected ? 'Login to enter the live draw dashboard.' : 'Connecting to live draw...'}
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

  return (
    <main className="app-shell">
      <section className="header-band">
        <div>
          <p className="eyebrow">Official Tournament Draw</p>
          <h1>2026 All Stars Intra League Draw</h1>
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

          <div className="roster-list">
            {teamRosters.map((team) => (
              <div className="roster-card" key={team.id} style={{ '--team-color': team.color }}>
                <div className="roster-title">
                  <i></i>
                  <strong>{team.name}</strong>
                  <span>{team.players.length}</span>
                </div>
                {team.players.length === 0 ? (
                  <p className="empty-state">Awaiting first player</p>
                ) : (
                  <ol>
                    {team.players.map((assignment, index) => (
                      <li key={`${assignment.player}-${team.id}-${index}`}>{assignment.player}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>

          {isAdmin && isGroupComplete && (
            <button className="primary-button full" type="button" onClick={startNextGroup}>
              Start next four players
            </button>
          )}

          <button
            className="ghost-button full export-button"
            type="button"
            onClick={exportTeamList}
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
