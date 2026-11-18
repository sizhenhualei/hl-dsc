/**
 * 老版本 Android System WebView（如 Chrome 79~109）的轻量运行时垫片，
 * 避免 Object.hasOwn / Array.at / toSorted / toReversed / MediaQueryList.addEventListener 缺失导致白屏。
 */
const objectWithHasOwn = Object as typeof Object & {
  hasOwn?: (target: object, key: PropertyKey) => boolean
}

if (typeof objectWithHasOwn.hasOwn !== 'function') {
  objectWithHasOwn.hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)
}

if (typeof Array.prototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    value(this: unknown[], index: number) {
      const len = this.length >>> 0
      const rel = Math.trunc(index) || 0
      const k = rel >= 0 ? rel : len + rel
      return k >= 0 && k < len ? this[k] : undefined
    },
    configurable: true,
    writable: true,
  })
}

if (typeof String.prototype.at !== 'function') {
  Object.defineProperty(String.prototype, 'at', {
    value(this: string, index: number) {
      const str = String(this)
      const len = str.length
      const rel = Math.trunc(index) || 0
      const k = rel >= 0 ? rel : len + rel
      return k >= 0 && k < len ? str.charAt(k) : undefined
    },
    configurable: true,
    writable: true,
  })
}

if (typeof Array.prototype.toSorted !== 'function') {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value(this: unknown[], compareFn?: (a: unknown, b: unknown) => number) {
      return [...this].sort(compareFn)
    },
    configurable: true,
    writable: true,
  })
}

if (typeof Array.prototype.toReversed !== 'function') {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value(this: unknown[]) {
      return [...this].reverse()
    },
    configurable: true,
    writable: true,
  })
}

type PromiseWithResolvers = typeof Promise & {
  withResolvers?: <T>() => {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: unknown) => void
  }
}

const promiseWithResolvers = Promise as PromiseWithResolvers
if (typeof promiseWithResolvers.withResolvers !== 'function') {
  promiseWithResolvers.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

const urlWithParse = URL as typeof URL & {
  parse?: (url: string, base?: string) => URL | null
}

if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof urlWithParse.parse !== 'function') {
  urlWithParse.parse = (url, base) => {
    try {
      return base ? new URL(url, base) : new URL(url)
    } catch {
      return null
    }
  }
}

if (typeof window !== 'undefined' && typeof MediaQueryList !== 'undefined') {
  const proto = MediaQueryList.prototype as MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent) => void) => void
    removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
  }
  if (typeof proto.addEventListener !== 'function' && typeof proto.addListener === 'function') {
    proto.addEventListener = function (
      _type: string,
      listener: EventListenerOrEventListenerObject | null
    ) {
      if (typeof listener === 'function') {
        this.addListener(listener as (event: MediaQueryListEvent) => void)
      }
    }
  }
  if (
    typeof proto.removeEventListener !== 'function' &&
    typeof proto.removeListener === 'function'
  ) {
    proto.removeEventListener = function (
      _type: string,
      listener: EventListenerOrEventListenerObject | null
    ) {
      if (typeof listener === 'function') {
        this.removeListener(listener as (event: MediaQueryListEvent) => void)
      }
    }
  }
}
