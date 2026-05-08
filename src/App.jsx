import { useCallback, useEffect, useRef, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, set, onValue, get } from "firebase/database";
import { auth, db, googleProvider, facebookProvider } from "./firebase";
import "./App.css";

const SIZE = 20;

// ─── SNAKE SKINS ───────────────────────────────────────────────────────────
const SNAKE_SKINS = [
  { id: "cyber",   name: "Cyber",    price: 0,    head: "#ffffff", body: "#00d4ff", glow: "rgba(0,212,255,0.9)",  unlocked: true },
  { id: "fire",    name: "Fire",     price: 150,  head: "#fff700", body: "#ff6a00", glow: "rgba(255,106,0,0.9)",  unlocked: false },
  { id: "venom",   name: "Venom",    price: 200,  head: "#ffffff", body: "#7fff00", glow: "rgba(127,255,0,0.9)",  unlocked: false },
  { id: "plasma",  name: "Plasma",   price: 300,  head: "#ffffff", body: "#cc00ff", glow: "rgba(204,0,255,0.9)",  unlocked: false },
  { id: "gold",    name: "Gold",     price: 500,  head: "#ffffff", body: "#ffd700", glow: "rgba(255,215,0,0.9)",  unlocked: false },
];

// ─── BACKGROUNDS ───────────────────────────────────────────────────────────
const BACKGROUNDS = [
  { id: "cyber",   name: "Cyber",   price: 0,   color: "#030d18", grid: "rgba(0,212,255,0.06)",   unlocked: true },
  { id: "matrix",  name: "Matrix",  price: 100, color: "#001a00", grid: "rgba(0,255,70,0.07)",    unlocked: false },
  { id: "nebula",  name: "Nebula",  price: 200, color: "#0d0020", grid: "rgba(180,0,255,0.07)",   unlocked: false },
  { id: "lava",    name: "Lava",    price: 250, color: "#1a0500", grid: "rgba(255,80,0,0.08)",    unlocked: false },
  { id: "arctic",  name: "Arctic",  price: 300, color: "#001828", grid: "rgba(150,220,255,0.07)", unlocked: false },
];

