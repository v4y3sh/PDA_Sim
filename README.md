# PDA Simulator — Universal NPDA Engine

An interactive Pushdown Automaton (PDA) Simulator built with pure HTML, CSS, and JavaScript. Open `index.html` in any browser — no build step required.

---

## Tabs

- **Simulator** — Run, Pause, Step, and step back through PDA computations with live state diagram, input tape, and stack visualization
  <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/79833eaa-beda-4e20-9367-f0291a3c9d06" />

- **Learn PDA** — Theory reference covering formal definition, acceptance methods (final state & empty stack), ε-transitions, and classic language walkthroughs
- **Table Editor** — Build or edit a custom PDA rule-by-rule with ε-insert support and textbook quick-parse

---

## Simulator

- String Builder — generate valid inputs from presets with configurable `n`/`m`
- Manual Input — type any string with real-time validation
- State Diagram — live canvas with animated active state
- Input Tape — read-head tracking with consumed / pending symbols
- Stack — push/pop animations, top symbol highlighted
- Step Explanation — plain-English description of each transition
- Controls — Run · Pause · Step · Prev · Reset with speed slider
- Transition Functions — lists all `δ` rules; active rule highlighted per step
- Computation Path — scrollable trace log; click any entry to replay

---

## Built-in Presets (7)

- `aⁿbⁿ` — equal a's and b's
- Balanced Parentheses
- `aⁿbᵐcⁿ⁺ᵐ`
- `aⁿbⁿ⁺ᵐcᵐ`
- `aⁿ⁺ᵐbᵐcⁿ`
- `aⁿb²ⁿ`
- `wcwᴿ`

---

## Project Structure

```
index.html  — layout and tabs
style.css   — design system
pda.js      — PDA engine and preset library
app.js      — UI controller and canvas renderer
```
