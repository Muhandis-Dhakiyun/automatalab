<div align="center">

# 🤖 AutomataLab

### An Interactive NFA / DFA Simulator for Theory of Computation

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-Visit%20Site-brightgreen?style=for-the-badge)](https://muhandis-dhakiyun.github.io/automatalab/)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://muhandis-dhakiyun.github.io/automatalab/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

**🔗 Live Site: [https://muhandis-dhakiyun.github.io/automatalab/](https://muhandis-dhakiyun.github.io/automatalab/)**

</div>

---

## 📖 About

**AutomataLab** is a fully interactive, browser-based simulator for **Finite Automata** concepts from the Theory of Computation syllabus (**Unit 1 – Finite Automata**). It visualizes three core algorithms step-by-step:

1. **NFA Construction** — Build Nondeterministic Finite Automata with ε-transitions interactively
2. **Subset Construction** — Convert NFA → DFA using the Powerset / Subset Construction algorithm
3. **Table-Filling (Myhill-Nerode)** — Minimize a DFA by identifying indistinguishable state pairs

Built entirely with **vanilla HTML, CSS, and JavaScript** — no frameworks, no dependencies, no build step. Just open `index.html` and it works.

---

## 🌐 Live Demo

> **[https://muhandis-dhakiyun.github.io/automatalab/](https://muhandis-dhakiyun.github.io/automatalab/)**

Open the link in any modern browser (Chrome, Firefox, Edge, Safari) — no installation required.

---

## ✨ Features

### 🏗️ NFA Builder (Tab 1)
- Add, delete, and drag states on an interactive SVG canvas
- Toggle **start** and **accept** states with one click
- Add transitions including **ε (epsilon)** transitions
- Double-click on the canvas to instantly place new states
- View the full NFA transition table auto-generated in real time
- **4 built-in presets** to get started instantly:
  - Ends with `ab`
  - Contains `aa`
  - Epsilon-closure demo
  - Odd number of `a`s
- Auto-layout button to neatly organize states

### ⚡ NFA → DFA Conversion (Tab 2)
- Full **Subset Construction** algorithm with step-by-step visualization
- Displays the **ε-closure table** for every NFA state
- Each new DFA state creation is animated individually
- **Step** button to advance one step at a time
- **Auto Run** button with pause/resume to animate automatically
- Final DFA transition table shown on completion
- Dead/trap states (∅) clearly labeled

### 🔬 DFA Minimization (Tab 3)
- Full **Table-Filling (Myhill-Nerode)** algorithm visualization
- Distinguishability table updates live as pairs are marked
- **Step** and **Auto Run** modes
- Final **Equivalence Classes** shown with DFA and NFA state mappings
- Minimized DFA rendered on an interactive canvas
- State count comparison: original DFA vs minimized DFA

### ▶️ String Simulation (Tab 4)
- Simulate any input string on **NFA**, **converted DFA**, or **minimized DFA**
- **Step** through the computation one symbol at a time
- **Auto Run** with adjustable speed slider (0.1s – 2.0s per step)
- Live **input tape** shows consumed / current / upcoming symbols
- Active states highlighted with a glowing purple ring on the canvas
- **Computation History** panel logs every transition
- **Accepted / Rejected** badge displayed at completion
- **Batch Test** — test multiple strings at once (one per line)

### 📚 Theory Reference (Tab 5)
- Formal definitions of NFA, DFA, ε-closure
- Theorem summaries for Subset Construction and Myhill-Nerode
- Quick reference for all algorithms implemented

---

## 🗂️ Project Structure

```
automatalab/
│
├── index.html        # Main application shell — 5-tab layout
├── style.css         # Dark-mode UI with glassmorphism & animations
├── automata.js       # Core logic engine (NFA/DFA algorithms)
├── renderer.js       # SVG graph renderer with drag-and-drop
├── app.js            # UI controller — wires everything together
└── description.txt   # Assignment description file
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `index.html` | HTML structure, tab panels, all DOM element IDs |
| `style.css` | CSS variables, glassmorphism cards, animations, tape/history styles |
| `automata.js` | `AutomataEngine` class — ε-closure, subset construction, minimization, simulation |
| `renderer.js` | `AutomataRenderer` class — SVG drawing, force-directed layout, drag-and-drop |
| `app.js` | Event listeners, step-by-step animation, simulation state machine |

---

## 🧠 Algorithms Implemented

### 1. ε-Closure
Computes the set of all NFA states reachable from a given state using only epsilon (ε) transitions.

```
ε-closure(q) = {q} ∪ { r | q →ε* r }
```

### 2. Subset Construction (NFA → DFA)
Converts an NFA to an equivalent DFA by treating subsets of NFA states as single DFA states.

```
DFA start state = ε-closure({ q₀ })
For each DFA state S and input symbol a:
    δ_DFA(S, a) = ε-closure( ∪ δ_NFA(q, a) for q ∈ S )
```

### 3. Table-Filling / Myhill-Nerode (DFA Minimization)
Identifies pairs of distinguishable states and merges indistinguishable ones.

```
Base:   Mark (p, q) if exactly one of p, q is accepting
Inductive: Mark (p, q) if ∃ symbol a: (δ(p,a), δ(q,a)) is marked
Repeat until no new pairs are marked
Merge all unmarked pairs into equivalence classes
```

---

## 🚀 Running Locally

No installation or build step needed:

```bash
# Clone the repository
git clone https://github.com/Muhandis-Dhakiyun/automatalab.git

# Navigate into the folder
cd automatalab

# Open in browser
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

Or just **double-click** `index.html` to open it directly in your browser.

---

## 🎓 Academic Context

| Field | Details |
|-------|---------|
| **Subject** | Theory of Computation (TOC) |
| **Unit / Module** | Unit 1 — Finite Automata (DFA & NFA) |
| **Topic** | NFA, Subset Construction, DFA Minimization (Myhill-Nerode) |
| **Simulation** | Interactive step-by-step visualization of NFA construction, NFA→DFA conversion via Subset Construction algorithm, and DFA Minimization via the Table-Filling (Myhill-Nerode) method, with animated string simulation on any of the three automata |

---

## 🛠️ Tech Stack

| Technology | Usage |
|------------|-------|
| HTML5 | Application structure and semantic layout |
| CSS3 | Dark-mode design, glassmorphism, CSS variables, keyframe animations |
| Vanilla JavaScript (ES6+) | All logic — no frameworks, no libraries |
| SVG | Interactive automaton graph rendering |
| GitHub Pages | Free static site hosting |

---

## 📸 Screenshots

### NFA Builder
Build automata interactively with drag-and-drop states and transitions.

### NFA → DFA Conversion
Watch the Subset Construction algorithm unfold step by step.

### DFA Minimization
The Table-Filling algorithm marks distinguishable pairs live.

### String Simulation
Animate any string through the NFA, DFA, or minimized DFA with a visual tape.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ for Theory of Computation

**[🌐 Open Live Demo](https://muhandis-dhakiyun.github.io/automatalab/)**

</div>
