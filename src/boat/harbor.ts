import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LAKE, lakeJetty } from '../land/lake'
import { planMarina } from '../land/marina-plan'
import type { Land } from '../land/plan'
import type { WorldCtx } from '../world/blocks'
import { Boat } from './boat'
import { BoatModels } from './boat-model'
import { buildMarina } from './marina'
import { setNavNight } from './nav-lights'
import { Wake } from './wake'
import { offshoreCurrent } from '../sea/offshore'

type WaterQuery = (x: number, z: number) => number | null

/** The marina's docks, every boat at its mooring, and the wake the driven one leaves. */
export function buildHarbor(ctx: WorldCtx, land: Land, water: WaterQuery) {
  const plan = planMarina(land)
  const setMarinaNight = buildMarina(ctx, land, plan)
  const setJettyNight = buildMarina(ctx, land, lakeJetty(LAKE))
  const models = new BoatModels()
  const current = offshoreCurrent(land.frame.coast)
  const boats = plan.boats.map((spot) => {
    const boat = new Boat(ctx.physics, models.make(), spot, water, current)
    ctx.scene.add(boat.visual.root)
    return boat
  })
  return {
    boats,
    dock: plan.dock,
    wake: new Wake(ctx.scene, water),
    /** 0 by day to 1 at night: lights the dock lamps. */
    setNight: (night: number) => {
      setMarinaNight(night)
      setJettyNight(night)
      setNavNight(night)
    },
    /** Fetches the boat model; call after the first frame, like the car bodies. */
    upgrade: (load: (url: string) => Promise<GLTF>) => models.load(load),
  }
}

export type Harbor = ReturnType<typeof buildHarbor>
