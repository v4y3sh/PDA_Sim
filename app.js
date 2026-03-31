/*
   app.js — UI Controller for PDA Simulator v4
   Includes: String Builder, Table Editor, JSON Editor
*/

// ── State ─────────────────────────────────────────
let currentPreset = 'anbn';
let currentPDA = null;
let trace = [];
let traceIndex = 0;
let animTimer = null;
let isRunning = false;
let isPaused = false;
let wcwrMode = 'random';
let tableRowCount = 0;

const SPEED_MAP = { 1: 1200, 2: 700, 3: 350, 4: 180, 5: 80 };
let animDelay = SPEED_MAP[2];

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPreset('anbn');
  updateSpeed(2);
  // Sync builder dropdown to default preset
  const sel = document.getElementById('builder-lang');
  if (sel) sel.value = 'anbn';
  updateBuilderPreview();
});

// ── Tab Switching ─────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  const panel = document.getElementById(`panel-${name}`);
  const btn = document.getElementById(`tab-${name}-btn`);
  if (panel) panel.classList.add('active');
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  if (name === 'editor') renderEditor();
  if (name === 'table') initTableEditorIfEmpty();
}

// ── Preset Loading ────────────────────────────────
function loadPreset(key) {
  if (!PDA_PRESETS[key]) return;
  resetSimulation();
  currentPreset = key;

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`preset-${key}`);
  if (btn) btn.classList.add('active');

  // Also sync builder dropdown
  const sel = document.getElementById('builder-lang');
  if (sel) sel.value = key;
  onBuilderLangChange(false); // sync UI but don't re-call loadPreset

  const config = PDA_PRESETS[key];
  currentPDA = new PDA(config);

  const input = document.getElementById('input-string');
  input.value = config.examples[0] || '';

  const qb = document.getElementById('quick-btns');
  qb.innerHTML = '';
  config.examples.forEach(ex => {
    const b = document.createElement('button');
    b.className = 'qs-btn';
    b.textContent = ex;
    b.onclick = () => { input.value = ex; validateInput(); };
    qb.appendChild(b);
  });

  renderPDATuple(config);
  updateDiagramHint(config.fullName || config.name);
  clearVisualization();
  renderCanvas(null);
  resetPhaseBar();

  validateInput();
  setStatus('idle', `Loaded: ${config.fullName || config.name}`);
}

// ── Input Validation ──────────────────────────────
function validateInput() {
  if (!currentPDA) return false;
  const raw = document.getElementById('input-string').value.trim();
  const hint = document.getElementById('input-hint');
  if (!raw) { hint.textContent = ''; hint.className = 'hint-text'; return false; }
  const valid = raw.split('').every(c => currentPDA.inputAlphabet.includes(c));
  if (valid) {
    hint.textContent = `✓ Valid string (length ${raw.length})`;
    hint.className = 'hint-text hint-ok';
  } else {
    const bad = [...new Set(raw.split('').filter(c => !currentPDA.inputAlphabet.includes(c)))];
    hint.textContent = `✗ Invalid chars: ${bad.join(', ')}`;
    hint.className = 'hint-text hint-err';
  }
  return valid;
}

// ── Simulation Control ────────────────────────────
function runSimulation() {
  if (isRunning && !isPaused) return;
  const input = document.getElementById('input-string').value.trim();
  if (!input) { setStatus('idle', 'Please enter an input string.'); return; }
  if (!validateInput()) { setStatus('idle', 'Invalid input string.'); return; }

  if (isPaused) {
    isPaused = false; isRunning = true;
    updateCtrlButtons(); setStatus('running', 'Running…');
    scheduleNext(); return;
  }

  trace = currentPDA.simulate(input);
  traceIndex = 0; isRunning = true; isPaused = false;
  clearLog(); updateCtrlButtons(); setStatus('running', 'Running…');
  scheduleNext();
}

function pauseSimulation() {
  if (!isRunning) return;
  isPaused = true; isRunning = false;
  clearInterval(animTimer); updateCtrlButtons();
  setStatus('paused', `Paused at step ${traceIndex}/${trace.length - 1}`);
}

function stepOnce() {
  const input = document.getElementById('input-string').value.trim();
  if (!trace.length || traceIndex === 0) {
    if (!input || !validateInput()) { setStatus('idle', 'Enter a valid input string first.'); return; }
    trace = currentPDA.simulate(input);
    traceIndex = 0; clearLog();
  }
  if (animTimer) clearInterval(animTimer);
  isRunning = false; isPaused = true;
  renderStep(trace[traceIndex]);
  appendLog(trace[traceIndex], traceIndex);
  traceIndex++;
  updateCtrlButtons();
  if (traceIndex >= trace.length) { isRunning = false; isPaused = false; updateCtrlButtons(); }
  else setStatus('paused', `Step ${traceIndex}/${trace.length - 1} — press Step or Run to continue`);
}

