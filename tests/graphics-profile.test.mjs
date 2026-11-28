// Mobil çözünürlük denetiminin performans ve görünürlük sınırlarını doğrular.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAdaptiveDpr } from '../src/world/performanceProfile.js'

function runFrames(sample, fps, seconds) {
  const changes = []
  for (let i = 0; i < fps * seconds; i++) {
    const next = sample(1 / fps, true)
    if (next != null) changes.push(next)
  }
  return changes
}

test('stable mobile frame rate raises resolution in bounded steps', () => {
  const sample = createAdaptiveDpr(1, 1.25)
  assert.deepEqual(runFrames(sample, 60, 16), [1.125, 1.25])
  assert.deepEqual(runFrames(createAdaptiveDpr(1, 1), 60, 6), [])
  assert.deepEqual(runFrames(createAdaptiveDpr(1, 1.25), 54, 15), [])
})

test('a substantial regression is detected even above 50 fps', () => {
  const sample = createAdaptiveDpr(1.25, 1.5)
  assert.deepEqual(runFrames(sample, 120, 7), [1.375])
  assert.deepEqual(runFrames(sample, 100, 7), [1.25])
})

test('low frame rate keeps the original resolution and a regression reverses an upgrade', () => {
  const sample = createAdaptiveDpr(1, 1.25)
  assert.deepEqual(runFrames(sample, 40, 6), [])
  assert.deepEqual(runFrames(sample, 60, 7), [1.125])
  assert.deepEqual(runFrames(sample, 45, 7), [1])
  assert.deepEqual(runFrames(sample, 60, 16), [])
})

test('hidden and suspended frames cannot count as a stable measurement', () => {
  const sample = createAdaptiveDpr(1, 1.25)
  assert.deepEqual(runFrames(sample, 60, 4), [])
  assert.equal(sample(0.016, false), null)
  assert.deepEqual(runFrames(sample, 60, 4), [])
  assert.equal(sample(2, true), null)
  assert.deepEqual(runFrames(sample, 60, 4), [])
  assert.deepEqual(runFrames(sample, 60, 3), [1.125])
})