// ─── SOUNDS ────────────────────────────────────────────────────────────────
const SOUND_PACKS = [
  { id: "retro",  name: "Retro",   icon: "🎮" },
  { id: "cyber",  name: "Cyber",   icon: "⚡" },
  { id: "nature", name: "Nature",  icon: "🌿" },
  { id: "silent", name: "Silent",  icon: "🔇" },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────
const randomFood = (snake) => {
  let food;
  do { food = { x: Math.floor(Math.random()*SIZE), y: Math.floor(Math.random()*SIZE) }; }
  while (snake.some(s => s.x === food.x && s.y === food.y));
  return food;
};

const LB_KEY = "csxp_lb";
const COINS_KEY = "csxp_coins";
const SKINS_KEY = "csxp_skins";
const BGS_KEY = "csxp_bgs";
const ACTIVE_SKIN_KEY = "csxp_active_skin";
const ACTIVE_BG_KEY = "csxp_active_bg";
const SOUND_KEY = "csxp_sound";

const getCoins = () => Number(localStorage.getItem(COINS_KEY)) || 0;
const saveCoins = (c) => localStorage.setItem(COINS_KEY, c);
const getUnlockedSkins = () => { try { return JSON.parse(localStorage.getItem(SKINS_KEY)) || ["cyber"]; } catch { return ["cyber"]; } };
const getUnlockedBgs = () => { try { return JSON.parse(localStorage.getItem(BGS_KEY)) || ["cyber"]; } catch { return ["cyber"]; } };
const saveUnlockedSkins = (s) => localStorage.setItem(SKINS_KEY, JSON.stringify(s));
const saveUnlockedBgs = (b) => localStorage.setItem(BGS_KEY, JSON.stringify(b));
const getActiveSkin = () => localStorage.getItem(ACTIVE_SKIN_KEY) || "cyber";
const getActiveBg = () => localStorage.getItem(ACTIVE_BG_KEY) || "cyber";
const getActiveSoundPack = () => localStorage.getItem(SOUND_KEY) || "cyber";

const saveScoreFirebase = async (uid, name, photo, score) => {
  try {
    const userRef = ref(db, `leaderboard/${uid}`);
    const snap = await get(userRef);
    const existing = snap.val();
    if (!existing || score > existing.score) {
      await set(userRef, { name, photo: photo || "", score, updatedAt: Date.now() });
    }
  } catch(e) { console.error(e); }
};

// ─── AUDIO ENGINE ──────────────────────────────────────────────────────────
function useAudio(soundPack) {
  const ctxRef = useRef(null);
  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }, []);

  const playNote = useCallback((freq1, freq2, dur, type="sine", vol=0.3) => {
    if (soundPack === "silent") return;
    const ctx = getCtx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq1, ctx.currentTime);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  }, [soundPack, getCtx]);

  const playEat = useCallback(() => {
    if (soundPack === "retro")  { playNote(220, 440, 0.1, "square", 0.2); }
    else if (soundPack === "cyber")  { playNote(440, 880, 0.12, "sine", 0.3); }
    else if (soundPack === "nature") { playNote(660, 990, 0.15, "sine", 0.2); }
  }, [soundPack, playNote]);

  const playDie = useCallback(() => {
    if (soundPack === "retro")  { playNote(300, 50, 0.5, "square", 0.3); }
    else if (soundPack === "cyber")  { playNote(300, 50, 0.45, "sawtooth", 0.4); }
    else if (soundPack === "nature") { playNote(200, 80, 0.6, "triangle", 0.3); }
  }, [soundPack, playNote]);

  const playMove = useCallback(() => {
    if (soundPack === "retro")  { playNote(110, null, 0.03, "square", 0.03); }
    else if (soundPack === "cyber")  { playNote(110, null, 0.04, "sine", 0.04); }
    else if (soundPack === "nature") { playNote(180, null, 0.03, "sine", 0.02); }
  }, [soundPack, playNote]);

  const playBuy = useCallback(() => {
    playNote(523, 1046, 0.2, "sine", 0.3);
  }, [playNote]);

  return { playEat, playDie, playMove, playBuy };
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────────────────
function LoginScreen({ onGoogle, onFacebook, loading, error }) {
  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">
          <span className="bolt">⚡</span>
          <span className="login-title">CYBER SNAKE</span>
          <span className="bolt">⚡</span>
        </div>
        <p className="login-tagline">X PRO EDITION</p>
        <p className="login-sub">Sign in to join the global arena</p>
        {loading ? (
          <div className="login-loading">Connecting...</div>
        ) : (
          <div className="login-btns">
            <button className="login-btn google-btn" onClick={onGoogle}>
              <svg width="18" height="18" viewBox="0 0 48 48" style={{marginRight:10,flexShrink:0}}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            <button className="login-btn facebook-btn" onClick={onFacebook}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{marginRight:10,flexShrink:0}}>
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Facebook
            </button>
          </div>
        )}
        {error && <p className="login-err">{error}</p>}
        <div className="login-features">
          <span>🌍 Global Leaderboard</span>
          <span>🐍 Custom Skins</span>
          <span>🎵 Sound Packs</span>
        </div>
      </div>
    </div>
  );
}

