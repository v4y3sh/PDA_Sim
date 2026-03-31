/* 
   pda.js — Pushdown Automaton Engine v2
   Stack symbols are ATOMIC TOKENS (may be multi-char)
   Push strings are space-separated token lists
*/

/**
 * PDA class — models a Pushdown Automaton
 *
 * Stack representation:
 *   stack is an array of atomic symbol strings.
 *   stack[stack.length-1] is the TOP.
 *
 * Transition { from, input, stackTop, to, push }
 *   push: space-separated list of symbols to push, LEFT = top after push.
 *         Use "" or "ε" to mean pop without pushing.
 *   Example: push "A Z0" → pop old top, push Z0, then A (A ends on top).
 */
class PDA {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.states = config.states;
    this.inputAlphabet = config.inputAlphabet;
    this.stackAlphabet = config.stackAlphabet;
    this.initialState = config.initialState;
    this.initialStack = config.initialStack;   // single symbol string
    this.acceptStates = config.acceptStates;
    this.transitions = config.transitions;
    this.examples = config.examples || [];
  }

  /** Parse push string: "A Z0" → ['A','Z0'], rightmost pushed first so 'A' is top */
  _parsePush(pushStr) {
    if (!pushStr || pushStr === 'ε' || pushStr === '') return [];
    return pushStr.trim().split(/\s+/);
  }

  /** Find best matching transition (prefers non-ε input) */
  _getTransition(state, inputSym, stackTop) {
    // 1) exact non-epsilon match
    for (const t of this.transitions) {
      if (t.from === state && t.input === inputSym && t.stackTop === stackTop) return t;
    }
    // 2) ε-transition
    for (const t of this.transitions) {
      if (t.from === state && (t.input === 'ε' || t.input === '') && t.stackTop === stackTop) return t;
    }
    return null;
  }

  /** Run simulation on input string, return step trace */
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
      description: `Initial configuration. State: ${state}, Stack top: ${this.initialStack}`,
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
          'Stack is empty — no transition possible. ✗ String REJECTED.', false, true));
        break;
      }

      let t = this._getTransition(state, inputSym, stackTop);
      const isEpsilon = t && (t.input === 'ε' || t.input === '');

      if (!t) {
        if (head >= tape.length && this.acceptStates.includes(state)) {
          trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Accept',
            `All input consumed. State ${state} is an accept state. ✓ String ACCEPTED.`, true, false));
        } else {
          trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Reject',
            `No transition for δ(${state}, ${inputSym}, ${stackTop}). ✗ String REJECTED.`, false, true));
        }
        break;
      }

      // Apply transition
      stack.pop();  // remove stackTop
      const pushSyms = this._parsePush(t.push);
      // Push right-to-left so first symbol of pushSyms ends on top
      for (let i = pushSyms.length - 1; i >= 0; i--) stack.push(pushSyms[i]);

      const prevState = state;
      state = t.to;
      if (!isEpsilon) head++;

      const pushDisp = pushSyms.length === 0 ? 'ε' : pushSyms.join(' ');
      const inpDisp = isEpsilon ? 'ε' : t.input;
      const transStr = `δ(${prevState}, ${inpDisp}, ${t.stackTop}) → (${t.to}, ${pushDisp})`;

      let desc = `Transition: ${transStr}.\n`;
      desc += `→ Popped "${t.stackTop}" from stack.\n`;
      desc += pushSyms.length === 0
        ? `→ Nothing pushed (pop only).\n`
        : `→ Pushed [${pushSyms.join(', ')}] — "${pushSyms[0]}" is now on top.\n`;
      desc += isEpsilon ? `→ ε-transition (no input consumed).` : `→ Consumed input symbol "${t.input}".`;

      trace.push(this._makeStep(stepNum, state, head, tape, [...stack], t, transStr, desc, false, false));

      // All input consumed — follow ε-chain to acceptance
      if (head >= tape.length) {
        let eState = state, eStack = [...stack], extra = 0;
        while (extra < 20) {
          extra++;
          const eTop = eStack.length > 0 ? eStack[eStack.length - 1] : null;
          if (!eTop) break;
          const eT = this._getTransition(eState, 'ε', eTop);
          if (!eT || (eT.input !== 'ε' && eT.input !== '')) break;
          eStack.pop();
          const ePush = this._parsePush(eT.push);
          for (let i = ePush.length - 1; i >= 0; i--) eStack.push(ePush[i]);
          const fromState = eState;
          eState = eT.to;
          stepNum++;
          const ePushDisp = ePush.length === 0 ? 'ε' : ePush.join(' ');
          trace.push(this._makeStep(stepNum, eState, head, tape, [...eStack], eT,
            `δ(${fromState}, ε, ${eT.stackTop}) → (${eT.to}, ${ePushDisp})`,
            `ε-transition after consuming all input. Moved to ${eT.to}.`, false, false));
          if (this.acceptStates.includes(eState)) {
            stepNum++;
            trace.push(this._makeStep(stepNum, eState, head, tape, [...eStack], null, 'Accept',
              `All input consumed. State ${eState} is an accept state. ✓ String ACCEPTED.`, true, false));
            return trace;
          }
        }
        // Final verdict
        stepNum++;
        if (this.acceptStates.includes(state) || this.acceptStates.includes(eState)) {
          trace.push(this._makeStep(stepNum, eState || state, head, tape, [...(eStack || stack)], null, 'Accept',
            `All input consumed and in accept state. ✓ String ACCEPTED.`, true, false));
        } else {
          trace.push(this._makeStep(stepNum, state, head, tape, [...stack], null, 'Reject',
            `All input consumed but state ${state} is not an accept state. ✗ String REJECTED.`, false, true));
        }
        break;
      }
    }

    if (stepNum >= maxSteps) {
      trace.push(this._makeStep(stepNum, state, 0, tape, [], null, 'Reject',
        'Maximum steps exceeded — possible infinite loop.', false, true));
    }
    return trace;
  }

  _makeStep(stepNum, state, head, tape, stack, transition, action, description, isAccept, isReject) {
    return { stepNum, state, inputHead: head, tape: [...tape], stack: [...stack], transition, action, description, isAccept, isReject };
  }
}

