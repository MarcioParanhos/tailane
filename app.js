let SIZE = 5;
let imageSrc = 'foto001.jpeg';
let squaredImageSrc = imageSrc; // data URL quadrada gerada por canvas
// Global error catcher to help diagnose runtime problems in the browser
window.addEventListener('error', (ev) => {
  try { alert('Erro no script: ' + (ev && ev.message ? ev.message : 'unknown')); } catch(e){}
  console.error('Script error caught:', ev);
});
window.addEventListener('unhandledrejection', (ev)=>{ try{ alert('Promise rejeitada: '+(ev && ev.reason ? ev.reason : 'unknown')); }catch(e){}; console.error('Unhandled rejection', ev); });
console.log('app.js loaded');
// Theme configuration: map theme keys to one or more image filenames
const THEMES = {
  casamento: ['foto001.jpeg'],
  fadas: ['fada001.jpeg'],
  princesa: ['princesa001.jpeg']
};
let currentTheme = 'casamento';
// store last chosen image per theme (declared early to avoid TDZ errors)
const lastImageForTheme = {};
// background floating emojis (hearts/flowers) - can be changed per theme
let bgEmojis = ['❤️','🌸','🌺','💐','💮'];

function updateBgEmojisForTheme(theme) {
  try {
    if (theme === 'princesa') {
      bgEmojis = ['❤️','🪻','❤️','🪻'];
    } else if (theme === 'fadas') {
      bgEmojis = ['❤️','🌺','❤️','🌺'];
    } else {
      bgEmojis = ['❤️','❤️','❤️','❤️','❤️','❤️',];
    }
  } catch (e) {}
}
// Difficulty settings
const DIFFICULTY_SIZES = { easy: 4, normal: 5, hard: 6 };
let currentDifficulty = 'normal';

function setDifficulty(diff, restart = true) {
  if (!DIFFICULTY_SIZES[diff]) return;
  currentDifficulty = diff;
  updateDifficultyUI();
  if (restart) init();
}

function updateDifficultyUI() {
  try {
    // if a select exists, sync its value
    const sel = document.getElementById('difficultySelect');
    if (sel) sel.value = currentDifficulty;
    // fallback: if legacy buttons exist, apply visual state
    const btns = document.querySelectorAll('[data-diff]');
    btns.forEach(btn => {
      const key = btn.getAttribute('data-diff');
      if (key === currentDifficulty) {
        btn.classList.remove('bbtn-secondary'); btn.classList.add('bbtn-primary'); btn.setAttribute('aria-pressed','true'); btn.style.boxShadow = '0 6px 18px rgba(37,99,235,0.12)';
      } else {
        btn.classList.remove('bbtn-primary'); btn.classList.add('bbtn-secondary'); btn.setAttribute('aria-pressed','false'); btn.style.boxShadow = 'none';
      }
    });
  } catch (e) {}
}

const boardEl     = document.getElementById('board');
const movesEl     = document.getElementById('moves');
const winMsg      = document.getElementById('winMsg');
const shuffleBtn  = document.getElementById('shuffleBtn');
const solveBtn    = document.getElementById('solveBtn');
const welcomeEl   = document.getElementById('welcome');
const gameSection = document.getElementById('gameSection');
const heartsContainer = document.getElementById('heartsContainer');

let state = [];
let moves = 0;
let hintShown500 = false;
let hintShown1000 = false;
let hintShown2000 = false;
let _confettiTimeout = null;

/* ─────────────────────────────────────────────
   Recorta a imagem ao centro, tornando-a
   quadrada via canvas.  Retorna data-URL.
   Isso garante que cada fragmento tenha o
   tamanho certo independente da proporção original.
───────────────────────────────────────────── */
function prepareImage(src, callback) {
  const tmp = new Image();
  tmp.onload = function () {
    const w = tmp.naturalWidth;
    const h = tmp.naturalHeight;
    const size = Math.min(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    try {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        tmp,
        Math.floor((w - size) / 2),
        Math.floor((h - size) / 2),
        size, size,
        0, 0, size, size
      );
      squaredImageSrc = canvas.toDataURL('image/jpeg', 0.92);
    } catch (_) {
      squaredImageSrc = src; // fallback se canvas estiver bloqueado por CORS
    }
    callback();
  };
  tmp.onerror = function () { squaredImageSrc = src; callback(); };
  tmp.src = src;
}

