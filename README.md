# PDA Simulator — Pushdown Automata Visualizer

An interactive, educational **Pushdown Automaton (PDA) Simulator** built with pure HTML, CSS, and JavaScript. Designed to help students and enthusiasts understand how PDAs work through step-by-step animated visualization.

> **Theme:** Yellow · Black · White — Code-editor aesthetic using JetBrains Mono font  
> **No build step required** — open `index.html` directly in any modern browser.

---

## Preview

The simulator features a three-panel layout:
- **Left sidebar** — Language selection, input controls, configuration
- **Center** — State diagram canvas, input tape, stack visualization, step explanation
- **Right sidebar** — Computation path log, PDA 7-tuple breakdown

---

## Features

### Simulator Tab
| Feature | Description |
|---|---|
| **2 Preset Languages** | `aⁿbⁿ` (equal a's and b's) and Balanced Parentheses — ready to run out of the box |
| **Custom Input** | Type any string; real-time validation highlights invalid characters |
| **Quick-fill Buttons** | One-click example strings for each preset language |
| **Run / Pause / Step / Reset** | Full playback control — run the full animation, pause at any moment, or step one transition at a time |
| **Speed Control** | 5-level slider from Slow (1.2s/step) to Instant (80ms/step) |
| **State Diagram Canvas** | Live-rendered HTML5 Canvas showing all states, transitions, self-loops, and transition labels. Active state glows yellow (running), green (accepted), or red (rejected) |
| **Animated Input Tape** | Shows all input symbols; read symbols are struck through, the current read-head pulses yellow, pending symbols are dimmed |
| **Stack Visualization** | Each stack symbol rendered in its own box; the top symbol is highlighted in yellow with a glow. Push/pop animations play on every transition |
| **Step Explanation Panel** | Plain-English description of every transition: what was popped, what was pushed, what input was consumed, and why |
| **Computation Path Log** | Scrollable history of every `(state, input, stackTop)` triple. Click any entry to replay that step's visualization |
| **Configuration Table** | Quick-reference showing states, alphabet, stack alphabet, initial state, accept states, and rule count |
| **PDA 7-Tuple Sidebar** | Formal breakdown of `(Q, Σ, Γ, δ, q₀, Z₀, F)` for the loaded automaton |
| **Accept / Reject Verdict** | Status bar and full-canvas glow show the final decision when simulation ends |

### Learn PDA Tab
| Section | Content |
|---|---|
| **Informal Definition** | Plain-language explanation of how a PDA works and what makes it more powerful than a Finite Automaton |
| **Formal Definition** | Full 7-tuple `M = (Q, Σ, Γ, δ, q₀, Z₀, F)` with descriptions of every component |
| **Acceptance Criteria** | Explains acceptance by final state vs. acceptance by empty stack |
| **FA vs PDA Comparison** | Side-by-side table: memory, language class, example languages |
| **Transition Function δ** | Format explained with worked examples including ε-transitions |
| **Example Languages** | Detailed strategy walkthroughs for both `aⁿbⁿ` and balanced parentheses |

### Transition Editor Tab
| Feature | Description |
|---|---|
| **JSON Editor** | Edit the PDA's full configuration (states, alphabets, transitions) directly in the browser |
| **Schema Reference** | Inline documentation panel explaining every field and the push-string format |
| **Live Apply** | Click "Apply Changes" to instantly load the modified PDA into the simulator |
| **Validation** | Checks for required fields and reports JSON parse errors with inline messages |

---

## Project Structure

```
PDA_Sim/
├── index.html      # Page structure — 3 tabs, all panels
├── style.css       # Full design system (tokens, components, animations)
├── pda.js          # PDA engine — automaton model + step-trace simulation
└── app.js          # UI controller — canvas, tape, stack, log, editor
```

---

## Getting Started

1. Clone or download this repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
3. No installation, no server, no build step required

```bash
git clone https://github.com/your-username/PDA_Sim.git
cd PDA_Sim
open index.html   # macOS
# or just double-click index.html
```

---

## Pre-configured Languages

### L = { aⁿbⁿ | n ≥ 1 }
Accepts strings where the number of `a`s equals the number of `b`s.

| Accepted | Rejected |
|---|---|
| `ab` | `a` |
| `aabb` | `ba` |
| `aaabbb` | `aab` |
| `aaaabbbb` | `abba` |

