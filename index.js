const Canvas = require('canvas');
const {
  initPush,
  sendFrame,
} = require('@guillaumearm/ableton-push-canvas-display');
const { Push2 } = require('@guillaumearm/ableton-push2');

function noop() {}

const canvas = Canvas.createCanvas(960, 160);
const ctx = canvas.getContext('2d');

const emptyCanvas = Canvas.createCanvas(960, 160);
const emptyCtx = emptyCanvas.getContext('2d');
emptyCtx.fillStyle = 'black';
emptyCtx.fillRect(0, 0, canvas.width, canvas.height);

const PI = Math.PI;

const state = {
  cc1: 100,
};

function drawKnob1(ctx) {
  // const value = frameNum;
  const value = Math.min(state.cc1, 127);

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
  console.log('=> Push disconnected!');

  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutIt = null;
  }

  if (push2) {
    sendFrame(emptyCtx, function () {
      push2.close();
      push2 = null;
      cb();
    });
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

initPush(
  function (error) {
    if (error) {
      console.log('Warning [init]: ', error.message);
    } else {
      console.log('=> Push connected!');
      push2 = new Push2();

      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          push2.setColor([x + 1, y + 1], x + y + 1);
        }
      }

      nextFrame();
    }
  },
  () => closePush()
);

process.on('SIGINT', () => {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      push2.setColor([x + 1, y + 1], 0);
    }
  }

  closePush(() => {
    process.exit(0);
  });
});
