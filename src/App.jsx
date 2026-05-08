import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const SIZE = 20;

const randomFood = (snake) => {
  let food;
  do {
    food = {
      x: Math.floor(Math.random() * SIZE),
      y: Math.floor(Math.random() * SIZE),
    };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
  return food;
};

// ── Leaderboard helpers ──
const LB_KEY = "cyberSnakeLeaderboard";

const getLeaderboard = () => {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
  catch { return []; }
};

const saveToLeaderboard = (name, score) => {
  const lb = getLeaderboard();
  const existing = lb.find((e) => e.name === name);
  if (existing) {
    if (score > existing.score) existing.score = score;
  } else {
    lb.push({ name, score });
  }
  lb.sort((a, b) => b.score - a.score);
  localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0, 20)));
};

// ── Login Screen ──
function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const handle = () => {
    const trimmed = name.trim();
    if (!trimmed) { setErr("Naam toh daal yaar!"); return; }
    if (trimmed.length > 16) { setErr("Max 16 characters allowed"); return; }
    onLogin(trimmed);
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">
          <span className="bolt">⚡</span>
          <span className="login-title">CYBER SNAKE</span>
          <span className="bolt">⚡</span>
        </div>
        <p className="login-sub">Enter the arena. Choose your name.</p>
        <div className="login-field">
          <input
            className="login-input"
            type="text"
            placeholder="Player Name..."
            value={name}
            maxLength={16}
            onChange={(e) => { setName(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && handle()}
            autoFocus
          />
          {err && <span className="login-err">{err}</span>}
        </div>
        <button className="login-btn" onClick={handle}>
          ▶ ENTER ARENA
        </button>
      </div>
    </div>
  );
}

// ── Leaderboard Panel ──
function LeaderboardPanel({ currentPlayer }) {
  const lb = getLeaderboard();
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="lb-panel">
      <div className="lb-header">
        <span className="lb-title">🏆 LEADERBOARD</span>
      </div>
      <div className="lb-list">
        {lb.length === 0 && (
          <div className="lb-empty">No scores yet. Be the first!</div>
        )}
        {lb.map((entry, i) => {
          const isYou = entry.name === currentPlayer;
          return (
            <div key={entry.name} className={`lb-row${isYou ? " lb-you" : ""}`}>
              <span className="lb-rank">
                {i < 3 ? medals[i] : `#${i + 1}`}
              </span>
              <span className="lb-name">
                {entry.name}
                {isYou && <span className="lb-you-badge">YOU</span>}
              </span>
              <span className="lb-score">{entry.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [playerName, setPlayerName] = useState(
    localStorage.getItem("cyberPlayerName") || ""
  );
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("cyberPlayerName"));

  const [snake, setSnake] = useState([{ x: 10, y: 10 }, { x: 9, y: 10 }]);
  const [food, setFood] = useState(randomFood([]));
  const [direction, setDirection] = useState("RIGHT");
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(180);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const getPersonalBest = (name) => {
    const lb = getLeaderboard();
    const me = lb.find((e) => e.name === name);
    return me ? me.score : 0;
  };

  const [highScore, setHighScore] = useState(() => getPersonalBest(localStorage.getItem("cyberPlayerName") || ""));
  const [showLb, setShowLb] = useState(false);

  const boardRef = useRef(null);
  const [cellSize, setCellSize] = useState(21);

  useEffect(() => {
    const updateCell = () => {
      if (boardRef.current) setCellSize(boardRef.current.offsetWidth / SIZE);
    };
    updateCell();
    window.addEventListener("resize", updateCell);
    return () => window.removeEventListener("resize", updateCell);
  }, []);

  const directionRef = useRef(direction);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  const touchStartRef = useRef(null);

  const audioCtx = useRef(null);
  const getCtx = useCallback(() => {
    if (!audioCtx.current)
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx.current;
  }, []);

  const playEat = useCallback(() => {
    const ctx = getCtx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(); o.stop(ctx.currentTime + 0.15);
  }, [getCtx]);

  const playDie = useCallback(() => {
    const ctx = getCtx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.45);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.start(); o.stop(ctx.currentTime + 0.45);
  }, [getCtx]);

  const playMove = useCallback(() => {
    const ctx = getCtx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(110, ctx.currentTime);
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    o.start(); o.stop(ctx.currentTime + 0.04);
  }, [getCtx]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowUp" && directionRef.current !== "DOWN") setDirection("UP");
      if (e.key === "ArrowDown" && directionRef.current !== "UP") setDirection("DOWN");
      if (e.key === "ArrowLeft" && directionRef.current !== "RIGHT") setDirection("LEFT");
      if (e.key === "ArrowRight" && directionRef.current !== "LEFT") setDirection("RIGHT");
      if (e.key === " ") setPaused((p) => !p);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Swipe controls
  useEffect(() => {
    const onTouchStart = (e) => {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    };
    const onTouchEnd = (e) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && directionRef.current !== "LEFT") setDirection("RIGHT");
        if (dx < 0 && directionRef.current !== "RIGHT") setDirection("LEFT");
      } else {
        if (dy > 0 && directionRef.current !== "UP") setDirection("DOWN");
        if (dy < 0 && directionRef.current !== "DOWN") setDirection("UP");
      }
      touchStartRef.current = null;
    };
    const board = boardRef.current;
    if (!board) return;
    board.addEventListener("touchstart", onTouchStart, { passive: true });
    board.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      board.removeEventListener("touchstart", onTouchStart);
      board.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameOver || paused || !started) return;
    const interval = setInterval(() => {
      setSnake((prev) => {
        const head = { ...prev[0] };
        if (directionRef.current === "UP") head.y--;
        if (directionRef.current === "DOWN") head.y++;
        if (directionRef.current === "LEFT") head.x--;
        if (directionRef.current === "RIGHT") head.x++;

        if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) {
          playDie(); setGameOver(true);
          return prev;
        }
        for (let part of prev) {
          if (part.x === head.x && part.y === head.y) {
            playDie(); setGameOver(true);
            return prev;
          }
        }

        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          playEat();
          setScore((s) => s + 10);
          setFood(randomFood(newSnake));
          setSpeed((s) => Math.max(65, s - 5));
        } else {
          playMove(); newSnake.pop();
        }
        return newSnake;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [food, speed, paused, gameOver, started, playDie, playEat, playMove]);

  // Save score on game over
  useEffect(() => {
    if (gameOver && playerName) {
      saveToLeaderboard(playerName, score);
      if (score > highScore) setHighScore(score);
    }
  }, [gameOver]); // eslint-disable-line

  // Load personal best on login
  useEffect(() => {
    if (playerName) {
      const lb = getLeaderboard();
      const me = lb.find((e) => e.name === playerName);
      if (me) setHighScore(me.score);
    }
  }, [playerName]);

  const restartGame = () => {
    setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }]);
    setFood(randomFood([]));
    setDirection("RIGHT");
    setScore(0); setSpeed(180);
    setGameOver(false); setPaused(false); setStarted(true);
  };

  const handleLogin = (name) => {
    localStorage.setItem("cyberPlayerName", name);
    setPlayerName(name);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("cyberPlayerName");
    setPlayerName("");
    setLoggedIn(false);
    setStarted(false);
    setGameOver(false);
    setPaused(false);
    setScore(0);
  };

  const speedDisplay = Math.floor(300 - speed);
  const isNewRecord = gameOver && score > 0 && score >= highScore;

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      <div className="container">
        <h1 className="title">
          <span className="bolt">⚡</span>
          CYBER SNAKE X PRO
          <span className="bolt">⚡</span>
        </h1>

        {/* PLAYER BAR */}
        <div className="player-bar">
          <div className="player-info">
            <span className="player-avatar">{playerName[0].toUpperCase()}</span>
            <span className="player-name">{playerName}</span>
          </div>
          <div className="player-bar-actions">
            <button className="lb-toggle-btn" onClick={() => setShowLb((v) => !v)}>
              {showLb ? "🎮 GAME" : "🏆 BOARD"}
            </button>
            <button className="logout-btn" onClick={handleLogout}>⏏ EXIT</button>
          </div>
        </div>

        {showLb ? (
          <LeaderboardPanel currentPlayer={playerName} />
        ) : (
          <>
            <div className="stats">
              <div className="stat-item">
                <span className="stat-icon">🏆</span>
                <span className="stat-label">Score</span>
                <span className="stat-value">{score}</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-icon">⭐</span>
                <span className="stat-label">Best</span>
                <span className="stat-value">{highScore}</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-icon">⏱</span>
                <span className="stat-label">Speed</span>
                <span className="stat-value">{speedDisplay}</span>
              </div>
            </div>

            <div className="board-wrapper">
              <div className="board-corner tl" />
              <div className="board-corner tr" />
              <div className="board-corner bl" />
              <div className="board-corner br" />
              <div className="board" ref={boardRef}>
                {snake.map((segment, index) => (
                  <div
                    key={index}
                    className={`snake${index === 0 ? " head" : ""}`}
                    style={{
                      left: segment.x * cellSize,
                      top: segment.y * cellSize,
                      width: cellSize - 1,
                      height: cellSize - 1,
                    }}
                  />
                ))}
                <div
                  className="food"
                  style={{
                    left: food.x * cellSize + cellSize * 0.1,
                    top: food.y * cellSize + cellSize * 0.1,
                    width: cellSize * 0.8,
                    height: cellSize * 0.8,
                  }}
                />

                {!started && !gameOver && (
                  <div className="overlay">
                    <h2>⚡ {playerName}</h2>
                    <p>Ready to dominate?</p>
                    <button onClick={restartGame}>▶ START</button>
                  </div>
                )}

                {paused && started && (
                  <div className="overlay">
                    <h2>⏸ PAUSED</h2>
                    <p>Press SPACE or Resume</p>
                  </div>
                )}

                {gameOver && (
                  <div className="overlay game-over">
                    <h2>💀 GAME OVER</h2>
                    <p className="go-player">{playerName}</p>
                    <p>Score: <strong>{score}</strong></p>
                    {isNewRecord && <p className="new-record">🎉 NEW RECORD!</p>}
                    <button onClick={restartGame}>▶ PLAY AGAIN</button>
                    <button className="view-lb-btn" onClick={() => setShowLb(true)}>
                      🏆 LEADERBOARD
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="controls">
              <button onClick={restartGame}>
                <span className="btn-icon">▶</span> START
              </button>
              <button onClick={() => setPaused((p) => !p)} disabled={!started || gameOver}>
                <span className="btn-icon">{paused ? "▶" : "⏸"}</span>
                {paused ? "RESUME" : "PAUSE"}
              </button>
            </div>

            <div className="mobile-controls">
              <button onClick={() => setDirection((d) => d !== "DOWN" ? "UP" : d)}>⬆</button>
              <div className="middle-row">
                <button onClick={() => setDirection((d) => d !== "RIGHT" ? "LEFT" : d)}>⬅</button>
                <button onClick={() => setDirection((d) => d !== "LEFT" ? "RIGHT" : d)}>➡</button>
              </div>
              <button onClick={() => setDirection((d) => d !== "UP" ? "DOWN" : d)}>⬇</button>
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        <div className="footer-brand">
          <span className="bolt">⚡</span> CYBER SNAKE X PRO
        </div>
        <span>STAY SHARP. STAY CYBER.</span>
        <span>POWERED BY PRO ENGINE</span>
      </footer>
    </>
  );
}