function resetSimulation() {
  clearInterval(animTimer);
  trace = []; traceIndex = 0; isRunning = false; isPaused = false;
  updateCtrlButtons(); clearVisualization(); clearLog();
  setStatus('idle', 'Ready — load a preset or use the String Builder.');
  renderCanvas(null); resetPhaseBar();
  const sc = document.getElementById('step-counter');
  if (sc) sc.textContent = '';
  const expBody = document.getElementById('explanation-body');
  if (expBody) expBody.innerHTML = '<p class="exp-idle">Run the simulation or press Step to see detailed explanations for each transition.</p>';
  const td = document.getElementById('transition-display');
  if (td) td.textContent = '';
}

function scheduleNext() {
  animTimer = setTimeout(() => {
    if (!isRunning || isPaused) return;
    if (traceIndex >= trace.length) { isRunning = false; isPaused = false; updateCtrlButtons(); return; }
    const step = trace[traceIndex];
    renderStep(step); appendLog(step, traceIndex); traceIndex++;
    if (step.isAccept || step.isReject) { isRunning = false; isPaused = false; updateCtrlButtons(); }
    else scheduleNext();
  }, animDelay);
}

// ── Speed ─────────────────────────────────────────
function updateSpeed(val) {
  animDelay = SPEED_MAP[val] || 700;
  const labels = { 1: 'Slow', 2: 'Normal', 3: 'Fast', 4: 'Faster', 5: 'Instant' };
  document.getElementById('speed-label').textContent = labels[val] || 'Normal';
}

// ── UI Updates ────────────────────────────────────
function updateCtrlButtons() {
  const btnRun = document.getElementById('btn-run');
  const btnPause = document.getElementById('btn-pause');
  const btnStep = document.getElementById('btn-step');
  if (isRunning) {
    btnRun.textContent = '▶ Run'; btnRun.disabled = true;
    btnPause.disabled = false; btnStep.disabled = true;
  } else if (isPaused) {
    btnRun.textContent = '▶ Resume'; btnRun.disabled = false;
    btnPause.disabled = true; btnStep.disabled = false;
  } else {
    btnRun.textContent = '▶ Run'; btnRun.disabled = false;
    btnPause.disabled = true; btnStep.disabled = false;
  }
}

function setStatus(type, text) {
  const bar = document.getElementById('status-bar');
  const icon = document.getElementById('status-icon');
  const txt = document.getElementById('status-text');
  if (!bar) return;
  bar.className = 'status-bar status-' + type;
  const icons = { idle: '◈', running: '◉', accept: '✓', reject: '✗', paused: '⏸' };
  icon.textContent = icons[type] || '◈';
  txt.textContent = text;
}

function updateDiagramHint(name) {
  const el = document.getElementById('diagram-hint');
  if (el) el.textContent = name;
}

// ════════════════ STRING BUILDER ═════════════════

function onBuilderLangChange(doLoad = true) {
  const key = document.getElementById('builder-lang').value;
  const preset = PDA_PRESETS[key];
  if (!preset) return;

  // Show/hide m input
  const mField = document.getElementById('m-field');
  const wcwrPanel = document.getElementById('wcwr-panel');
  const nField = document.getElementById('n-field');

  mField.style.display = preset.needsM ? '' : 'none';
  wcwrPanel.style.display = preset.needsW ? '' : 'none';
  nField.style.display = ''; // always show n (for random w length)

  // If manual mode and wcwr hidden, ensure n shows
  if (!preset.needsW) {
    const manualPanel = document.getElementById('wcwr-manual-panel');
    if (manualPanel) manualPanel.style.display = 'none';
  }

  if (doLoad) loadPreset(key);
  updateBuilderPreview();
}

function setWcwrMode(mode) {
  wcwrMode = mode;
  document.getElementById('mode-random').classList.toggle('active', mode === 'random');
  document.getElementById('mode-manual').classList.toggle('active', mode === 'manual');
  const manualPanel = document.getElementById('wcwr-manual-panel');
  if (manualPanel) manualPanel.style.display = mode === 'manual' ? '' : 'none';
  // Hide n-input (length) when typing manually
  const nField = document.getElementById('n-field');
  if (nField) nField.style.display = mode === 'manual' ? 'none' : '';
  updateBuilderPreview();
}

