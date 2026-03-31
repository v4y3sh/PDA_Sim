/* 
   pda.js — Universal NPDA Engine v3
   Stack symbols are ATOMIC TOKENS (may be multi-char)
   Push strings are space-separated token lists
   Supports phase metadata and stack-delta signalling
*/

/**
 * PDA class — models a Pushdown Automaton
 *
 * Transition { from, input, stackTop, to, push }
 *   push: space-separated list, leftmost = top after push.
 *         "" or "ε" = pop only.
 *   Example: "A Z0" → pop old top, push Z0, push A → A on top.
 */
class PDA {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.states = config.states;
    this.inputAlphabet = config.inputAlphabet;
    this.stackAlphabet = config.stackAlphabet;
    this.initialState = config.initialState;
    this.initialStack = config.initialStack;
    this.acceptStates = config.acceptStates;
    this.transitions = config.transitions;
    this.examples = config.examples || [];
    this.phases = config.phases || {};
  }

  _parsePush(pushStr) {
    if (!pushStr || pushStr === 'ε' || pushStr === '') return [];
    return pushStr.trim().split(/\s+/);
  }

  _getTransition(state, inputSym, stackTop) {
    for (const t of this.transitions) {
      if (t.from === state && t.input === inputSym && t.stackTop === stackTop) return t;
    }
    for (const t of this.transitions) {
      if (t.from === state && (t.input === 'ε' || t.input === '') && t.stackTop === stackTop) return t;
    }
    return null;
  }

  _stackDelta(before, after) {
    if (after.length > before.length) {
      return { action: 'push', symbols: after.slice(before.length - 1) };
    } else if (after.length < before.length) {
      return { action: 'pop', symbol: before[before.length - 1] };
    }
    return { action: 'none', symbol: null };
  }

  simulate(input) {
    const tape = input === '' ? [] : input.split('');
    let stack = [this.initialStack];
    let state = this.initialState;
    let head = 0;
    const trace = [];

    trace.push({
      stepNum: 0, state, inputHead: head,
      tape: [...tape], stack: [...stack],
      transition: null, action: 'Start',
      description: `Initial configuration. State: <strong>${state}</strong>, Stack: [<code>${stack.join(', ')}</code>]`,
      phase: this.phases[state] || '',
      stackDelta: { action: 'none', symbol: null },
      isAccept: false, isReject: false,
    });

    const maxSteps = 500;
    let stepNum = 0;

    while (stepNum < maxSteps) {
      stepNum++;
      const inputSym = head < tape.length ? tape[head] : 'ε';
      const stackTop = stack.length > 0 ? stack[stack.length - 1] : null;

      if (stackTop === null) {
        trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Reject',
          'Stack is empty — no transition possible. ✗ String REJECTED.',
          this.phases[state] || '', { action: 'none', symbol: null }, false, true));
        break;
      }

      let t = this._getTransition(state, inputSym, stackTop);
      const isEpsilon = t && (t.input === 'ε' || t.input === '');

      if (!t) {
        if (head >= tape.length && this.acceptStates.includes(state)) {
          trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Accept',
            `All input consumed. State <strong>${state}</strong> is an accept state. ✓ String ACCEPTED.`,
            this.phases[state] || '', { action: 'none', symbol: null }, true, false));
        } else {
          trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Reject',
            `No transition for δ(<strong>${state}</strong>, <code>${inputSym}</code>, <code>${stackTop}</code>). ✗ String REJECTED.`,
            this.phases[state] || '', { action: 'none', symbol: null }, false, true));
        }
        break;
      }

      const prevStack = [...stack];
      const prevState = state;
      stack.pop();
      const pushSyms = this._parsePush(t.push);
      for (let i = pushSyms.length - 1; i >= 0; i--) stack.push(pushSyms[i]);

      state = t.to;
      if (!isEpsilon) head++;

      const delta = this._stackDelta(prevStack, stack);
      const pushDisp = pushSyms.length === 0 ? 'ε' : pushSyms.join(' ');
      const inpDisp = isEpsilon ? 'ε' : t.input;
      const transStr = `δ(${prevState}, ${inpDisp}, ${t.stackTop}) → (${t.to}, ${pushDisp})`;

      let desc = `<strong>Transition:</strong> <code>${transStr}</code><br>`;
      desc += `→ Popped <code>${t.stackTop}</code> from stack.<br>`;
      if (pushSyms.length === 0) {
        desc += `→ Nothing pushed (pop only).<br>`;
      } else if (pushSyms.length === 1 && pushSyms[0] === t.stackTop) {
        desc += `→ Kept <code>${t.stackTop}</code> on stack.<br>`;
      } else {
        desc += `→ Pushed [<code>${pushSyms.join(', ')}</code>] — <code>${pushSyms[0]}</code> now on top.<br>`;
      }
      if (isEpsilon) desc += `→ ε-transition (no input consumed).`;
      else desc += `→ Consumed input symbol <code>${t.input}</code>.`;

      const phaseLabel = this.phases[state] || this.phases[prevState] || '';
      if (phaseLabel) desc += `<br><em>${phaseLabel}</em>`;

      trace.push(this._makeStep(stepNum, state, head, tape, [...stack], t, transStr, desc,
        this.phases[state] || '', delta, false, false));

      if (head >= tape.length) {
        let eState = state, eStack = [...stack], extra = 0;
        while (extra < 20) {
          extra++;
          const eTop = eStack.length > 0 ? eStack[eStack.length - 1] : null;
          if (!eTop) break;
          const eT = this._getTransition(eState, 'ε', eTop);
          if (!eT || (eT.input !== 'ε' && eT.input !== '')) break;
          const eFromState = eState;
          const ePrevStack = [...eStack];
          eStack.pop();
          const ePush = this._parsePush(eT.push);
          for (let i = ePush.length - 1; i >= 0; i--) eStack.push(ePush[i]);
          eState = eT.to;
          const eDelta = this._stackDelta(ePrevStack, eStack);
          stepNum++;
          const ePushDisp = ePush.length === 0 ? 'ε' : ePush.join(' ');
          trace.push(this._makeStep(stepNum, eState, head, tape, [...eStack], eT,
            `δ(${eFromState}, ε, ${eT.stackTop}) → (${eT.to}, ${ePushDisp})`,
            `ε-transition after consuming all input. Moved to <strong>${eT.to}</strong>.`,
            this.phases[eState] || '', eDelta, false, false));
          if (this.acceptStates.includes(eState)) {
            stepNum++;
            trace.push(this._makeStep(stepNum, eState, head, tape, [...eStack], null, 'Accept',
              `All input consumed. State <strong>${eState}</strong> is an accept state. ✓ String ACCEPTED.`,
              this.phases[eState] || '', { action: 'none', symbol: null }, true, false));
            return trace;
          }
        }

        stepNum++;
        const finalState = eState || state;
        const finalStack = eStack || stack;
        if (this.acceptStates.includes(finalState)) {
          trace.push(this._makeStep(stepNum, finalState, head, tape, [...finalStack], null, 'Accept',
            `All input consumed and in accept state <strong>${finalState}</strong>. ✓ String ACCEPTED.`,
            this.phases[finalState] || '', { action: 'none', symbol: null }, true, false));
        } else {
          trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Reject',
            `All input consumed but state <strong>${state}</strong> is not an accept state. ✗ String REJECTED.`,
            this.phases[state] || '', { action: 'none', symbol: null }, false, true));
        }
        break;
      }
    }

    if (stepNum >= maxSteps) {
      trace.push(this._makeStep(stepNum, state, 0, tape, [], null, 'Reject',
        'Maximum steps exceeded — possible infinite loop.', '', { action: 'none', symbol: null }, false, true));
    }
    return trace;
  }

  _makeStep(stepNum, state, head, tape, stack, transition, action, description, phase, stackDelta, isAccept, isReject) {
    return { stepNum, state, inputHead: head, tape: [...tape], stack: [...stack], transition, action, description, phase, stackDelta, isAccept, isReject };
  }
}