function init() {
  // set SIZE from difficulty
  SIZE = DIFFICULTY_SIZES[currentDifficulty] || 5;
  hintShown500 = false;
  hintShown1000 = false;
  hintShown2000 = false;
  boardEl.style.gridTemplateColumns = `repeat(${SIZE}, minmax(0, 1fr))`;
  moves = 0;
  movesEl.textContent = moves;
  winMsg.classList.add('hidden');
  // remove any previous win overlay when starting a new game
  removeWinOverlay();
  boardEl.innerHTML = '<p class="col-span-full text-center text-gray-400 text-sm py-8">Carregando…</p>';

  prepareImage(imageSrc, () => {
    state = shuffledSolvable();
    render();
  });
}

function shuffledSolvable() {
  const n = SIZE * SIZE;
  const arr = Array.from({length: n}, (_,i) => i);
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while (!isSolvable(arr) || isSolved(arr));
  return arr;
}

function isSolved(arr = state) {
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] !== i+1) return false;
  }
  return arr[arr.length-1] === 0;
}

function isSolvable(arr) {
  const flat = arr.filter(n => n !== 0);
  let inv = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inv++;
    }
  }
  const blankIndex = arr.indexOf(0);
  const rowFromTop = Math.floor(blankIndex / SIZE) + 1;
  const rowFromBottom = SIZE - (rowFromTop - 1);
  if (SIZE % 2 === 1) {
    return (inv % 2) === 0;
  } else {
    return ((inv + rowFromBottom) % 2) === 0;
  }
}

/* ─────────────────────────────────────────────
   Renderiza o tabuleiro.
   Cada peça contém um <img> dimensionado para
   cobrir o tabuleiro inteiro (SIZE × peça) e
   deslocado para exibir SOMENTE o fragmento
   que pertence àquela peça (baseado em val,
   não na posição atual idx).
   Assim o tabuleiro fica visualmente embaralhado.
───────────────────────────────────────────── */
function render() {
  boardEl.innerHTML = '';
  const n = SIZE * SIZE;

  for (let idx = 0; idx < n; idx++) {
    const val  = state[idx];
    const tile = document.createElement('button');

    tile.className     = 'aspect-square overflow-hidden relative select-none touch-manipulation focus:outline-none cursor-pointer';
    tile.dataset.index = idx;
    tile.setAttribute('aria-label', val === 0 ? 'espaço vazio' : `peça ${val}`);

    if (val !== 0) {
      // origIndex = onde esta peça fica na solução (val-1)
      const origIndex = val - 1;
      const origRow   = Math.floor(origIndex / SIZE);
      const origCol   = origIndex % SIZE;

      /*
        Técnica de recorte com <img>:
        - O <img> tem SIZE*100% da largura e altura da peça
          → ou seja, cobre o tabuleiro inteiro
        - left = -(origCol * 100%)  desloca para a coluna correta
        - top  = -(origRow * 100%)  desloca para a linha correta
        - overflow:hidden na peça faz o recorte
        Percentagens de left/top são relativas ao bloco contentor (a peça).
      */
      const img = document.createElement('img');
      img.src                 = squaredImageSrc;
      img.draggable           = false;
      img.alt                 = '';
      img.style.position      = 'absolute';
      img.style.width         = `${SIZE * 100}%`;
      img.style.height        = `${SIZE * 100}%`;
      img.style.maxWidth      = 'none';
      img.style.left          = `${-origCol * 100}%`;
      img.style.top           = `${-origRow * 100}%`;
      img.style.pointerEvents = 'none';
      img.style.userSelect    = 'none';

      tile.style.outline = '2px solid rgba(255,255,255,0.6)';
      tile.appendChild(img);
    } else {
      tile.style.background = '#d1d5db';
    }

    tile.addEventListener('click',      onTileClick);
    tile.addEventListener('touchstart', onTileClick, { passive: true });
    boardEl.appendChild(tile);
  }

  movesEl.textContent = moves;
  if (isSolved()) {
    winMsg.classList.remove('hidden');
    showFullImageOnWin();
  }
}

// no image upload: uses default `imageSrc` (foto001.jpeg)

function onTileClick(e) {
  const idx = Number(e.currentTarget.dataset.index);
  tryMove(idx);
}

