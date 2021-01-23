const Canvas = require('canvas');
const easymidi = require('@guillaumearm/easymidi');
const {
  initPush,
  sendFrame,
} = require('@guillaumearm/ableton-push-canvas-display');
const { Push2 } = require('@guillaumearm/ableton-push2');
const { compose } = require('ramda');

function noop() {}

const PISOUND_MIDI_INTERFACE = 'pisound:pisound MIDI PS-03QS2E8 20:0';

let pisoundOut = null;

if (easymidi.getInputs().includes(PISOUND_MIDI_INTERFACE)) {
  pisoundOut = new easymidi.Output(PISOUND_MIDI_INTERFACE);
  console.log('PISOUND interface connected!');
}

const canvas = Canvas.createCanvas(960, 160);
const ctx = canvas.getContext('2d');

const emptyCanvas = Canvas.createCanvas(960, 160);
const emptyCtx = emptyCanvas.getContext('2d');

emptyCtx.fillStyle = 'black';
emptyCtx.fillRect(0, 0, canvas.width, canvas.height);

const PI = Math.PI;

function minMax(min, max) {
  return (value) => {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  };
}

const ensureMidiRange = minMax(0, 127);
const ensureMidiValue = compose(Math.floor, ensureMidiRange);

const state = {
  cc1: 64,
};

const setCC1Absolute = (absValue) => {
  state.cc1 = ensureMidiRange(absValue);
};

const setCC1Relative = (relValue, divisor = 2) => {
  state.cc1 = ensureMidiRange(state.cc1 + relValue / divisor);

  if (pisoundOut) {
    pisoundOut.send('cc', { channel: 0, controller: 0, value: state.cc1 });
  }
};

function getCCRelativeValue(value) {
  // it's a positive increment
  if (value < 64) {
    return value;
  }
  // it's a negative increment
  const decrementValue = 127 - value + 1;
  return -decrementValue;
}

function drawKnob1(ctx) {
  // const value = frameNum;
  const value = ensureMidiValue(state.cc1);

  ctx.strokeStyle = '#ff0';
  ctx.fillStyle = 'blue';
  ctx.fillRect(0, 0, 960, 160);
  ctx.lineWidth = 3;

  const start = 0 - PI - PI / 4;
  const end = start + (PI * 2 - PI / 2);
  const angleMax = end - start;

  const midiValue = Math.floor(value % 128);
  // const midiValue = 100;

  const ratio = midiValue / 127;
  // const ratio = 127 / 127;
  const pos = angleMax * ratio;

  ctx.beginPath();
  const x = 60;
  const y = 130;
  const size = 20;

  ctx.arc(x, y, size, start, start + pos);
  ctx.lineTo(x, y);
  ctx.stroke();

  let xPos = 55;
  if (midiValue >= 10 && midiValue <= 99) {
    xPos = 50;
  } else if (midiValue >= 100) {
    xPos = 45;
  }
  const yPos = 100;

  ctx.font = '100 18px "SF Pro Display"';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${midiValue}`, xPos, yPos);
}

function drawFrame(ctx) {
  drawKnob1(ctx);
}

let push2 = null;
let timeoutId = null;

function closePush(cb = noop) {
  const pushConnected = Boolean(push2);

  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutIt = null;
  }

  if (push2) {
    sendFrame(emptyCtx, function () {
      push2.close();
      push2 = null;
      if (pushConnected) {
        console.log('=> Push disconnected!');
      }
      cb();
    });
  } else {
    cb();
  }
}

function nextFrame() {
  if (!push2) {
    return;
  }

  drawFrame(ctx);
  sendFrame(ctx, function (error) {
    // we can ignore any error here, more or less
    timeoutId = setTimeout(nextFrame, 15); // Do not use nextTick here, as this will not allow USB callbacks to fire.
  });
}

function onStart() {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      push2.setColor([x + 1, y + 1], x + y + 1);
    }
  }

  push2.midi.on('cc', ({ controller, value, channel, _type }) => {
    if (controller === 71) {
      const relValue = getCCRelativeValue(value);
      setCC1Relative(relValue, 1);
    }
  });
}

function onStop() {
  if (push2) {
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        push2.setColor([x + 1, y + 1], 0);
      }
    }
  }
}

initPush(
  function (error) {
    if (error) {
      console.log('Warning [init]: ', error.message);
    } else {
      console.log('=> Push connected!');
      push2 = new Push2();

      onStart();
      nextFrame();
    }
  },
  () => closePush()
);

process.on('SIGINT', () => {
  onStop();

  closePush(() => {
    process.exit(0);
  });
});