function buildString(key, n, m) {
  const preset = PDA_PRESETS[key];
  if (!preset || !preset.generator) return '';
  if (preset.needsW) {
    let w = '';
    if (wcwrMode === 'manual') {
      const wEl = document.getElementById('w-input');
      w = wEl ? wEl.value.trim().replace(/[^ab]/g, '') : '';
    }
    return preset.generator(n, m, w);
  }
  return preset.generator(n, m);
}

function updateBuilderPreview() {
  const key = document.getElementById('builder-lang').value;
  const n = parseInt(document.getElementById('n-input').value) || 1;
  const m = parseInt(document.getElementById('m-input').value) || 1;
  const previewEl = document.getElementById('builder-preview');
  if (!previewEl) return;
  try {
    const str = buildString(key, n, m);
    if (str) previewEl.innerHTML = `→ <code style="color:var(--yellow)">${str}</code> <span style="color:#555">(len ${str.length})</span>`;
    else previewEl.textContent = '';
  } catch (e) { previewEl.textContent = ''; }
}

function generateAndRun() {
  const key = document.getElementById('builder-lang').value;
  const n = parseInt(document.getElementById('n-input').value) || 1;
  const m = parseInt(document.getElementById('m-input').value) || 1;
  const str = buildString(key, n, m);
  if (!str) { setStatus('idle', 'Could not generate string.'); return; }

  loadPreset(key);
  document.getElementById('input-string').value = str;
  validateInput();
  setTimeout(() => runSimulation(), 80);
}

// ════════════════ VISUALIZATION ══════════════════

function renderStep(step) {
  renderCanvas(step);
  renderTape(step);
  renderStack(step);
  renderExplanation(step);
  renderPhaseIndicator(step);

  const viz = document.querySelector('#viz-diagram');
  if (viz) {
    viz.classList.remove('glow-accept', 'glow-reject');
    if (step.isAccept) { viz.classList.add('glow-accept'); setStatus('accept', '✓ ACCEPTED — String is in the language!'); }
    if (step.isReject) { viz.classList.add('glow-reject'); setStatus('reject', '✗ REJECTED — String is NOT in the language.'); }
  }
}

function clearVisualization() {
  const tape = document.getElementById('tape-display');
  const stack = document.getElementById('stack-display');
  if (tape) tape.innerHTML = '';
  if (stack) stack.innerHTML = '';
  const viz = document.querySelector('.viz-center');
  if (viz) viz.classList.remove('glow-accept', 'glow-reject');
  const expBody = document.getElementById('explanation-body');
  if (expBody) expBody.innerHTML = '<p class="exp-idle">Run the simulation or press Step to see detailed explanations.</p>';
}

// Phase indicator
function renderPhaseIndicator(step) {
  const bar = document.getElementById('phase-bar');
  const txt = document.getElementById('phase-bar-text');
  if (!bar || !txt) return;
  bar.classList.remove('phase-active', 'phase-accept', 'phase-reject');
  if (step.isAccept) {
    bar.classList.add('phase-accept');
    bar.querySelector('.phase-bar-icon').textContent = '✓';
    txt.textContent = step.phase || 'Accepted — computation complete.';
    return;
  }
  if (step.isReject) {
    bar.classList.add('phase-reject');
    bar.querySelector('.phase-bar-icon').textContent = '✗';
    txt.textContent = 'Rejected — no valid transition found.';
    return;
  }
  const phaseLabel = step.phase || (currentPDA && currentPDA.phases && currentPDA.phases[step.state]) || '';
  if (phaseLabel) {
    bar.classList.add('phase-active');
    bar.querySelector('.phase-bar-icon').textContent = '◉';
    txt.textContent = phaseLabel;
  } else {
    bar.querySelector('.phase-bar-icon').textContent = '◈';
    txt.textContent = `State: ${step.state}`;
  }
}

function resetPhaseBar() {
  const bar = document.getElementById('phase-bar');
  const txt = document.getElementById('phase-bar-text');
  if (!bar || !txt) return;
  bar.classList.remove('phase-active', 'phase-accept', 'phase-reject');
  bar.querySelector('.phase-bar-icon').textContent = '◈';
  txt.textContent = 'Run a simulation to see the current computation phase.';
}

// Tape
function renderTape(step) {
  const container = document.getElementById('tape-display');
  container.innerHTML = '';
  if (!step || !step.tape) return;
  step.tape.forEach((sym, i) => {
    const cell = document.createElement('div');
    cell.className = 'tape-cell';
    cell.textContent = sym;
    if (i < step.inputHead) cell.classList.add('read');
    else if (i === step.inputHead) cell.classList.add('current');
    else cell.classList.add('pending');
    container.appendChild(cell);
  });
  if (step.tape.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tape-cell pending';
    empty.textContent = 'ε';
    container.appendChild(empty);
  }
}

