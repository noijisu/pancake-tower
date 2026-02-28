// ============================================================
// うんこタワー - Physics Stacking Game
// ============================================================

const {
  Engine, Render, Runner, Bodies, Body, Composite, Events, Mouse, Vector
} = Matter;

// --- Audio -----------------------------------------------------------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playDrop() {
  ensureAudio();
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

function playLand() {
  ensureAudio();
  const ctx = audioCtx;
  // Splat sound
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function playGameOver() {
  ensureAudio();
  const ctx = audioCtx;
  const notes = [200, 180, 150, 100];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.2;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

function playScore() {
  ensureAudio();
  const ctx = audioCtx;
  // Fart-like bloop
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

function playEat() {
  ensureAudio();
  const ctx = audioCtx;
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
let bgmPlaying = false;
let bgmNodes = [];
let bgmTimerId = null;

const NOTE_FREQ = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

// Silly bouncy melody
const BGM_MELODY = [
  'C4','E4','G4','E4', 'C4','E4','G4','C5',
  'B4','G4','E4','G4', 'B4','G4','E4','C4',
  'F4','A4','C5','A4', 'F4','A4','C5','A4',
  'G4','E4','C4','E4', 'G4','E4','D4','C4',
];

const BGM_BASS = [
  'C4','C4','C4','C4', 'C4','C4','C4','C4',
  'G4','G4','G4','G4', 'G4','G4','G4','G4',
  'F4','F4','F4','F4', 'F4','F4','F4','F4',
  'G4','G4','G4','G4', 'G4','G4','G4','G4',
];

const BGM_BPM = 150;
const BGM_NOTE_LEN = 60 / BGM_BPM;

function startBGM() {
  if (bgmPlaying) return;
  ensureAudio();
  bgmPlaying = true;

  let beatIndex = 0;

  function scheduleLoop() {
    if (!bgmPlaying) return;
    const ctx = audioCtx;
    const loopLen = BGM_MELODY.length;

    for (let i = 0; i < loopLen; i++) {
      const t = ctx.currentTime + i * BGM_NOTE_LEN;

      const melodyNote = BGM_MELODY[(beatIndex + i) % loopLen];
      const freq = NOTE_FREQ[melodyNote];
      if (freq) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.setValueAtTime(0.05, t + BGM_NOTE_LEN * 0.7);
        gain.gain.linearRampToValueAtTime(0.0, t + BGM_NOTE_LEN * 0.95);
        osc.start(t);
        osc.stop(t + BGM_NOTE_LEN);
        bgmNodes.push(osc);
      }

      const bassNote = BGM_BASS[(beatIndex + i) % loopLen];
      const bassFreq = NOTE_FREQ[bassNote];
      if (bassFreq) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = bassFreq * 0.5;
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        gain2.gain.setValueAtTime(0.04, t);
        gain2.gain.setValueAtTime(0.04, t + BGM_NOTE_LEN * 0.5);
        gain2.gain.linearRampToValueAtTime(0.0, t + BGM_NOTE_LEN * 0.9);
        osc2.start(t);
        osc2.stop(t + BGM_NOTE_LEN);
        bgmNodes.push(osc2);
      }
    }

    beatIndex = (beatIndex + loopLen) % loopLen;
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
  for (const node of bgmNodes) {
    try { node.stop(); } catch (e) {}
  }
  bgmNodes = [];
}

// --- Constants -------------------------------------------------------
const W = 420;
const H = 700;
const PLATE_Y = H - 50;
const PLATE_WIDTH = 140;
const PAN_Y = 80;
const UNKO_RX = 35;
const UNKO_RY = 30;
const DROP_COOLDOWN = 400;

// --- Difficulty Settings ---------------------------------------------
const DIFFICULTY = {
  easy: {
    label: 'かんたん',
    tiltThreshold: 1.0,
    basePanSpeed: 0.8,
    panSpeedInc: 0.02,
    maxPanSpeed: 2.2,
    friction: 1.5,
    frictionStatic: 3.0,
    sizeVariance: 0.10,
    sizeBase: 0.95,
    plateWidth: 1.5,
    gravity: 0.8,
  },
  normal: {
    label: 'ふつう',
    tiltThreshold: 0.75,
    basePanSpeed: 1.3,
    panSpeedInc: 0.03,
    maxPanSpeed: 3.5,
    friction: 1.2,
    frictionStatic: 2.0,
    sizeVariance: 0.15,
    sizeBase: 0.90,
    plateWidth: 1.2,
    gravity: 1.0,
  },
  hard: {
    label: 'むずかしい',
    tiltThreshold: 0.55,
    basePanSpeed: 2.0,
    panSpeedInc: 0.06,
    maxPanSpeed: 5.0,
    friction: 0.8,
    frictionStatic: 1.2,
    sizeVariance: 0.30,
    sizeBase: 0.80,
    plateWidth: 0.85,
    gravity: 1.4,
  }
};

let currentDifficulty = 'normal';

// --- High Score (localStorage) ---------------------------------------
function getHighScore(diff) {
  return parseInt(localStorage.getItem('unko_best_' + diff) || '0', 10);
}

function setHighScore(diff, val) {
  localStorage.setItem('unko_best_' + diff, String(val));
}

// --- Game State ------------------------------------------------------
let engine, render, runner;
let unkos = [];
let score = 0;
let gameActive = false;
let lastDropTime = 0;
let panX = W / 2;
let panDirection = 1;
let panSpeed = 1.8;
let gameOverTriggered = false;
let droppedUnko = null;
let nextUnkoScale = 1;
let landedBodies = new Set();

// --- Ojisan (Enemy) --------------------------------------------------
let ojisans = [];
const OJISAN_SPEED = 2.0;
const OJISAN_FIRST_DELAY = 12000;
const OJISAN_INTERVAL_MIN = 8000;
const OJISAN_INTERVAL_MAX = 18000;
const OJISAN_TRIPLE_CHANCE = 0.12;
let ojisanNextTime = 0;

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
  if (unkos.filter(p => p.hasLanded).length < 2) return;

  const isTriple = Math.random() < OJISAN_TRIPLE_CHANCE;

  if (isTriple && unkos.filter(p => p.hasLanded).length >= 4) {
    ojisans.push(createSingleOjisan(true, 0));
    ojisans.push(createSingleOjisan(false, 0));
    const thirdLeft = Math.random() < 0.5;
    ojisans.push(createSingleOjisan(thirdLeft, 40));
    playOjisanAppear();
    setTimeout(() => playOjisanAppear(), 100);
    setTimeout(() => playOjisanAppear(), 200);
  } else {
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
        eatTopUnko();
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

  const before = ojisans.length;
  ojisans = ojisans.filter(o => !(o.state === 'leaving' && (o.x < -60 || o.x > W + 60)));
  if (before > 0 && ojisans.length === 0) {
    ojisanNextTime = Date.now() + OJISAN_INTERVAL_MIN + Math.random() * (OJISAN_INTERVAL_MAX - OJISAN_INTERVAL_MIN);
  }
}

function eatTopUnko() {
  const landed = unkos.filter(p => p.hasLanded);
  if (landed.length === 0) return;

  let topUnko = landed[0];
  for (const p of landed) {
    if (p.position.y < topUnko.position.y) {
      topUnko = p;
    }
  }

  Composite.remove(engine.world, topUnko);
  unkos = unkos.filter(p => p !== topUnko);
  if (droppedUnko === topUnko) droppedUnko = null;

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
  if (faceDir < 0) ctx.scale(-1, 1);

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

  // Hair (balding)
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.ellipse(-12, -18, 6, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, -18, 6, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
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

  // Eyes
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-6, -14, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -14, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
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
    ctx.fillStyle = '#8B2020';
    ctx.beginPath();
    ctx.ellipse(0, -2, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFB0B0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
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

  // Arm
  if (o.state === 'eating') {
    ctx.strokeStyle = '#F0D0A0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.quadraticCurveTo(25, -5, 20, -15);
    ctx.stroke();
    ctx.fillStyle = '#F0D0A0';
    ctx.beginPath();
    ctx.arc(20, -15, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
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

  // "!" warning
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

// --- Create Unko Body ------------------------------------------------
function createUnko(x, y, scale) {
  const diff = DIFFICULTY[currentDifficulty];
  const rx = UNKO_RX * scale;
  const ry = UNKO_RY * scale;
  // Wide flat rectangle for stable stacking (visual is round unko shape)
  const body = Bodies.rectangle(x, y, rx * 2, ry * 1.2, {
    chamfer: { radius: Math.min(ry * 0.3, 5) },
    restitution: 0,
    friction: diff.friction,
    frictionStatic: diff.frictionStatic,
    density: 0.003,
    frictionAir: 0.05,
    render: { visible: false },
    collisionFilter: { group: 0, category: 0x0001, mask: 0xFFFF }
  });
  body.frictionAir = 0.05;
  body.unkoRX = rx;
  body.unkoRY = ry;
  body.unkoScale = scale;
  body.hasLanded = false;
  body.landedAt = 0;
  body.droppedAt = Date.now();
  return body;
}

// --- Drawing ---------------------------------------------------------
function drawUnko(ctx, body) {
  const { x, y } = body.position;
  const angle = body.angle;
  const scale = body.unkoScale || 1;
  const baseSize = 30 * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow
  ctx.save();
  ctx.translate(2, 4);
  ctx.beginPath();
  ctx.ellipse(0, baseSize * 0.3, baseSize * 0.8, baseSize * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fill();
  ctx.restore();

  // Unko body - stack of 3 layers
  const brown1 = '#8B6914';
  const brown2 = '#7A5C10';
  const brown3 = '#6B4E0C';
  const highlight = '#A07818';

  // Bottom layer (widest)
  ctx.beginPath();
  ctx.ellipse(0, baseSize * 0.2, baseSize * 0.75, baseSize * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = brown3;
  ctx.fill();

  // Middle layer
  ctx.beginPath();
  ctx.ellipse(0, -baseSize * 0.1, baseSize * 0.55, baseSize * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = brown2;
  ctx.fill();

  // Top layer (swirl tip)
  ctx.beginPath();
  ctx.ellipse(baseSize * 0.05, -baseSize * 0.35, baseSize * 0.3, baseSize * 0.22, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = brown1;
  ctx.fill();

  // Tip point
  ctx.beginPath();
  ctx.moveTo(baseSize * 0.15, -baseSize * 0.5);
  ctx.quadraticCurveTo(baseSize * 0.25, -baseSize * 0.75, baseSize * 0.1, -baseSize * 0.65);
  ctx.quadraticCurveTo(-baseSize * 0.05, -baseSize * 0.55, baseSize * 0.15, -baseSize * 0.5);
  ctx.fillStyle = brown1;
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.ellipse(-baseSize * 0.2, -baseSize * 0.15, baseSize * 0.15, baseSize * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  // Face
  if (scale >= 0.7) {
    // Eyes
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.ellipse(-baseSize * 0.2, -baseSize * 0.05, 2.5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(baseSize * 0.2, -baseSize * 0.05, 2.5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(-baseSize * 0.2 - 1, -baseSize * 0.05 - 1.5, 1.2 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(baseSize * 0.2 - 1, -baseSize * 0.05 - 1.5, 1.2 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth - cheeky grin
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1.5 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, baseSize * 0.1, baseSize * 0.15, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Cheeks (blush)
    ctx.fillStyle = 'rgba(255, 120, 120, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-baseSize * 0.35, baseSize * 0.08, 4 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(baseSize * 0.35, baseSize * 0.08, 4 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawToilet(ctx) {
  const pw = PLATE_WIDTH * DIFFICULTY[currentDifficulty].plateWidth;

  // Toilet shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y + 10, pw * 0.6, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fill();
  ctx.restore();

  // Toilet bowl - outer
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y, pw * 0.55, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F0F0F0';
  ctx.fill();
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Toilet bowl - inner
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y, pw * 0.42, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E0E8F0';
  ctx.fill();

  // Rim highlight
  ctx.beginPath();
  ctx.ellipse(W / 2, PLATE_Y - 2, pw * 0.48, 10, 0, 0, Math.PI, true);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawButt(ctx, x) {
  // Butt (replaces frying pan)
  ctx.save();

  // Skin color body
  ctx.fillStyle = '#FDBCB4';

  // Left cheek
  ctx.beginPath();
  ctx.ellipse(x - 22, PAN_Y, 32, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Right cheek
  ctx.beginPath();
  ctx.ellipse(x + 22, PAN_Y, 32, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Center crack line
  ctx.strokeStyle = '#E8A090';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, PAN_Y - 20);
  ctx.quadraticCurveTo(x, PAN_Y + 5, x, PAN_Y + 22);
  ctx.stroke();

  // Slight shadow on cheeks
  ctx.fillStyle = 'rgba(200, 130, 120, 0.15)';
  ctx.beginPath();
  ctx.ellipse(x - 22, PAN_Y + 5, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 22, PAN_Y + 5, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#E0A098';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x - 22, PAN_Y, 32, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 22, PAN_Y, 32, 24, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
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

function drawNextUnko(ctx, x) {
  const scale = nextUnkoScale;
  const baseSize = 30 * scale;

  ctx.save();
  ctx.translate(x, PAN_Y);

  const brown1 = '#8B6914';
  const brown2 = '#7A5C10';
  const brown3 = '#6B4E0C';

  ctx.beginPath();
  ctx.ellipse(0, baseSize * 0.2, baseSize * 0.75, baseSize * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = brown3;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -baseSize * 0.1, baseSize * 0.55, baseSize * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = brown2;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(baseSize * 0.05, -baseSize * 0.35, baseSize * 0.3, baseSize * 0.22, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = brown1;
  ctx.fill();

  // Tip
  ctx.beginPath();
  ctx.moveTo(baseSize * 0.15, -baseSize * 0.5);
  ctx.quadraticCurveTo(baseSize * 0.25, -baseSize * 0.75, baseSize * 0.1, -baseSize * 0.65);
  ctx.quadraticCurveTo(-baseSize * 0.05, -baseSize * 0.55, baseSize * 0.15, -baseSize * 0.5);
  ctx.fillStyle = brown1;
  ctx.fill();

  // Face
  if (scale >= 0.7) {
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.ellipse(-baseSize * 0.2, -baseSize * 0.05, 2.5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(baseSize * 0.2, -baseSize * 0.05, 2.5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(-baseSize * 0.2 - 1, -baseSize * 0.05 - 1.5, 1.2 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(baseSize * 0.2 - 1, -baseSize * 0.05 - 1.5, 1.2 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1.5 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, baseSize * 0.1, baseSize * 0.15, 0.1, Math.PI - 0.1);
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

  const floor = Bodies.rectangle(W / 2, PLATE_Y + 4, PLATE_WIDTH * 0.85 * diff.plateWidth, 8, {
    isStatic: true,
    restitution: 0,
    render: { visible: false },
    friction: diff.friction,
    frictionStatic: diff.frictionStatic
  });

  const wallL = Bodies.rectangle(-10, H / 2, 20, H * 2, {
    isStatic: true, render: { visible: false }
  });
  const wallR = Bodies.rectangle(W + 10, H / 2, 20, H * 2, {
    isStatic: true, render: { visible: false }
  });

  Composite.add(engine.world, [floor, wallL, wallR]);

  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;

      if (a.unkoRX && !a.hasLanded) {
        a.hasLanded = true;
        a.landedAt = Date.now();
        Body.setVelocity(a, { x: a.velocity.x * 0.1, y: 0 });
        Body.setAngularVelocity(a, a.angularVelocity * 0.05);
        if (!landedBodies.has(a.id)) {
          landedBodies.add(a.id);
          playLand();
        }
      }
      if (b.unkoRX && !b.hasLanded) {
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

  Engine.update(engine, 1000 / 60);

  panX += panDirection * panSpeed;
  if (panX > W - 80) panDirection = -1;
  if (panX < 80) panDirection = 1;

  const diff = DIFFICULTY[currentDifficulty];
  panSpeed = diff.basePanSpeed + score * diff.panSpeedInc;
  if (panSpeed > diff.maxPanSpeed) panSpeed = diff.maxPanSpeed;

  if (!gameOverTriggered && droppedUnko && !droppedUnko.hasLanded) {
    if (droppedUnko.position.y > H + 50) {
      const missed = droppedUnko;
      Composite.remove(engine.world, missed);
      unkos = unkos.filter(p => p !== missed);
      droppedUnko = null;
    }
  }

  const SETTLE_TIME = 800;
  const now = Date.now();
  if (!gameOverTriggered) {
    for (const p of unkos) {
      if (p.hasLanded && p.landedAt > 0 && (now - p.landedAt > SETTLE_TIME)) {
        const absAngle = Math.abs(p.angle % (Math.PI * 2));
        const normalizedAngle = absAngle > Math.PI ? Math.PI * 2 - absAngle : absAngle;
        if (normalizedAngle > diff.tiltThreshold) {
          triggerGameOver();
          break;
        }
      }
      if (p.hasLanded && p.position.y > H + 50) {
        triggerGameOver();
        break;
      }
    }
  }

  // Fly spawn & update
  if (!gameOverTriggered && ojisans.length === 0 && now >= ojisanNextTime && score >= 3) {
    spawnOjisan();
  }
  updateOjisans();

  // --- Draw ---
  ctx.clearRect(0, 0, W, H);

  // Background - sky blue with grass
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, W, H);

  // Simple grass at bottom
  ctx.fillStyle = '#7EC850';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#6AB840';
  ctx.fillRect(0, H - 30, W, 5);

  // Toilet
  drawToilet(ctx);

  // Flies behind
  drawOjisansBehind(ctx);

  // Unkos
  for (const p of unkos) {
    drawUnko(ctx, p);
  }

  // Flies in front
  drawOjisansFront(ctx);

  // Butt & next unko
  drawButt(ctx, panX);
  if (!droppedUnko || droppedUnko.hasLanded) {
    drawNextUnko(ctx, panX);
    drawArrow(ctx, panX);
  }

  // Stink lines for tall stacks
  if (score >= 5) {
    drawStinkLines(ctx);
  }

  requestAnimationFrame(gameLoop);
}

// Stink wavy lines
function drawStinkLines(ctx) {
  const topUnko = unkos.reduce((top, p) => {
    if (p.hasLanded && (!top || p.position.y < top.position.y)) return p;
    return top;
  }, null);
  if (!topUnko) return;

  const tx = topUnko.position.x;
  const ty = topUnko.position.y - 30;
  const time = Date.now() * 0.003;

  ctx.save();
  ctx.strokeStyle = 'rgba(100, 160, 60, 0.4)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    const ox = tx + i * 15;
    for (let j = 0; j < 20; j++) {
      const py = ty - j * 2;
      const px = ox + Math.sin(j * 0.4 + time + i) * 6;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// --- Drop Unko -------------------------------------------------------
function dropUnko() {
  if (!gameActive || gameOverTriggered) return;

  const now = Date.now();
  if (now - lastDropTime < DROP_COOLDOWN) return;
  if (droppedUnko && !droppedUnko.hasLanded) return;

  lastDropTime = now;

  const scale = nextUnkoScale;
  const unko = createUnko(panX, PAN_Y, scale);
  Composite.add(engine.world, unko);
  unkos.push(unko);

  playDrop();

  droppedUnko = unko;

  const checkLanded = setInterval(() => {
    if (unko.hasLanded && !gameOverTriggered) {
      score++;
      scoreNumber.textContent = score;
      playScore();
      clearInterval(checkLanded);
    }
    if (gameOverTriggered) {
      clearInterval(checkLanded);
    }
  }, 100);

  const d = DIFFICULTY[currentDifficulty];
  nextUnkoScale = d.sizeBase + Math.random() * d.sizeVariance;
}

// --- Game Over -------------------------------------------------------
function triggerGameOver() {
  if (gameOverTriggered) return;
  gameOverTriggered = true;
  gameActive = false;

  stopBGM();
  playGameOver();

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
    gameoverBestEl.textContent = best > 0 ? 'BEST: ' + best + '個 (' + DIFFICULTY[currentDifficulty].label + ')' : '';
    gameOverScreen.classList.add('active');
  }, 800);
}

// --- Start / Restart -------------------------------------------------
function startGame() {
  if (engine) {
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  }

  const diff = DIFFICULTY[currentDifficulty];

  unkos = [];
  score = 0;
  gameActive = true;
  lastDropTime = 0;
  panX = W / 2;
  panDirection = 1;
  panSpeed = diff.basePanSpeed;
  gameOverTriggered = false;
  droppedUnko = null;
  nextUnkoScale = diff.sizeBase + Math.random() * diff.sizeVariance;
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
  if (gameActive) dropUnko();
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameActive) dropUnko();
}, { passive: false });

// --- Difficulty Selection ---------------------------------------------
function updateStartBest() {
  const best = getHighScore(currentDifficulty);
  const label = DIFFICULTY[currentDifficulty].label;
  startBestEl.textContent = best > 0 ? 'BEST: ' + best + '個 (' + label + ')' : '';
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
