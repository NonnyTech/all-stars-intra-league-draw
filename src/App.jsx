import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TEAMS = [
  { id: 'wisdom', name: 'Seat of Wisdom', color: '#8ee88e' },
  { id: 'star', name: 'Morning Star', color: '#050505' },
  { id: 'tower', name: 'Tower of David', color: '#e32227' },
  { id: 'mirror', name: 'Mirror of Justice', color: '#4cc9ff' },
]

const initialPlayers = ['', '', '', '']
const teamById = Object.fromEntries(TEAMS.map((team) => [team.id, team]))
const STORAGE_KEY = 'all-stars-2026-team-draw'

function getSavedDraw() {
  try {
    const savedDraw = window.localStorage.getItem(STORAGE_KEY)
    return savedDraw ? JSON.parse(savedDraw) : null
  } catch {
    return null
  }
}

const savedDraw = getSavedDraw()

function App() {
  const [players, setPlayers] = useState(savedDraw?.players ?? initialPlayers)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(savedDraw?.currentPlayerIndex ?? 0)
  const [remainingTeams, setRemainingTeams] = useState(savedDraw?.remainingTeams ?? TEAMS)
  const [assignments, setAssignments] = useState(savedDraw?.assignments ?? [])
  const [currentGroupAssignments, setCurrentGroupAssignments] = useState(
    savedDraw?.currentGroupAssignments ?? [],
  )
  const [rotation, setRotation] = useState(savedDraw?.rotation ?? 0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState(null)

  const currentPlayerName = players[currentPlayerIndex]?.trim()
  const isGroupComplete = currentGroupAssignments.length === TEAMS.length
  const canSpin = Boolean(currentPlayerName) && remainingTeams.length > 0 && !isSpinning
  const teamRosters = TEAMS.map((team) => ({
    ...team,
    players: assignments.filter((assignment) => assignment.team.id === team.id),
  }))
  const visibleRemainingTeams = remainingTeams.map((team) => teamById[team.id] ?? team)

  useEffect(() => {
    const drawState = {
      assignments,
      currentGroupAssignments,
      currentPlayerIndex,
      players,
      remainingTeams,
      rotation,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drawState))
  }, [assignments, currentGroupAssignments, currentPlayerIndex, players, remainingTeams, rotation])

  const wheelGradient = useMemo(() => {
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

  function updatePlayer(index, value) {
    const nextPlayers = [...players]
    nextPlayers[index] = value
    setPlayers(nextPlayers)
  }

  function spinWheel() {
    if (!canSpin) return

    if (visibleRemainingTeams.length === 1) {
      const finalTeam = visibleRemainingTeams[0]
      const assignment = {
        player: currentPlayerName,
        team: finalTeam,
      }

      setAssignments((previous) => [...previous, assignment])
      setCurrentGroupAssignments((previous) => [...previous, assignment])
      setRemainingTeams([])
      setCurrentPlayerIndex((previous) => Math.min(previous + 1, TEAMS.length - 1))
      setSelectedTeamId(finalTeam.id)
      return
    }

    const winningIndex = Math.floor(Math.random() * visibleRemainingTeams.length)
    const winningTeam = visibleRemainingTeams[winningIndex]
    const slice = 360 / visibleRemainingTeams.length
    const targetMiddle = winningIndex * slice + slice / 2
    const pointerAngle = 270
    const fullTurns = 55 + Math.floor(Math.random() * 16)
    const finalRotation = fullTurns * 360 + pointerAngle - targetMiddle

    setIsSpinning(true)
    setSelectedTeamId(null)
    setRotation((previous) => previous + finalRotation)

    window.setTimeout(() => {
      const assignment = {
        player: currentPlayerName,
        team: winningTeam,
      }

      setAssignments((previous) => [...previous, assignment])
      setCurrentGroupAssignments((previous) => [...previous, assignment])
      setRemainingTeams((previous) => previous.filter((team) => team.id !== winningTeam.id))
      setCurrentPlayerIndex((previous) => Math.min(previous + 1, TEAMS.length - 1))
      setSelectedTeamId(winningTeam.id)
      setIsSpinning(false)
    }, 15000)
  }

  function startNextGroup() {
    setPlayers(initialPlayers)
    setCurrentPlayerIndex(0)
    setRemainingTeams(TEAMS)
    setCurrentGroupAssignments([])
    setRotation(0)
    setIsSpinning(false)
    setSelectedTeamId(null)
  }

  function resetTournament() {
    startNextGroup()
    setAssignments([])
    window.localStorage.removeItem(STORAGE_KEY)
  }

  function exportTeamList() {
    window.print()
  }

  return (
    <main className="app-shell">
      <section className="header-band">
        <div>
          <p className="eyebrow">Official Tournament Draw</p>
          <h1>2026 All Stars Intra League Draw</h1>
          <p className="save-status">Draw progress saves automatically on this browser.</p>
        </div>
        <button className="ghost-button" type="button" onClick={resetTournament}>
          Reset tournament
        </button>
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
                    disabled={Boolean(assigned) || isSpinning}
                    onChange={(event) => updatePlayer(index, event.target.value)}
                    placeholder="Enter name"
                  />
                  {assigned && <strong>{assigned.team.name}</strong>}
                </label>
              )
            })}
          </div>
        </aside>

        <section className="draw-stage" aria-label="Team draw wheel">
          <div className="active-player">
            <span>Tournament draw</span>
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

          <button className="primary-button" disabled={!canSpin} onClick={spinWheel} type="button">
            {isSpinning ? 'Rolling...' : remainingTeams.length === 1 ? 'Assign final team' : 'Spin wheel'}
          </button>

          <div className="remaining-teams">
            {visibleRemainingTeams.map((team) => (
              <span className={selectedTeamId === team.id ? 'selected' : ''} key={team.id}>
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

          {isGroupComplete && (
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