// Stack with pop-flash animation
let _prevStackLen = 0;

function renderStack(step) {
  const container = document.getElementById('stack-display');
  if (!step || !step.stack) { container.innerHTML = ''; _prevStackLen = 0; return; }
  const stackToShow = [...step.stack];
  const isPopping = step.stackDelta && step.stackDelta.action === 'pop';
  const isPushing = step.stackDelta && step.stackDelta.action === 'push';

  if (isPopping && _prevStackLen > 0) {
    const oldTop = container.querySelector('.stack-item.top');
    if (oldTop) { oldTop.classList.remove('top'); oldTop.classList.add('stack-popping'); }
    setTimeout(() => _doRenderStack(container, stackToShow, isPushing), 280);
    _prevStackLen = stackToShow.length;
    return;
  }
  _doRenderStack(container, stackToShow, isPushing);
  _prevStackLen = stackToShow.length;
}

function _doRenderStack(container, stackToShow, isPushing) {
  container.innerHTML = '';
  stackToShow.forEach((sym, i) => {
    const el = document.createElement('div');
    el.className = 'stack-item';
    const isTop = i === stackToShow.length - 1;
    if (isTop) el.classList.add('top');
    if (sym === 'Z0') el.classList.add('stack-z0');
    if (isTop && isPushing) el.classList.add('stack-pushing');
    el.textContent = sym;
    container.appendChild(el);
  });
}