**Strategy:** Push one stack symbol (`A`) for each `a`. Pop one for each `b`. Accept if stack returns to `Z₀` when input is exhausted.

**Transitions:**
```
δ(q0, a, Z0) → (q0, A Z0)   — push A, keep Z0
δ(q0, a, A)  → (q0, A A)    — push another A
δ(q0, b, A)  → (q1, ε)      — first b: pop A
δ(q1, b, A)  → (q1, ε)      — subsequent b's: pop A
δ(q1, ε, Z0) → (q2, Z0)     — all matched: go to accept
```

---

### Balanced Parentheses
Accepts strings of correctly nested and matched parentheses.

| Accepted | Rejected |
|---|---|
| `()` | `)(` |
| `(())` | `(()` |
| `(()())` | `(()`  |
| `((()))` | `())` |

**Strategy:** Push `P` for each `(`. Pop `P` for each `)`. Accept if stack returns to `Z₀`.

**Transitions:**
```
δ(q0, (, Z0) → (q0, P Z0)   — push P, keep Z0
δ(q0, (, P)  → (q0, P P)    — push another P
δ(q0, ), P)  → (q0, ε)      — pop matching P
δ(q0, ε, Z0) → (q1, Z0)     — balanced: go to accept
```

---

## ⚙ PDA Engine — Technical Details

### Stack Symbol Model
Stack symbols are **atomic tokens** — `Z0` is a single symbol, not two characters `Z` and `0`. The push string in each transition uses **space-separated tokens**:

```json
{ "from": "q0", "input": "a", "stackTop": "Z0", "to": "q0", "push": "A Z0" }
```
> `"A Z0"` means: pop `Z0`, push `Z0`, then push `A` — so `A` ends on top.

Use `""` or `"ε"` for a pop-only transition (push nothing).

### ε-Transitions
After all input is consumed, the engine automatically follows ε-transition chains to reach an accept state if possible.

### Custom PDA via Editor
You can define your own PDA using this JSON schema:

```json
{
  "name": "My Language",
  "description": "What this PDA recognizes",
  "states": ["q0", "q1"],
  "inputAlphabet": ["a", "b"],
  "stackAlphabet": ["A", "Z0"],
  "initialState": "q0",
  "initialStack": "Z0",
  "acceptStates": ["q1"],
  "transitions": [
    { "from": "q0", "input": "a", "stackTop": "Z0", "to": "q0", "push": "A Z0" }
  ],
  "examples": ["ab", "aabb"]
}
```

---

## Design System

| Token | Value |
|---|---|
| Background | `#0d0d0d` (Jet Black) |
| Surface | `#131313` / `#1a1a1a` |
| Accent | `#ffd60a` (Amber Yellow) |
| Foreground | `#f4f4f4` (Off White) |
| Accept color | `#39d353` (Green) |
| Reject color | `#f85149` (Red) |
| Code font | JetBrains Mono |
| UI font | Inter |

---

## Verified Test Cases

| Input | Language | Result |
|---|---|---|
| `ab` | aⁿbⁿ | ACCEPTED |
| `aabb` | aⁿbⁿ | ACCEPTED |
| `aaabbb` | aⁿbⁿ | ACCEPTED |
| `aaaabbbb` | aⁿbⁿ | ACCEPTED |
| `ba` | aⁿbⁿ | REJECTED |
| `()` | Balanced Parens | ACCEPTED |
| `(())` | Balanced Parens | ACCEPTED |
| `(()())` | Balanced Parens | ACCEPTED |
| `)(` | Balanced Parens | REJECTED |

---

## What is a Pushdown Automaton?

A **Pushdown Automaton** is a computational model that extends a Finite Automaton with an unbounded **stack** (LIFO memory). This extra memory allows it to recognize all **Context-Free Languages** — a strictly larger class than what DFAs/NFAs can handle.

**Formally**, a PDA is a 7-tuple:

```
M = (Q, Σ, Γ, δ, q₀, Z₀, F)
```

| Symbol | Meaning |
|---|---|
| `Q` | Finite set of states |
| `Σ` | Input alphabet |
| `Γ` | Stack alphabet |
| `δ` | Transition function: Q × (Σ ∪ {ε}) × Γ → P(Q × Γ*) |
| `q₀` | Initial state |
| `Z₀` | Initial stack symbol |
| `F` | Set of accepting states |

---