/* ── Pre-defined PDA Configurations ──────────────
   IMPORTANT: push strings use SPACE-SEPARATED tokens.
   "A Z0" means push Z0 first, then A → A is on top.
   ─────────────────────────────────────────────── */
const PDA_PRESETS = {
  anbn: {
    name: "L = { aⁿbⁿ | n ≥ 1 }",
    description: "Accepts strings with equal number of a's followed by equal b's.",
    states: ["q0", "q1", "q2"],
    inputAlphabet: ["a", "b"],
    stackAlphabet: ["A", "Z0"],
    initialState: "q0",
    initialStack: "Z0",
    acceptStates: ["q2"],
    transitions: [
      // In q0, reading 'a' with Z0 on top: push A on top of Z0
      { from: "q0", input: "a", stackTop: "Z0", to: "q0", push: "A Z0" },
      // In q0, reading 'a' with A on top: push another A
      { from: "q0", input: "a", stackTop: "A", to: "q0", push: "A A" },
      // First 'b' transitions to q1, pops one A
      { from: "q0", input: "b", stackTop: "A", to: "q1", push: "" },
      // Subsequent b's in q1, each pops one A
      { from: "q1", input: "b", stackTop: "A", to: "q1", push: "" },
      // All b's matched — Z0 on stack — ε-transition to accept state
      { from: "q1", input: "ε", stackTop: "Z0", to: "q2", push: "Z0" },
    ],
    examples: ["ab", "aabb", "aaabbb", "aaaabbbb"],
  },

  paren: {
    name: "Balanced Parentheses",
    description: "Accepts strings of correctly nested and balanced parentheses.",
    states: ["q0", "q1"],
    inputAlphabet: ["(", ")"],
    stackAlphabet: ["P", "Z0"],
    initialState: "q0",
    initialStack: "Z0",
    acceptStates: ["q1"],
    transitions: [
      // '(' on Z0 → push P on top of Z0
      { from: "q0", input: "(", stackTop: "Z0", to: "q0", push: "P Z0" },
      // '(' on P → push another P
      { from: "q0", input: "(", stackTop: "P", to: "q0", push: "P P" },
      // ')' matches '(' — pop P
      { from: "q0", input: ")", stackTop: "P", to: "q0", push: "" },
      // Empty parens balanced — Z0 on stack — ε to accept
      { from: "q0", input: "ε", stackTop: "Z0", to: "q1", push: "Z0" },
    ],
    examples: ["()", "(())", "(()())", "((()))"],
  },
};