// Explanation panel
function renderExplanation(step) {
  const body = document.getElementById('explanation-body');
  const tdisp = document.getElementById('transition-display');
  const counter = document.getElementById('step-counter');
  counter.textContent = `Step ${step.stepNum}`;

  if (step.isAccept || step.isReject) {
    const cls = step.isAccept ? 'exp-accept' : 'exp-reject';
    body.innerHTML = `<p class="exp-step ${cls}">${step.description}</p>`;
    tdisp.textContent = step.isAccept ? '✓ Accepted by final state' : '✗ Rejected';
    return;
  }
  body.innerHTML = `<p class="exp-step">${step.description}</p>`;
  tdisp.innerHTML = step.action !== 'Start'
    ? `<span style="color:var(--white-dim)">δ:</span> <code style="color:var(--yellow);font-family:var(--font-code)">${escapeHtml(step.action)}</code>`
    : '';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Step log
function clearLog() {
  const log = document.getElementById('step-log');
  log.innerHTML = '<p class="log-idle">Computation steps will appear here.</p>';
}

function appendLog(step, idx) {
  const log = document.getElementById('step-log');
  const idle = log.querySelector('.log-idle');
  if (idle) idle.remove();
  log.querySelectorAll('.log-entry.current').forEach(e => e.classList.remove('current'));

  const entry = document.createElement('div');
  entry.className = 'log-entry current';
  entry.id = `log-entry-${idx}`;
  if (step.isAccept) { entry.classList.remove('current'); entry.classList.add('accepted'); }
  if (step.isReject) { entry.classList.remove('current'); entry.classList.add('rejected'); }

  const inputSym = step.inputHead < step.tape.length ? step.tape[step.inputHead] : 'ε';
  const stackTop = step.stack.length > 0 ? step.stack[step.stack.length - 1] : '∅';
  entry.innerHTML = `<span class="log-step-num">#${step.stepNum}</span>(${step.state}, ${inputSym}, ${stackTop})`;
  entry.title = step.description.replace(/<[^>]+>/g, '');
  entry.onclick = () => renderStep(step);
  log.appendChild(entry);
  entry.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// PDA Tuple sidebar
function renderPDATuple(config) {
  const el = document.getElementById('pda-tuple-display');
  if (!el) return;
  const rows = [
    ['Q', config.states.join(', '), 'States'],
    ['Σ', config.inputAlphabet.join(', '), 'Input alphabet'],
    ['Γ', config.stackAlphabet.join(', '), 'Stack alphabet'],
    ['q₀', config.initialState, 'Initial state'],
    ['Z₀', config.initialStack, 'Init stack symbol'],
    ['F', config.acceptStates.join(', '), 'Accept states'],
    ['δ', `${config.transitions.length} rules`, 'Transition function'],
  ];
  el.innerHTML = rows.map(([sym, val, name]) =>
    `<div class="tuple-row">
      <span class="tuple-sym">${sym}</span>
      <span class="tuple-val">${val}<span class="tuple-name">${name}</span></span>
    </div>`
  ).join('');
}

// ════════════════ CANVAS — State Diagram ═════════

const NODE_RADIUS = 28;
const getCanvasColors = () => {
  const isLight = document.body.classList.contains('light-mode');
  return {
    bg: isLight ? '#f0f2f5' : '#131313',
    border: isLight ? '#d1d5db' : '#2a2a2a',
    node: isLight ? '#ffffff' : '#1a1a1a',
    nodeBdr: isLight ? '#d1d5db' : '#3a3a3a',
    active: isLight ? '#d97706' : '#ffd60a',
    accept: isLight ? '#10b981' : '#39d353',
    text: isLight ? '#1f2937' : '#f4f4f4',
    textDim: isLight ? '#6b7280' : '#9a9a9a',
    arrow: isLight ? '#9ca3af' : '#555',
    arrowAct: isLight ? '#d97706' : '#ffd60a',
    label: isLight ? '#6b7280' : '#9a9a9a',
  };
};

function getNodePositions(states, W, H) {
  const n = states.length;
  const positions = {};
  const cx = W / 2, cy = (H / 2) + 15;
  if (n === 1) {
    positions[states[0]] = { x: cx, y: cy };
  } else if (n === 2) {
    positions[states[0]] = { x: cx - 110, y: cy };
    positions[states[1]] = { x: cx + 110, y: cy };
  } else {
    const radius = Math.min(cx, H / 2) - NODE_RADIUS - 40;
    states.forEach((s, i) => {
      const angle = (2 * Math.PI * i / n) - Math.PI / 2;
      positions[s] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
  }
  return positions;
}

function renderCanvas(step) {
  const canvas = document.getElementById('state-canvas');
  if (!canvas || !currentPDA) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = getCanvasColors().bg;
  ctx.fillRect(0, 0, W, H);

  const positions = getNodePositions(currentPDA.states, W, H);
  const activeState = step ? step.state : null;
  const prevState = step && step.transition ? step.transition.from : null;

  currentPDA.transitions.forEach(t => {
    const from = positions[t.from], to = positions[t.to];
    if (!from || !to) return;
    const isActive = step && step.transition && step.transition.from === t.from && step.transition.to === t.to && step.transition.input === t.input;
    drawArrow(ctx, from, to, t, isActive, activeState, prevState, positions);
  });

  currentPDA.states.forEach(state => {
    const pos = positions[state];
    if (!pos) return;
    const isActive = activeState === state;
    const isAccept = currentPDA.acceptStates.includes(state);
    const isInitial = state === currentPDA.initialState;

    if (isActive) {
      ctx.shadowColor = step && step.isAccept ? '#39d353' : step && step.isReject ? '#f85149' : '#ffd60a';
      ctx.shadowBlur = 22;
    }

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = isActive ? (step && step.isAccept ? 'rgba(57,211,83,0.15)' : step && step.isReject ? 'rgba(248,81,73,0.15)' : 'rgba(255,214,10,0.1)') : getCanvasColors().node;
    ctx.fill();
    ctx.strokeStyle = isActive ? (step && step.isAccept ? '#39d353' : step && step.isReject ? '#f85149' : getCanvasColors().active) : isAccept ? '#39d35355' : getCanvasColors().nodeBdr;
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (isAccept) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS - 5, 0, 2 * Math.PI);
      ctx.strokeStyle = isActive ? '#39d353' : '#39d35344';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (isInitial) {
      ctx.beginPath();
      ctx.moveTo(pos.x - NODE_RADIUS - 28, pos.y);
      ctx.lineTo(pos.x - NODE_RADIUS - 2, pos.y);
      ctx.strokeStyle = getCanvasColors().textDim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawArrowHead(ctx, pos.x - NODE_RADIUS - 2, pos.y, 0, getCanvasColors().textDim);
    }

    ctx.font = 'bold 13px JetBrains Mono, monospace';
    ctx.fillStyle = isActive ? (step && step.isAccept ? '#39d353' : step && step.isReject ? '#f85149' : getCanvasColors().active) : getCanvasColors().text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state, pos.x, pos.y);
  });
}

function drawArrow(ctx, from, to, t, isActive, activeState, prevState, positions) {
  const color = isActive ? getCanvasColors().arrowAct : getCanvasColors().arrow;
  ctx.strokeStyle = color;
  ctx.lineWidth = isActive ? 2 : 1.2;
  const label = buildTransLabel(t);

  if (t.from === t.to) { drawSelfLoop(ctx, from, label, isActive, color); return; }

  const hasCurve = currentPDA.transitions.some(ot => ot.from === t.to && ot.to === t.from);
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / dist, ny = dx / dist;
  const curveOff = hasCurve ? 30 : 0;
  const cpx = (from.x + to.x) / 2 + nx * curveOff;
  const cpy = (from.y + to.y) / 2 + ny * curveOff;

  const angle1 = Math.atan2(cpy - from.y, cpx - from.x);
  const angle2 = Math.atan2(to.y - cpy, to.x - cpx);
  const sx = from.x + NODE_RADIUS * Math.cos(angle1);
  const sy = from.y + NODE_RADIUS * Math.sin(angle1);
  const ex = to.x - NODE_RADIUS * Math.cos(angle2);
  const ey = to.y - NODE_RADIUS * Math.sin(angle2);

  ctx.beginPath();
  if (hasCurve) { ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey); }
  else { ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); }
  ctx.stroke();
  drawArrowHead(ctx, ex, ey, angle2, color);

  const lx = hasCurve ? cpx : (sx + ex) / 2;
  const ly = hasCurve ? cpy : (sy + ey) / 2;
  drawTransLabel(ctx, label, lx + nx * 12, ly + ny * 12, isActive);
}

