/* 
   app.js — UI Controller for PDA Simulator
*/

// ── State ──────────────────────────────────────
let currentPreset = 'anbn';
let currentPDA = null;
let trace = [];
let traceIndex = 0;
let animTimer = null;
let isRunning = false;
let isPaused = false;

const SPEED_MAP = { 1: 1200, 2: 700, 3: 350, 4: 180, 5: 80 };
let animDelay = SPEED_MAP[2];

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPreset('anbn');
  updateSpeed(2);
});

// ── Tab Switching ──────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(`panel-${name}`);
  const btn = document.getElementById(`tab-${name}-btn`);
  if (panel) panel.classList.add('active');
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.id !== `tab-${name}-btn`) b.setAttribute('aria-selected', 'false');
  });
  if (name === 'editor') renderEditor();
}

// ── Preset Loading ─────────────────────────────
function loadPreset(key) {
  resetSimulation();
  currentPreset = key;

  // Highlight button
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`preset-${key}`);
  if (btn) btn.classList.add('active');

  const config = PDA_PRESETS[key];
  currentPDA = new PDA(config);

  // Set a default example
  const input = document.getElementById('input-string');
  input.value = config.examples[0] || '';

  // Render quick-fill buttons
  const qb = document.getElementById('quick-btns');
  qb.innerHTML = '';
  config.examples.forEach(ex => {
    const b = document.createElement('button');
    b.className = 'qs-btn';
    b.textContent = ex;
    b.onclick = () => { input.value = ex; validateInput(); };
    qb.appendChild(b);
  });

  renderConfigTable(config);
  renderPDATuple(config);
  updateDiagramHint(config.name);
  clearVisualization();
  renderCanvas(null);
  document.getElementById('hint-text') && (document.getElementById('hint-text').textContent = '');

  validateInput();
  setStatus('idle', `Loaded: ${config.name}`);
}

