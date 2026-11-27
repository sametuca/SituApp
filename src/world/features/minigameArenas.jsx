// Mini oyun arenaları: her oyun kendi dosyasında, buradan yeniden dışa aktarılır.

import { lazy } from 'react'

export const RhythmArena = lazy(() => import('./RhythmArena').then((m) => ({ default: m.RhythmArena })))
export const ColorTilesArena = lazy(() => import('./ColorTilesArena').then((m) => ({ default: m.ColorTilesArena })))
export const BaristaArena = lazy(() => import('./BaristaArena').then((m) => ({ default: m.BaristaArena })))
export const BikeSprintArena = lazy(() => import('./BikeSprintArena').then((m) => ({ default: m.BikeSprintArena })))
export const BalloonPopArena = lazy(() => import('./BalloonPopArena').then((m) => ({ default: m.BalloonPopArena })))