function drawSelfLoop(ctx, pos, label, isActive, color) {
  const loopRadius = 22;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - NODE_RADIUS - loopRadius, loopRadius, 0.2 * Math.PI, 0.8 * Math.PI, true);
  ctx.stroke();
  drawArrowHead(ctx, pos.x - 8, pos.y - NODE_RADIUS - 2, Math.PI * 0.3, color);
  drawTransLabel(ctx, label, pos.x, pos.y - NODE_RADIUS - loopRadius * 2 - 6, isActive);
}

function drawArrowHead(ctx, x, y, angle, color) {
  const size = 8;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-size, -size / 2); ctx.lineTo(-size, size / 2);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function drawTransLabel(ctx, label, x, y, isActive) {
  ctx.font = '10px JetBrains Mono, monospace';
  const w = ctx.measureText(label).width + 8;
  ctx.fillStyle = 'rgba(13,13,13,0.85)';
  ctx.fillRect(x - w / 2, y - 8, w, 16);
  ctx.fillStyle = isActive ? '#ffd60a' : '#666';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function buildTransLabel(t) {
  const inp = (t.input === 'ε' || t.input === '') ? 'ε' : t.input;
  const push = (t.push === 'ε' || t.push === '') ? 'ε' : t.push.replace(/\s+/g, '');
  return `${inp},${t.stackTop}→${push}`;
}

// ════════════════ TABLE EDITOR ════════════════════

function initTableEditorIfEmpty() {
  const tbody = document.getElementById('te-tbody');
  if (tbody && tbody.children.length === 0) {
    // Start with 3 blank rows as a hint
    addTableRow(); addTableRow(); addTableRow();
  }
}

function addTableRow(data = {}) {
  const tbody = document.getElementById('te-tbody');
  if (!tbody) return;
  tableRowCount++;
  const rowNum = tableRowCount;

  const tr = document.createElement('tr');
  tr.className = 'te-row';
  tr.id = `te-row-${rowNum}`;

  // Row number cell
  const tdNum = document.createElement('td');
  tdNum.className = 'te-num';
  tdNum.textContent = rowNum;
  tr.appendChild(tdNum);

  // Data cells
  const fields = ['from', 'input', 'stackTop', 'to', 'push'];
  const placeholders = ['q0', 'a / ε', 'Z0', 'q1', 'A Z0 / ε'];
  fields.forEach((f, i) => {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'te-cell';
    inp.placeholder = placeholders[i];
    inp.dataset.field = f;
    inp.value = data[f] !== undefined ? data[f] : '';
    inp.addEventListener('input', updateTeCounter);
    td.appendChild(inp);
    tr.appendChild(td);
  });

  // Delete button
  const tdDel = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.className = 'te-del-btn';
  delBtn.textContent = '✕';
  delBtn.title = 'Delete row';
  delBtn.onclick = () => { tr.remove(); updateTeCounter(); };
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  tbody.appendChild(tr);
  updateTeCounter();
  // Focus the first cell of the new row
  const firstCell = tr.querySelector('.te-cell');
  if (firstCell && !data.from) firstCell.focus();
}

function updateTeCounter() {
  const rows = document.querySelectorAll('#te-tbody .te-row');
  const el = document.getElementById('te-row-counter');
  if (el) el.textContent = `${rows.length} rule${rows.length !== 1 ? 's' : ''}`;
}

function parsePastedRules() {
  const text = document.getElementById('te-paste').value.trim();
  if (!text) return;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let parsed = 0;

  lines.forEach(line => {
    // Supported formats:
    //   q0, a, Z0 -> q0, A Z0
    //   (q0, a, Z0) -> (q0, A Z0)
    //   q0 a Z0 -> q0 A Z0
    const clean = line.replace(/[()]/g, '').trim();
    const arrowIdx = clean.search(/->/);
    if (arrowIdx === -1) return;

    const leftStr = clean.slice(0, arrowIdx).trim();
    const rightStr = clean.slice(arrowIdx + 2).trim();

    const left = leftStr.split(/[\s,]+/).filter(Boolean);
    const right = rightStr.split(/[\s,]+/).filter(Boolean);

    if (left.length < 3 || right.length < 1) return;

    const normaliseEps = s => (['e', 'eps', 'epsilon', 'lambda', 'λ', 'ε', ''].includes(s.toLowerCase()) ? 'ε' : s);

    const pushParts = right.slice(1);
    const pushStr = pushParts.length === 0 ? 'ε' : pushParts.map(normaliseEps).join(' ');

    addTableRow({
      from: left[0],
      input: normaliseEps(left[1]),
      stackTop: left[2],
      to: right[0],
      push: pushStr,
    });
    parsed++;
  });

  if (parsed > 0) {
    showTeStatus(`✓ Parsed ${parsed} rule(s) from text`, 'ok');
    document.getElementById('te-paste').value = '';
  } else {
    showTeStatus('✗ Could not parse any rules. Check format.', 'err');
  }
}

function clearTableEditor() {
  const tbody = document.getElementById('te-tbody');
  if (tbody) tbody.innerHTML = '';
  tableRowCount = 0;
  const pasteEl = document.getElementById('te-paste');
  if (pasteEl) pasteEl.value = '';
  ['te-name', 'te-init-state', 'te-init-stack', 'te-accept-states'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'te-init-state' ? 'q0' : id === 'te-init-stack' ? 'Z0' : '';
  });
  showTeStatus('', '');
  updateTeCounter();
}

