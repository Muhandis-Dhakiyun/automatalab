/**
 * renderer.js — SVG-based graph renderer for automata
 * Renders NFA/DFA states and transitions with force-directed layout
 */

class AutomataRenderer {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.positions = {};     // stateId → {x, y}
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.onStateClick = null;
    this.isDragging = false;
    this._setupDefs();
    this._setupEventListeners();
  }

  _setupDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="10" markerHeight="7"
        refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="rgba(156,163,175,0.8)" />
      </marker>
      <marker id="arrowhead-start" markerWidth="10" markerHeight="7"
        refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#34d399" />
      </marker>
      <marker id="arrowhead-purple" markerWidth="10" markerHeight="7"
        refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#a78bfa" />
      </marker>
      <marker id="arrowhead-green" markerWidth="10" markerHeight="7"
        refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#34d399" />
      </marker>
      <linearGradient id="grad-start-accept" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#34d399" />
        <stop offset="100%" style="stop-color:#fbbf24" />
      </linearGradient>
    `;
    this.svg.appendChild(defs);
    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(this.mainGroup);
  }

  _setupEventListeners() {
    this.svg.addEventListener('mousemove', e => this._onMouseMove(e));
    this.svg.addEventListener('mouseup', () => this._onMouseUp());
    this.svg.addEventListener('mouseleave', () => this._onMouseUp());
  }

  _getSVGPoint(e) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _onMouseMove(e) {
    if (!this.dragging) return;
    const pt = this._getSVGPoint(e);
    this.positions[this.dragging] = {
      x: pt.x - this.dragOffset.x,
      y: pt.y - this.dragOffset.y
    };
    this.isDragging = true;
    this._redrawIfDragging();
  }

  _onMouseUp() {
    this.dragging = null;
    setTimeout(() => { this.isDragging = false; }, 50);
  }

  _redrawIfDragging() {
    // Will be set by the render call
    if (this._redrawCallback) this._redrawCallback();
  }

  /**
   * Auto-layout states in a circle or force-directed
   */
  autoLayout(states, padding=80) {
    const w = this.svg.clientWidth || 700;
    const h = this.svg.clientHeight || 500;
    const n = states.length;
    const cx = w / 2, cy = h / 2;
    if (n === 0) return;
    if (n === 1) {
      this.positions[states[0].id] = { x: cx, y: cy };
      return;
    }
    const radius = Math.min(w, h) / 2 - padding;
    states.forEach((s, i) => {
      const angle = (2 * Math.PI * i / n) - Math.PI / 2;
      this.positions[s.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      };
    });
  }

  /**
   * Main render function
   */
  render(states, transitions, alphabet, highlightedStates=[], highlightedTransitions=[]) {
    this.mainGroup.innerHTML = '';
    const w = this.svg.clientWidth || 700;
    const h = this.svg.clientHeight || 500;

    // Ensure all states have positions
    for (const s of states) {
      if (!this.positions[s.id]) {
        this.positions[s.id] = {
          x: 80 + Math.random() * (w - 160),
          y: 80 + Math.random() * (h - 160)
        };
      }
    }

    // -- Draw transitions (edges) --
    const transGroups = this._groupTransitions(transitions);
    this._drawEdges(transGroups, states, highlightedTransitions);

    // -- Draw states (nodes) --
    for (const s of states) {
      this._drawState(s, highlightedStates);
    }

    this._redrawCallback = () => this.render(states, transitions, alphabet, highlightedStates, highlightedTransitions);
  }

  _groupTransitions(transitions) {
    // Group by (from, to) pairs to handle multi-edges and self-loops
    const groups = new Map();
    for (const t of transitions) {
      const key = `${t.from}→${t.to}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    return groups;
  }

  _drawEdges(transGroups, states, highlightedTransitions) {
    for (const [key, trans] of transGroups) {
      const from = trans[0].from;
      const to   = trans[0].to;
      const fromPos = this.positions[from];
      const toPos   = this.positions[to];
      if (!fromPos || !toPos) continue;

      const symbols = trans.map(t => t.symbol).join(',');
      const isHighlighted = highlightedTransitions.some(ht => ht.from===from && ht.to===to);
      const isSelfLoop = from === to;

      if (isSelfLoop) {
        this._drawSelfLoop(fromPos, symbols, isHighlighted, trans);
      } else {
        // Check if reverse edge exists
        const reverseKey = `${to}→${from}`;
        const hasBidirectional = transGroups.has(reverseKey);
        this._drawEdge(fromPos, toPos, symbols, hasBidirectional, isHighlighted, trans);
      }
    }
  }

  _drawEdge(fromPos, toPos, label, curved, isHighlighted, trans) {
    const r = 28;
    const color = isHighlighted ? '#a78bfa' : 'rgba(156,163,175,0.55)';
    const strokeW = isHighlighted ? 2.5 : 1.8;
    const isEpsilon = trans.some(t => t.symbol === 'ε');

    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/dist, uy = dy/dist;
    const nx = -uy, ny = ux; // normal

    const sx = fromPos.x + ux*r;
    const sy = fromPos.y + uy*r;
    const ex = toPos.x - ux*r;
    const ey = toPos.y - uy*r;

    let d, midX, midY;
    if (curved) {
      const bend = 35;
      const cx = (sx+ex)/2 + nx*bend;
      const cy = (sy+ey)/2 + ny*bend;
      d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
      midX = 0.5*(sx+ex)/2 + 0.5*cx + nx*10;
      midY = 0.5*(sy+ey)/2 + 0.5*cy + ny*10;
    } else {
      d = `M ${sx} ${sy} L ${ex} ${ey}`;
      midX = (sx+ex)/2 + nx*12;
      midY = (sy+ey)/2 + ny*12;
    }

    const markerId = isHighlighted ? 'arrowhead-purple' : 'arrowhead';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeW);
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#${markerId})`);
    if (isEpsilon && !isHighlighted) {
      path.setAttribute('stroke-dasharray', '5,3');
    }
    this.mainGroup.appendChild(path);

    this._drawLabel(midX, midY, label, isHighlighted);
  }

  _drawSelfLoop(pos, label, isHighlighted, trans) {
    const color = isHighlighted ? '#a78bfa' : 'rgba(156,163,175,0.55)';
    const isEpsilon = trans.some(t => t.symbol === 'ε');
    const r = 28;

    // Draw a loop arc above the state
    const markerId = isHighlighted ? 'arrowhead-purple' : 'arrowhead';
    const lx = pos.x, ly = pos.y - r;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${lx-15} ${ly+5} C ${lx-35} ${ly-40}, ${lx+35} ${ly-40}, ${lx+15} ${ly+5}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', isHighlighted ? 2.5 : 1.8);
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#${markerId})`);
    if (isEpsilon) path.setAttribute('stroke-dasharray', '5,3');
    this.mainGroup.appendChild(path);

    this._drawLabel(lx, ly - 24, label, isHighlighted);
  }

  _drawLabel(x, y, text, isHighlighted) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const padding = 4;
    const fontSize = 11;
    const w = text.length * 6.5 + padding*2;
    const h = fontSize + padding*2;
    bg.setAttribute('x', x - w/2);
    bg.setAttribute('y', y - h/2);
    bg.setAttribute('width', w);
    bg.setAttribute('height', h);
    bg.setAttribute('rx', '3');
    bg.setAttribute('fill', 'rgba(13,17,32,0.92)');
    this.mainGroup.appendChild(bg);

    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-size', fontSize);
    t.setAttribute('font-family', "'JetBrains Mono', monospace");
    t.setAttribute('font-weight', '600');
    t.setAttribute('fill', isHighlighted ? '#a78bfa' : '#9ca3af');
    t.textContent = text;
    this.mainGroup.appendChild(t);
  }

  _drawState(state, highlightedStates) {
    const pos = this.positions[state.id];
    if (!pos) return;

    const r = 28;
    const isHighlighted = highlightedStates.includes(state.id);
    const isDead = state.isDead;

    // Determine stroke color/class
    let strokeColor = 'rgba(255,255,255,0.2)';
    let fillColor = 'rgba(17,24,39,0.95)';
    let labelColor = '#e8eaf0';
    let glowFilter = '';

    if (isDead) {
      strokeColor = '#374151'; fillColor = 'rgba(17,20,30,0.8)'; labelColor = '#4b5563';
    } else if (isHighlighted) {
      strokeColor = '#a78bfa'; fillColor = 'rgba(167,139,250,0.15)';
    } else if (state.isStart && state.isAccept) {
      strokeColor = 'url(#grad-start-accept)';
    } else if (state.isStart) {
      strokeColor = '#34d399';
    } else if (state.isAccept) {
      strokeColor = '#fbbf24';
    }

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.cursor = 'pointer';

    // Glow/pulse for highlighted
    if (isHighlighted) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', pos.x); glow.setAttribute('cy', pos.y); glow.setAttribute('r', r+8);
      glow.setAttribute('fill', 'rgba(167,139,250,0.12)');
      glow.style.animation = 'pulse-state 1s ease infinite';
      g.appendChild(glow);
    }

    // Main circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x); circle.setAttribute('cy', pos.y); circle.setAttribute('r', r);
    circle.setAttribute('fill', fillColor);
    circle.setAttribute('stroke', strokeColor);
    circle.setAttribute('stroke-width', isHighlighted ? 3 : 2);
    g.appendChild(circle);

    // Accept double ring
    if (state.isAccept && !isDead) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', pos.x); ring.setAttribute('cy', pos.y); ring.setAttribute('r', r - 5);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#fbbf24');
      ring.setAttribute('stroke-width', '1.5');
      g.appendChild(ring);
    }

    // Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const displayLabel = state.label || state.name || state.id;
    text.setAttribute('x', pos.x); text.setAttribute('y', pos.y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', displayLabel.length > 4 ? '9' : '12');
    text.setAttribute('font-family', "'JetBrains Mono', monospace");
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', labelColor);
    text.textContent = displayLabel;
    g.appendChild(text);

    // Drag + click
    g.addEventListener('mousedown', e => {
      this.dragging = state.id;
      const pt = this._getSVGPoint(e);
      this.dragOffset = { x: pt.x - pos.x, y: pt.y - pos.y };
      e.stopPropagation();
    });
    g.addEventListener('click', () => {
      if (!this.isDragging && this.onStateClick) this.onStateClick(state.id);
    });

    // Start arrow
    if (state.isStart && !isDead) {
      const arrowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      arrowLine.setAttribute('x1', pos.x - r - 28);
      arrowLine.setAttribute('y1', pos.y);
      arrowLine.setAttribute('x2', pos.x - r - 1);
      arrowLine.setAttribute('y2', pos.y);
      arrowLine.setAttribute('stroke', '#34d399');
      arrowLine.setAttribute('stroke-width', '2');
      arrowLine.setAttribute('marker-end', 'url(#arrowhead-start)');
      this.mainGroup.appendChild(arrowLine);
    }

    this.mainGroup.appendChild(g);
  }

  clear() {
    this.mainGroup.innerHTML = '';
    this.positions = {};
  }

  /**
   * Remove positions for states that no longer exist
   */
  cleanPositions(stateIds) {
    const idSet = new Set(stateIds);
    for (const id of Object.keys(this.positions)) {
      if (!idSet.has(id)) delete this.positions[id];
    }
  }
}

// Color palette for DFA states (visual distinction)
const STATE_COLORS = [
  '#a78bfa','#60a5fa','#f472b6','#34d399','#fbbf24',
  '#fb923c','#38bdf8','#c084fc','#4ade80','#f87171'
];

window.AutomataRenderer = AutomataRenderer;
window.STATE_COLORS = STATE_COLORS;
