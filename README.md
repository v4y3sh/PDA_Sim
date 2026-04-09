# PDA Simulator — Universal NPDA Engine

An interactive **Pushdown Automaton (PDA) Simulator** built with pure HTML, CSS, and JavaScript. Visualize and step through PDA computations with animated state diagrams, tape, and stack — no build step, no dependencies.

> Open `index.html` in any modern browser to run.

---

## Tabs

### Simulator

The main workspace. Load a preset language or enter any custom string.

**Left sidebar**

| Panel | Description |
|---|---|
| **String Builder** | Select a preset language, set `n`/`m` parameters, and generate valid example strings. Click **⚡ Generate & Run** to run immediately. |
| **Manual Input** | Type any custom string. Real-time validation highlights invalid characters. Click ▶ to run. |
| **PDA 7-Tuple** | Live formal definition of the currently loaded automaton — `(Q, Σ, Γ, δ, q₀, Z₀, F)` with row-by-row breakdown. |

**Center panel**

| Panel | Description |
|---|---|
| **State Diagram** | HTML5 Canvas rendering of all states and transitions. The active state glows yellow (running), green (accepted), or red (rejected). Fullscreen toggle available. |
| **Phase Indicator** | Description of the current computation phase (e.g. "Phase 1 — Pushing A for each 'a'"). |
| **Input Tape** | All input symbols shown as cells. The current read head pulses yellow; consumed symbols are struck through; pending symbols are dimmed. |
| **Stack** | Each symbol rendered as a block. The top symbol is highlighted. Push/pop animations play on every transition. |
| **Step Explanation** | Plain-English description of which transition fired, what was consumed, popped, and pushed. |

**Right sidebar**

| Card | Description |
|---|---|
| **04 Controls** | **▶ Run** — animate the full simulation at the selected speed. **⏸ Pause** — pause mid-run. **⏭ Step** — advance one transition. **⏮ Prev** — step backward through the trace. **↺ Reset** (full-width) — clear everything. Speed slider: Slow → Instant (5 levels). |
| **05 Transition Functions** | Lists all compiled `δ(from, input, stackTop) → (to, push)` rules for the loaded PDA. The currently executing rule is highlighted in yellow on every step. |
| **06 Computation Path** | Scrollable log of every `(state, input, stackTop)` triple in the trace. Scrolls internally — the page itself never jumps. Click any entry to replay that step. |

---

### Learn PDA

Self-contained theory reference. No interaction required.

| Section | Content |
|---|---|
| **Informal Definition** | What a PDA is and why a stack makes it more powerful than a Finite Automaton. |
| **Formal Definition** | Full 7-tuple `M = (Q, Σ, Γ, δ, q₀, Z₀, F)` with a description of every component. |
| **Acceptance** | Summary — accepted by final state OR by empty stack. |
| **PDA vs FA** | Comparison table: memory, language class, example languages. |
| **Acceptance Methods** | Detailed breakdown of both acceptance methods: |
| | **Method 1 — Final State L(P):** formal definition, key points, step-by-step `aⁿbⁿ` simulation example showing transition to `qf ∈ F`. |
| | **Method 2 — Empty Stack N(P):** formal definition, key points, step-by-step `aⁿbⁿ` simulation example showing stack emptying to `ε`. |
| | Comparison table (acceptance criteria, stack content, final state requirements) and equivalence theorem. |
| **ε-Transitions** | What epsilon moves are, their notation, and their role in both acceptance methods and phase switching. |
| **Classic Languages** | Language walkthroughs for each built-in preset with strategy, transitions, and accepted/rejected examples. |

---

### Table Editor

Build or edit a PDA from scratch using a visual table — no JSON required.

| Feature | Description |
|---|---|
| **PDA Metadata** | Set PDA name, initial state, initial stack symbol, and accept states. |
| **Transition Table** | Each rule is a row with editable cells: From State, Input, Stack Top, To State, Push. Click **+ Add Transition Row** to append. Click ✕ to delete a row. |
| **ε Insert button** | Pill button next to the rules counter. Click it to insert `ε` at the cursor in whichever table cell you last focused — saves typing. |
| **Rules counter** | Live count of defined rules (e.g. `3 rules`). |
| **Quick-Parse** | Paste textbook-style rules (one per line) and click **Parse & Add Rows** to bulk-import. |
| **Export to Simulator** | Compiled PDA loads directly into the Simulator tab. |

---

## Built-in Languages (7 Presets)

All presets use `qf` to denote the unique final/accept state.

| Preset | Language | Description |
|---|---|---|
| `aⁿbⁿ` | `{ aⁿbⁿ \| n ≥ 1 }` | Equal a's then b's. Push A per 'a', pop per 'b'. |
| `( )` | Balanced Parentheses | Push P per `(`, pop per `)`. Accept when stack returns to `Z₀`. |
| `aⁿbᵐcⁿ⁺ᵐ` | `{ aⁿbᵐcⁿ⁺ᵐ \| n,m ≥ 1 }` | Total c's equals n+m. Push A per 'a', B per 'b', pop one per 'c'. |
| `aⁿbⁿ⁺ᵐcᵐ` | `{ aⁿbⁿ⁺ᵐcᵐ \| n ≥ 1, m ≥ 0 }` | First n b's cancel a's; extra m b's matched by m c's. |
| `aⁿ⁺ᵐbᵐcⁿ` | `{ aⁿ⁺ᵐbᵐcⁿ \| n,m ≥ 0 }` | Push all a's (n+m), pop m for b's, pop n for c's. |
| `aⁿb²ⁿ` | `{ aⁿb²ⁿ \| n ≥ 1 }` | Each 'a' contributes 2 A's; each 'b' pops one. |
| `wcwᴿ` | `{ wcwᴿ \| w ∈ {a,b}* }` | Push w, pass centre 'c', pop and match reverse. |

---

## PDA Engine — Technical Notes

**Stack model:** Stack symbols are atomic space-separated tokens. `"A Z0"` means push `A` on top of `Z0`. Use `""` or `"ε"` for a pop-only move.

**ε-transitions:** After all input is consumed, the engine automatically follows ε-chains to reach an accept state if one exists.

**Final states:** All built-in presets label their accept state `qf` to make acceptance explicit in the diagram.

**Bidirectional stepping:** Step forward with ⏭, step backward with ⏮. The state diagram, tape, stack, explanation, and transition highlight all rewind correctly.

---

## Project Structure

```
PDA_Sim/
├── index.html    # Page structure — 3 tabs, all panels
├── style.css     # Design system — tokens, layout, components, animations
├── pda.js        # PDA engine — automaton model, preset library, step-trace simulation
└── app.js        # UI controller — canvas renderer, tape, stack, controls, table editor
```

---

## Getting Started

```bash
git clone https://github.com/your-username/PDA_Sim.git
cd PDA_Sim
open index.html   # macOS — or just double-click index.html
```

No npm, no bundler, no server needed.

---

## Design

| | |
|---|---|
| **Theme** | Jet Black `#0d0d0d` · Amber Yellow `#ffd60a` · Off White `#f4f4f4` |
| **Accept** | Green `#39d353` |
| **Reject** | Red `#f85149` |
| **Fonts** | JetBrains Mono (code) · Inter (UI) |
| **Light mode** | Toggle in the top-right header |