function loadTableFromPreset(key) {
  if (!key || !PDA_PRESETS[key]) return;
  clearTableEditor();
  const config = PDA_PRESETS[key];
  document.getElementById('te-name').value = config.fullName || config.name;
  document.getElementById('te-init-state').value = config.initialState;
  document.getElementById('te-init-stack').value = config.initialStack;
  document.getElementById('te-accept-states').value = config.acceptStates.join(', ');
  config.transitions.forEach(t => addTableRow({
    from: t.from,
    input: t.input,
    stackTop: t.stackTop,
    to: t.to,
    push: (t.push === '' || t.push === undefined) ? 'ε' : t.push,
  }));
  showTeStatus(`✓ Loaded ${config.transitions.length} rules from ${config.name}`, 'ok');
}

/** Convert unspaced push string to spaced tokens: "AZ0" → "A Z0" */
function normalizePushStr(push) {
  if (!push || push === 'ε' || push === 'e' || push === '') return '';
  if (push.includes(' ')) return push; // already spaced
  // Tokenise: Z0 is a 2-char token, everything else is 1-char
  const tokens = [];
  let i = 0;
  while (i < push.length) {
    if (push[i] === 'Z' && i + 1 < push.length && push[i + 1] === '0') {
      tokens.push('Z0'); i += 2;
    } else {
      tokens.push(push[i]); i++;
    }
  }
  return tokens.join(' ');
}

