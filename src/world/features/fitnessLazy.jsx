import { lazy } from 'react'

export const WeightWorkoutModal = lazy(() => import('./WorkoutModals').then((m) => ({ default: m.WeightWorkoutModal })))
export const CardioWorkoutModal = lazy(() => import('./WorkoutModals').then((m) => ({ default: m.CardioWorkoutModal })))
export const BoxingArena = lazy(() => import('./BoxingArena').then((m) => ({ default: m.BoxingArena })))
