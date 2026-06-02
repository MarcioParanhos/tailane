let SIZE = 5;
let imageSrc = 'foto001.jpeg';
let squaredImageSrc = imageSrc; // data URL quadrada gerada por canvas

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
  SIZE = 5; // fixed 5x5 as requested
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
  // fallback: start immediately
  init();
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