function compileAndLoadTable() {
  const rows = document.querySelectorAll('#te-tbody .te-row');
  if (!rows.length) { showTeStatus('✗ No transitions defined.', 'err'); return; }

  const transitions = [];
  const statesSet = new Set();
  const inputAlphSet = new Set();
  const stackAlphSet = new Set();
  let hasError = false;

  rows.forEach(row => {
    const cells = row.querySelectorAll('.te-cell');
    const from = cells[0].value.trim();
    const input = cells[1].value.trim();
    const stackTop = cells[2].value.trim();
    const to = cells[3].value.trim();
    const pushRaw = cells[4].value.trim();

    // Validate required fields
    [cells[0], cells[1], cells[2], cells[3]].forEach((c, i) => {
      const missing = i < 4 && !c.value.trim();
      c.classList.toggle('te-cell-err', missing);
      if (missing) hasError = true;
    });
    if (!from || !input || !stackTop || !to) return;

    statesSet.add(from); statesSet.add(to);
    if (input !== 'ε' && input !== '') inputAlphSet.add(input);
    stackAlphSet.add(stackTop);

    const push = normalizePushStr(pushRaw === 'ε' ? '' : pushRaw);
    if (push) push.split(' ').forEach(sym => { if (sym) stackAlphSet.add(sym); });

    transitions.push({ from, input, stackTop, to, push });
  });

  if (hasError) { showTeStatus('✗ Fill all required fields (From, Input, StackTop, To).', 'err'); return; }

  const name = document.getElementById('te-name').value.trim() || 'Custom PDA';
  const initState = document.getElementById('te-init-state').value.trim() || 'q0';
  const initStack = document.getElementById('te-init-stack').value.trim() || 'Z0';
  const acceptStr = document.getElementById('te-accept-states').value.trim();
  const acceptStates = acceptStr ? acceptStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!acceptStates.length) { showTeStatus('✗ Specify at least one accept state.', 'err'); return; }

  stackAlphSet.add(initStack);

  const config = {
    name, fullName: name,
    description: 'Custom PDA from Table Editor',
    states: [...statesSet],
    inputAlphabet: [...inputAlphSet],
    stackAlphabet: [...stackAlphSet],
    initialState: initState,
    initialStack: initStack,
    acceptStates,
    transitions,
    examples: [],
    phases: {},
  };

  try {
    currentPDA = new PDA(config);
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    renderPDATuple(config);
    updateDiagramHint(name);
    clearVisualization();
    renderCanvas(null);
    resetPhaseBar();
    switchTab('sim');
    setStatus('idle', `Custom PDA loaded: ${name} (${transitions.length} rules)`);
    showTeStatus(`✓ Compiled ${transitions.length} rules — go to Simulator tab`, 'ok');
    const teStringInput = document.getElementById('te-test-string');
    if (teStringInput) {
      document.getElementById('input-string').value = teStringInput.value.trim();
      validateInput();
    }

    // Auto-run simulation
    setTimeout(() => {
      runSimulation();
    }, 150);
  } catch (e) {
    showTeStatus('✗ Error: ' + e.message, 'err');
  }
}

function showTeStatus(msg, type) {
  const el = document.getElementById('te-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'te-status' + (type ? ' ' + type : '');
}

function exportTableJSON() {
  if (!currentPDA) return;
  const exportObj = {
    name: currentPDA.name,
    fullName: currentPDA.fullName || currentPDA.name,
    description: currentPDA.description,
    states: currentPDA.states,
    inputAlphabet: currentPDA.inputAlphabet,
    stackAlphabet: currentPDA.stackAlphabet,
    initialState: currentPDA.initialState,
    initialStack: currentPDA.initialStack,
    acceptStates: currentPDA.acceptStates,
    transitions: currentPDA.transitions,
    examples: currentPDA.examples,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentPDA.name || 'pda').replace(/[^a-z0-9]/gi, '_') + '.json';
  a.click();
}

// ════════════════ JSON EDITOR ═════════════════════

function renderEditor() {
  if (!currentPDA) return;
  const ta = document.getElementById('json-editor');
  const config = PDA_PRESETS[currentPreset] || {
    name: currentPDA.name,
    states: currentPDA.states,
    inputAlphabet: currentPDA.inputAlphabet,
    stackAlphabet: currentPDA.stackAlphabet,
    initialState: currentPDA.initialState,
    initialStack: currentPDA.initialStack,
    acceptStates: currentPDA.acceptStates,
    transitions: currentPDA.transitions,
    examples: currentPDA.examples,
  };
  // Exclude generator functions from JSON output
  const { generator, needsM, needsW, ...rest } = config;
  ta.value = JSON.stringify(rest, null, 2);
  const es = document.getElementById('editor-status');
  if (es) { es.textContent = ''; es.className = 'editor-status'; }
}

function applyEditorChanges() {
  const ta = document.getElementById('json-editor');
  const status = document.getElementById('editor-status');
  try {
    const raw = JSON.parse(ta.value);
    const required = ['name', 'states', 'inputAlphabet', 'stackAlphabet', 'initialState', 'initialStack', 'acceptStates', 'transitions'];
    const missing = required.filter(k => !(k in raw));
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);

    if (currentPreset && PDA_PRESETS[currentPreset]) {
      PDA_PRESETS[currentPreset] = { ...PDA_PRESETS[currentPreset], ...raw };
    }
    currentPDA = new PDA(raw);
    renderPDATuple(raw);
    resetSimulation();
    renderCanvas(null);
    status.textContent = '✓ Changes applied successfully!';
    status.className = 'editor-status ok';
  } catch (e) {
    status.textContent = '✗ Error: ' + e.message;
    status.className = 'editor-status err';
  }
}

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = document.body.classList.contains('light-mode') ? '🌙' : '☀️';
  if (currentPDA) {
    clearVisualization();
    renderStep(trace && trace[traceIndex] ? trace[traceIndex] : { tape: [], stack: [], description: '', action: '', isAccept: false, isReject: false });
  }
}

