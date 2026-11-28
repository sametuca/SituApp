// Bankların iki kişilik kapasitesini ve sunucudaki yer kontrolünü doğrular.
import assert from 'node:assert/strict'
import test from 'node:test'
import together from '../server/features/together.js'
import { SEATS } from '../src/world/layout.js'

test('city benches have two distinct seats', () => {
  const benches = SEATS.filter((seat) => seat.kind === 'bench')
  assert.ok(benches.length > 0)
  for (const bench of benches) {
    assert.equal(bench.slots.length, 2, bench.id)
    assert.notDeepEqual(bench.slots[0], bench.slots[1], bench.id)
  }
})

test('a full bench rejects a third player and frees a seat when someone leaves', () => {
  const bench = SEATS.find((seat) => seat.kind === 'bench')
  const messages = []
  const players = new Map()
  const ctx = {
    players,
    send: (ws, message) => messages.push({ ws, message }),
    broadcast: () => {},
    dist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
    features: [{ api: { blockedPair: () => false, reach: () => null } }],
  }
  const feature = together(ctx)
  const makePlayer = (id) => {
    const player = { id, ws: { id }, room: 'city', name: id, avatar: 'zeynep', x: bench.x, z: bench.z }
    players.set(id, player)
    return player
  }
  const first = makePlayer('first')
  const second = makePlayer('second')
  const third = makePlayer('third')

  feature.handlers.sit(first, { seat: bench.id, slot: 0 })
  feature.handlers.sit(second, { seat: bench.id, slot: 1 })
  assert.equal(first.pose.slot, 0)
  assert.equal(second.pose.slot, 1)

  feature.handlers.sit(third, { seat: bench.id, slot: 0 })
  assert.equal(third.pose, undefined)
  assert.ok(messages.some(({ ws, message }) => ws === third.ws && message.t === 'info' && message.text.includes('Boş yer yok')))

  third.lastSit = 0
  feature.handlers.sit(third, { seat: bench.id, slot: 2 })
  assert.equal(third.pose, undefined)

  feature.onLeave(first)
  third.lastSit = 0
  feature.handlers.sit(third, { seat: bench.id, slot: 0 })
  assert.equal(third.pose.slot, 0)
  assert.equal(second.pose.slot, 1)
})
