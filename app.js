/**
 * app.js — Main application controller
 * Wires up UI, coordinates renderer and automata engine
 */

// ============================================================
//  GLOBAL STATE
// ============================================================
const eng = window.engine;
let nfaRenderer, dfaRenderer, minRenderer, simRenderer;
let convertSteps = [], convertStepIdx = 0, convertResult = null;
let minimizeSteps = [], minimizeStepIdx = 0, minimizeResult = null;
let simState = null;   // { path, idx, auto, timer, automaton, inputStr }
let autoConvertTimer = null, autoMinTimer = null;

// ============================================================
//  DOM HELPERS
// ============================================================
const $ = id => document.getElementById(id);
const toast = (msg, type='info', duration=2500) => {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
};
const ce = (tag, cls='', text='') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};

// ============================================================
//  TAB NAVIGATION
// ============================================================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`panel-${tab}`).classList.add('active');
    if (tab === 'builder') refreshBuilder();
    if (tab === 'convert') refreshConvertTab();
    if (tab === 'minimize') refreshMinimizeTab();
    if (tab === 'simulate') refreshSimTab();
  });
});

// ============================================================
//  NFA BUILDER
// ============================================================
function refreshBuilder() {
  refreshStateList();
  refreshTransitionSelects();
  refreshTransitionTable();
  renderNFA();
}

function refreshStateList() {
  const list = $('state-list');
  list.innerHTML = '';
  eng.states.forEach(s => {
    const item = ce('div', 'state-item');
    const nameEl = ce('span', 'state-name', s.name);
    const badges = ce('div', 'state-badges');

    const startBtn = ce('button', `state-toggle toggle-start${s.isStart?' active':''}`, 'S');
    startBtn.title = 'Set as start state';
    startBtn.onclick = () => { eng.setStart(s.id); refreshBuilder(); };

    const acceptBtn = ce('button', `state-toggle toggle-accept${s.isAccept?' active':''}`, 'F');
    acceptBtn.title = 'Toggle accept state';
    acceptBtn.onclick = () => { eng.toggleAccept(s.id); refreshBuilder(); };

    const delBtn = ce('button', 'state-delete', '×');
    delBtn.title = 'Delete state';
    delBtn.onclick = () => { eng.deleteState(s.id); refreshBuilder(); };

    badges.append(startBtn, acceptBtn, delBtn);
    item.append(nameEl, badges);
    list.appendChild(item);
  });
}

function refreshTransitionSelects() {
  const stateOpts = eng.states.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  $('trans-from').innerHTML = stateOpts;
  $('trans-to').innerHTML = stateOpts;
  const symOpts = [...eng.alphabet, 'ε'].map(a => `<option value="${a}">${a}</option>`).join('');
  $('trans-symbol').innerHTML = symOpts;
}

