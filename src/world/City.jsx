// Şehir çizimi (birleştirici): zemin dokuları, yollar ve alt bileşenlerin (bina/deniz/süs) yerleşimi.
import { BEACH, BUILDINGS, GAP, ISLAND, PLAZA_R, PROPS, RIM, RING, ROAD_END, ROAD_HALF, ROAD_START, TOWELS } from './layout'
import Prop, { InstancedPropGroup } from './Prop'
import Plants from './Plants'
import TownDetails from './TownDetails'
import BeachParty from './BeachParty'
import TurkishFlags from './TurkishFlags'
import { RoadCurbs, RoadDetails, RoadMarkings } from './RoadInfrastructure'
import { Flat, Ring, TexRing } from './CityGround'
import { Y } from './cityShared'
import { Building } from './CityBuildings'
import { ClubMusicNotes, FountainFx, Gazebo, SkyBalloon, SpeedRings, Sun, Towel, ToyClouds } from './CityDecor'
import { BeachPier, Buoys, Pond, Sea } from './CitySea'
// PROPS ve BLANKETS'i model adına göre grupla (≥ 2 örnek → InstancedPropGroup, tekil → Prop)
const { INSTANCED_PROPS, SINGLE_PROPS } = (() => {
  const byModel = new Map()
  const all = PROPS
  for (const p of all) {
    let arr = byModel.get(p.model)
    if (!arr) {
      arr = []
      byModel.set(p.model, arr)
    }
    arr.push(p)
  }
  const inst = []
  const single = []
  for (const [model, items] of byModel) {
    if (items.length >= 2) inst.push({ model, items })
    else single.push(items[0])
  }
  return { INSTANCED_PROPS: inst, SINGLE_PROPS: single }
})()

export default function City({ focusRef }) {
  const road = ROAD_HALF * 2
  const W = ISLAND.x1 - ISLAND.x0
  const D = ISLAND.z1 - ISLAND.z0
  const cx = (ISLAND.x0 + ISLAND.x1) / 2
  const cz = (ISLAND.z0 + ISLAND.z1) / 2
  const swW = road + 2.8
  const nsN = { len: -ROAD_START - ROAD_END.north, cz: (-ROAD_START + ROAD_END.north) / 2 } // kuzey kolu
  const nsS = { len: ROAD_END.south - ROAD_START, cz: (ROAD_END.south + ROAD_START) / 2 } // güney kolu (plaja)
  const ewE = { len: ROAD_END.east - ROAD_START, cx: (ROAD_END.east + ROAD_START) / 2 } // doğu kolu
  return (
    <group>
      <Sun focusRef={focusRef} />
      <ClubMusicNotes />
      <ToyClouds />
      <FountainFx />
      <SkyBalloon />
      <SpeedRings />
      <BeachPier />
      <BeachParty />
      <TurkishFlags />
      <TownDetails focusRef={focusRef} />

      {/* zemin ve mahalle zeminleri */}
      <Sea />
      <Buoys />
      <Flat x={cx} z={cz} w={W} d={D} y={0} tex="grass" /> {/* ada */}
      {/* kıyı kumu: adanın dört kenarında */}
      <Flat x={cx} z={ISLAND.z0 - RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={cx} z={ISLAND.z1 + RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x0 - RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x1 + RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Pond x={-30 - GAP} z={30 + GAP} r={7} />
      <Flat x={0} z={-34.3} w={28} d={34.6} y={Y.floor} tex="cobble" color="#fff3ea" feather={3} /> {/* kafe: sıcak kaldırım taşı */}
      <Flat x={34.3} z={0} w={34.6} d={28} y={Y.floor} tex="cobble" color="#e3d6ff" feather={3} /> {/* kulüp */}
      <Flat x={BEACH.x} z={BEACH.z} round={BEACH.r + 4} y={Y.floor} tex="sand" feather={6} /> {/* yuvarlak plaj: yumuşak kenarlı */}
      <Flat x={BEACH.x} z={BEACH.z} round={BEACH.r - 2} y={Y.floor + 0.004} tex="sand" color="#fff6dc" feather={5} />
      
      <Pond x={-42.5} z={-12.5} r={4.2} />

      {/* kaldırım + yollar */}
      <Flat x={0} z={nsN.cz} w={swW} d={nsN.len} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={0} z={nsS.cz} w={swW} d={nsS.len} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={ewE.cx} z={0} w={ewE.len} d={swW} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <TexRing r0={PLAZA_R - 0.8} r1={RING.r0} y={Y.sidewalk + 0.004} tex="cobble" color="#fdf6ff" />
      <TexRing r0={RING.r1} r1={RING.r1 + RING.side} y={Y.sidewalk + 0.004} tex="cobble" color="#fdf6ff" />
      <Flat x={-25} z={0} w={12} d={3.4} y={Y.sidewalk} tex="cobble" color="#fff8f0" /> {/* park patikası: lobiden çardağa */}
      <Flat x={0} z={nsN.cz} w={road} d={nsN.len} y={Y.road} tex="asphalt" />
      <Flat x={0} z={nsS.cz} w={road} d={nsS.len} y={Y.road} tex="asphalt" />
      <Flat x={ewE.cx} z={0} w={ewE.len} d={road} y={Y.road} tex="asphalt" />
      <TexRing r0={RING.r0} r1={RING.r1} y={Y.road + 0.006} tex="asphalt" />
      <RoadMarkings />
      <RoadCurbs />
      <RoadDetails />

      {/* lobi meydanı */}
      <Flat round={PLAZA_R} y={Y.plaza} tex="cobble" color="#fff7ee" />
      <Ring r0={12.2} r1={13.1} y={Y.mark} color="#ffebd3" />
      <Flat round={6.3} y={Y.mark} color="#ffebd3" />
      <Gazebo />

      {BUILDINGS.filter((b) => !b.gazebo).map((b, i) => (
        <Building key={i} b={b} i={i} focusRef={focusRef} />
      ))}
      {INSTANCED_PROPS.map((g) => (
        <InstancedPropGroup key={g.model} model={g.model} items={g.items} />
      ))}
      {SINGLE_PROPS.map((p, i) => (
        <Prop key={i} {...p} />
      ))}
      <Plants />
      {TOWELS.map((t, i) => (
        <Towel key={i} t={t} />
      ))}
    </group>
  )
}

