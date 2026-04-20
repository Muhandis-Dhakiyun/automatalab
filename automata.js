/**
 * automata.js — Core automata logic engine
 * Handles NFA, DFA, subset construction, DFA minimization
 */

// ============================================================
// DATA STRUCTURES
// ============================================================

class AutomataEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.states = [];        // [{id, name, isStart, isAccept}]
    this.alphabet = ['a','b'];
    this.transitions = [];   // [{from, symbol, to}] (symbol can be 'ε')
    this.dfa = null;         // converted DFA
    this.minDfa = null;      // minimized DFA
  }

  // ---- State management ----
  addState(name, isStart=false, isAccept=false) {
    const id = 'q' + (this.states.length);
    this.states.push({ id, name: name || id, isStart, isAccept });
    return id;
  }

  deleteState(id) {
    this.states = this.states.filter(s => s.id !== id);
    this.transitions = this.transitions.filter(t => t.from !== id && t.to !== id);
  }

  getState(id) { return this.states.find(s => s.id === id); }

  setStart(id) {
    this.states.forEach(s => s.isStart = (s.id === id));
  }

  toggleAccept(id) {
    const s = this.getState(id);
    if (s) s.isAccept = !s.isAccept;
  }

  getStartState() {
    return this.states.find(s => s.isStart) || this.states[0] || null;
  }

  // ---- Transition management ----
  addTransition(from, symbol, to) {
    const exists = this.transitions.some(t => t.from===from && t.symbol===symbol && t.to===to);
    if (!exists) this.transitions.push({ from, symbol, to });
  }

  removeTransition(from, symbol, to) {
    this.transitions = this.transitions.filter(
      t => !(t.from===from && t.symbol===symbol && t.to===to)
    );
  }

  // ---- NFA operations ----
  /**
   * Get all states reachable from `state` on `symbol` (without ε-closure)
   */
  nfaMove(stateId, symbol) {
    return this.transitions
      .filter(t => t.from === stateId && t.symbol === symbol)
      .map(t => t.to);
  }

  /**
   * Compute ε-closure of a single state (returns sorted array of state IDs)
   */
  epsilonClosure(stateId) {
    const closure = new Set([stateId]);
    const queue = [stateId];
    while (queue.length > 0) {
      const cur = queue.shift();
      const epsilonTargets = this.transitions
        .filter(t => t.from === cur && t.symbol === 'ε')
        .map(t => t.to);
      for (const tgt of epsilonTargets) {
        if (!closure.has(tgt)) {
          closure.add(tgt);
          queue.push(tgt);
        }
      }
    }
    return [...closure].sort();
  }

  /**
   * Compute ε-closure of a SET of states
   */
  epsilonClosureSet(stateIds) {
    const result = new Set();
    for (const id of stateIds) {
      for (const s of this.epsilonClosure(id)) result.add(s);
    }
    return [...result].sort();
  }

  /**
   * Move from a set of states on a symbol (without applying ε-closure)
   */
  moveSet(stateIds, symbol) {
    const result = new Set();
    for (const id of stateIds) {
      for (const tgt of this.nfaMove(id, symbol)) result.add(tgt);
    }
    return [...result];
  }

  /**
   * Full NFA transition: ε-closure(move(S, a))
   */
  nfaTransitionSet(stateIds, symbol) {
    return this.epsilonClosureSet(this.moveSet(stateIds, symbol));
  }

  // ---- NFA Simulation ----
  /**
   * Run NFA on a string; returns {accepted, path}
   * path = [{states, symbol}] for each step
   */
  simulateNFA(inputStr) {
    const start = this.getStartState();
    if (!start) return { accepted: false, path: [] };

    let currentStates = this.epsilonClosureSet([start.id]);
    const path = [{ states: [...currentStates], symbol: null, step: 0 }];

    for (let i = 0; i < inputStr.length; i++) {
      const sym = inputStr[i];
      currentStates = this.nfaTransitionSet(currentStates, sym);
      path.push({ states: [...currentStates], symbol: sym, step: i+1 });
      if (currentStates.length === 0) break;
    }

    const accepted = currentStates.some(id => {
      const s = this.getState(id);
      return s && s.isAccept;
    });

    return { accepted, path };
  }

  // ---- Subset Construction (NFA → DFA) ----
  /**
   * Perform full subset construction.
   * Returns a DFA object and a list of algorithm steps for visualization.
   */
  subsetConstruction() {
    const alphabet = this.alphabet;
    const start = this.getStartState();
    if (!start) return null;

    const startSet = this.epsilonClosureSet([start.id]);
    const steps = [];

    // DFA states are represented as sorted arrays of NFA state IDs
    // We use a string key for deduplication
    const key = (arr) => '[' + arr.join(',') + ']';
    const dfaStates = new Map(); // key → {id, nfaStates, isAccept, isStart, isDead}
    const dfaTrans  = [];        // {from, symbol, to}
    const queue = [startSet];

    const startKey = key(startSet);
    const startId = 'D0';
    dfaStates.set(startKey, {
      id: startId,
      nfaStates: startSet,
      isStart: true,
      isAccept: startSet.some(sid => this.getState(sid)?.isAccept),
      isDead: startSet.length === 0
    });

    steps.push({
      type: 'init',
      title: 'Initialization',
      text: `Start state = ε-closure({${start.name}}) = {${startSet.map(id => this.getState(id)?.name || id).join(', ')}}`,
      newState: startId
    });

    let counter = 1;

    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = key(current);
      const currentDfa = dfaStates.get(currentKey);

      steps.push({
        type: 'process',
        title: `Processing DFA state ${currentDfa.id}`,
        text: `State ${currentDfa.id} = {${current.map(id => this.getState(id)?.name||id).join(', ')}}`,
        processState: currentDfa.id
      });

      for (const sym of alphabet) {
        const moved = this.nfaTransitionSet(current, sym);
        const movedKey = key(moved);

        let targetDfa;
        if (dfaStates.has(movedKey)) {
          targetDfa = dfaStates.get(movedKey);
        } else {
          const newId = moved.length === 0 ? 'D∅' : `D${counter++}`;
          // Avoid duplicate dead state
          if (moved.length === 0) {
            if (dfaStates.has('[]')) {
              targetDfa = dfaStates.get('[]');
            } else {
              targetDfa = { id: newId, nfaStates: [], isStart: false, isAccept: false, isDead: true };
              dfaStates.set(movedKey, targetDfa);
              queue.push(moved);
              steps.push({
                type: 'new-state',
                title: `New DFA state: ${newId} (dead/trap state)`,
                text: `δ(${currentDfa.id}, ${sym}) → ∅ → Dead state ${newId}`,
                newState: newId
              });
            }
          } else {
            targetDfa = {
              id: newId, nfaStates: moved, isStart: false,
              isAccept: moved.some(sid => this.getState(sid)?.isAccept),
              isDead: false
            };
            dfaStates.set(movedKey, targetDfa);
            queue.push(moved);
            steps.push({
              type: 'new-state',
              title: `New DFA state: ${newId}`,
              text: `δ(${currentDfa.id}, ${sym}) = ε-closure({${moved.map(id=>this.getState(id)?.name||id).join(', ')}}) = {${moved.map(id=>this.getState(id)?.name||id).join(', ')}}${moved.some(id=>this.getState(id)?.isAccept) ? ' ← ACCEPTING' : ''}`,
              newState: newId
            });
          }
        }

        dfaTrans.push({ from: currentDfa.id, symbol: sym, to: targetDfa.id });
        steps.push({
          type: 'transition',
          title: `Transition added`,
          text: `δ(${currentDfa.id}, ${sym}) → ${targetDfa.id}`,
          from: currentDfa.id, to: targetDfa.id, symbol: sym
        });
      }
    }

    const dfa = {
      states: [...dfaStates.values()],
      alphabet,
      transitions: dfaTrans,
      startId: startId
    };

    this.dfa = dfa;

    steps.push({
      type: 'done',
      title: 'Conversion Complete!',
      text: `DFA has ${dfa.states.length} states. NFA had ${this.states.length} NFA states.`,
      done: true
    });

    return { dfa, steps };
  }

  // ---- DFA Minimization (Table-Filling) ----
  /**
   * Minimize a DFA using the table-filling algorithm.
   * Works on this.dfa if available, otherwise returns null.
   */
  minimizeDFA() {
    const dfa = this.dfa;
    if (!dfa) return null;

    const states = dfa.states.filter(s => !s.isDead);
    const alphabet = dfa.alphabet;
    const steps = [];

    // Build transition lookup
    const transMap = {};
    for (const t of dfa.transitions) {
      if (!transMap[t.from]) transMap[t.from] = {};
      transMap[t.from][t.symbol] = t.to;
    }

    const getNext = (sid, sym) => {
      return transMap[sid]?.[sym] ?? '∅';
    };

    const n = states.length;
    // Pair (i,j) table where i < j — true = distinguishable
    // Key: `${id1},${id2}` always with lex order
    const pairKey = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
    const table = {};

    // Initialize all pairs as not distinguishable
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        table[pairKey(states[i].id, states[j].id)] = false;
      }
    }

    // Base step: mark pairs where exactly one is accepting
    steps.push({ type:'init', title:'Base Step', text:'Mark pairs (p,q) where exactly one of p, q is an accepting state.' });

    let changed = true;
    let iteration = 0;

    // Base: mark accepting vs non-accepting
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        const si = states[i], sj = states[j];
        const k = pairKey(si.id, sj.id);
        if (si.isAccept !== sj.isAccept) {
          table[k] = true;
          steps.push({
            type: 'mark',
            title: 'Mark distinguishable',
            text: `(${si.id}, ${sj.id}): one accepts, one doesn't → MARKED`,
            pair: k
          });
        }
      }
    }

    // Inductive step
    while (changed) {
      changed = false;
      iteration++;
      steps.push({ type:'iter', title:`Iteration ${iteration}`, text:`Checking all unmarked pairs for distinguishability...` });
      for (let i = 0; i < n; i++) {
        for (let j = i+1; j < n; j++) {
          const si = states[i], sj = states[j];
          const k = pairKey(si.id, sj.id);
          if (table[k]) continue; // already marked
          for (const sym of alphabet) {
            const ni = getNext(si.id, sym); // '∅' means no transition (goes to dead/missing)
            const nj = getNext(sj.id, sym);
            // If both go to the same target (including both dead), indistinguishable on this symbol
            if (ni === nj) continue;
            // If one goes to dead (∅ or D∅) and both go to the same dead-ness, continue
            const niDead = (ni === '∅' || ni === 'D∅' || (dfa.states.find(s=>s.id===ni)?.isDead));
            const njDead = (nj === '∅' || nj === 'D∅' || (dfa.states.find(s=>s.id===nj)?.isDead));
            if (niDead && njDead) continue; // both dead → not distinguishable on this sym
            if (niDead !== njDead) {
              // one dead, one alive: dead states are non-accepting, so if the alive state
              // is accepting they are distinguishable; if not, mark anyway (alive has transitions)
              table[k] = true; changed = true;
              steps.push({ type:'mark', title:'Mark distinguishable',
                text:`(${si.id}, ${sj.id}): δ(·,${sym}) → (${ni}, ${nj}), one reaches dead state → MARKED`, pair:k });
              break;
            }
            // Both alive but different targets — check if that pair is marked
            const kk = pairKey(ni, nj);
            if (table[kk] !== undefined && table[kk]) {
              table[k] = true; changed = true;
              steps.push({ type:'mark', title:'Mark distinguishable',
                text:`(${si.id}, ${sj.id}): δ(·,${sym}) → (${ni}, ${nj}) which is marked → MARKED`, pair:k });
              break;
            }
          }
        }
      }
    }

    // Collect equivalence classes
    // Union-Find
    const parent = {};
    states.forEach(s => parent[s.id] = s.id);
    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (a, b) => { parent[find(a)] = find(b); };

    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        const si = states[i], sj = states[j];
        if (!table[pairKey(si.id, sj.id)]) {
          union(si.id, sj.id);
        }
      }
    }

    // Build equivalence classes
    const classes = {};
    for (const s of states) {
      const root = find(s.id);
      if (!classes[root]) classes[root] = [];
      classes[root].push(s.id);
    }

    steps.push({ type:'done', title:'Minimization Complete!',
      text:`Found ${Object.keys(classes).length} equivalence classes from ${states.length} reachable DFA states.`,
      classes });

    // Build minimized DFA
    const classIds = Object.keys(classes);
    const minStates = classIds.map((root, idx) => {
      const members = classes[root];
      const anyAccept = members.some(id => {
        const s = dfa.states.find(ss=>ss.id===id);
        return s && s.isAccept;
      });
      const isStart = members.some(id => {
        const s = dfa.states.find(ss=>ss.id===id);
        return s && s.isStart;
      });
      const nfaNames = [...new Set(members.flatMap(id => {
        const s = dfa.states.find(ss=>ss.id===id);
        return s ? (s.nfaStates||[]).map(nid => this.getState(nid)?.name||nid) : [id];
      }))];
      return { id: `M${idx}`, members, isAccept: anyAccept, isStart, label: `M${idx}`, nfaNames };
    });

    const minTrans = [];
    const getMinState = (dfaId) => minStates.find(ms => ms.members.includes(find(dfaId)));

    for (const ms of minStates) {
      const rep = ms.members[0];
      for (const sym of alphabet) {
        const next = getNext(rep, sym);
        if (next && next !== '∅') {
          const nextMin = getMinState(next);
          if (nextMin) {
            const exists = minTrans.some(t => t.from===ms.id && t.symbol===sym && t.to===nextMin.id);
            if (!exists) minTrans.push({ from: ms.id, symbol: sym, to: nextMin.id });
          }
        }
      }
    }

    const minDfa = { states: minStates, alphabet, transitions: minTrans, classes };
    this.minDfa = minDfa;
    return { minDfa, steps, table, states, pairKey };
  }

  // ---- DFA Simulation ----
  simulateDFA(dfa, inputStr) {
    const startState = dfa.states.find(s => s.isStart);
    if (!startState) return { accepted: false, path: [] };

    const transMap = {};
    for (const t of dfa.transitions) {
      if (!transMap[t.from]) transMap[t.from] = {};
      transMap[t.from][t.symbol] = t.to;
    }

    let cur = startState.id;
    const path = [{ state: cur, symbol: null, step: 0 }];

    for (let i = 0; i < inputStr.length; i++) {
      const sym = inputStr[i];
      const next = transMap[cur]?.[sym];
      cur = next ?? null;
      path.push({ state: cur, symbol: sym, step: i+1 });
      if (!cur) break;
    }

    const finalState = dfa.states.find(s => s.id === cur);
    return { accepted: !!(finalState?.isAccept), path };
  }

  // ---- Presets ----
  loadPreset(name) {
    this.reset();
    switch(name) {
      case 'ends-ab':
        this.alphabet = ['a','b'];
        this.addState('q0', true, false);
        this.addState('q1', false, false);
        this.addState('q2', false, true);
        this.addTransition('q0','a','q0');
        this.addTransition('q0','b','q0');
        this.addTransition('q0','a','q1');
        this.addTransition('q1','b','q2');
        break;

      case 'contains-aa':
        this.alphabet = ['a','b'];
        this.addState('q0', true, false);
        this.addState('q1', false, false);
        this.addState('q2', false, true);
        this.addTransition('q0','a','q1');
        this.addTransition('q0','b','q0');
        this.addTransition('q1','a','q2');
        this.addTransition('q1','b','q0');
        this.addTransition('q2','a','q2');
        this.addTransition('q2','b','q2');
        break;

      case 'epsilon-closure':
        this.alphabet = ['a','b'];
        this.addState('q0', true, false);
        this.addState('q1', false, false);
        this.addState('q2', false, false);
        this.addState('q3', false, true);
        this.addTransition('q0','ε','q1');
        this.addTransition('q0','a','q2');
        this.addTransition('q1','b','q3');
        this.addTransition('q2','ε','q3');
        this.addTransition('q3','a','q0');
        break;

      case 'odd-a':
        this.alphabet = ['a','b'];
        this.addState('q0', true, false);
        this.addState('q1', false, true);
        this.addTransition('q0','a','q1');
        this.addTransition('q0','b','q0');
        this.addTransition('q1','a','q0');
        this.addTransition('q1','b','q1');
        break;
    }
  }

  // ---- Validation ----
  validate() {
    if (this.states.length === 0) return 'No states defined.';
    if (!this.getStartState()) return 'No start state defined.';
    if (this.alphabet.length === 0) return 'Alphabet is empty.';
    return null;
  }
}

window.engine = new AutomataEngine();
