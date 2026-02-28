// ============================================================
// パンケーキタワー - Physics Stacking Game
// ============================================================

const {
  Engine, Render, Runner, Bodies, Body, Composite, Events, Mouse, Vector
} = Matter;

// --- Audio -----------------------------------------------------------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playDrop() {
  ensureAudio();
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

function playLand() {
  ensureAudio();
  const ctx = audioCtx;
  // Soft thud
  const bufferSize = ctx.sampleRate * 0.12;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 6);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function playGameOver() {
  ensureAudio();
  const ctx = audioCtx;
  const notes = [400, 350, 300, 200];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

function playScore() {
  ensureAudio();
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

function playEat() {
  ensureAudio();
  const ctx = audioCtx;
  // Chomp sound - two quick bites
  for (let b = 0; b < 2; b++) {
    const t = ctx.currentTime + b * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

function playOjisanAppear() {
  ensureAudio();
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

// --- BGM -------------------------------------------------------------
// Cheerful looping melody generated with Web Audio API
let bgmPlaying = false;
let bgmNodes = [];      // keep references to stop later
let bgmTimerId = null;

// Note frequencies (C major pentatonic + extras for a cute feel)
const NOTE_FREQ = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
};

// Melody pattern - a cute, bouncy 8-bar loop
const BGM_MELODY = [
  'E4','G4','A4','G4', 'E4','G4','C5','A4',
  'G4','A4','C5','D5', 'C5','A4','G4','E4',
  'D4','E4','G4','A4', 'G4','E4','D4','C4',
  'D4','G4','E4','G4', 'A4','G4','E4','G4',
];

// Bass pattern
const BGM_BASS = [
  'C4','C4','C4','C4', 'A4','A4','A4','A4',
  'G4','G4','G4','G4', 'C4','C4','C4','C4',
  'D4','D4','D4','D4', 'E4','E4','E4','E4',
  'D4','D4','D4','D4', 'G4','G4','G4','G4',
];

const BGM_BPM = 140;
const BGM_NOTE_LEN = 60 / BGM_BPM; // seconds per beat

function startBGM() {
  if (bgmPlaying) return;
  ensureAudio();
  bgmPlaying = true;

  let beatIndex = 0;

  function scheduleLoop() {
    if (!bgmPlaying) return;
    const ctx = audioCtx;
    const loopLen = BGM_MELODY.length;

    // Schedule one full loop ahead
    for (let i = 0; i < loopLen; i++) {
      const t = ctx.currentTime + i * BGM_NOTE_LEN;

      // Melody voice
      const melodyNote = BGM_MELODY[(beatIndex + i) % loopLen];
      const freq = NOTE_FREQ[melodyNote];
      if (freq) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.setValueAtTime(0.06, t + BGM_NOTE_LEN * 0.7);
        gain.gain.linearRampToValueAtTime(0.0, t + BGM_NOTE_LEN * 0.95);
        osc.start(t);
        osc.stop(t + BGM_NOTE_LEN);
        bgmNodes.push(osc);
      }

      // Bass voice (one octave lower, quieter)
      const bassNote = BGM_BASS[(beatIndex + i) % loopLen];
      const bassFreq = NOTE_FREQ[bassNote];
      if (bassFreq) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = bassFreq * 0.5;
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        gain2.gain.setValueAtTime(0.05, t);
        gain2.gain.setValueAtTime(0.05, t + BGM_NOTE_LEN * 0.5);
        gain2.gain.linearRampToValueAtTime(0.0, t + BGM_NOTE_LEN * 0.9);
        osc2.start(t);
        osc2.stop(t + BGM_NOTE_LEN);
        bgmNodes.push(osc2);
      }
    }

    beatIndex = (beatIndex + loopLen) % loopLen;

    // Schedule next loop
    bgmTimerId = setTimeout(scheduleLoop, loopLen * BGM_NOTE_LEN * 1000 - 100);
  }

  scheduleLoop();
}

function stopBGM() {
  bgmPlaying = false;
  if (bgmTimerId) {
    clearTimeout(bgmTimerId);
    bgmTimerId = null;
  }
  // Stop all scheduled oscillators
  for (const node of bgmNodes) {
    try { node.stop(); } catch (e) { /* already stopped */ }
  }
  bgmNodes = [];
}

// --- Constants -------------------------------------------------------
const W = 420;
const H = 700;
const PLATE_Y = H - 50;
const PLATE_WIDTH = 140;
const PAN_Y = 80;
const PANCAKE_RX = 55;        // horizontal radius (visual)
const PANCAKE_RY = 12;        // vertical radius (thickness) - flat like real pancakes
const DROP_COOLDOWN = 400;     // ms between drops
const SEGMENTS = 16;           // segments for pancake shape

// --- Difficulty Settings ---------------------------------------------
const DIFFICULTY = {
  easy: {
    label: 'かんたん',
    tiltThreshold: 1.0,      // ~57 degrees - very forgiving
    basePanSpeed: 0.8,
    panSpeedInc: 0.02,
    maxPanSpeed: 2.2,
    friction: 1.5,
    frictionStatic: 3.0,
    sizeVariance: 0.10,      // almost uniform size
    sizeBase: 0.95,
    plateWidth: 1.5,         // big plate
    gravity: 0.8,
  },
  normal: {
    label: 'ふつう',
    tiltThreshold: 0.75,     // ~43 degrees
    basePanSpeed: 1.3,
    panSpeedInc: 0.03,
    maxPanSpeed: 3.5,
    friction: 1.2,
    frictionStatic: 2.0,
    sizeVariance: 0.15,
    sizeBase: 0.90,
    plateWidth: 1.2,         // slightly bigger plate
    gravity: 1.0,
  },
  hard: {
    label: 'むずかしい',
    tiltThreshold: 0.55,     // ~31 degrees
    basePanSpeed: 2.0,
    panSpeedInc: 0.06,
    maxPanSpeed: 5.0,
    friction: 0.8,
    frictionStatic: 1.2,
    sizeVariance: 0.30,
    sizeBase: 0.80,
    plateWidth: 0.85,        // smaller plate
    gravity: 1.4,
  }
};

let currentDifficulty = 'normal';

// --- High Score (localStorage) ---------------------------------------
function getHighScore(diff) {
  return parseInt(localStorage.getItem('pancake_best_' + diff) || '0', 10);
}

function setHighScore(diff, val) {
  localStorage.setItem('pancake_best_' + diff, String(val));
}

// --- Game State ------------------------------------------------------
let engine, render, runner;
let pancakes = [];
let score = 0;
let gameActive = false;
let lastDropTime = 0;
let panX = W / 2;
let panDirection = 1;
let panSpeed = 1.8;
let gameOverTriggered = false;
let droppedPancake = null;
let nextPancakeScale = 1;
let landedBodies = new Set();

// --- Ojisan (Enemy) --------------------------------------------------
// Each ojisan: { x, targetX, dir, state, eatTimer, eatCount, maxEat, mouthOpen, mouthFrame, bodyColor }
let ojisans = [];
const OJISAN_SPEED = 2.0;
const OJISAN_FIRST_DELAY = 12000;  // first appearance after 12s
const OJISAN_INTERVAL_MIN = 8000;
const OJISAN_INTERVAL_MAX = 18000;
const OJISAN_TRIPLE_CHANCE = 0.12;  // 12% chance for 3-ojisan raid
let ojisanNextTime = 0;

// Ojisan outfit colors for variety
const OJISAN_COLORS = ['#6B8E6B', '#6B6B8E', '#8E6B6B', '#8E8E6B', '#6B8E8E'];

function createSingleOjisan(fromLeft, offsetX) {
  const color = OJISAN_COLORS[Math.floor(Math.random() * OJISAN_COLORS.length)];
  return {
    x: fromLeft ? -50 - offsetX : W + 50 + offsetX,
    targetX: W / 2 + (fromLeft ? -35 - offsetX : 35 + offsetX),
    dir: fromLeft ? 1 : -1,
    state: 'entering',
    eatTimer: 0,
    eatCount: 0,
    maxEat: 1,
    mouthOpen: false,
    mouthFrame: 0,
    bodyColor: color,
  };
}

function spawnOjisan() {
  if (ojisans.length > 0 || !gameActive || gameOverTriggered) return;
  if (pancakes.filter(p => p.hasLanded).length < 2) return;

  const isTriple = Math.random() < OJISAN_TRIPLE_CHANCE;

  if (isTriple && pancakes.filter(p => p.hasLanded).length >= 4) {
    // 3-ojisan raid! One from left, one from right, one from random side
    ojisans.push(createSingleOjisan(true, 0));
    ojisans.push(createSingleOjisan(false, 0));
    const thirdLeft = Math.random() < 0.5;
    ojisans.push(createSingleOjisan(thirdLeft, 40));
    // Each eats 1 pancake = 3 total eaten
    playOjisanAppear();
    // Extra dramatic sound for triple
    setTimeout(() => playOjisanAppear(), 100);
    setTimeout(() => playOjisanAppear(), 200);
  } else {
    // Normal: 1 ojisan, eats 1-2
    const fromLeft = Math.random() < 0.5;
    const o = createSingleOjisan(fromLeft, 0);
    o.maxEat = 1 + Math.floor(Math.random() * 2);
    ojisans.push(o);
    playOjisanAppear();
  }
}

function updateOjisans() {
  for (const o of ojisans) {
    if (o.state === 'entering') {
      o.x += o.dir * OJISAN_SPEED;
      if ((o.dir > 0 && o.x >= o.targetX) ||
          (o.dir < 0 && o.x <= o.targetX)) {
        o.x = o.targetX;
        o.state = 'eating';
        o.eatTimer = 0;
      }
    }

    if (o.state === 'eating') {
      o.eatTimer++;
      o.mouthFrame++;
      o.mouthOpen = Math.floor(o.mouthFrame / 8) % 2 === 0;

      if (o.eatTimer % 40 === 20 && o.eatCount < o.maxEat) {
        eatTopPancake();
        o.eatCount++;
      }

      if (o.eatCount >= o.maxEat && o.eatTimer > o.maxEat * 40 + 20) {
        o.state = 'leaving';
      }
    }

    if (o.state === 'leaving') {
      o.x -= o.dir * OJISAN_SPEED * 1.5;
    }
  }

  // Remove ojisans that left the screen
  const before = ojisans.length;
  ojisans = ojisans.filter(o => !(o.state === 'leaving' && (o.x < -60 || o.x > W + 60)));
  if (before > 0 && ojisans.length === 0) {
    // All gone - schedule next wave
    ojisanNextTime = Date.now() + OJISAN_INTERVAL_MIN + Math.random() * (OJISAN_INTERVAL_MAX - OJISAN_INTERVAL_MIN);
  }
}

function eatTopPancake() {
  const landed = pancakes.filter(p => p.hasLanded);
  if (landed.length === 0) return;

  let topPancake = landed[0];
  for (const p of landed) {
    if (p.position.y < topPancake.position.y) {
      topPancake = p;
    }
  }

  Composite.remove(engine.world, topPancake);
  pancakes = pancakes.filter(p => p !== topPancake);
  if (droppedPancake === topPancake) droppedPancake = null;

  score = Math.max(0, score - 1);
  scoreNumber.textContent = score;

  playEat();
}

function drawSingleOjisan(ctx, o) {
  const x = o.x;
  const faceDir = o.dir;
  const y = PLATE_Y - 25;

  ctx.save();
  ctx.translate(x, y);
  if (faceDir < 0) ctx.scale(-1, 1); // flip horizontally

  // Body
  ctx.fillStyle = o.bodyColor || '#6B8E6B';
  ctx.beginPath();
  ctx.ellipse(0, 15, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#F0D0A0';
  ctx.beginPath();
  ctx.arc(0, -12, 16, 0, Math.PI * 2);
  ctx.fill();

  // Hair (balding, thin on sides)
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.ellipse(-12, -18, 6, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, -18, 6, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Top - bald with a few strands
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-3, -28);
  ctx.quadraticCurveTo(-1, -33, 2, -28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, -27);
  ctx.quadraticCurveTo(5, -32, 7, -27);
  ctx.stroke();

  // Eyes - beady
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-6, -14, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -14, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows - thick
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -19);
  ctx.lineTo(-3, -18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, -18);
  ctx.lineTo(10, -19);
  ctx.stroke();

  // Nose
  ctx.fillStyle = '#D8B88A';
  ctx.beginPath();
  ctx.ellipse(0, -9, 3, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  if (o.state === 'eating' && o.mouthOpen) {
    // Open mouth - eating!
    ctx.fillStyle = '#8B2020';
    ctx.beginPath();
    ctx.ellipse(0, -2, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFB0B0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Grinning
    ctx.strokeStyle = '#8B4020';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // Mustache
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, -5);
  ctx.quadraticCurveTo(-5, -3, 0, -5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.quadraticCurveTo(5, -3, 9, -5);
  ctx.stroke();

  // Arm reaching toward pancakes
  if (o.state === 'eating') {
    ctx.strokeStyle = '#F0D0A0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.quadraticCurveTo(25, -5, 20, -15);
    ctx.stroke();
    // Hand
    ctx.fillStyle = '#F0D0A0';
    ctx.beginPath();
    ctx.arc(20, -15, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Arms at side
    ctx.strokeStyle = '#F0D0A0';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(18, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, 8);
    ctx.lineTo(-18, 22);
    ctx.stroke();
  }

  // Legs
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-7, 35);
  ctx.lineTo(-8, 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7, 35);
  ctx.lineTo(8, 50);
  ctx.stroke();

  // Shoes
  ctx.fillStyle = '#4A3020';
  ctx.beginPath();
  ctx.ellipse(-8, 52, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8, 52, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // "!" warning when entering
  if (o.state === 'entering') {
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -38);
  }

  ctx.restore();
}

function drawOjisansBehind(ctx) {
  for (const o of ojisans) {
    if (o.state !== 'eating') drawSingleOjisan(ctx, o);
  }
}

function drawOjisansFront(ctx) {
  for (const o of ojisans) {
    if (o.state === 'eating') drawSingleOjisan(ctx, o);
  }
}

// --- DOM Elements ----------------------------------------------------
const canvas = document.getElementById('game-canvas');
const scoreNumber = document.getElementById('score-number');
const finalScore = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const bestScoreNumber = document.getElementById('best-score-number');
const newRecordEl = document.getElementById('new-record');
const gameoverBestEl = document.getElementById('gameover-best');
const startBestEl = document.getElementById('start-best');
const diffBtns = document.querySelectorAll('.diff-btn');
const backBtn = document.getElementById('back-btn');

// --- Create Pancake Body (rounded rectangle for stable stacking) -----
function createPancake(x, y, scale) {
  const diff = DIFFICULTY[currentDifficulty];
  const rx = PANCAKE_RX * scale;
  const ry = PANCAKE_RY * scale;
  // Use a rectangle body for stable stacking, with small chamfer for slight rounding
  const body = Bodies.rectangle(x, y, rx * 2, ry * 2, {
    chamfer: { radius: Math.min(ry * 0.6, 6) },
    restitution: 0,
    friction: diff.friction,
    frictionStatic: diff.frictionStatic,
    density: 0.003,
    frictionAir: 0.05,
    render: { visible: false },
    collisionFilter: { group: 0, category: 0x0001, mask: 0xFFFF }
  });
  body.frictionAir = 0.05;
  body.pancakeRX = rx;
  body.pancakeRY = ry;
  body.pancakeScale = scale;
  body.hasLanded = false;
  body.landedAt = 0;       // timestamp when it landed (0 = not yet)
  body.droppedAt = Date.now();
  return body;
}

// --- Drawing ---------------------------------------------------------
function drawPancake(ctx, body) {
  const { x, y } = body.position;
  const angle = body.angle;
  const rx = body.pancakeRX;
  const ry = body.pancakeRY;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow
  ctx.save();
  ctx.translate(2, 3);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fill();
  ctx.restore();

  // Main pancake body
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E8A838';
  ctx.fill();
  ctx.strokeStyle = '#C4852A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner brown (cooked) area
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.72, ry * 0.68, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#C47A20';
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.ellipse(-rx * 0.15, -ry * 0.15, rx * 0.35, ry * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();

  // Face (eyes + mouth) - only if not too tilted
  const faceScale = body.pancakeScale || 1;
  if (faceScale >= 0.7) {
    // Eyes
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.2, -ry * 0.15, 2.5 * faceScale, 3.5 * faceScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rx * 0.2, -ry * 0.15, 2.5 * faceScale, 3.5 * faceScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.2 - 1, -ry * 0.15 - 1.5, 1.2 * faceScale, 1.5 * faceScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rx * 0.2 - 1, -ry * 0.15 - 1.5, 1.2 * faceScale, 1.5 * faceScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 1.5 * faceScale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, ry * 0.2, rx * 0.12, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlate(ctx) {
  const pw = PLATE_WIDTH * DIFFICULTY[currentDifficulty].plateWidth;

  // Plate shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y + 8, pw * 0.55, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fill();
  ctx.restore();

  // Plate
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y, pw * 0.55, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FAFAFA';
  ctx.fill();
  ctx.strokeStyle = '#DDD';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Plate rim highlight
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y - 1, pw * 0.48, 8, 0, 0, Math.PI, true);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPan(ctx, x) {
  // Pan handle
  ctx.save();
  ctx.fillStyle = '#5C3D2E';
  ctx.beginPath();
  ctx.roundRect(x + 55, PAN_Y - 8, 60, 16, 8);
  ctx.fill();
  ctx.strokeStyle = '#3E2518';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Pan body
  ctx.beginPath();
  ctx.ellipse(x, PAN_Y, 68, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3A3A3A';
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pan inner
  ctx.beginPath();
  ctx.ellipse(x, PAN_Y, 55, 17, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4A4A4A';
  ctx.fill();
}

function drawArrow(ctx, x) {
  const arrowY = PAN_Y + 32;
  ctx.save();
  ctx.strokeStyle = '#5C3D0E';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, arrowY);
  ctx.lineTo(x, arrowY + 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 7, arrowY + 12);
  ctx.lineTo(x, arrowY + 18);
  ctx.lineTo(x + 7, arrowY + 12);
  ctx.stroke();
  ctx.restore();
}

function drawNextPancake(ctx, x) {
  // Preview pancake in pan
  const rx = PANCAKE_RX * nextPancakeScale;
  const ry = PANCAKE_RY * nextPancakeScale;

  ctx.save();
  ctx.translate(x, PAN_Y);

  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E8A838';
  ctx.fill();
  ctx.strokeStyle = '#C4852A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.72, ry * 0.68, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#C47A20';
  ctx.fill();

  // Face
  const s = nextPancakeScale;
  if (s >= 0.7) {
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.2, -ry * 0.15, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rx * 0.2, -ry * 0.15, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.2 - 1, -ry * 0.15 - 1.5, 1.2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rx * 0.2 - 1, -ry * 0.15 - 1.5, 1.2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, ry * 0.2, rx * 0.12, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  ctx.restore();
}

// --- Physics Setup ---------------------------------------------------
function setupPhysics() {
  const diff = DIFFICULTY[currentDifficulty];
  engine = Engine.create({
    gravity: { x: 0, y: diff.gravity }
  });

  // Invisible floor
  const floor = Bodies.rectangle(W / 2, PLATE_Y + 4, PLATE_WIDTH * 0.85 * diff.plateWidth, 8, {
    isStatic: true,
    restitution: 0,
    render: { visible: false },
    friction: diff.friction,
    frictionStatic: diff.frictionStatic
  });

  // Walls (invisible, to keep things in bounds)
  const wallL = Bodies.rectangle(-10, H / 2, 20, H * 2, {
    isStatic: true, render: { visible: false }
  });
  const wallR = Bodies.rectangle(W + 10, H / 2, 20, H * 2, {
    isStatic: true, render: { visible: false }
  });

  Composite.add(engine.world, [floor, wallL, wallR]);

  // Collision event for landing sound
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;

      // Check if a pancake just landed - heavily dampen velocity
      if (a.pancakeRX && !a.hasLanded) {
        a.hasLanded = true;
        a.landedAt = Date.now();
        Body.setVelocity(a, { x: a.velocity.x * 0.1, y: 0 });
        Body.setAngularVelocity(a, a.angularVelocity * 0.05);
        if (!landedBodies.has(a.id)) {
          landedBodies.add(a.id);
          playLand();
        }
      }
      if (b.pancakeRX && !b.hasLanded) {
        b.hasLanded = true;
        b.landedAt = Date.now();
        Body.setVelocity(b, { x: b.velocity.x * 0.1, y: 0 });
        Body.setAngularVelocity(b, b.angularVelocity * 0.05);
        if (!landedBodies.has(b.id)) {
          landedBodies.add(b.id);
          playLand();
        }
      }
    }
  });
}

// --- Game Loop -------------------------------------------------------
function gameLoop() {
  if (!gameActive) return;

  const ctx = canvas.getContext('2d');

  // Update physics
  Engine.update(engine, 1000 / 60);

  // Move pan
  panX += panDirection * panSpeed;
  if (panX > W - 80) panDirection = -1;
  if (panX < 80) panDirection = 1;

  // Increase speed with score
  const diff = DIFFICULTY[currentDifficulty];
  panSpeed = diff.basePanSpeed + score * diff.panSpeedInc;
  if (panSpeed > diff.maxPanSpeed) panSpeed = diff.maxPanSpeed;

  // Check for pancakes that fell off screen without landing (missed the plate)
  if (!gameOverTriggered && droppedPancake && !droppedPancake.hasLanded) {
    if (droppedPancake.position.y > H + 50) {
      // Remove the missed pancake from physics and arrays
      const missed = droppedPancake;
      Composite.remove(engine.world, missed);
      pancakes = pancakes.filter(p => p !== missed);
      droppedPancake = null;
    }
  }

  // Check tilt of landed pancakes (with settling grace period)
  const SETTLE_TIME = 800; // ms to wait after landing before checking tilt
  const now = Date.now();
  if (!gameOverTriggered) {
    for (const p of pancakes) {
      if (p.hasLanded && p.landedAt > 0 && (now - p.landedAt > SETTLE_TIME)) {
        const absAngle = Math.abs(p.angle % (Math.PI * 2));
        const normalizedAngle = absAngle > Math.PI ? Math.PI * 2 - absAngle : absAngle;
        if (normalizedAngle > diff.tiltThreshold) {
          triggerGameOver();
          break;
        }
      }
      // Fell off screen after landing
      if (p.hasLanded && p.position.y > H + 50) {
        triggerGameOver();
        break;
      }
    }
  }

  // --- Ojisan spawn & update ---
  if (!gameOverTriggered && ojisans.length === 0 && now >= ojisanNextTime && score >= 3) {
    spawnOjisan();
  }
  updateOjisans();

  // --- Draw ---
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#F5A623';
  ctx.fillRect(0, 0, W, H);

  // Plate
  drawPlate(ctx);

  // Ojisans (behind pancakes when entering/leaving)
  drawOjisansBehind(ctx);

  // Pancakes (draw in order for layering)
  for (const p of pancakes) {
    drawPancake(ctx, p);
  }

  // Ojisans in front when eating
  drawOjisansFront(ctx);

  // Pan & next pancake
  drawPan(ctx, panX);
  if (!droppedPancake || droppedPancake.hasLanded) {
    drawNextPancake(ctx, panX);
    drawArrow(ctx, panX);
  }

  requestAnimationFrame(gameLoop);
}

// --- Drop Pancake ----------------------------------------------------
function dropPancake() {
  if (!gameActive || gameOverTriggered) return;

  const now = Date.now();
  if (now - lastDropTime < DROP_COOLDOWN) return;

  // Don't drop if previous pancake hasn't landed
  if (droppedPancake && !droppedPancake.hasLanded) return;

  lastDropTime = now;

  const scale = nextPancakeScale;
  const pancake = createPancake(panX, PAN_Y, scale);
  Composite.add(engine.world, pancake);
  pancakes.push(pancake);

  playDrop();

  droppedPancake = pancake;

  // Update score after a short delay (when it lands)
  const checkLanded = setInterval(() => {
    if (pancake.hasLanded && !gameOverTriggered) {
      score++;
      scoreNumber.textContent = score;
      playScore();
      clearInterval(checkLanded);
    }
    if (gameOverTriggered) {
      clearInterval(checkLanded);
    }
  }, 100);

  // Randomize next pancake size based on difficulty
  const d = DIFFICULTY[currentDifficulty];
  nextPancakeScale = d.sizeBase + Math.random() * d.sizeVariance;
}

// --- Game Over -------------------------------------------------------
function triggerGameOver() {
  if (gameOverTriggered) return;
  gameOverTriggered = true;
  gameActive = false;

  stopBGM();
  playGameOver();

  // Check & save high score
  const prevBest = getHighScore(currentDifficulty);
  const isNewRecord = score > prevBest;
  if (isNewRecord) {
    setHighScore(currentDifficulty, score);
    bestScoreNumber.textContent = score;
  }

  setTimeout(() => {
    finalScore.textContent = score;
    if (isNewRecord && score > 0) {
      newRecordEl.style.display = 'block';
    } else {
      newRecordEl.style.display = 'none';
    }
    const best = getHighScore(currentDifficulty);
    gameoverBestEl.textContent = best > 0 ? 'BEST: ' + best + '枚 (' + DIFFICULTY[currentDifficulty].label + ')' : '';
    gameOverScreen.classList.add('active');
  }, 800);
}

// --- Start / Restart -------------------------------------------------
function startGame() {
  // Clear old state
  if (engine) {
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  }

  const diff = DIFFICULTY[currentDifficulty];

  pancakes = [];
  score = 0;
  gameActive = true;
  lastDropTime = 0;
  panX = W / 2;
  panDirection = 1;
  panSpeed = diff.basePanSpeed;
  gameOverTriggered = false;
  droppedPancake = null;
  nextPancakeScale = diff.sizeBase + Math.random() * diff.sizeVariance;
  landedBodies = new Set();
  ojisans = [];
  ojisanNextTime = Date.now() + OJISAN_FIRST_DELAY;

  scoreNumber.textContent = '0';
  const best = getHighScore(currentDifficulty);
  bestScoreNumber.textContent = best;
  gameOverScreen.classList.remove('active');
  startScreen.style.display = 'none';

  setupPhysics();
  ensureAudio();
  startBGM();
  gameLoop();
}

// --- Event Listeners -------------------------------------------------
canvas.addEventListener('click', () => {
  if (gameActive) dropPancake();
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameActive) dropPancake();
}, { passive: false });

// --- Difficulty Selection ---------------------------------------------
function updateStartBest() {
  const best = getHighScore(currentDifficulty);
  const label = DIFFICULTY[currentDifficulty].label;
  startBestEl.textContent = best > 0 ? 'BEST: ' + best + '枚 (' + label + ')' : '';
}

diffBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    diffBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentDifficulty = btn.dataset.diff;
    updateStartBest();
  });
});

// Show best on initial load
updateStartBest();

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

retryBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

backBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  stopBGM();
  gameOverScreen.classList.remove('active');
  updateStartBest();
  startScreen.style.display = '';
});
