import { fromEvent, map, merge, switchMap, takeUntil } from './operators.js'


const board = document.getElementById('board')
const clear = document.getElementById('clear')
const footer = document.getElementById('footer')
const lineWidth = document.getElementById('lineWidth')
const strokeStyle = document.getElementById('strokeStyle')
const undo = document.getElementById('undo')
const undoOperations = document.getElementById('undoOperations')

/** @type {CanvasRenderingContext2D} */
const context = board.getContext('2d')

const mouseEvents = {
  click: 'click',
  mousedown: 'mousedown',
  mouseleave: 'mouseleave',
  mousemove: 'mousemove',
  mouseup: 'mouseup',
  touchend: 'touchend',
  touchmove: 'touchmove',
  touchstart: 'touchstart'
}

const store = {
  db: [],
  clear () {
    this.db.length = 0
  },
  get () {
    return this.db
  },
  set (item) {
    this.db.push(item)
  },
  splice (deleteCount) {
    return this.db.splice(deleteCount * -1)
  }
}


function drawOnBoard (from, to) {
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.stroke()
}


/**
 * @param {HTMLElement} board 
 * @param {Touch} event 
 */
function getMousePosition (board, event) {
  const rect = board.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}


/**
 * 
 * @param {number} width 
 * @param {number} height 
 */
function resetBoard (width, height) {
  const parent = board.parentElement
  board.width = width || parent.clientWidth
  board.height = height || parent.clientHeight - footer.clientHeight
  context.clearRect(0, 0, board.width, board.height)
}


function resetConfig () {
  context.beginPath()
  context.lineWidth = Number(lineWidth.value)
  context.strokeStyle = strokeStyle.value
}


/**
 * @param {number} milliseconds 
 * @returns {Promise<void>}
 */
function sleep (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}


/**
 * @param {TouchEvent} touchEvent 
 * @param {MouseEvent} mouseEvent 
 */
function touchToMouse (touchEvent, mouseEvent) {
  const [touch] = touchEvent.touches.length ?
    touchEvent.touches : touchEvent.changedTouches
  return new MouseEvent(mouseEvent, {
    clientX: touch.clientX, clientY: touch.clientY
  })
}


lineWidth.addEventListener('change', event => {
  const max = Number(event.target.max)
  const min = Number(event.target.min)
  const value = Number(event.target.value)
  if (value >= min && value <= max) {
    context.beginPath()
    context.lineWidth = value
  }
})

strokeStyle.addEventListener('change', event => {
  context.beginPath()
  context.strokeStyle = event.target.value
})

resetBoard()
resetConfig()

fromEvent(clear, mouseEvents.click).pipeTo(new WritableStream({
    async write () {
      context.beginPath()
      context.strokeStyle = 'white'
      for (const { from, to } of store.get()) {
        drawOnBoard(from, to)
        await sleep(0.01)
      }
      store.clear()
      resetBoard(board.width, board.height)
      resetConfig()
    }
  }))

fromEvent(undo, mouseEvents.click).pipeTo(new WritableStream({
  async write () {
    try {
      store.splice(Number(undoOperations.value))
      resetBoard(board.width, board.height)
      for (const { color, from, to, width } of store.get()) {
        if (context.strokeStyle !== color) {
          context.beginPath()
          context.strokeStyle = color
        }
        if (context.lineWidth !== width) {
          context.beginPath()
          context.lineWidth = width
        }
        drawOnBoard(from, to)
      }
      resetConfig()
    }
    catch (error) {
      // console.error(error)
    }
  }
}))

merge([
  fromEvent(board, mouseEvents.mousedown),
  fromEvent(board, mouseEvents.touchstart)
    .pipeThrough(map(event => touchToMouse(event, mouseEvents.mousedown)))
])
  .pipeThrough(switchMap(function () {
    return merge([
      fromEvent(board, mouseEvents.mousemove),
      fromEvent(board, mouseEvents.touchmove)
        .pipeThrough(map(event => touchToMouse(event, mouseEvents.mousemove)))
    ])
    .pipeThrough(takeUntil(merge([
      fromEvent(board, mouseEvents.mouseup),
      fromEvent(board, mouseEvents.mouseleave),
      fromEvent(board, mouseEvents.touchend)
        .pipeThrough(map(event => touchToMouse(event, mouseEvents.mouseup)))
    ])))
  }))
  .pipeThrough(map(function ([mouseDown, mouseMove]) {
    this._lastPosition = this._lastPosition ?? mouseDown
    const [from, to] = [this._lastPosition, mouseMove]
      .map(item => getMousePosition(board, item))
    this._lastPosition = mouseMove.type === mouseEvents.mouseup ? null : mouseMove
    return { from, to }
  }))
  .pipeTo(new WritableStream({
    write ({ from, to }) {
      store.set({ color: strokeStyle.value, from, to, width: Number(lineWidth.value) })
      drawOnBoard(from, to)
    }
  }))