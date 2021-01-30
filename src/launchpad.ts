import easymidi from '@guillaumearm/easymidi';

const LAUNCHPAD_REAL_NOTE_IDS = [
  // line 1
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  // line 2
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  // line 3
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  // line 4
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  // line 5
  64,
  65,
  66,
  67,
  68,
  69,
  70,
  71,
  // line 6
  80,
  81,
  82,
  83,
  84,
  85,
  86,
  87,
  // line 7
  96,
  97,
  98,
  99,
  100,
  101,
  102,
  103,
  // line 8
  112,
  113,
  114,
  115,
  116,
  117,
  118,
  119,
];

const LAUNCHPAD_REAL_SCENE_IDS = [8, 24, 40, 56, 72, 88, 104, 120];

const LAUNCHPAD_SHIFT_TOGGLE_ID = LAUNCHPAD_REAL_SCENE_IDS[6];
const LAUNCHPAD_SHIFT_ID = LAUNCHPAD_REAL_SCENE_IDS[7];

const LAUNCHPAD_NOTE_MAP = LAUNCHPAD_REAL_NOTE_IDS.reduce((acc: Record<string, number>, noteId, idx) => {
  acc[noteId] = idx;
  return acc;
}, {});

const LED_DISABLED = 0;
const LED_ENABLED = 63; // Amber full

const LED_PRESSED_ADDED = 28; // Green low
const LED_PRESSED_REMOVED = 13; // Red low

const LED_ADDED = 60; // Green full
const LED_REMOVED = 15; // Red full

console.log('=> Launchpad script: started!');

const state = LAUNCHPAD_REAL_NOTE_IDS.reduce(
  (acc: Record<string, boolean | 'added' | 'removed' | 'pressed-added' | 'pressed-removed'>, _noteId, idx) => {
    acc[idx] = false;
    return acc;
  },
  {},
);

let shiftState = false;

const midiInputs = easymidi.getInputs();
const midiOutputs = easymidi.getOutputs();

console.log('Inputs: ', midiInputs);
console.log('Outputs: ', midiOutputs);

const launchpadInterfaceName = midiInputs.find(x => x.includes('Launchpad')) || 'Launchpad';

const launchpadIn = new easymidi.Input(launchpadInterfaceName);
const launchpadOut = new easymidi.Output(launchpadInterfaceName);
const launchpadVirtualOut = new easymidi.Output('Virtual LP', true);

const enableShiftMode = () => {
  const note = LAUNCHPAD_SHIFT_ID;
  const pressedPads = Object.values(state).filter(x => x === 'pressed-added' || x === 'pressed-removed');
  if (!pressedPads.length) {
    shiftState = true;
    launchpadOut.send('noteon', { channel: 0, note, velocity: LED_ENABLED });
    launchpadOut.send('noteon', {
      note: LAUNCHPAD_SHIFT_TOGGLE_ID,
      velocity: LED_ENABLED,
    });
  }
};

const disableShiftMode = (noteId: number) => {
  const note = LAUNCHPAD_SHIFT_ID;
  shiftState = false;
  launchpadOut.send('noteon', { channel: 0, note, velocity: LED_DISABLED });
  launchpadOut.send('noteon', {
    note: LAUNCHPAD_SHIFT_TOGGLE_ID,
    velocity: LED_DISABLED,
  });

  Object.keys(state)
    .filter(k => state[k] === 'added' || state[k] === 'removed')
    .forEach(k => {
      const realNote = LAUNCHPAD_REAL_NOTE_IDS[Number(k)];
      if (state[k] === 'added') {
        launchpadOut.send('noteon', {
          channel: 0,
          note: realNote,
          velocity: LED_ENABLED,
        });
        launchpadVirtualOut.send('noteon', {
          channel: 0,
          note: noteId,
          velocity: 127,
        });
        state[k] = true;
      } else if (state[k] === 'removed') {
        launchpadOut.send('noteon', {
          channel: 0,
          note: realNote,
          velocity: LED_DISABLED,
        });
        launchpadVirtualOut.send('noteoff', {
          channel: 0,
          note: noteId,
          velocity: 127,
        });
        state[k] = false;
      }
    });
};

launchpadIn.on('noteon', payload => {
  // console.log(payload);
  const { velocity, note } = payload;
  const noteId = LAUNCHPAD_NOTE_MAP[note];

  if (!shiftState && note === LAUNCHPAD_SHIFT_ID && velocity === 127) {
    enableShiftMode();
  } else if (shiftState && note === LAUNCHPAD_SHIFT_ID && velocity === 0) {
    disableShiftMode(noteId);
  } else if (note === LAUNCHPAD_SHIFT_TOGGLE_ID && velocity === 127) {
    if (shiftState) {
      disableShiftMode(noteId);
    } else {
      enableShiftMode();
    }
  }

  if (noteId === undefined) {
    return;
  }

  if (shiftState && velocity === 127) {
    if (state[noteId] === true) {
      state[noteId] = 'removed';
      launchpadOut.send('noteon', { note, velocity: LED_REMOVED });
    } else if (state[noteId] === false) {
      state[noteId] = 'added';
      launchpadOut.send('noteon', { note, velocity: LED_ADDED });
    } else if (state[noteId] === 'added') {
      state[noteId] = false;
      launchpadOut.send('noteon', { note, velocity: LED_DISABLED });
    } else if (state[noteId] === 'removed') {
      state[noteId] = true;
      launchpadOut.send('noteon', { note, velocity: LED_ENABLED });
    }
  }

  if (shiftState) {
    return;
  }

  // console.log(payload.note);
  if (velocity === 0) {
    // pad released
    const isEnabled = state[noteId] === 'pressed-added';
    state[noteId] = isEnabled;
    const ledVelocity = isEnabled ? LED_ENABLED : LED_DISABLED;
    launchpadOut.send('noteon', { channel: 0, note, velocity: ledVelocity });
    if (isEnabled) {
      launchpadVirtualOut.send('noteon', {
        channel: 0,
        note: noteId,
        velocity: 127,
      });
    } else {
      launchpadVirtualOut.send('noteoff', {
        channel: 0,
        note: noteId,
        velocity: 127,
      });
    }
  } else if (velocity === 127) {
    // pad pressed
    const isEnabled = state[noteId] === true;
    if (isEnabled) {
      state[noteId] = 'pressed-removed';
    } else {
      state[noteId] = 'pressed-added';
    }
    const ledVelocity = isEnabled ? LED_PRESSED_REMOVED : LED_PRESSED_ADDED;
    launchpadOut.send('noteon', { channel: 0, note, velocity: ledVelocity });
  }
});

process.on('SIGINT', () => {
  Object.keys(state)
    .filter(k => state[k] !== false)
    .forEach(k => {
      const n = Number(k);
      const note = LAUNCHPAD_REAL_NOTE_IDS[n];
      launchpadOut.send('noteon', { channel: 0, note, velocity: 12 });
    });

  Object.values(LAUNCHPAD_REAL_SCENE_IDS).forEach(note => {
    launchpadOut.send('noteon', { channel: 0, note, velocity: 12 });
  });

  setTimeout(() => {
    process.exit(0);
  }, 10);
});