// ─── STORE MODAL ───────────────────────────────────────────────────────────
function StoreModal({ coins, onClose, onBuy, activeSkin, activeBg, onSetSkin, onSetBg }) {
  const [tab, setTab] = useState("skins");
  const unlockedSkins = getUnlockedSkins();
  const unlockedBgs = getUnlockedBgs();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🏪 STORE</span>
          <span className="modal-coins">🪙 {coins}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-tabs">
          <button className={tab==="skins" ? "active" : ""} onClick={() => setTab("skins")}>🐍 Skins</button>
          <button className={tab==="bg" ? "active" : ""} onClick={() => setTab("bg")}>🖼 Boards</button>
        </div>
        <div className="modal-body">
          {tab === "skins" && SNAKE_SKINS.map(skin => {
            const owned = unlockedSkins.includes(skin.id);
            const isActive = activeSkin === skin.id;
            return (
              <div key={skin.id} className={`store-item${isActive ? " active-item" : ""}`}>
                <div className="store-skin-preview">
                  <div style={{background: skin.head, width:14, height:14, borderRadius:3, boxShadow:`0 0 8px ${skin.glow}`}} />
                  <div style={{background: skin.body, width:12, height:12, borderRadius:2, boxShadow:`0 0 6px ${skin.glow}`, opacity:0.85}} />
                  <div style={{background: skin.body, width:12, height:12, borderRadius:2, boxShadow:`0 0 6px ${skin.glow}`, opacity:0.7}} />
                </div>
                <div className="store-info">
                  <span className="store-name">{skin.name}</span>
                  {isActive && <span className="store-badge">ACTIVE</span>}
                </div>
                <div className="store-action">
                  {owned ? (
                    <button className={`btn-equip${isActive?" equipped":""}`} onClick={() => onSetSkin(skin.id)}>
                      {isActive ? "✓ ON" : "USE"}
                    </button>
                  ) : (
                    <button className="btn-buy" onClick={() => onBuy("skin", skin.id, skin.price)} disabled={coins < skin.price}>
                      🪙 {skin.price}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {tab === "bg" && BACKGROUNDS.map(bg => {
            const owned = unlockedBgs.includes(bg.id);
            const isActive = activeBg === bg.id;
            return (
              <div key={bg.id} className={`store-item${isActive ? " active-item" : ""}`}>
                <div className="store-bg-preview" style={{background: bg.color, border: `2px solid ${bg.grid.replace("0.07","0.8").replace("0.06","0.8").replace("0.08","0.8")}`}}>
                  <div className="store-bg-grid" style={{backgroundImage:`linear-gradient(${bg.grid} 1px, transparent 1px),linear-gradient(90deg,${bg.grid} 1px, transparent 1px)`, backgroundSize:"20% 20%", width:"100%", height:"100%"}} />
                </div>
                <div className="store-info">
                  <span className="store-name">{bg.name}</span>
                  {isActive && <span className="store-badge">ACTIVE</span>}
                </div>
                <div className="store-action">
                  {owned ? (
                    <button className={`btn-equip${isActive?" equipped":""}`} onClick={() => onSetBg(bg.id)}>
                      {isActive ? "✓ ON" : "USE"}
                    </button>
                  ) : (
                    <button className="btn-buy" onClick={() => onBuy("bg", bg.id, bg.price)} disabled={coins < bg.price}>
                      🪙 {bg.price}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS MODAL ────────────────────────────────────────────────────────
function SettingsModal({ soundPack, onSoundChange, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">⚙️ SETTINGS</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <p className="settings-label">🎵 SOUND PACK</p>
            <div className="sound-grid">
              {SOUND_PACKS.map(sp => (
                <button
                  key={sp.id}
                  className={`sound-btn${soundPack === sp.id ? " active" : ""}`}
                  onClick={() => onSoundChange(sp.id)}
                >
                  <span className="sound-icon">{sp.icon}</span>
                  <span>{sp.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="settings-section">
            <p className="settings-label">ℹ️ HOW TO PLAY</p>
            <div className="how-to-play">
              <p>📱 <strong>Mobile:</strong> Swipe on board to move</p>
              <p>⌨️ <strong>Desktop:</strong> Arrow keys to move</p>
              <p>⏸ <strong>Space:</strong> Pause/Resume</p>
              <p>🪙 <strong>Coins:</strong> +5 per food eaten</p>
              <p>💡 <strong>Tip:</strong> Speed increases as you grow!</p>
            </div>
          </div>
          <div className="settings-section">
            <p className="settings-label" style={{color:"#888", fontSize:10}}>APP VERSION 2.0 — COMING SOON: Multiplayer Mode</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEADERBOARD PANEL ─────────────────────────────────────────────────────
function LeaderboardPanel({ currentUid }) {
  const [lb, setLb] = useState([]);
  useEffect(() => {
    const lbRef = ref(db, "leaderboard");
    const unsub = onValue(lbRef, snap => {
      const data = snap.val() || {};
      const sorted = Object.entries(data)
        .map(([uid, v]) => ({ uid, ...v }))
        .sort((a,b) => b.score - a.score)
        .slice(0, 50);
      setLb(sorted);
    });
    return () => unsub();
  }, []);
  const medals = ["🥇","🥈","🥉"];
  return (
    <div className="lb-panel">
      <div className="lb-header">
        <span className="lb-title">🌍 GLOBAL LEADERBOARD</span>
        <span className="lb-live">● LIVE</span>
      </div>
      <div className="lb-list">
        {lb.length === 0 && <div className="lb-empty">Loading scores...</div>}
        {lb.map((entry, i) => {
          const isYou = entry.uid === currentUid;
          return (
            <div key={entry.uid} className={`lb-row${isYou ? " lb-you" : ""}`}>
              <span className="lb-rank">{i < 3 ? medals[i] : `#${i+1}`}</span>
              <div className="lb-player">
                {entry.photo ? (
                  <img src={entry.photo} className="lb-avatar" alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="lb-avatar-placeholder">{entry.name?.[0]?.toUpperCase()||"?"}</div>
                )}
                <span className="lb-name">{entry.name}{isYou && <span className="lb-you-badge">YOU</span>}</span>
              </div>
              <span className="lb-score">{entry.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Game state
  const [snake, setSnake] = useState([{x:10,y:10},{x:9,y:10}]);
  const [food, setFood] = useState(randomFood([]));
  const [direction, setDirection] = useState("RIGHT");
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(180);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // Coins & shop
  const [coins, setCoins] = useState(getCoins);
  const [activeSkin, setActiveSkin] = useState(getActiveSkin);
  const [activeBg, setActiveBg] = useState(getActiveBg);

  // UI
  const [view, setView] = useState("game"); // game | leaderboard
  const [showStore, setShowStore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundPack, setSoundPack] = useState(getActiveSoundPack);

  const boardRef = useRef(null);
  const [cellSize, setCellSize] = useState(21);
  const scoreRef = useRef(0);
  const userRef2 = useRef(null);
  const highScoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { userRef2.current = user; }, [user]);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  const { playEat, playDie, playMove, playBuy } = useAudio(soundPack);

  // Derived skin/bg data
  const skin = SNAKE_SKINS.find(s => s.id === activeSkin) || SNAKE_SKINS[0];
  const bg = BACKGROUNDS.find(b => b.id === activeBg) || BACKGROUNDS[0];

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const snap = await get(ref(db, `leaderboard/${firebaseUser.uid}`));
        const data = snap.val();
        if (data) setHighScore(data.score);
      } else { setUser(null); setHighScore(0); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Board resize
  useEffect(() => {
    const updateCell = () => { if (boardRef.current) setCellSize(boardRef.current.offsetWidth / SIZE); };
    updateCell();
    window.addEventListener("resize", updateCell);
    return () => window.removeEventListener("resize", updateCell);
  }, []);

  // Prevent page scroll on swipe over board
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const prevent = (e) => e.preventDefault();
    board.addEventListener("touchmove", prevent, { passive: false });
    return () => board.removeEventListener("touchmove", prevent);
  }, []);

  const directionRef = useRef(direction);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  // Keyboard
  useEffect(() => {
    const handleKey = e => {
      if (e.key === "ArrowUp"    && directionRef.current !== "DOWN")  setDirection("UP");
      if (e.key === "ArrowDown"  && directionRef.current !== "UP")    setDirection("DOWN");
      if (e.key === "ArrowLeft"  && directionRef.current !== "RIGHT") setDirection("LEFT");
      if (e.key === "ArrowRight" && directionRef.current !== "LEFT")  setDirection("RIGHT");
      if (e.key === " ") setPaused(p => !p);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Swipe — fixed with passive:false on touchmove above
  const touchStartRef = useRef(null);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const onTouchStart = e => {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    };
    const onTouchEnd = e => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && directionRef.current !== "LEFT")  setDirection("RIGHT");
        if (dx < 0 && directionRef.current !== "RIGHT") setDirection("LEFT");
      } else {
        if (dy > 0 && directionRef.current !== "UP")    setDirection("DOWN");
        if (dy < 0 && directionRef.current !== "DOWN")  setDirection("UP");
      }
    };
    board.addEventListener("touchstart", onTouchStart, { passive: true });
    board.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      board.removeEventListener("touchstart", onTouchStart);
      board.removeEventListener("touchend",   onTouchEnd);
    };
  }, []);

  // Game over
  const handleGameOver = useCallback(() => {
    playDie();
    setGameOver(true);
    const finalScore = scoreRef.current;
    const u = userRef2.current;
    if (u) {
      saveScoreFirebase(u.uid, u.displayName||"Player", u.photoURL||"", finalScore);
      if (finalScore > highScoreRef.current) setHighScore(finalScore);
    }
  }, [playDie]);

  // Game loop
  useEffect(() => {
    if (gameOver || paused || !started) return;
    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] };
        if (directionRef.current === "UP")    head.y--;
        if (directionRef.current === "DOWN")  head.y++;
        if (directionRef.current === "LEFT")  head.x--;
        if (directionRef.current === "RIGHT") head.x++;
        if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) { handleGameOver(); return prev; }
        for (let part of prev) {
          if (part.x === head.x && part.y === head.y) { handleGameOver(); return prev; }
        }
        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          playEat();
          setScore(s => s + 10);
          const newCoins = getCoins() + 5;
          saveCoins(newCoins); setCoins(newCoins);
          setFood(randomFood(newSnake));
          setSpeed(s => Math.max(65, s - 5));
        } else {
          playMove(); newSnake.pop();
        }
        return newSnake;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [food, speed, paused, gameOver, started, handleGameOver, playEat, playMove]);

  const restartGame = () => {
    setSnake([{x:10,y:10},{x:9,y:10}]);
    setFood(randomFood([]));
    setDirection("RIGHT");
    setScore(0); setSpeed(180);
    setGameOver(false); setPaused(false); setStarted(true);
  };

  const handleSetSkin = (id) => { setActiveSkin(id); localStorage.setItem(ACTIVE_SKIN_KEY, id); };
  const handleSetBg   = (id) => { setActiveBg(id);   localStorage.setItem(ACTIVE_BG_KEY, id); };
  const handleSoundChange = (id) => { setSoundPack(id); localStorage.setItem(SOUND_KEY, id); };

  const handleBuy = (type, id, price) => {
    if (coins < price) return;
    const newCoins = coins - price;
    saveCoins(newCoins); setCoins(newCoins);
    if (type === "skin") {
      const s = [...getUnlockedSkins(), id]; saveUnlockedSkins(s);
      handleSetSkin(id);
    } else {
      const b = [...getUnlockedBgs(), id]; saveUnlockedBgs(b);
      handleSetBg(id);
    }
    playBuy();
  };

  const handleGoogle   = async () => { setLoginLoading(true); setLoginError(""); try { await signInWithPopup(auth, googleProvider);   } catch { setLoginError("Google login failed. Try again."); } setLoginLoading(false); };
  const handleFacebook = async () => { setLoginLoading(true); setLoginError(""); try { await signInWithPopup(auth, facebookProvider); } catch { setLoginError("Facebook login failed. Try again."); } setLoginLoading(false); };
  const handleLogout   = async () => { await signOut(auth); setStarted(false); setGameOver(false); setPaused(false); setScore(0); setView("game"); };

  const speedDisplay  = Math.floor(300 - speed);
  const displayName   = user?.displayName || "Player";
  const isNewRecord   = gameOver && score > 0 && score >= highScore;

  if (authLoading) return (
    <div className="login-screen">
      <div className="loading-full"><span className="bolt" style={{fontSize:40}}>⚡</span><span className="loading-text">LOADING...</span></div>
    </div>
  );

  if (!user) return <LoginScreen onGoogle={handleGoogle} onFacebook={handleFacebook} loading={loginLoading} error={loginError} />;

  return (
    <>
      {/* MODALS */}
      {showStore && (
        <StoreModal coins={coins} onClose={() => setShowStore(false)} onBuy={handleBuy}
          activeSkin={activeSkin} activeBg={activeBg} onSetSkin={handleSetSkin} onSetBg={handleSetBg} />
      )}
      {showSettings && (
        <SettingsModal soundPack={soundPack} onSoundChange={handleSoundChange} onClose={() => setShowSettings(false)} />
      )}

      <div className="container">
        {/* TITLE */}
        <h1 className="title"><span className="bolt">⚡</span>CYBER SNAKE X PRO<span className="bolt">⚡</span></h1>

        {/* PLAYER BAR */}
        <div className="player-bar">
          <div className="player-info">
            {user.photoURL
              ? <img src={user.photoURL} className="player-photo" alt="" referrerPolicy="no-referrer" />
              : <span className="player-avatar">{displayName[0].toUpperCase()}</span>}
            <div className="player-meta">
              <span className="player-name">{displayName}</span>
              <span className="player-coins">🪙 {coins}</span>
            </div>
          </div>
          <div className="player-bar-actions">
            <button className="icon-btn" title="Store"    onClick={() => setShowStore(true)}>🏪</button>
            <button className="icon-btn" title="Settings" onClick={() => setShowSettings(true)}>⚙️</button>
            <button className="icon-btn lb-btn" title="Leaderboard" onClick={() => setView(v => v==="game"?"leaderboard":"game")}>
              {view==="leaderboard" ? "🎮" : "🌍"}
            </button>
            <button className="icon-btn logout-icon" title="Logout" onClick={handleLogout}>⏏</button>
          </div>
        </div>

        {view === "leaderboard" ? (
          <LeaderboardPanel currentUid={user.uid} />
        ) : (
          <>
            {/* STATS */}
            <div className="stats">
              <div className="stat-item">
                <span className="stat-icon">🏆</span>
                <span className="stat-label">Score</span>
                <span className="stat-value">{score}</span>
              </div>
              <div className="stat-divider"/>
              <div className="stat-item">
                <span className="stat-icon">⭐</span>
                <span className="stat-label">Best</span>
                <span className="stat-value">{highScore}</span>
              </div>
              <div className="stat-divider"/>
              <div className="stat-item">
                <span className="stat-icon">⏱</span>
                <span className="stat-label">Speed</span>
                <span className="stat-value">{speedDisplay}</span>
              </div>
              <div className="stat-divider"/>
              <div className="stat-item">
                <span className="stat-icon">🪙</span>
                <span className="stat-label">Coins</span>
                <span className="stat-value">{coins}</span>
              </div>
            </div>

            {/* BOARD */}
            <div className="board-wrapper">
              <div className="board-corner tl"/><div className="board-corner tr"/>
              <div className="board-corner bl"/><div className="board-corner br"/>
              <div className="board" ref={boardRef}
                style={{
                  background: bg.color,
                  backgroundImage: `linear-gradient(${bg.grid} 1px, transparent 1px), linear-gradient(90deg, ${bg.grid} 1px, transparent 1px)`,
                  backgroundSize: "5% 5%",
                }}
              >
                {snake.map((seg, i) => (
                  <div key={i}
                    className={`snake${i===0?" head":""}`}
                    style={{
                      left: seg.x * cellSize, top: seg.y * cellSize,
                      width: cellSize-1, height: cellSize-1,
                      background: i === 0 ? skin.head : skin.body,
                      boxShadow: i === 0
                        ? `0 0 10px ${skin.glow}, 0 0 20px ${skin.glow.replace("0.9","0.4")}`
                        : `0 0 5px ${skin.glow.replace("0.9","0.6")}`,
                    }}
                  />
                ))}
                <div className="food" style={{
                  left: food.x*cellSize + cellSize*0.1, top: food.y*cellSize + cellSize*0.1,
                  width: cellSize*0.8, height: cellSize*0.8,
                }}/>

                {!started && !gameOver && (
                  <div className="overlay">
                    <h2>⚡ {displayName}</h2>
                    <p>Ready to dominate?</p>
                    <button onClick={restartGame}>▶ START</button>
                  </div>
                )}
                {paused && started && (
                  <div className="overlay">
                    <h2>⏸ PAUSED</h2>
                    <p>Press SPACE or Resume</p>
                    <button onClick={() => setPaused(false)}>▶ RESUME</button>
                  </div>
                )}
                {gameOver && (
                  <div className="overlay game-over">
                    <h2>💀 GAME OVER</h2>
                    <p className="go-player">{displayName}</p>
                    <p>Score: <strong>{score}</strong> &nbsp;🪙 +{Math.floor(score/2)}</p>
                    {isNewRecord && <p className="new-record">🎉 NEW RECORD!</p>}
                    <button onClick={restartGame}>▶ PLAY AGAIN</button>
                    <button className="view-lb-btn" onClick={() => setView("leaderboard")}>🌍 LEADERBOARD</button>
                  </div>
                )}
              </div>
            </div>

            {/* CONTROLS */}
            <div className="controls">
              <button onClick={restartGame}><span className="btn-icon">▶</span> START</button>
              <button onClick={() => setPaused(p => !p)} disabled={!started||gameOver}>
                <span className="btn-icon">{paused ? "▶" : "⏸"}</span>{paused ? "RESUME" : "PAUSE"}
              </button>
            </div>

            {/* D-PAD */}
            <div className="dpad">
              <button className="dpad-btn dpad-up"    onClick={() => setDirection(d => d!=="DOWN"  ? "UP"    : d)}>▲</button>
              <div className="dpad-middle">
                <button className="dpad-btn dpad-left"  onClick={() => setDirection(d => d!=="RIGHT" ? "LEFT"  : d)}>◀</button>
                <div className="dpad-center"/>
                <button className="dpad-btn dpad-right" onClick={() => setDirection(d => d!=="LEFT"  ? "RIGHT" : d)}>▶</button>
              </div>
              <button className="dpad-btn dpad-down"   onClick={() => setDirection(d => d!=="UP"    ? "DOWN"  : d)}>▼</button>
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        <div className="footer-brand"><span className="bolt">⚡</span> CYBER SNAKE X PRO</div>
        <span>STAY SHARP. STAY CYBER.</span>
        <span>v2.0 🔥</span>
      </footer>
    </>
  );
}