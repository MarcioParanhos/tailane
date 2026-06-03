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
  fadas: ['fada001.jpeg', 'fada002.jpeg']
};
let currentTheme = 'casamento';
// store last chosen image per theme (declared early to avoid TDZ errors)
const lastImageForTheme = {};
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
    canvas.width  = size;
    canvas.height = size;
    try {
      canvas.getContext('2d').drawImage(
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
  if (isSolved()) winMsg.classList.remove('hidden');
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
      if (moves > 2 && !hintShown2000) {
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
  // create periodic hearts
  setInterval(() => {
    const h = document.createElement('div');
    h.className = 'heart';
    h.textContent = '❤️';
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
  `;
  document.head.appendChild(style);
})();