function refreshTransitionTable() {
  const wrap = $('trans-table-wrapper');
  if (eng.states.length === 0) { wrap.innerHTML = '<p style="color:var(--text3);font-size:0.8rem">No states yet.</p>'; return; }
  const syms = [...eng.alphabet, 'ε'];
  let html = '<table><thead><tr><th>State</th>';
  syms.forEach(s => { html += `<th>${s}</th>`; });
  html += '</tr></thead><tbody>';
  eng.states.forEach(st => {
    const prefix = (st.isStart?'→':'') + (st.isAccept?'*':'');
    html += `<tr><td class="${st.isStart?'start-col':''}">${prefix}${st.name}</td>`;
    syms.forEach(sym => {
      const targets = eng.transitions
        .filter(t => t.from===st.id && t.symbol===sym)
        .map(t => eng.getState(t.to)?.name || t.to);
      html += `<td>${targets.length ? targets.join(',') : '—'}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function renderNFA(highlighted=[]) {
  if (!nfaRenderer) {
    nfaRenderer = new AutomataRenderer('nfa-canvas');
    nfaRenderer.onStateClick = (id) => {
      eng.toggleAccept(id);
      refreshBuilder();
    };
    $('nfa-canvas').addEventListener('dblclick', e => {
      const rect = $('nfa-canvas').getBoundingClientRect();
      addStateAt('q'+eng.states.length, e.clientX - rect.left, e.clientY - rect.top);
    });
  }
  nfaRenderer.cleanPositions(eng.states.map(s=>s.id));
  nfaRenderer.render(eng.states, eng.transitions, eng.alphabet, highlighted);
}

function addStateAt(name, x, y) {
  const id = eng.addState(name, eng.states.length===0, false);
  if (nfaRenderer) nfaRenderer.positions[id] = { x, y };
  refreshBuilder();
}

$('add-state-btn').addEventListener('click', () => {
  const name = 'q' + eng.states.length;
  const id = eng.addState(name, eng.states.length===0, false);
  nfaRenderer?.autoLayout(eng.states);
  refreshBuilder();
});

$('add-trans-btn').addEventListener('click', () => {
  const from = $('trans-from').value;
  const to   = $('trans-to').value;
  const sym  = $('trans-symbol').value;
  if (!from || !to) { toast('Select from/to states', 'error'); return; }
  eng.addTransition(from, sym, to);
  refreshBuilder();
  toast(`Added transition: ${eng.getState(from)?.name} —${sym}→ ${eng.getState(to)?.name}`, 'success');
});

$('alphabet-input').addEventListener('change', e => {
  eng.alphabet = e.target.value.split(',').map(a => a.trim()).filter(Boolean);
  refreshBuilder();
});

$('layout-btn').addEventListener('click', () => {
  nfaRenderer?.autoLayout(eng.states);
  renderNFA();
});

$('clear-canvas-btn').addEventListener('click', () => {
  eng.reset();
  nfaRenderer?.clear();
  refreshBuilder();
  toast('Cleared all states and transitions');
});

// Presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    eng.loadPreset(preset);
    nfaRenderer?.clear();
    nfaRenderer = new AutomataRenderer('nfa-canvas');
    nfaRenderer.onStateClick = (id) => { eng.toggleAccept(id); refreshBuilder(); };
    $('alphabet-input').value = eng.alphabet.join(',');
    nfaRenderer.autoLayout(eng.states);
    refreshBuilder();
    toast(`Loaded preset: ${btn.textContent}`, 'success');
  });
});

// ============================================================
//  NFA → DFA CONVERSION
// ============================================================
function refreshConvertTab() {
  buildEpsilonTable();
}

function buildEpsilonTable() {
  const wrap = $('epsilon-table');
  if (eng.states.length === 0) { wrap.innerHTML = ''; return; }
  let html = '<table><thead><tr><th>State</th><th>ε-closure</th></tr></thead><tbody>';
  eng.states.forEach(s => {
    const cl = eng.epsilonClosure(s.id).map(id => eng.getState(id)?.name||id).join(', ');
    html += `<tr><td>${s.name}</td><td>{${cl}}</td></tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

$('start-convert-btn').addEventListener('click', () => {
  const err = eng.validate();
  if (err) { toast(err, 'error'); return; }
  convertResult = eng.subsetConstruction();
  convertSteps = convertResult.steps;
  convertStepIdx = 0;

  // Initialize DFA renderer
  if (!dfaRenderer) dfaRenderer = new AutomataRenderer('dfa-canvas');
  dfaRenderer.clear();
  dfaRenderer.autoLayout(convertResult.dfa.states);

  $('convert-steps').innerHTML = '';
  $('dfa-table-wrapper').innerHTML = '';
  $('step-convert-btn').disabled = false;
  $('auto-convert-btn').disabled = false;
  $('start-convert-btn').disabled = true;

  addConvertStep(0);
});

$('step-convert-btn').addEventListener('click', () => {
  if (convertStepIdx < convertSteps.length - 1) {
    convertStepIdx++;
    addConvertStep(convertStepIdx);
  }
  if (convertStepIdx >= convertSteps.length - 1) {
    finalizeConvert();
  }
});

$('auto-convert-btn').addEventListener('click', () => {
  if (autoConvertTimer) { clearInterval(autoConvertTimer); autoConvertTimer = null; $('auto-convert-btn').textContent = '⚡ Auto Run'; return; }
  $('auto-convert-btn').textContent = '⏸ Pause';
  autoConvertTimer = setInterval(() => {
    if (convertStepIdx < convertSteps.length - 1) {
      convertStepIdx++;
      addConvertStep(convertStepIdx);
    } else {
      clearInterval(autoConvertTimer); autoConvertTimer = null;
      $('auto-convert-btn').textContent = '⚡ Auto Run';
      finalizeConvert();
    }
  }, 600);
});

function addConvertStep(idx) {
  const step = convertSteps[idx];
  const list = $('convert-steps');
  const item = ce('div', `step-item ${step.done?'step-done':step.type==='new-state'?'step-new':'step-note'}`);
  item.innerHTML = `<div class="step-title">${step.title}</div><div>${step.text}</div>`;
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;

  // Highlight the new/processed state in DFA
  const highlighted = [];
  if (step.newState) highlighted.push(step.newState);
  if (step.processState) highlighted.push(step.processState);

  renderConvertDFA(highlighted, step.from && step.to ? [{from:step.from, to:step.to}] : []);
}

function renderConvertDFA(highlightedStates=[], highlightedTrans=[]) {
  if (!convertResult || !dfaRenderer) return;
  const { dfa } = convertResult;
  dfaRenderer.render(dfa.states, dfa.transitions, dfa.alphabet, highlightedStates, highlightedTrans);
  $('dfa-state-count').textContent = `${dfa.states.length} states`;
}

function finalizeConvert() {
  if (!convertResult) return;
  const { dfa } = convertResult;
  dfaRenderer.render(dfa.states, dfa.transitions, dfa.alphabet);
  $('dfa-state-count').textContent = `${dfa.states.length} states`;

  // Build DFA transition table
  let html = '<table><thead><tr><th>State</th><th>NFA States</th>';
  dfa.alphabet.forEach(a => { html += `<th>${a}</th>`; });
  html += '</tr></thead><tbody>';
  dfa.states.forEach(s => {
    const prefix = (s.isStart?'→':'') + (s.isAccept?'*':'');
    const nfaNames = (s.nfaStates||[]).map(id => eng.getState(id)?.name||id).join(',') || '∅';
    html += `<tr><td class="${s.isStart?'start-col':''}${s.isAccept?' accept-col':''}">${prefix}${s.id}</td><td>{${nfaNames}}</td>`;
    dfa.alphabet.forEach(sym => {
      const t = dfa.transitions.find(t => t.from===s.id && t.symbol===sym);
      const next = t ? t.to : '—';
      html += `<td class="${next==='D∅'?'dead-col':''}">${next}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  $('dfa-table-wrapper').innerHTML = html;
  $('start-convert-btn').disabled = false;
  toast('DFA construction complete! 🎉', 'success');
}

// ============================================================
//  DFA MINIMIZATION
// ============================================================
function refreshMinimizeTab() {
  if (!eng.dfa) {
    $('min-steps').innerHTML = '<div class="step-item step-note"><div>Run NFA → DFA conversion first!</div></div>';
  }
}

$('start-min-btn').addEventListener('click', () => {
  if (!eng.dfa) { toast('Convert NFA to DFA first!', 'error'); return; }
  minimizeResult = eng.minimizeDFA();
  minimizeSteps = minimizeResult.steps;
  minimizeStepIdx = 0;

  if (!minRenderer) minRenderer = new AutomataRenderer('min-canvas');
  minRenderer.clear();
  minRenderer.autoLayout(minimizeResult.minDfa.states);

  $('min-steps').innerHTML = '';
  $('dist-table-wrapper').innerHTML = '';
  $('equiv-classes').innerHTML = '';
  $('step-min-btn').disabled = false;
  $('auto-min-btn').disabled = false;
  $('start-min-btn').disabled = true;

  addMinStep(0);
  buildDistTable([]);
});

$('step-min-btn').addEventListener('click', () => {
  if (minimizeStepIdx < minimizeSteps.length - 1) {
    minimizeStepIdx++;
    addMinStep(minimizeStepIdx);
  }
  if (minimizeStepIdx >= minimizeSteps.length - 1) {
    finalizeMinimize();
  }
});

$('auto-min-btn').addEventListener('click', () => {
  if (autoMinTimer) { clearInterval(autoMinTimer); autoMinTimer = null; $('auto-min-btn').textContent = '⚡ Auto Run'; return; }
  $('auto-min-btn').textContent = '⏸ Pause';
  autoMinTimer = setInterval(() => {
    if (minimizeStepIdx < minimizeSteps.length - 1) {
      minimizeStepIdx++;
      addMinStep(minimizeStepIdx);
    } else {
      clearInterval(autoMinTimer); autoMinTimer = null;
      $('auto-min-btn').textContent = '⚡ Auto Run';
      finalizeMinimize();
    }
  }, 500);
});

function addMinStep(idx) {
  const step = minimizeSteps[idx];
  const list = $('min-steps');
  const item = ce('div', `step-item ${step.done?'step-done':step.type==='mark'?'step-new':'step-note'}`);
  item.innerHTML = `<div class="step-title">${step.title}</div><div>${step.text||''}</div>`;
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;

  // Collect all marked pairs so far
  const markedPairs = minimizeSteps.slice(0, idx+1)
    .filter(s => s.type==='mark' && s.pair).map(s => s.pair);
  buildDistTable(markedPairs);
}

function buildDistTable(markedPairs) {
  if (!minimizeResult) return;
  const { states } = minimizeResult;
  const n = states.length;
  if (n === 0) return;
  let html = '<table><thead><tr><th></th>';
  for (let j = 0; j < n-1; j++) html += `<th>${states[j].id}</th>`;
  html += '</tr></thead><tbody>';
  for (let i = 1; i < n; i++) {
    html += `<tr><td style="color:var(--purple);font-weight:700">${states[i].id}</td>`;
    for (let j = 0; j < n-1; j++) {
      if (j >= i) { html += '<td style="background:rgba(0,0,0,0.3)">—</td>'; continue; }
      const k = minimizeResult.pairKey(states[i].id, states[j].id);
      const marked = markedPairs.includes(k);
      html += `<td class="${marked?'marked':''}">${marked?'✗':'○'}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  $('dist-table-wrapper').innerHTML = html;
}

function finalizeMinimize() {
  if (!minimizeResult) return;
  const { minDfa } = minimizeResult;
  buildDistTable(minimizeSteps.filter(s=>s.pair).map(s=>s.pair));
  minRenderer.autoLayout(minDfa.states);
  minRenderer.render(minDfa.states, minDfa.transitions, minDfa.alphabet);
  $('min-state-count').textContent = `${minDfa.states.length} states`;

  // Equiv classes
  const list = $('equiv-classes');
  list.innerHTML = '';
  minDfa.states.forEach(ms => {
    const div = ce('div', 'equiv-class');
    const label = ce('div', 'equiv-class-label', ms.id);
    const members = ce('div', 'equiv-class-states');
    const nfaNamesStr = ms.nfaNames && ms.nfaNames.length ? ms.nfaNames.join(', ') : ms.members.join(', ');
    members.innerHTML = `<strong>DFA states:</strong> {${ms.members.join(', ')}}<br/>` +
      `<strong>NFA states:</strong> {${nfaNamesStr}}<br/>` +
      `${ms.isAccept?'<span style="color:var(--yellow)">★ Accepting</span>':''}${ms.isStart?'<span style="color:var(--green)"> → Start</span>':''}`;
    div.append(label, members);
    list.appendChild(div);
  });

  $('start-min-btn').disabled = false;
  toast('DFA Minimization complete! 🔬', 'success');
}

// ============================================================
//  SIMULATION
// ============================================================
function refreshSimTab() {
  if (!simRenderer) simRenderer = new AutomataRenderer('sim-canvas');
  renderSimCanvas([]);
}

function getSimAutomaton() {
  const type = document.querySelector('input[name="sim-auto"]:checked')?.value;
  if (type === 'dfa') return eng.dfa ? { type: 'dfa', auto: eng.dfa } : null;
  if (type === 'min') return eng.minDfa ? { type: 'min', auto: eng.minDfa } : null;
  return { type: 'nfa', auto: null }; // NFA uses engine directly
}

// Track which automaton type was last rendered to detect switches
let _lastSimType = null;

function renderSimCanvas(highlightedStates=[], highlightedTrans=[]) {
  const which = getSimAutomaton();
  if (!which) return;
  if (!simRenderer) simRenderer = new AutomataRenderer('sim-canvas');

  let states, transitions, alphabet;
  if (which.type === 'nfa') {
    states = eng.states; transitions = eng.transitions; alphabet = eng.alphabet;
  } else {
    states = which.auto.states; transitions = which.auto.transitions; alphabet = which.auto.alphabet;
  }

  // Remove positions for states that no longer exist in the current automaton
  const currentIds = new Set(states.map(s => s.id));
  for (const id of Object.keys(simRenderer.positions)) {
    if (!currentIds.has(id)) delete simRenderer.positions[id];
  }

  // Auto-layout if switching automaton type OR no positions exist yet
  const needsLayout = which.type !== _lastSimType ||
    states.some(s => !simRenderer.positions[s.id]);
  if (needsLayout) {
    simRenderer.autoLayout(states);
    _lastSimType = which.type;
  }

  simRenderer.render(states, transitions, alphabet, highlightedStates, highlightedTrans);
  $('sim-canvas-label').textContent = which.type === 'nfa' ? 'NFA Simulation' : which.type === 'dfa' ? 'DFA Simulation' : 'Min-DFA Simulation';
}

$('sim-start-btn').addEventListener('click', () => {
  startSimulation(true);
});
$('sim-step-btn').addEventListener('click', () => {
  if (!simState) startSimulation(false);
  else advanceSimulation();
});
$('sim-reset-btn').addEventListener('click', resetSimulation);

function startSimulation(autoRun) {
  const inputStr = $('sim-input').value;
  // validate() returns null on success, a string message on failure
  const validErr = eng.validate();
  if (validErr) { toast(validErr, 'error'); return; }

  const which = getSimAutomaton();
  if (!which) { toast('No automaton available for selected type. Convert NFA→DFA first if needed.', 'error'); return; }

  // Check every character is in the NFA alphabet (empty string = ε is always valid)
  for (const ch of inputStr) {
    if (!eng.alphabet.includes(ch)) { toast(`Symbol '${ch}' not in alphabet: {${eng.alphabet.join(',')}}`, 'error'); return; }
  }

  // Run the simulation and capture both path and acceptance result
  let path, accepted;
  if (which.type === 'nfa') {
    const res = eng.simulateNFA(inputStr);
    accepted = res.accepted;
    path = res.path.map((p, i) => ({
      states: p.states,
      symbol: p.symbol,
      step: i
    }));
  } else {
    const res = eng.simulateDFA(which.auto, inputStr);
    accepted = res.accepted;
    path = res.path.map((p, i) => ({
      states: p.state ? [p.state] : [],
      symbol: p.symbol,
      step: i
    }));
  }

  simState = {
    path, inputStr, idx: 0, accepted,
    automaton: which.type,
    auto: which.auto
  };

  $('sim-history').innerHTML = '';
  $('sim-result-badge').innerHTML = '';
  renderTape(inputStr, -1);
  updateSimStatus(simState.path[0].states, null, false);
  renderSimCanvas(simState.path[0].states);

  if (autoRun) {
    const speed = parseInt($('sim-speed').value);
    if (simState?.timer) clearInterval(simState.timer);
    simState.timer = setInterval(() => advanceSimulation(), speed);
  }
}

function advanceSimulation() {
  if (!simState) return;
  if (simState.idx >= simState.path.length - 1) {
    finishSimulation();
    return;
  }
  simState.idx++;
  const step = simState.path[simState.idx];
  const prevStep = simState.path[simState.idx - 1];

  renderTape(simState.inputStr, simState.idx - 1);
  updateSimStatus(step.states, step.symbol, false);
  renderSimCanvas(step.states.filter(id => {
    const s = simState.automaton === 'nfa' ? eng.getState(id) : (simState.auto?.states||[]).find(x=>x.id===id);
    return !!s;
  }));

  // History
  const row = ce('div', 'history-row');
  row.innerHTML = `<span class="history-step">${simState.idx}</span>
    <span class="history-symbol">'${step.symbol||'ε'}'</span>
    <span class="history-arrow">→</span>
    <span class="history-states">{${step.states.map(id => {
      const s = simState.automaton==='nfa' ? eng.getState(id) : (simState.auto?.states||[]).find(x=>x.id===id);
      return s?.name||s?.id||id;
    }).join(', ')||'∅'}}</span>`;
  $('sim-history').appendChild(row);
  $('sim-history').scrollTop = $('sim-history').scrollHeight;

  if (simState.idx >= simState.path.length - 1) {
    finishSimulation();
  }
}

function finishSimulation() {
  if (simState?.timer) { clearInterval(simState.timer); simState.timer = null; }
  const accepted = simState?.accepted ?? false;
  $('sim-result-badge').innerHTML = `<span class="result-badge ${accepted?'accept':'reject'}">${accepted?'✓ ACCEPTED':'✗ REJECTED'}</span>`;
  updateSimStatus(simState?.path?.[simState.path.length-1]?.states || [], null, true, accepted);
  renderTape(simState.inputStr, simState.inputStr.length);
}

function updateSimStatus(states, symbol, done, accepted) {
  const status = $('sim-status');
  status.innerHTML = '';

  if (symbol) {
    const symEl = ce('div');
    symEl.innerHTML = `Reading: <strong style="color:var(--blue)">'${symbol}'</strong>`;
    symEl.style.fontSize = '0.82rem'; symEl.style.color = 'var(--text2)';
    status.appendChild(symEl);
  }

  const chipsWrap = ce('div', 'sim-current-states');
  if (states.length === 0) {
    const chip = ce('span', 'state-chip dead', '∅ (Dead)');
    chipsWrap.appendChild(chip);
  } else {
    states.forEach(id => {
      const s = simState?.automaton === 'nfa' ? eng.getState(id) : (simState?.auto?.states||[]).find(x=>x.id===id);
      const name = s?.name || s?.id || id;
      const isAcc = s?.isAccept;
      const chipClass = done ? (accepted ? 'accept' : (isAcc ? 'accept' : 'reject')) : 'active';
      const chip = ce('span', `state-chip ${chipClass}`, name + (isAcc ? ' ★' : ''));
      chipsWrap.appendChild(chip);
    });
  }
  status.appendChild(chipsWrap);

  if (done) {
    const resultEl = ce('div');
    resultEl.innerHTML = `<strong style="color:${accepted?'var(--green)':'var(--red)'}">${accepted?'✓ String ACCEPTED':'✗ String REJECTED'}</strong>`;
    status.appendChild(resultEl);
  }
}

function renderTape(str, headPos) {
  const tape = $('tape-display');
  tape.innerHTML = '';
  if (!str && str !== '') return;
  if (str.length === 0) {
    const cell = ce('div', 'tape-cell', 'ε');
    cell.style.color = 'var(--text3)';
    tape.appendChild(cell);
    return;
  }
  for (let i = 0; i < str.length; i++) {
    const cell = ce('div', 'tape-cell', str[i]);
    if (i < headPos) cell.classList.add('consumed');
    else if (i === headPos) cell.classList.add('head');
    else cell.classList.add('upcoming');
    tape.appendChild(cell);
  }
}

function resetSimulation() {
  if (simState?.timer) clearInterval(simState.timer);
  simState = null;
  _lastSimType = null; // force re-layout on next render
  $('sim-status').innerHTML = '<div class="sim-status-idle">Ready to simulate</div>';
  $('sim-history').innerHTML = '';
  $('tape-display').innerHTML = '';
  $('sim-result-badge').innerHTML = '';
  renderSimCanvas([]);
}

// Speed label
$('sim-speed').addEventListener('input', e => {
  $('sim-speed-label').textContent = (parseInt(e.target.value)/1000).toFixed(1) + 's';
});

// Automaton type switch
document.querySelectorAll('input[name="sim-auto"]').forEach(r => {
  r.addEventListener('change', () => {
    resetSimulation();
    renderSimCanvas([]);
  });
});

// Batch test
$('batch-run-btn').addEventListener('click', () => {
  const lines = $('batch-input').value.split('\n').map(l=>l.trim()).filter(Boolean);
  const which = getSimAutomaton();
  const results = $('batch-results');
  results.innerHTML = '';

  lines.forEach(str => {
    let accepted;
    if (which?.type === 'nfa') {
      accepted = eng.simulateNFA(str).accepted;
    } else if (which?.auto) {
      accepted = eng.simulateDFA(which.auto, str).accepted;
    } else {
      accepted = false;
    }
    const row = ce('div', 'batch-row');
    row.innerHTML = `<span class="batch-str">"${str || 'ε'}"</span>
      <span class="${accepted?'batch-accept':'batch-reject'}">${accepted?'✓ ACCEPT':'✗ REJECT'}</span>`;
    results.appendChild(row);
  });
  toast(`Tested ${lines.length} strings`, 'info');
});

// ============================================================
//  INITIALIZATION
// ============================================================
function init() {
  eng.loadPreset('ends-ab');
  $('alphabet-input').value = eng.alphabet.join(',');

  // Initialize NFA renderer after layout
  nfaRenderer = new AutomataRenderer('nfa-canvas');
  nfaRenderer.onStateClick = (id) => { eng.toggleAccept(id); refreshBuilder(); };
  $('nfa-canvas').addEventListener('dblclick', e => {
    const rect = $('nfa-canvas').getBoundingClientRect();
    addStateAt('q'+eng.states.length, e.clientX - rect.left, e.clientY - rect.top);
  });
  nfaRenderer.autoLayout(eng.states);
  refreshBuilder();

  // Initial DFA renderer
  dfaRenderer = new AutomataRenderer('dfa-canvas');
  minRenderer = new AutomataRenderer('min-canvas');
  simRenderer = new AutomataRenderer('sim-canvas');
}

window.addEventListener('load', init);
window.addEventListener('resize', () => {
  renderNFA();
});