function tryMove(idx) {
  const emptyIdx = state.indexOf(0);
  if (isAdjacent(idx, emptyIdx)) {
    [state[idx], state[emptyIdx]] = [state[emptyIdx], state[idx]];
    moves++;
    render();
    // show hints at two thresholds: 500 and 1000 moves
    try {
      const hintEl = document.getElementById('hint');
      const titleEl = document.getElementById('hintTitle');
      const msgEl = document.getElementById('hintMsg');
      if (moves > 1000 && !hintShown1000) {
        hintShown1000 = true;
        if (titleEl) titleEl.textContent = "Rapaz... você nao desiste";
        if (msgEl) msgEl.textContent = "tome um copo d'agua ou entao clique em mostrar solução, vc não vai conseguir é muito dificil";
        hintEl.classList.remove('hidden');
      } else if (moves > 500 && !hintShown500) {
        hintShown500 = true;
        if (titleEl) titleEl.textContent = "Tailane — dica amiga";
        if (msgEl) msgEl.textContent = "Acho que você não vai conseguir... respira um pouco e descansa kkkkkkkkkk";
        hintEl.classList.remove('hidden');
      }
      // strongly suggest lowering difficulty at very high move counts
      if (moves > 2000 && !hintShown2000) {
        hintShown2000 = true;
        try {
          if (titleEl) titleEl.textContent = 'Pausa — reduza a dificuldade';
          if (msgEl) msgEl.textContent = "Esse nível exige um esforço intelectual muito grande. Recomendo diminuir a dificuldade para continuar.";
          // replace actions with options: continuar or diminuir dificuldade
          const actions = document.querySelector('.hint-actions');
          if (actions) {
            actions.innerHTML = '';
            const btnContinue = document.createElement('button');
            btnContinue.className = 'calm';
            btnContinue.textContent = 'Continuar assim';
            btnContinue.addEventListener('click', () => { if (hintEl) hintEl.classList.add('hidden'); restoreHintActions(); });

            const btnReduce = document.createElement('button');
            btnReduce.className = 'solve';
            btnReduce.textContent = 'Diminuir dificuldade';
            btnReduce.addEventListener('click', () => { if (hintEl) hintEl.classList.add('hidden'); reduceDifficulty(); restoreHintActions(); });

            actions.appendChild(btnContinue);
            actions.appendChild(btnReduce);
          }
        } catch (e) {}
        if (hintEl) hintEl.classList.remove('hidden');
      }
    } catch(e){}
  }
}

function isAdjacent(a, b) {
  const ax = a % SIZE, ay = Math.floor(a / SIZE);
  const bx = b % SIZE, by = Math.floor(b / SIZE);
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx + dy) === 1;
}

shuffleBtn.addEventListener('click', () => {
  state = shuffledSolvable();
  moves = 0;
  movesEl.textContent = moves;
  winMsg.classList.add('hidden');
  // allow hint to show again on new game and hide overlay if visible
  hintShown500 = false;
  hintShown1000 = false;
  hintShown2000 = false;
  try{ document.getElementById('hint').classList.add('hidden'); }catch(e){}
  // remove full-image overlay if present
  removeWinOverlay();
  render();
});

solveBtn.addEventListener('click', () => {
  state = Array.from({length: SIZE*SIZE}, (_,i) => (i === SIZE*SIZE-1 ? 0 : i+1));
  moves = 0;
  render();
});

// size is fixed to 5x5; no change listener

// Inicializa quando o usuário clicar em Começar na tela de boas-vindas
const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (welcomeEl) welcomeEl.classList.add('hidden');
    if (gameSection) gameSection.classList.remove('hidden');
    init();
    // scroll to game on small screens
    setTimeout(() => { if (gameSection) gameSection.scrollIntoView({ behavior: 'smooth' }); }, 80);
  });
} else {
  // fallback: start immediately, set theme and init
  setTheme(currentTheme, true);
}

// Theme helper: pick an image for a theme (if multiple images, pick randomly)
function pickImageForTheme(theme) {
  const list = THEMES[theme] || [imageSrc];
  if (list.length === 1) {
    lastImageForTheme[theme] = list[0];
    return list[0];
  }
  const last = lastImageForTheme[theme];
  // prefer images different from last; if all filtered out, fall back to full list
  const candidates = last ? list.filter(i => i !== last) : list.slice();
  const pickList = candidates.length ? candidates : list;
  const choice = pickList[Math.floor(Math.random() * pickList.length)];
  lastImageForTheme[theme] = choice;
  return choice;
}

function setTheme(theme, restart = true) {
  if (!THEMES[theme]) return;
  currentTheme = theme;
  // update background floating emojis for the selected theme
  updateBgEmojisForTheme(theme);
  imageSrc = pickImageForTheme(theme);
  // update UI buttons to reflect active theme
  updateThemeUI();
  if (restart) init();
}

