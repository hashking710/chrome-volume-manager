import { describe, expect, it, vi } from 'vitest'
import { createLatestValueQueue } from '../src/latest-value-queue'

function deferred () {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

describe('createLatestValueQueue', () => {
  it('applies the latest value after an in-flight update and settles every caller', async () => {
    const firstUpdate = deferred()
    const applied: number[] = []
    const idle = vi.fn()
    const queue = createLatestValueQueue<number>(async value => {
      applied.push(value)
      if (value === 1) {
        await firstUpdate.promise
      }
    }, idle)

    const first = queue.enqueue(1)
    const second = queue.enqueue(2)
    const third = queue.enqueue(3)

    expect(applied).toEqual([1])
    firstUpdate.resolve()
    await Promise.all([first, second, third])

    expect(applied).toEqual([1, 3])
    expect(idle).toHaveBeenCalledOnce()
  })

  it('rejects waiters for a failed batch and still applies the next value', async () => {
    const applied: number[] = []
    const queue = createLatestValueQueue<number>(async value => {
      applied.push(value)
      if (value === 1) {
        throw new Error('update failed')
      }
    })

    await expect(queue.enqueue(1)).rejects.toThrow('update failed')
    await expect(queue.enqueue(2)).resolves.toBeUndefined()

    expect(applied).toEqual([1, 2])
  })
})
