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

export default function App() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }, { x: 9, y: 10 }]);
  const [food, setFood] = useState(randomFood([]));
  const [direction, setDirection] = useState("RIGHT");
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(180);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [highScore, setHighScore] = useState(
    Number(localStorage.getItem("cyberHighScore")) || 0
  );

  const boardRef = useRef(null);
  const [cellSize, setCellSize] = useState(21);

  useEffect(() => {
    const updateCell = () => {
      if (boardRef.current) {
        setCellSize(boardRef.current.offsetWidth / SIZE);
      }
    };
    updateCell();
    window.addEventListener("resize", updateCell);
    return () => window.removeEventListener("resize", updateCell);
  }, []);

  const directionRef = useRef(direction);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  const audioCtx = useRef(null);
  const getCtx = useCallback(() => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
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
          if (score > highScore) { localStorage.setItem("cyberHighScore", score); setHighScore(score); }
          return prev;
        }
        for (let part of prev) {
          if (part.x === head.x && part.y === head.y) {
            playDie(); setGameOver(true);
            if (score > highScore) { localStorage.setItem("cyberHighScore", score); setHighScore(score); }
            return prev;
          }
        }

        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          playEat(); setScore((s) => s + 10);
          setFood(randomFood(newSnake)); setSpeed((s) => Math.max(65, s - 5));
        } else {
          playMove(); newSnake.pop();
        }
        return newSnake;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [food, speed, paused, gameOver, started, score, highScore, playDie, playEat, playMove]);

  const restartGame = () => {
    setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }]);
    setFood(randomFood([]));
    setDirection("RIGHT");
    setScore(0); setSpeed(180);
    setGameOver(false); setPaused(false); setStarted(true);
  };

  const speedDisplay = Math.floor(300 - speed);

  return (
    <>
      <div className="container">
        {/* TITLE */}
        <h1 className="title">
          <span className="bolt">⚡</span>
          CYBER SNAKE X PRO
          <span className="bolt">⚡</span>
        </h1>

        {/* STATS */}
        <div className="stats">
          <div className="stat-item">
            <span className="stat-icon">🏆</span>
            <span className="stat-label">Score</span>
            <span className="stat-value">{score}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-icon">⭐</span>
            <span className="stat-label">High Score</span>
            <span className="stat-value">{highScore}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-icon">⏱</span>
            <span className="stat-label">Speed</span>
            <span className="stat-value">{speedDisplay}</span>
          </div>
        </div>

        {/* BOARD */}
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
                <h2>⚡ CYBER SNAKE</h2>
                <p>Press START to play</p>
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
                <p>Final Score: {score}</p>
                <button onClick={restartGame}>▶ PLAY AGAIN</button>
              </div>
            )}
          </div>
        </div>

        {/* BUTTONS */}
        <div className="controls">
          <button onClick={restartGame}>
            <span className="btn-icon">▶</span> START
          </button>
          <button onClick={() => setPaused((p) => !p)} disabled={!started || gameOver}>
            <span className="btn-icon">{paused ? "▶" : "⏸"}</span>
            {paused ? "RESUME" : "PAUSE"}
          </button>
        </div>

        {/* MOBILE D-PAD */}
        <div className="mobile-controls">
          <button onClick={() => setDirection((d) => d !== "DOWN" ? "UP" : d)}>⬆</button>
          <div className="middle-row">
            <button onClick={() => setDirection((d) => d !== "RIGHT" ? "LEFT" : d)}>⬅</button>
            <button onClick={() => setDirection((d) => d !== "LEFT" ? "RIGHT" : d)}>➡</button>
          </div>
          <button onClick={() => setDirection((d) => d !== "UP" ? "DOWN" : d)}>⬇</button>
        </div>
      </div>

      {/* FOOTER */}
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