function updateThemeUI() {
  try {
    const btns = document.querySelectorAll('[data-theme]');
    btns.forEach(btn => {
      const key = btn.getAttribute('data-theme');
      if (key === currentTheme) {
        btn.classList.remove('bbtn-secondary');
        btn.classList.add('bbtn-primary');
        btn.setAttribute('aria-pressed','true');
        // subtle focus style for selected theme
        btn.style.boxShadow = '0 6px 18px rgba(37,99,235,0.12)';
      } else {
        btn.classList.remove('bbtn-primary');
        btn.classList.add('bbtn-secondary');
        btn.setAttribute('aria-pressed','false');
        btn.style.boxShadow = 'none';
      }
    });
  } catch (e) {}
}

// wire all theme buttons (handles any number of themes)
try {
  const themeBtns = document.querySelectorAll('[data-theme]');
  themeBtns.forEach(b => {
    b.addEventListener('click', (e) => {
      const key = b.getAttribute('data-theme');
      setTheme(key);
    });
  });
} catch (e) {}

// wire difficulty select (compact) or fallback to legacy buttons
try{
  const sel = document.getElementById('difficultySelect');
  if (sel) {
    sel.addEventListener('change', ()=> setDifficulty(sel.value));
    sel.value = currentDifficulty;
  } else {
    const diffs = document.querySelectorAll('[data-diff]');
    diffs.forEach(d => d.addEventListener('click', ()=> setDifficulty(d.getAttribute('data-diff'))));
  }
  // apply initial UI state
  updateDifficultyUI();
}catch(e){}

// Top hamburger menu toggle
(function wireTopMenu(){
  const btn = document.getElementById('topMenuBtn');
  const panel = document.getElementById('topMenuPanel');
  if (!btn || !panel) return;
  function openMenu(){ panel.classList.remove('hidden'); btn.setAttribute('aria-expanded','true'); panel.setAttribute('aria-hidden','false'); }
  function closeMenu(){ panel.classList.add('hidden'); btn.setAttribute('aria-expanded','false'); panel.setAttribute('aria-hidden','true'); }
  function toggleMenu(){ if (panel.classList.contains('hidden')) openMenu(); else closeMenu(); }
  btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleMenu(); });
  // close when clicking outside
  document.addEventListener('click', (e)=>{ if (!panel.contains(e.target) && !btn.contains(e.target)) closeMenu(); });
  // close on Esc
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeMenu(); });
  // ensure menu closes when navigation actions happen (like Solve / Shuffle)
  try{ document.getElementById('shuffleBtn').addEventListener('click', closeMenu); }catch(e){}
  try{ document.getElementById('solveBtn').addEventListener('click', closeMenu); }catch(e){}
})();

// helper to reduce difficulty by one step
function reduceDifficulty() {
  try {
    if (currentDifficulty === 'hard') setDifficulty('normal');
    else if (currentDifficulty === 'normal') setDifficulty('easy');
    else {
      // already easy — do nothing
    }
  } catch (e) {}
}

// restore default hint action buttons
function restoreHintActions() {
  try {
    const actions = document.querySelector('.hint-actions');
    if (!actions) return;
    actions.innerHTML = '';
    const btn1 = document.createElement('button');
    btn1.className = 'calm';
    btn1.textContent = 'Eu me recuso a desistir';
    btn1.addEventListener('click', () => { document.getElementById('hint').classList.add('hidden'); });
    const btn2 = document.createElement('button');
    btn2.className = 'solve';
    btn2.textContent = 'Mostrar solução';
    btn2.addEventListener('click', () => { document.getElementById('hint').classList.add('hidden'); document.getElementById('solveBtn').click(); });
    actions.appendChild(btn1);
    actions.appendChild(btn2);
  } catch (e) {}
}



// Hearts background: create floating hearts behind the UI
function startHearts() {
  if (!heartsContainer) return;
  // create periodic floating emojis based on current theme
  setInterval(() => {
    const choice = bgEmojis[Math.floor(Math.random() * bgEmojis.length)];
    const h = document.createElement('div');
    h.className = 'heart';
    h.textContent = choice;
    // size variation per emoji
    const size = 12 + Math.random() * 36; // font-size px
    h.style.fontSize = size + 'px';
    const left = Math.random() * 100;
    const top = Math.random() * 100; // spread vertically across page
    h.style.left = left + '%';
    h.style.top = top + '%';
    const duration = 4000 + Math.random() * 8000; // ms
    h.style.animationDuration = duration + 'ms';
    h.style.opacity = (0.5 + Math.random() * 0.5).toString();
    // random horizontal drift via transform rotate and small translateX
    const drift = (Math.random() - 0.5) * 30; // percent to translateX during animation
    h.style.setProperty('--drift', drift + 'px');
    heartsContainer.appendChild(h);
    // remove after animation
    setTimeout(() => { h.remove(); }, duration + 300);
  }, 250);
}