// ── Input Validation ───────────────────────────
function validateInput() {
  if (!currentPDA) return false;
  const raw = document.getElementById('input-string').value.trim();
  const hint = document.getElementById('input-hint');
  if (!raw) {
    hint.textContent = '';
    hint.className = 'hint-text';
    return false;
  }
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

// ── Simulation Control ─────────────────────────
function runSimulation() {
  if (isRunning && !isPaused) return;

  const input = document.getElementById('input-string').value.trim();
  if (!input) { setStatus('idle', 'Please enter an input string.'); return; }
  if (!validateInput()) { setStatus('idle', 'Invalid input string.'); return; }

  if (isPaused) {
    // Resume
    isPaused = false;
    isRunning = true;
    updateCtrlButtons();
    setStatus('running', 'Running…');
    scheduleNext();
    return;
  }

  // Fresh run
  trace = currentPDA.simulate(input);
  traceIndex = 0;
  isRunning = true;
  isPaused = false;
  clearLog();
  updateCtrlButtons();
  setStatus('running', 'Running…');
  scheduleNext();
}

function pauseSimulation() {
  if (!isRunning) return;
  isPaused = true;
  isRunning = false;
  clearInterval(animTimer);
  updateCtrlButtons();
  setStatus('paused', `Paused at step ${traceIndex}/${trace.length - 1}`);
}

function stepOnce() {
  const input = document.getElementById('input-string').value.trim();
  if (!trace.length || traceIndex === 0) {
    if (!input || !validateInput()) { setStatus('idle', 'Enter a valid input string first.'); return; }
    trace = currentPDA.simulate(input);
    traceIndex = 0;
    clearLog();
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
  trace = []; traceIndex = 0;
  isRunning = false; isPaused = false;
  updateCtrlButtons();
  clearVisualization();
  clearLog();
  setStatus('idle', 'Ready — load a preset or type an input string.');
  renderCanvas(null);
  if (document.getElementById('step-counter')) document.getElementById('step-counter').textContent = '';
  const expBody = document.getElementById('explanation-body');
  if (expBody) expBody.innerHTML = '<p class="exp-idle">Run the simulation or press Step to see detailed explanations for each transition.</p>';
  const td = document.getElementById('transition-display');
  if (td) td.textContent = '';
}

function scheduleNext() {
  animTimer = setTimeout(() => {
    if (!isRunning || isPaused) return;
    if (traceIndex >= trace.length) {
      isRunning = false; isPaused = false;
      updateCtrlButtons();
      return;
    }
    const step = trace[traceIndex];
    renderStep(step);
    appendLog(step, traceIndex);
    traceIndex++;
    if (step.isAccept || step.isReject) {
      isRunning = false; isPaused = false;
      updateCtrlButtons();
    } else {
      scheduleNext();
    }
  }, animDelay);
}

// ── Speed ──────────────────────────────────────
function updateSpeed(val) {
  animDelay = SPEED_MAP[val] || 700;
  const labels = { 1: 'Slow', 2: 'Normal', 3: 'Fast', 4: 'Faster', 5: 'Instant' };
  document.getElementById('speed-label').textContent = labels[val] || 'Normal';
}

// ── UI Updates ─────────────────────────────────
function updateCtrlButtons() {
  const btnRun = document.getElementById('btn-run');
  const btnPause = document.getElementById('btn-pause');
  const btnStep = document.getElementById('btn-step');
  const btnReset = document.getElementById('btn-reset');

  if (isRunning) {
    btnRun.textContent = '▶ Run'; btnRun.disabled = true;
    btnPause.disabled = false;
    btnStep.disabled = true;
  } else if (isPaused) {
    btnRun.textContent = '▶ Resume'; btnRun.disabled = false;
    btnPause.disabled = true;
    btnStep.disabled = false;
  } else {
    btnRun.textContent = '▶ Run'; btnRun.disabled = false;
    btnPause.disabled = true;
    btnStep.disabled = false;
  }
}

function setStatus(type, text) {
  const bar = document.getElementById('status-bar');
  const icon = document.getElementById('status-icon');
  const txt = document.getElementById('status-text');
  bar.className = 'status-bar status-' + type;
  const icons = { idle: '◈', running: '◉', accept: '✓', reject: '✗', paused: '⏸' };
  icon.textContent = icons[type] || '◈';
  txt.textContent = text;
}

function updateDiagramHint(name) {
  const el = document.getElementById('diagram-hint');
  if (el) el.textContent = name;
}

// ── Visualization Rendering ────────────────────
function renderStep(step) {
  renderCanvas(step);
  renderTape(step);
  renderStack(step);
  renderExplanation(step);

  // Glow the viz-center on accept/reject
  const viz = document.querySelector('.viz-center');
  viz.classList.remove('glow-accept', 'glow-reject');
  if (step.isAccept) { viz.classList.add('glow-accept'); setStatus('accept', '✓ ACCEPTED — String is in the language!'); }
  if (step.isReject) { viz.classList.add('glow-reject'); setStatus('reject', '✗ REJECTED — String is NOT in the language.'); }
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

// ─ Tape ─────────────────────────────────────
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

// ─ Stack ────────────────────────────────────
function renderStack(step) {
  const container = document.getElementById('stack-display');
  container.innerHTML = '';
  if (!step || !step.stack) return;

  const stackToShow = [...step.stack]; // bottom at index 0
  stackToShow.forEach((sym, i) => {
    const el = document.createElement('div');
    el.className = 'stack-item';
    if (i === stackToShow.length - 1) el.classList.add('top'); // top of stack
    if (sym === 'Z0') el.classList.add('stack-z0');
    el.textContent = sym;
    container.appendChild(el);
  });
}

// ─ Explanation ──────────────────────────────
function renderExplanation(step) {
  const body = document.getElementById('explanation-body');
  const tdisp = document.getElementById('transition-display');
  const counter = document.getElementById('step-counter');

  counter.textContent = `Step ${step.stepNum}`;

  if (step.isAccept || step.isReject) {
    const cls = step.isAccept ? 'exp-accept' : 'exp-reject';
    body.innerHTML = `<p class="exp-step ${cls}">${escapeHtml(step.description)}</p>`;
    tdisp.textContent = step.isAccept ? '✓ Accepted by final state' : '✗ Rejected';
    return;
  }

  const lines = step.description.split('\n').filter(Boolean);
  body.innerHTML = lines.map(l => `<p class="exp-step">${formatLine(l)}</p>`).join('');
  tdisp.innerHTML = step.action !== 'Start'
    ? `<span style="color:var(--white-dim)">δ:</span> <code style="color:var(--yellow);font-family:var(--font-code)">${escapeHtml(step.action)}</code>`
    : '';
}

function formatLine(line) {
  return escapeHtml(line)
    .replace(/&quot;([^&]+)&quot;/g, '<code>"$1"</code>')
    .replace(/"([^"]+)"/g, '<code>"$1"</code>')
    .replace(/\b(Push|Pop|Popped|Pushed|Consumed|Transition|State)\b/g, '<strong>$1</strong>');
}
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─ Log ──────────────────────────────────────
function clearLog() {
  const log = document.getElementById('step-log');
  log.innerHTML = '<p class="log-idle">Computation steps will appear here.</p>';
}

function appendLog(step, idx) {
  const log = document.getElementById('step-log');
  const idle = log.querySelector('.log-idle');
  if (idle) idle.remove();

  // Remove 'current' from previous
  log.querySelectorAll('.log-entry.current').forEach(e => e.classList.remove('current'));

  const entry = document.createElement('div');
  entry.className = 'log-entry current';
  entry.id = `log-entry-${idx}`;

  if (step.isAccept) { entry.classList.remove('current'); entry.classList.add('accepted'); }
  if (step.isReject) { entry.classList.remove('current'); entry.classList.add('rejected'); }

  const stateStr = `(${step.state}, ${step.inputHead < step.tape.length ? step.tape[step.inputHead] : 'ε'}, ${step.stack.length > 0 ? step.stack[step.stack.length - 1] : '∅'})`;
  entry.innerHTML = `<span class="log-step-num">#${step.stepNum}</span>${stateStr}`;
  entry.title = step.description;
  entry.onclick = () => { renderStep(step); };

  log.appendChild(entry);
  entry.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ─ Config Table ──────────────────────────────
function renderConfigTable(config) {
  const el = document.getElementById('config-table');
  el.innerHTML = '';
  const rows = [
    ['States', config.states.join(', ')],
    ['Alphabet', config.inputAlphabet.join(', ')],
    ['Stack Σ', config.stackAlphabet.join(', ')],
    ['Start', config.initialState],
    ['Init Stack', config.initialStack],
    ['Accept', config.acceptStates.join(', ')],
    ['Rules', config.transitions.length + ' transitions'],
  ];
  rows.forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'config-row';
    row.innerHTML = `<span class="config-key">${k}</span><span class="config-val">${v}</span>`;
    el.appendChild(row);
  });
}

// ─ PDA Tuple Sidebar ─────────────────────────
function renderPDATuple(config) {
  const el = document.getElementById('pda-tuple-display');
  if (!el) return;
  const rows = [
    ['Q', config.states.join(', '), 'States'],
    ['Σ', config.inputAlphabet.join(', '), 'Input alphabet'],
    ['Γ', config.stackAlphabet.join(', '), 'Stack alphabet'],
    ['q₀', config.initialState, 'Initial state'],
    ['Z₀', config.initialStack, 'Initial stack symbol'],
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

// ══════════ CANVAS — State Diagram ══════════
const NODE_RADIUS = 28;
const CANVAS_COLORS = {
  bg: '#131313',
  border: '#2a2a2a',
  node: '#1a1a1a',
  nodeBdr: '#3a3a3a',
  active: '#ffd60a',
  accept: '#39d353',
  text: '#f4f4f4',
  textDim: '#9a9a9a',
  arrow: '#555',
  arrowAct: '#ffd60a',
  label: '#9a9a9a',
};

function getNodePositions(states, canvasWidth, canvasHeight) {
  const n = states.length;
  const positions = {};
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  if (n === 1) {
    positions[states[0]] = { x: cx, y: cy };
  } else if (n === 2) {
    positions[states[0]] = { x: cx - 110, y: cy };
    positions[states[1]] = { x: cx + 110, y: cy };
  } else {
    const radius = Math.min(cx, cy) - NODE_RADIUS - 20;
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
  ctx.fillStyle = CANVAS_COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const positions = getNodePositions(currentPDA.states, W, H);
  const activeState = step ? step.state : null;
  const prevState = step && step.transition ? step.transition.from : null;

  // Draw transitions (arrows)
  currentPDA.transitions.forEach(t => {
    const from = positions[t.from];
    const to = positions[t.to];
    if (!from || !to) return;
    const isActive = step && step.transition && step.transition.from === t.from && step.transition.to === t.to && step.transition.input === t.input;
    drawArrow(ctx, from, to, t, isActive, activeState, prevState, positions);
  });

  // Draw nodes
  currentPDA.states.forEach(state => {
    const pos = positions[state];
    if (!pos) return;
    const isActive = activeState === state;
    const isAccept = currentPDA.acceptStates.includes(state);
    const isInitial = state === currentPDA.initialState;

    // Glow for active
    if (isActive) {
      ctx.shadowColor = step && step.isAccept ? '#39d353' : step && step.isReject ? '#f85149' : '#ffd60a';
      ctx.shadowBlur = 22;
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = isActive ? (step && step.isAccept ? 'rgba(57,211,83,0.15)' : step && step.isReject ? 'rgba(248,81,73,0.15)' : 'rgba(255,214,10,0.1)') : CANVAS_COLORS.node;
    ctx.fill();
    ctx.strokeStyle = isActive ? (step && step.isAccept ? '#39d353' : step && step.isReject ? '#f85149' : CANVAS_COLORS.active) : isAccept ? '#39d35355' : CANVAS_COLORS.nodeBdr;
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Double circle for accept states
    if (isAccept) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS - 5, 0, 2 * Math.PI);
      ctx.strokeStyle = isActive ? '#39d353' : '#39d35344';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Initial arrow
    if (isInitial) {
      ctx.beginPath();
      ctx.moveTo(pos.x - NODE_RADIUS - 28, pos.y);
      ctx.lineTo(pos.x - NODE_RADIUS - 2, pos.y);
      ctx.strokeStyle = CANVAS_COLORS.textDim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawArrowHead(ctx, pos.x - NODE_RADIUS - 2, pos.y, 0, CANVAS_COLORS.textDim);
    }

    // State label
    ctx.font = 'bold 13px JetBrains Mono, monospace';
    ctx.fillStyle = isActive ? (step && step.isAccept ? '#39d353' : step && step.isReject ? '#f85149' : CANVAS_COLORS.active) : CANVAS_COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state, pos.x, pos.y);
  });
}

function drawArrow(ctx, from, to, t, isActive, activeState, prevState, positions) {
  const color = isActive ? CANVAS_COLORS.arrowAct : CANVAS_COLORS.arrow;
  ctx.strokeStyle = color;
  ctx.lineWidth = isActive ? 2 : 1.2;

  const label = buildTransLabel(t);

  if (t.from === t.to) {
    // Self-loop
    drawSelfLoop(ctx, from, label, isActive, color);
    return;
  }

  // Check if reverse transition exists for curve
  const hasCurve = currentPDA.transitions.some(ot => ot.from === t.to && ot.to === t.from);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / dist, ny = dx / dist; // perpendicular

  const curveOff = hasCurve ? 30 : 0;
  const cpx = (from.x + to.x) / 2 + nx * curveOff;
  const cpy = (from.y + to.y) / 2 + ny * curveOff;

  // Compute start/end on node borders
  const angle1 = Math.atan2(cpy - from.y, cpx - from.x);
  const angle2 = Math.atan2(to.y - cpy, to.x - cpx);
  const sx = from.x + NODE_RADIUS * Math.cos(angle1);
  const sy = from.y + NODE_RADIUS * Math.sin(angle1);
  const ex = to.x - NODE_RADIUS * Math.cos(angle2);
  const ey = to.y - NODE_RADIUS * Math.sin(angle2);

  ctx.beginPath();
  if (hasCurve) {
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpx, cpy, ex, ey);
  } else {
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
  }
  ctx.stroke();

  // Arrowhead
  drawArrowHead(ctx, ex, ey, angle2, color);

  // Label
  const lx = hasCurve ? cpx : (sx + ex) / 2;
  const ly = hasCurve ? cpy : (sy + ey) / 2;
  drawTransLabel(ctx, label, lx + nx * 12, ly + ny * 12, isActive);
}

function drawSelfLoop(ctx, pos, label, isActive, color) {
  const loopRadius = 22;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - NODE_RADIUS - loopRadius, loopRadius, 0.2 * Math.PI, 0.8 * Math.PI, true);
  ctx.stroke();
  // Arrowhead at end of arc
  const endX = pos.x - loopRadius * Math.sin(0.8 * Math.PI - Math.PI / 2) + pos.x - pos.x;
  drawArrowHead(ctx, pos.x - 8, pos.y - NODE_RADIUS - 2, Math.PI * 0.3, color);
  drawTransLabel(ctx, label, pos.x, pos.y - NODE_RADIUS - loopRadius * 2 - 6, isActive);
}

function drawArrowHead(ctx, x, y, angle, color) {
  const size = 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2);
  ctx.lineTo(-size, size / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawTransLabel(ctx, label, x, y, isActive) {
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillStyle = isActive ? '#ffd60a' : '#777';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Background pill
  const w = ctx.measureText(label).width + 8;
  ctx.fillStyle = 'rgba(13,13,13,0.85)';
  ctx.fillRect(x - w / 2, y - 8, w, 16);
  ctx.fillStyle = isActive ? '#ffd60a' : '#666';
  ctx.fillText(label, x, y);
}

function buildTransLabel(t) {
  const inp = (t.input === 'ε' || t.input === '') ? 'ε' : t.input;
  const push = (t.push === 'ε' || t.push === '') ? 'ε' : t.push.replace(/\s+/g, '');
  return `${inp},${t.stackTop}→${push}`;
}

// ══════════ EDITOR PANEL ══════════════════════
function renderEditor() {
  if (!currentPDA) return;
  const ta = document.getElementById('json-editor');
  const config = PDA_PRESETS[currentPreset];
  ta.value = JSON.stringify(config, null, 2);
  document.getElementById('editor-status').textContent = '';
  document.getElementById('editor-status').className = 'editor-status';
}

function applyEditorChanges() {
  const ta = document.getElementById('json-editor');
  const status = document.getElementById('editor-status');
  try {
    const raw = JSON.parse(ta.value);
    // Validate required fields
    const required = ['name', 'states', 'inputAlphabet', 'stackAlphabet', 'initialState', 'initialStack', 'acceptStates', 'transitions'];
    const missing = required.filter(k => !(k in raw));
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);

    // Apply to current preset slot
    PDA_PRESETS[currentPreset] = raw;
    currentPDA = new PDA(raw);
    renderConfigTable(raw);
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