/* ── Pre-defined PDA Configurations ─────────────────
   push field: SPACE-SEPARATED tokens, leftmost = top.
   "" or "ε" = pop only (no push).
   Each preset has: needsM, needsW, generator(n,m,w).
   ─────────────────────────────────────────────────── */
const PDA_PRESETS = {

  /* ── 1. aⁿbⁿ ─────────────────────────────── */
  anbn: {
    name: "aⁿbⁿ", fullName: "L = { aⁿbⁿ | n ≥ 1 }",
    description: "Equal number of a's followed by equal number of b's.",
    states: ["q0","q1","q2"], inputAlphabet: ["a","b"], stackAlphabet: ["A","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q2"],
    phases: { "q0":"Phase 1 — Pushing A for each 'a'", "q1":"Phase 2 — Popping A for each 'b'", "q2":"✓ Accepted — Equal a's and b's" },
    transitions: [
      { from:"q0", input:"a", stackTop:"Z0", to:"q0", push:"A Z0" },
      { from:"q0", input:"a", stackTop:"A",  to:"q0", push:"A A" },
      { from:"q0", input:"b", stackTop:"A",  to:"q1", push:"" },
      { from:"q1", input:"b", stackTop:"A",  to:"q1", push:"" },
      { from:"q1", input:"ε", stackTop:"Z0", to:"q2", push:"Z0" },
    ],
    examples: ["ab","aabb","aaabbb","aaaabbbb"],
    needsM: false, needsW: false,
    generator: (n) => 'a'.repeat(n) + 'b'.repeat(n),
  },

  /* ── 2. Balanced Parens ───────────────────── */
  paren: {
    name: "( )", fullName: "Balanced Parentheses",
    description: "Correctly nested and balanced parentheses.",
    states: ["q0","q1"], inputAlphabet: ["(", ")"], stackAlphabet: ["P","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q1"],
    phases: { "q0":"Tracking open parentheses", "q1":"✓ Accepted — All parentheses balanced" },
    transitions: [
      { from:"q0", input:"(", stackTop:"Z0", to:"q0", push:"P Z0" },
      { from:"q0", input:"(", stackTop:"P",  to:"q0", push:"P P" },
      { from:"q0", input:")", stackTop:"P",  to:"q0", push:"" },
      { from:"q0", input:"ε", stackTop:"Z0", to:"q1", push:"Z0" },
    ],
    examples: ["()","(())","(()())","((()))"],
    needsM: false, needsW: false,
    generator: (n) => '('.repeat(n) + ')'.repeat(n),
  },

  /* ── 3. aⁿbᵐcⁿ⁺ᵐ ─────────────────────────── */
  anbmcnpm: {
    name: "aⁿbᵐcⁿ⁺ᵐ", fullName: "L = { aⁿbᵐcⁿ⁺ᵐ | n, m ≥ 1 }",
    description: "Push A per 'a', push B per 'b', pop one per 'c'. Total c's = n+m.",
    states: ["q0","q1","q2","q3"], inputAlphabet: ["a","b","c"], stackAlphabet: ["A","B","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q3"],
    phases: { "q0":"Phase 1 — Pushing A for each 'a'", "q1":"Phase 2 — Pushing B for each 'b'", "q2":"Phase 3 — Popping for each 'c' (n+m pops)", "q3":"✓ Accepted — c's matched n+m" },
    transitions: [
      { from:"q0", input:"a", stackTop:"Z0", to:"q0", push:"A Z0" },
      { from:"q0", input:"a", stackTop:"A",  to:"q0", push:"A A" },
      { from:"q0", input:"b", stackTop:"Z0", to:"q1", push:"B Z0" },
      { from:"q0", input:"b", stackTop:"A",  to:"q1", push:"B A" },
      { from:"q1", input:"b", stackTop:"Z0", to:"q1", push:"B Z0" },
      { from:"q1", input:"b", stackTop:"A",  to:"q1", push:"B A" },
      { from:"q1", input:"b", stackTop:"B",  to:"q1", push:"B B" },
      { from:"q1", input:"c", stackTop:"A",  to:"q2", push:"" },
      { from:"q1", input:"c", stackTop:"B",  to:"q2", push:"" },
      { from:"q2", input:"c", stackTop:"A",  to:"q2", push:"" },
      { from:"q2", input:"c", stackTop:"B",  to:"q2", push:"" },
      { from:"q2", input:"ε", stackTop:"Z0", to:"q3", push:"Z0" },
    ],
    examples: ["abcc","aabccc","abbccc","aabbcccc"],
    needsM: true, needsW: false,
    generator: (n, m) => 'a'.repeat(n) + 'b'.repeat(m) + 'c'.repeat(n + m),
  },

  /* ── 4. aⁿbⁿ⁺ᵐcᵐ ──────────────────────────── */
  anbncm: {
    name: "aⁿbⁿ⁺ᵐcᵐ", fullName: "L = { aⁿbⁿ⁺ᵐcᵐ | n ≥ 1, m ≥ 0 }",
    description: "First n b's match a's. Extra m b's verified by m c's.",
    states: ["q0","q1","q2","q3","q4"], inputAlphabet: ["a","b","c"], stackAlphabet: ["A","B","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q4"],
    phases: { "q0":"Phase 1 — Pushing A for each 'a'", "q1":"Phase 2 — Popping A for each 'b' (n match)", "q2":"Phase 3 — Pushing B for extra b's (m count)", "q3":"Phase 4 — Popping B for each 'c'", "q4":"✓ Accepted" },
    transitions: [
      { from:"q0", input:"a", stackTop:"Z0", to:"q0", push:"A Z0" },
      { from:"q0", input:"a", stackTop:"A",  to:"q0", push:"A A" },
      { from:"q0", input:"b", stackTop:"A",  to:"q1", push:"" },
      { from:"q1", input:"b", stackTop:"A",  to:"q1", push:"" },
      { from:"q1", input:"b", stackTop:"Z0", to:"q2", push:"B Z0" },
      { from:"q1", input:"ε", stackTop:"Z0", to:"q4", push:"Z0" },
      { from:"q2", input:"b", stackTop:"Z0", to:"q2", push:"B Z0" },
      { from:"q2", input:"b", stackTop:"B",  to:"q2", push:"B B" },
      { from:"q2", input:"c", stackTop:"B",  to:"q3", push:"" },
      { from:"q3", input:"c", stackTop:"B",  to:"q3", push:"" },
      { from:"q3", input:"ε", stackTop:"Z0", to:"q4", push:"Z0" },
    ],
    examples: ["ab","abbc","aabb","aabbbc"],
    needsM: true, needsW: false,
    generator: (n, m) => 'a'.repeat(n) + 'b'.repeat(n + m) + 'c'.repeat(m),
  },

  /* ── 5. aⁿ⁺ᵐbᵐcⁿ ──────────────────────────── */
  anmbmcn: {
    name: "aⁿ⁺ᵐbᵐcⁿ", fullName: "L = { aⁿ⁺ᵐbᵐcⁿ | n, m ≥ 0 }",
    description: "Push all a's (n+m). Pop m for b's. Pop remaining n for c's.",
    states: ["q0","q1","q2","q3"], inputAlphabet: ["a","b","c"], stackAlphabet: ["A","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q3"],
    phases: { "q0":"Phase 1 — Pushing A (counting n+m)", "q1":"Phase 2 — Popping A for each 'b' (m)", "q2":"Phase 3 — Popping A for each 'c' (n)", "q3":"✓ Accepted" },
    transitions: [
      { from:"q0", input:"a", stackTop:"Z0", to:"q0", push:"A Z0" },
      { from:"q0", input:"a", stackTop:"A",  to:"q0", push:"A A" },
      { from:"q0", input:"b", stackTop:"A",  to:"q1", push:"" },
      { from:"q0", input:"c", stackTop:"A",  to:"q2", push:"" },
      { from:"q0", input:"ε", stackTop:"Z0", to:"q3", push:"Z0" },
      { from:"q1", input:"b", stackTop:"A",  to:"q1", push:"" },
      { from:"q1", input:"c", stackTop:"A",  to:"q2", push:"" },
      { from:"q1", input:"ε", stackTop:"Z0", to:"q3", push:"Z0" },
      { from:"q2", input:"c", stackTop:"A",  to:"q2", push:"" },
      { from:"q2", input:"ε", stackTop:"Z0", to:"q3", push:"Z0" },
    ],
    examples: ["ac","ab","aabc","aaabcc"],
    needsM: true, needsW: false,
    generator: (n, m) => 'a'.repeat(n + m) + 'b'.repeat(m) + 'c'.repeat(n),
  },

  /* ── 6. aⁿb²ⁿ ───────────────────────────────
     Each 'a' pushes 2 A's. Each 'b' pops 1 A.
     Need exactly 2n b's to clear the stack.     */
  anb2n: {
    name: "aⁿb²ⁿ", fullName: "L = { aⁿb²ⁿ | n ≥ 1 }",
    description: "Each 'a' pushes 2 A's onto the stack. Each 'b' pops 1. Need exactly 2n b's.",
    states: ["q0","q1","q2"], inputAlphabet: ["a","b"], stackAlphabet: ["A","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q2"],
    phases: { "q0":"Phase 1 — Pushing 2×A per 'a' (stack grows to 2n)", "q1":"Phase 2 — Popping 1 A per 'b' (need exactly 2n pops)", "q2":"✓ Accepted — Exactly 2n b's matched" },
    transitions: [
      // Net +2 per 'a': pop 1, push 3 (or pop Z0, push 2+Z0)
      { from:"q0", input:"a", stackTop:"Z0", to:"q0", push:"A A Z0" },
      { from:"q0", input:"a", stackTop:"A",  to:"q0", push:"A A A" },
      // First 'b': switch to pop phase
      { from:"q0", input:"b", stackTop:"A",  to:"q1", push:"" },
      // Continue popping
      { from:"q1", input:"b", stackTop:"A",  to:"q1", push:"" },
      // All A's cleared → accept
      { from:"q1", input:"ε", stackTop:"Z0", to:"q2", push:"Z0" },
    ],
    examples: ["abb","aabbbb","aaabbbbbb"],
    needsM: false, needsW: false,
    generator: (n) => 'a'.repeat(n) + 'b'.repeat(2 * n),
  },

  /* ── 7. wcwᴿ ─────────────────────────────────
     Push each symbol of w in q0.
     At 'c', switch to pop mode q1.
     Pop and match symbols of reversed w.         */
  wcwr: {
    name: "wcwᴿ", fullName: "L = { wcwᴿ | w ∈ {a,b}* }",
    description: "Push w onto stack, pass centre 'c', pop and match wᴿ.",
    states: ["q0","q1","q2"], inputAlphabet: ["a","b","c"], stackAlphabet: ["a","b","Z0"],
    initialState: "q0", initialStack: "Z0", acceptStates: ["q2"],
    phases: { "q0":"Phase 1 — Pushing symbols of w", "q1":"Phase 2 — Matching wᴿ by popping", "q2":"✓ Accepted — wcwᴿ verified" },
    transitions: [
      // Push phase: push input symbol over whatever is on top
      { from:"q0", input:"a", stackTop:"Z0", to:"q0", push:"a Z0" },
      { from:"q0", input:"a", stackTop:"a",  to:"q0", push:"a a" },
      { from:"q0", input:"a", stackTop:"b",  to:"q0", push:"a b" },
      { from:"q0", input:"b", stackTop:"Z0", to:"q0", push:"b Z0" },
      { from:"q0", input:"b", stackTop:"a",  to:"q0", push:"b a" },
      { from:"q0", input:"b", stackTop:"b",  to:"q0", push:"b b" },
      // Centre 'c': switch to pop mode, keep stack unchanged
      { from:"q0", input:"c", stackTop:"a",  to:"q1", push:"a" },
      { from:"q0", input:"c", stackTop:"b",  to:"q1", push:"b" },
      { from:"q0", input:"c", stackTop:"Z0", to:"q2", push:"Z0" }, // w = ε → "c" accepted
      // Pop phase: pop matching symbols
      { from:"q1", input:"a", stackTop:"a",  to:"q1", push:"" },
      { from:"q1", input:"b", stackTop:"b",  to:"q1", push:"" },
      // All matched → accept
      { from:"q1", input:"ε", stackTop:"Z0", to:"q2", push:"Z0" },
    ],
    examples: ["c","abcba","aabcbaa","babcbab"],
    needsM: false, needsW: true,
    generator: (n, _m, w) => {
      const word = (w && w.length > 0)
        ? w.replace(/[^ab]/g, '')
        : Array.from({ length: Math.max(1, n) }, () => Math.random() < 0.5 ? 'a' : 'b').join('');
      return word + 'c' + [...word].reverse().join('');
    },
  },
};