startHearts();

// estilo responsivo dos números
(function applyResponsiveStyles(){
  const style = document.createElement('style');
  style.textContent = `
    #board {
      gap: 3px;
      background: #374151;
      border-radius: 8px;
      padding: 3px;
    }
    #board button { transition: transform 0.08s, opacity 0.08s; }
    #board button:active { opacity: 0.82; transform: scale(0.96); }
    /* Full-image overlay shown on puzzle completion */
    #winOverlay { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; background: rgba(2,6,23,0.7); z-index:70; padding:18px; }
    #winOverlay .win-card { max-width: 960px; width: min(96vw, 960px); max-height: 92vh; background: transparent; display:flex; align-items:center; justify-content:center; position:relative; }
    #winOverlay img.win-image { width: 100%; height: auto; object-fit: contain; border-radius:10px; box-shadow: 0 20px 50px rgba(2,6,23,0.28); }
    #winOverlay .win-close { position:absolute; top:8px; right:8px; background: rgba(255,255,255,0.9); border:none; border-radius:8px; padding:6px 8px; cursor:pointer; font-weight:700; }
    /* Confetti pieces animation */
    .confetti-piece { will-change: transform, opacity; }
    @keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg); opacity:1 } 100% { transform: translateY(120vh) rotate(720deg); opacity:0 } }
    /* Centered congratulations message */
    #winOverlay .win-message { position: absolute; top: 10%; left: 50%; transform: translateX(-50%); background: linear-gradient(90deg,#06b6d4,#8b5cf6); color: white; padding:14px 18px; border-radius:12px; box-shadow: 0 12px 30px rgba(2,6,23,0.24); font-weight:800; font-size:1.05rem; z-index:80; text-align:center; display:flex; align-items:center; gap:10px; }
    #winOverlay .win-message small { display:block; font-weight:600; opacity:0.95; margin-top:6px; font-size:0.92rem; }
    #winOverlay .win-message .msg-close { background: transparent; border: none; color: rgba(255,255,255,0.95); font-weight:900; margin-left:8px; cursor:pointer; }
    /* Animated icons around the message */
    .win-anim-icons { position:absolute; inset:0; pointer-events:none; }
    .win-anim-icons span { position:absolute; font-size:22px; opacity:0; transform: translateY(0) scale(0.8); animation: icon-pop 1400ms cubic-bezier(.2,.9,.3,1) forwards; }
    @keyframes icon-pop { 0% { opacity:0; transform: translateY(6px) scale(0.8) rotate(0deg) } 30% { opacity:1; transform: translateY(-6px) scale(1.08) rotate(20deg) } 100% { opacity:1; transform: translateY(-28px) scale(1) rotate(360deg) } }
    /* Subtle pulse for message */
    @keyframes msg-pop { 0% { transform: translateX(-50%) scale(.96); opacity:0 } 60% { transform: translateX(-50%) scale(1.02); opacity:1 } 100% { transform: translateX(-50%) scale(1); opacity:1 } }
    #winOverlay .win-message { animation: msg-pop .6s cubic-bezier(.2,.9,.3,1) both; }

    /* Mouse fairy-dust pieces (small glowing stars) */
    #mouseDustContainer { position: fixed; inset: 0; pointer-events: none; overflow: visible; z-index: 60; }
    .dust-piece { position: absolute; pointer-events: none; transform-origin: center; will-change: transform, opacity; animation: dust-pop 900ms cubic-bezier(.2,.8,.2,1) forwards; text-shadow: 0 2px 6px rgba(255,130,190,0.14); font-weight: 600; line-height: 1; background: transparent; border-radius: 0; display: inline-block; padding: 0; }
    @keyframes dust-pop {
      0% { opacity: 1; transform: translateY(0) scale(0.4) rotate(0deg); filter: blur(0px); }
      40% { opacity: 0.95; transform: translateY(-8px) scale(1.12) rotate(18deg); filter: blur(0.4px); }
      100% { opacity: 0; transform: translateY(-48px) scale(0.8) rotate(92deg); filter: blur(1.6px); }
      }

      /* Hide the native cursor everywhere (including clickable elements) — we show a wand image instead */
      body, button, a, input, textarea, select, #board, #board button, .bbtn-primary, .bbtn-secondary { cursor: none !important; }

      /* Fairy book GIF pinned to bottom-right on desktop */
      #fairyBook { position: fixed; right: 20px; bottom: 20px; width: 120px; height: auto; z-index: 20; pointer-events: none; display: block; }
      /* On small screens show a smaller fairy book in the corner instead of hiding it */
      @media (max-width: 900px) {
        #fairyBook { display: block !important; width: 64px; right: 12px; bottom: 12px; opacity: 0.95; pointer-events: auto; }
      }
    `;
  document.head.appendChild(style);
})();

