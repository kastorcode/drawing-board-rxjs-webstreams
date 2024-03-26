/**
 * @param {EventTarget} target 
 * @param {string} eventName 
 * @returns {ReadableStream}
 */
export function fromEvent (target, eventName) {
  let _listener
  return new ReadableStream({
    start (controller) {
      _listener = event => controller.enqueue(event)
      target.addEventListener(eventName, _listener)
    },
    cancel () {
      target.removeEventListener(eventName, _listener)
    }
  })
}


/**
 * @param {number} milliseconds 
 * @returns {ReadableStream}
 */
export function interval (milliseconds) {
  let _intervalId
  return new ReadableStream({
    start (controller) {
      _intervalId = setInterval(() => {
        controller.enqueue(Date.now())
      }, milliseconds)
    },
    cancel () {
      clearInterval(_intervalId)
    }
  })
}


/**
 * @param {Function} callback 
 * @returns {TransformStream}
 */
export function map (callback) {
  return new TransformStream({
    transform (chunk, controller) {
      controller.enqueue(callback.bind(callback)(chunk))
    }
  })
}


/**
 * @typedef {ReadableStream | TransformStream} Stream 
 * @param {Stream[]} streams 
 * @returns {ReadableStream}
 */
export function merge (streams) {
  return new ReadableStream({
    async start (controller) {
      /**
       * @param {ReadableStreamDefaultReader} reader 
       * @returns {Promise<void>}
       */
      async function read (reader) {
        const { value, done } = await reader.read()
        if (done || !controller.desiredSize) return
        controller.enqueue(value)
        return read(reader)
      }
      for (const stream of streams) {
        const reader = (stream.readable || stream).getReader()
        read(reader)
      }
    }
  })
}


/**
 * @typedef {function() : ReadableStream | TransformStream} StreamFunction
 * @param {StreamFunction} callback 
 * @param {object} options 
 * @param {boolean} options.pairwise
 * @returns {TransformStream}
 */
export function switchMap (callback, options = { pairwise: true }) {
  return new TransformStream({
    transform (chunk, controller) {
      const stream = callback.bind(callback)(chunk)
      const reader = (stream.readable || stream).getReader()
      async function read () {
        const { value, done } = await reader.read()
        if (done) return
        const result = options.pairwise ? [chunk, value] : value
        controller.enqueue(result)
        return read()
      }
      return read()
    }
  })
}


/**
 * @param {ReadableStream | TransformStream} stream 
 * @returns {TransformStream}
 */
export function takeUntil (stream) {
  /**
   * @param {TransformStreamDefaultController<any>} controller 
   */
  async function readAndTerminate (controller) {
    const reader = (stream.readable || stream).getReader()
    const { value } = await reader.read()
    controller.enqueue(value)
    controller.terminate()
  }
  return new TransformStream({
    start (controller) {
      readAndTerminate(controller)
    },
    transform (chunk, controller) {
      controller.enqueue(chunk)
    }
  })
}