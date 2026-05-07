import { useEffect, useRef, useState } from "react";
import "./App.css";

const SIZE = 20;
const CELL = 25;

/* FOOD GENERATOR */
const randomFood = (snake) => {
  let food;

  do {
    food = {
      x: Math.floor(Math.random() * SIZE),
      y: Math.floor(Math.random() * SIZE),
    };
  } while (
    snake.some(
      (segment) =>
        segment.x === food.x &&
        segment.y === food.y
    )
  );

  return food;
};

export default function App() {
  const [snake, setSnake] = useState([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
  ]);

  const [food, setFood] = useState(
    randomFood([])
  );

  const [direction, setDirection] =
    useState("RIGHT");

  const [score, setScore] = useState(0);

  const [speed, setSpeed] = useState(180);

  const [gameOver, setGameOver] =
    useState(false);

  const [paused, setPaused] =
    useState(false);

  const [highScore, setHighScore] =
    useState(
      Number(
        localStorage.getItem(
          "cyberHighScore"
        )
      ) || 0
    );

  const directionRef = useRef(direction);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  /* KEYBOARD CONTROLS */
  useEffect(() => {
    const handleKey = (e) => {
      if (
        e.key === "ArrowUp" &&
        directionRef.current !== "DOWN"
      ) {
        setDirection("UP");
      }

      if (
        e.key === "ArrowDown" &&
        directionRef.current !== "UP"
      ) {
        setDirection("DOWN");
      }

      if (
        e.key === "ArrowLeft" &&
        directionRef.current !== "RIGHT"
      ) {
        setDirection("LEFT");
      }

      if (
        e.key === "ArrowRight" &&
        directionRef.current !== "LEFT"
      ) {
        setDirection("RIGHT");
      }

      // SPACE = PAUSE
      if (e.key === " ") {
        setPaused((p) => !p);
      }
    };

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKey
      );
    };
  }, []);

  /* GAME LOOP */
  useEffect(() => {
    if (gameOver || paused) return;

    const interval = setInterval(() => {
      setSnake((prev) => {
        const head = { ...prev[0] };

        if (
          directionRef.current === "UP"
        )
          head.y--;

        if (
          directionRef.current === "DOWN"
        )
          head.y++;

        if (
          directionRef.current === "LEFT"
        )
          head.x--;

        if (
          directionRef.current === "RIGHT"
        )
          head.x++;

        /* WALL COLLISION */
        if (
          head.x < 0 ||
          head.y < 0 ||
          head.x >= SIZE ||
          head.y >= SIZE
        ) {
          setGameOver(true);

          if (score > highScore) {
            localStorage.setItem(
              "cyberHighScore",
              score
            );

            setHighScore(score);
          }

          return prev;
        }

        /* SELF COLLISION */
        for (let part of prev) {
          if (
            part.x === head.x &&
            part.y === head.y
          ) {
            setGameOver(true);

            if (score > highScore) {
              localStorage.setItem(
                "cyberHighScore",
                score
              );

              setHighScore(score);
            }

            return prev;
          }
        }

        const newSnake = [
          head,
          ...prev,
        ];

        /* FOOD EAT */
        if (
          head.x === food.x &&
          head.y === food.y
        ) {
          setScore((s) => s + 10);

          setFood(
            randomFood(newSnake)
          );

          // SPEED INCREASE
          setSpeed((s) =>
            Math.max(65, s - 5)
          );
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, speed);

    return () =>
      clearInterval(interval);
  }, [
    food,
    speed,
    paused,
    gameOver,
    score,
    highScore,
  ]);

  /* RESTART */
  const restartGame = () => {
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ]);

    setFood(randomFood([]));

    setDirection("RIGHT");

    setScore(0);

    setSpeed(180);

    setGameOver(false);

    setPaused(false);
  };

  return (
    <div className="container">
      <h1 className="title">
        ⚡ CYBER SNAKE X PRO ⚡
      </h1>

      <div className="stats">
        <div>Score: {score}</div>

        <div>
          High Score: {highScore}
        </div>

        <div>
          Speed:{" "}
          {Math.floor(300 - speed)}
        </div>
      </div>

      {/* GAME BOARD */}
      <div className="board">
        {/* SNAKE */}
        {snake.map(
          (segment, index) => (
            <div
              key={index}
              className={`snake ${
                index === 0
                  ? "head"
                  : ""
              }`}
              style={{
                left:
                  segment.x * CELL,
                top:
                  segment.y * CELL,
              }}
            />
          )
        )}

        {/* FOOD */}
        <div
          className="food"
          style={{
            left: food.x * CELL,
            top: food.y * CELL,
          }}
        />

        {/* PAUSE */}
        {paused && (
          <div className="overlay">
            <h2>⏸ PAUSED</h2>
          </div>
        )}

        {/* GAME OVER */}
        {gameOver && (
          <div className="overlay game-over">
            <h2>
              💀 GAME OVER
            </h2>

            <p>
              Final Score: {score}
            </p>

            <button
              onClick={restartGame}
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* BUTTONS */}
      <div className="controls">
        <button
          onClick={restartGame}
        >
          Restart
        </button>

        <button
          onClick={() =>
            setPaused((p) => !p)
          }
        >
          {paused
            ? "Resume"
            : "Pause"}
        </button>
      </div>

      {/* MOBILE CONTROLS */}
      <div className="mobile-controls">
        <button
          onClick={() =>
            setDirection("UP")
          }
        >
          ⬆
        </button>

        <div className="middle-row">
          <button
            onClick={() =>
              setDirection("LEFT")
            }
          >
            ⬅
          </button>

          <button
            onClick={() =>
              setDirection("RIGHT")
            }
          >
            ➡
          </button>
        </div>

        <button
          onClick={() =>
            setDirection("DOWN")
          }
        >
          ⬇
        </button>
      </div>
    </div>
  );
}