// Fairy dust mouse trail: pink sparkles emitted at mouse/touch position
function startFairyDust() {
  try {
    // create container once
    let container = document.getElementById('mouseDustContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'mouseDustContainer';
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.pointerEvents = 'none';
      container.style.overflow = 'visible';
      container.style.zIndex = '60';
      document.body.appendChild(container);
    }

    function makeParticle(x, y) {
      const p = document.createElement('span');
      p.className = 'dust-piece';
      // star characters for variety
      const stars = ['✦','✶','✺','✨','✧'];
      p.textContent = stars[Math.floor(Math.random() * stars.length)];
      const size = 4 + Math.random() * 6; // much smaller px font-size
      p.style.fontSize = size + 'px';
      p.style.left = (x - size/2) + 'px';
      p.style.top = (y - size/2) + 'px';
      p.style.lineHeight = '1';
      p.style.display = 'inline-block';
      p.style.background = 'transparent';
      p.style.borderRadius = '0';
      // pink color variations
      const pinks = ['#ff7ecb','#ff8ccf','#ff69b4','#ff99d6'];
      p.style.color = pinks[Math.floor(Math.random() * pinks.length)];
      p.style.opacity = String(0.95 - Math.random() * 0.6);
      p.style.transform = 'translateZ(0)';
      container.appendChild(p);
      // remove after animation
      setTimeout(() => { p.remove(); }, 700 + Math.random() * 700);
    }

    let lastEmit = 0;
    function emitAt(clientX, clientY) {
      const now = Date.now();
      // throttle to ~60-120 particles/sec depending on movement
      if (now - lastEmit < 16) return;
      lastEmit = now;
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        // slight spread
        const sx = clientX + (Math.random() - 0.5) * 18;
        const sy = clientY + (Math.random() - 0.5) * 12;
        makeParticle(sx, sy);
      }
    }

    function onMove(e) {
      if (e.touches && e.touches.length) {
        const t = e.touches[0];
        emitAt(t.clientX, t.clientY);
      } else {
        emitAt(e.clientX, e.clientY);
      }
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
  } catch (e) { console.error('startFairyDust error', e); }
}

startFairyDust();

