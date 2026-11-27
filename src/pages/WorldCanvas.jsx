// Dünya 3B sahnesi (R3F Canvas): ışık/ortam, şehir/ev/mekân, oyuncular, NPC'ler, özellik katmanları, kamera ve izleyiciler.
// World.jsx'ten ayrıldı; tüm durum World.jsx'te kalır, buraya yalnızca prop olarak gelir.
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { NeutralToneMapping, PCFSoftShadowMap } from 'three'
import City from '../world/City'
import HomeRoom from '../world/HomeRoom'
import Venue from '../world/Venue'
import { VENUE_ROOM } from '../world/venues'
import { FurnitureLayer } from '../world/HomeEditor'
import TogetherScene from '../world/features/TogetherScene'
import Sky from '../world/Sky'
import { AirportTutorialScene } from '../world/AirportTutorial'
import { IntroCutsceneCamera } from '../world/IntroCutscene'
import LocalPlayer, { ClickToMoveGround } from '../world/LocalPlayer'
import RemotePlayers, { GuideNpc, SelfTag } from '../world/RemotePlayers'
import { HOME_DOOR, HOME_ROOM, HOME_ZONE, resolveCollisions, resolveRoom } from '../world/layout'
import GraphicsEffects from '../world/GraphicsEffects'
import { DoorWatcher, SceneReady, VenueDoorWatcher, WorldErrorBoundary, ZoneWatcher } from './WorldLoading'
import { GUIDE_TIPS } from './worldConfig'

export default function WorldCanvas({ chatTargetRef, controlsRef, editing, feat, finishIntro, focusRef, furnColliders, graphics, home, inTutorial, introActive, isOwnHome, joystickRef, lookJoystickRef, moveTargetRef, name, net, onSceneReady, roomTier, say, sceneBase, selected, setChatTarget, setFurn, setHelp, setInteractId, setNearDoor, setNearGuide, setNearVenue, setPanel, setSelected, setTutNear, setZone, shownItems, slug, start, touch, tutStep, venue, venueCollide, venueDim, venueTh, venueZone }) {
  return (
    <WorldErrorBoundary>
    <Canvas
      shadows={graphics.shadows ? PCFSoftShadowMap : false}
      dpr={graphics.lowPower ? graphics.dpr : (touch ? [1, 1.25] : graphics.dpr)}
      gl={{ powerPreference: graphics.lowPower ? 'default' : 'high-performance', antialias: graphics.antialias, toneMapping: NeutralToneMapping, toneMappingExposure: 1.02 }}
      camera={{ fov: 55, near: 0.3, far: 300, position: [start.x, 6.4, start.z + 9.4] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          say('⚠️ Grafik bağlantısı kesildi, sahne toparlanıyor…')
        })
      }}
    >
      <color attach="background" args={[sceneBase.bg]} />
      <fog attach="fog" args={sceneBase.fog} />
      {/* Tek karede üretilen hafif PBR ışık haritası (IBL): tüm kil/plastik/cam/su yüzeylerine modern yansıma ve derinlik katar */}
      {!graphics.lowPower && (
        <Environment resolution={128} frames={1} environmentIntensity={home || venue ? 0.36 : 0.42}>
          <Lightformer form="ring" intensity={1.8} color="#fff6e0" position={[10, 14, 8]} scale={14} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.4} color="#bfe8ff" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[26, 26, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#ffe0c2" position={[-12, 4, -8]} scale={[14, 8, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.75} color="#ffe8d6" position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[24, 24, 1]} />
        </Environment>
      )}
      <Sky home={Boolean(home)} interior={venueTh ? { bg: venueTh.bg, fog: sceneBase.fog, dim: venueDim } : null} focusRef={focusRef} />

      <TogetherScene home={Boolean(home || venue)} />
      <Suspense fallback={null}>
        {venue ? (
          <Venue id={venue} />
        ) : home ? (
          <HomeRoom
            key={`room-${roomTier}`}
            tier={roomTier}
            ownerName={home.ownerName}
            decor={feat.homeDecor}
            garden={feat.garden}
            landTier={feat.landTier}
            isOwnHome={isOwnHome}
            onPlotClick={feat.onPlotClick}
            onOpenHomeUpgrade={() => setPanel('housing')}
            onOpenLand={feat.onOpenLand}
          >
            <FurnitureLayer items={shownItems} setItems={setFurn} editing={editing && isOwnHome} selected={selected} setSelected={setSelected} controlsRef={controlsRef} />
          </HomeRoom>
        ) : (
          <City focusRef={focusRef} />
        )}
        <ClickToMoveGround moveTargetRef={moveTargetRef} disabled={introActive} />
        <LocalPlayer
          slug={slug}
          start={start}
          focusRef={focusRef}
          controlsRef={controlsRef}
          joystickRef={joystickRef}
          lookJoystickRef={lookJoystickRef}
          moveTargetRef={moveTargetRef}
          onMove={net.sendMove}
          camOffset={[6.4, 9.4]}
          locked={introActive}
          collide={venue ? venueCollide : home ? (x, z) => resolveRoom(x, z, furnColliders) : resolveCollisions}
        >
          <SelfTag name={name} bubbles={net.bubbles} selfId={net.selfId} reactions={net.reactions} />
        </LocalPlayer>
        <SceneReady onReady={onSceneReady} />
      </Suspense>
      {/* Geri kalan her katman kendi yükleme bölgesinde: model gelmeyi beklerken şehir/oyuncu çizilmeye devam eder */}
      <Suspense fallback={null}>
        <RemotePlayers roster={net.roster} remotes={net.remotes} bubbles={net.bubbles} reactions={net.reactions} whispering={net.whispering} touch={touch} onPick={(id) => { setChatTarget(null); chatTargetRef.current = null; setInteractId(id) }} />
      </Suspense>
      {!home && !venue && (
        <Suspense fallback={null}>
          <GuideNpc focusRef={focusRef} tips={GUIDE_TIPS} onOpen={() => setHelp(true)} onNear={setNearGuide} />
        </Suspense>
      )}
      {feat.sceneNodes}
      {feat.worldEffects}
      {inTutorial && <AirportTutorialScene step={tutStep} focusRef={focusRef} onNear={setTutNear} />}
      <IntroCutsceneCamera active={introActive} focusRef={focusRef} controlsRef={controlsRef} camOffset={[6.4, 9.4]} onDone={finishIntro} />

      <ZoneWatcher key={home ? 'home' : venue ? `v-${venue}` : 'city'} focusRef={focusRef} onChange={setZone} fixed={home ? HOME_ZONE : venueZone} />
      <DoorWatcher key={`door-${home ? `home${roomTier}` : venue ? 'venue' : 'city'}`} focusRef={focusRef} door={home ? HOME_ROOM.exit : venue ? VENUE_ROOM.exit : HOME_DOOR} onChange={setNearDoor} />
      {!home && !venue && <VenueDoorWatcher focusRef={focusRef} onChange={setNearVenue} />}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!introActive}
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={touch ? 0.85 : 1}
        target={[start.x, 0.8, start.z]}
        minDistance={3.5}
        maxDistance={home ? 10 : 11}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
      />
      <GraphicsEffects ao={graphics.ao} bloom={graphics.bloom} />
    </Canvas>
    </WorldErrorBoundary>
  )
}
