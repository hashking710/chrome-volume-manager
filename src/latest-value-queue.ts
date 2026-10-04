interface Waiter {
  resolve: () => void,
  reject: (error: unknown) => void
}

interface Batch<T> {
  value: T,
  waiters: Waiter[]
}

export interface LatestValueQueue<T> {
  enqueue: (value: T) => Promise<void>
}

export function createLatestValueQueue<T> (
  apply: (value: T) => Promise<void>,
  onIdle: () => void = () => {}
): LatestValueQueue<T> {
  let running = false
  let pending: Batch<T> | undefined

  async function drain () {
    while (pending) {
      const batch = pending
      pending = undefined

      try {
        await apply(batch.value)
        batch.waiters.forEach(waiter => waiter.resolve())
      } catch (error) {
        batch.waiters.forEach(waiter => waiter.reject(error))
      }
    }

    running = false
    onIdle()
  }

  return {
    enqueue (value) {
      const result = new Promise<void>((resolve, reject) => {
        if (pending) {
          pending.value = value
          pending.waiters.push({ resolve, reject })
        } else {
          pending = { value, waiters: [{ resolve, reject }] }
        }
      })

      if (!running) {
        running = true
        void drain()
      }

      return result
    }
  }
}