// Custom wand cursor: show `varinha.webp` following the pointer and hide native cursor
function startWandCursor() {
  try {
    if (document.getElementById('wandCursor')) return;
    const img = document.createElement('img');
    img.id = 'wandCursor';
    img.src = 'varinha.webp';
    img.alt = 'varinha';
    img.style.position = 'fixed';
    img.style.left = '0px';
    img.style.top = '0px';
    img.style.width = '44px';
    img.style.height = 'auto';
    img.style.pointerEvents = 'none';
    img.style.zIndex = '120';
    img.style.transition = 'left 0.02s linear, top 0.02s linear, transform 120ms linear';
    document.body.appendChild(img);
    // hide native cursor so wand is visible everywhere
    try { document.body.style.cursor = 'none'; } catch(e){}

    // hotspot offsets: adjust these so the wand tip aligns with pointer
    const hotspot = { x: 8, y: 34 };
    function onMove(e) {
      const x = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      const y = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
      // position the image so the hotspot pixel is exactly at the pointer
      img.style.left = (x - hotspot.x) + 'px';
      img.style.top = (y - hotspot.y) + 'px';
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
  } catch (e) { console.error('startWandCursor error', e); }
}

startWandCursor();

// Add fairy book GIF to bottom-right on desktop screens
function addFairyBook() {
  try {
    let b = document.getElementById('fairyBook');
    if (!b) {
      b = document.createElement('img');
      b.id = 'fairyBook';
      b.src = 'livro de fada.gif';
      b.alt = 'Livro de fada';
      b.style.pointerEvents = 'auto';
      // keep native cursor hidden here too so only the wand is visible
      b.style.cursor = 'none';
      document.body.appendChild(b);
      // open surprise and immediately unlock 'fadas' when clicked
      b.addEventListener('click', (e) => { e.stopPropagation(); try{ unlockFadasButton(); }catch(_){}; setTheme('fadas'); showFairySurprise(); });
    }
    function update() {
      if (window.innerWidth >= 900) b.style.display = 'block'; else b.style.display = 'none';
    }
    update();
    window.addEventListener('resize', update);
  } catch (e) { console.error('addFairyBook error', e); }
}

addFairyBook();
// Ensure 'fadas' theme is hidden on every page load (no persistence)
try {
  const fbtn = document.querySelector('[data-theme="fadas"]');
  if (fbtn) fbtn.style.display = 'none';
} catch(e) {}

// Global unlock function so clicking the book can immediately reveal the theme
function unlockFadasButton() {
  try {
    const btn = document.querySelector('[data-theme="fadas"]');
    if (btn) {
      btn.style.display = '';
      try { btn.removeAttribute('aria-hidden'); } catch(e) {}
      try {
        btn.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' });
      } catch (e) {}
    }
    // do not persist unlock to storage — require unlocking each visit
  } catch (e) { console.error('unlockFadasButton error', e); }
}

// Surprise opened when clicking the fairy book GIF
function showFairySurprise() {
  try {
    // avoid duplicates
    if (document.getElementById('fairySurprise')) return;
    const overlay = document.createElement('div');
    overlay.id = 'fairySurprise';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(2,6,23,0.6)';
    overlay.style.zIndex = '140';
    overlay.style.pointerEvents = 'auto';
    overlay.style.padding = '18px';

    const card = document.createElement('div');
    card.style.background = 'linear-gradient(180deg,#fff,#f7eefc)';
    card.style.borderRadius = '12px';
    card.style.padding = '22px';
    card.style.maxWidth = '640px';
    card.style.width = 'min(92vw,640px)';
    card.style.boxShadow = '0 20px 60px rgba(2,6,23,0.28)';
    card.style.pointerEvents = 'auto';
    card.style.zIndex = '141';
    card.style.textAlign = 'center';

    const h = document.createElement('h3');
    h.textContent = 'Surpresa das Fadas!';
    h.style.margin = '0 0 8px 0';
    h.style.fontSize = '1.15rem';
    h.style.fontWeight = '800';
    h.style.color = '#6b21a8';

    const p = document.createElement('p');
    p.textContent = 'Tailane, você encontrou um livro mágico, parabéns!';
    p.style.margin = '0 0 12px 0';
    p.style.color = '#334155';

    // build a more impressive fairy surprise (no internal close button)
    const reveal = document.createElement('div');
    reveal.style.marginBottom = '8px';
    reveal.style.fontSize = '1rem';
    reveal.style.color = '#6b21a8';
    reveal.style.fontWeight = '700';
    reveal.textContent = 'Uma magia das fadas aconteceu...';

    const big = document.createElement('div');
    big.style.fontSize = '1.8rem';
    big.style.fontWeight = '900';
    big.style.background = 'linear-gradient(90deg,#ff88d1,#f59be3,#a78bfa)';
    big.style.webkitBackgroundClip = 'text';
    big.style.backgroundClip = 'text';
    big.style.color = 'transparent';
    big.style.margin = '6px 0 12px 0';
    big.textContent = 'Tema "Fadas" desbloqueado!';

    // removed internal CTA — clicking the book now unlocks immediately

    card.appendChild(h);
    card.appendChild(reveal);
    card.appendChild(big);
    card.appendChild(p);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // make overlay focusable for Escape key
    overlay.tabIndex = -1;
    try { overlay.focus(); } catch(e) {}
    overlay.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { overlay.remove(); removeConfetti(); } });

    // create flying fairy/star particles programmatically
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('div');
      s.textContent = ['✨','🧚','🌟'][Math.floor(Math.random()*3)];
      s.style.position = 'absolute';
      s.style.left = (50 + (Math.random()-0.5)*40) + '%';
      s.style.top = (55 + Math.random()*20) + '%';
      const sz = 10 + Math.random()*28;
      s.style.fontSize = sz + 'px';
      s.style.opacity = '0';
      s.style.transform = 'translate(-50%, -50%) scale(0.6)';
      s.style.pointerEvents = 'none';
      s.style.zIndex = '142';
      overlay.appendChild(s);
      // animate via JS (no extra CSS needed)
      (function(el){
        const dx = (Math.random()-0.5) * 220; const dy = -120 - Math.random()*260; const rot = (Math.random()-0.5)*720;
        setTimeout(()=>{ el.style.transition = 'transform 1200ms cubic-bezier(.2,.9,.2,1), opacity 1200ms ease'; el.style.opacity = '1'; el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(1)`; }, 60 + Math.random()*220);
        setTimeout(()=>{ el.style.transition = 'opacity 600ms ease'; el.style.opacity = '0'; }, 1200 + Math.random()*1200);
        setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 2600 + Math.random()*1000);
      })(s);
    }

    // small confetti celebration
    launchConfetti(overlay);
    // clicking outside closes
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) { overlay.remove(); removeConfetti(); } });
  } catch (e) { console.error('showFairySurprise error', e); }
}

function showFullImageOnWin() {
  try {
    // avoid creating multiple overlays
    if (document.getElementById('winOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'winOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-label','Imagem completa — puzzle resolvido');

    const card = document.createElement('div');
    card.className = 'win-card';

    const img = document.createElement('img');
    img.className = 'win-image';
    img.src = imageSrc || squaredImageSrc;
    img.alt = 'Imagem completa';

    // centered congratulations message with animated icons and close
    const msg = document.createElement('div');
    msg.className = 'win-message';
    msg.innerHTML = 'Parabéns — você concluiu o quebra-cabeças!<small>Ótimo trabalho 🎉</small>';
    // close button inside message
    const msgClose = document.createElement('button');
    msgClose.className = 'msg-close';
    msgClose.type = 'button';
    msgClose.textContent = '✕';
    msgClose.addEventListener('click', hideWinMessage);
    msg.appendChild(msgClose);
    card.appendChild(msg);
    // animated icons container
    const icons = document.createElement('div');
    icons.className = 'win-anim-icons';
    const iconSet = ['🎉','✨','⭐','🥳','💫','👏','🎊'];
    for (let i = 0; i < 8; i++) {
      const sp = document.createElement('span');
      sp.textContent = iconSet[i % iconSet.length];
      // random position around the message
      sp.style.left = (40 + Math.random() * 40) + '%';
      sp.style.top = (6 + Math.random() * 18) + '%';
      sp.style.fontSize = (18 + Math.random() * 18) + 'px';
      sp.style.animationDelay = (i * 80) + 'ms';
      icons.appendChild(sp);
    }
    card.appendChild(icons);

    const btn = document.createElement('button');
    btn.className = 'win-close';
    btn.type = 'button';
    btn.textContent = 'Fechar';
    btn.addEventListener('click', removeWinOverlay);

    card.appendChild(img);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    // close overlay when clicking outside image
    overlay.addEventListener('click', (ev)=>{ if (ev.target === overlay) removeWinOverlay(); });
    // launch confetti celebration
    launchConfetti(overlay);
  } catch (e) { console.error('showFullImageOnWin error', e); }
}

function removeWinOverlay() {
  try {
    const ex = document.getElementById('winOverlay');
    if (ex) ex.remove();
    // remove any running confetti
    removeConfetti();
  } catch (e) {}
}

function hideWinMessage() {
  try {
    const overlay = document.getElementById('winOverlay');
    if (!overlay) return;
    const msg = overlay.querySelector('.win-message');
    const icons = overlay.querySelector('.win-anim-icons');
    if (msg) msg.style.display = 'none';
    if (icons) icons.style.display = 'none';
  } catch (e) { console.error('hideWinMessage error', e); }
}

function launchConfetti(parentEl) {
  try {
    removeConfetti();
    const overlay = parentEl || document.body;
    const container = document.createElement('div');
    container.id = 'confettiContainer';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.overflow = 'visible';

    const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
    const pieces = 40;
    for (let i = 0; i < pieces; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const dur = 1800 + Math.random() * 2200;
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.background = color;
      p.style.left = left + '%';
      p.style.top = (20 + Math.random() * 10) + '%';
      p.style.width = (6 + Math.random() * 8) + 'px';
      p.style.height = (8 + Math.random() * 10) + 'px';
      p.style.borderRadius = '2px';
      p.style.opacity = '0.95';
      p.style.transform = 'translateY(0) rotate(' + (Math.random()*360) + 'deg)';
      p.style.animation = `confetti-fall ${dur}ms cubic-bezier(.2,.8,.2,1) ${delay}s forwards`;
      p.style.position = 'absolute';
      container.appendChild(p);
    }
    overlay.appendChild(container);
    // auto remove confetti after 6s
    _confettiTimeout = setTimeout(() => { removeConfetti(); }, 6000);
  } catch (e) { console.error('launchConfetti error', e); }
}

function removeConfetti() {
  try {
    if (_confettiTimeout) { clearTimeout(_confettiTimeout); _confettiTimeout = null; }
    const c = document.getElementById('confettiContainer');
    if (c) c.remove();
  } catch (e) { console.error('removeConfetti error', e); }
}
