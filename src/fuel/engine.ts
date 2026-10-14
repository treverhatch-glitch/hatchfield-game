import { FuelOutageMonitor } from '../catering/fuelOutage.ts'
import { FUEL } from './config.ts'
import { deliveryPath } from './path.ts'
import type { DeliveryRead, DockRead, FuelOrder, FuelView, FuelWatch } from './types.ts'

function usable(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

function emptyView(): FuelView {
  return {
    capacityLitres: 0,
    litres: 0,
    daysCover: Number.POSITIVE_INFINITY,
    queue: [],
    truckDrawPerMin: 0,
    hydrantDrawPerMin: 0,
    groundedIds: [],
    roadVehPerMin: 0,
    paid: 0,
    delivered: 0,
    dock: null,
    path: [],
    farm: null,
    wholesalePerLitre: 0,
  }
}

const DOCK: DockRead = { farm: 'farm_fill', truck: 'truck_fill' }

/**
 * Tankers or a pipeline bring fuel along the public road. Apron trucks and the
 * hydrant draw it back out. An empty reservation grounds the departure until a
 * delivery refills the tank. Prices come from the caller.
 */
export class FuelChain {
  private monitor = new FuelOutageMonitor()
  private now = 0
  private elapsed = 0
  private docking = false
  private dockLeft = 0
  private view: FuelView = emptyView()

  reset(): void {
    this.monitor = new FuelOutageMonitor()
    this.now = 0
    this.elapsed = 0
    this.docking = false
    this.dockLeft = 0
    this.view = emptyView()
  }

  snapshot(): FuelView {
    return this.view
  }

  /** Applies draw and a delivery to the stock. The headless outage test drives this. */
  tick(minutes: number, input: FuelOrder): FuelView {
    const dt = Math.max(0, minutes)
    const cap = usable(input.capacityLitres)
    let litres = Math.min(usable(input.litres), cap)
    const truck = usable(input.truckDrawPerMin)
    const hydrant = usable(input.hydrantDrawPerMin)
    const drawn = Math.min(litres, (truck + hydrant) * dt)
    litres -= drawn

    const route = deliveryPath(input.roads, input.farms, input.connectors)
    const roadOpen = route.path.length > 0
    let paid = 0
    let delivered = 0
    const queue: DeliveryRead[] = []
    let roadVeh = 0
    let dock: DockRead | null = null
    const price = usable(input.wholesalePerLitre)

    if (input.mode === 'pipeline') {
      const perMin = usable(input.pipelinePerMin)
      if (roadOpen && perMin > 0) {
        const room = Math.max(0, cap - litres)
        const flow = Math.min(room, perMin * dt)
        const bill = flow * price
        const waiting = flow > 0 && bill > input.cash + 1e-6
        if (!waiting && flow > 0) {
          litres += flow
          paid += bill
          delivered += flow
        }
        queue.push({
          id: 'pipeline',
          mode: 'pipeline',
          litres: perMin * 60,
          progress: 1,
          state: waiting ? 'wait_cash' : 'dock',
          docked: !waiting,
        })
        if (!waiting) {
          roadVeh = FUEL.pipelineVehPerMin
          dock = DOCK
        }
      }
    } else if (roadOpen && usable(input.tankerLitres) > 0 && usable(input.leadMinutes) > 0 && litres < cap - 1) {
      const lead = input.leadMinutes
      const loadLitres = input.tankerLitres
      if (!this.docking) this.elapsed += dt
      if (!this.docking && this.elapsed + 1e-6 < lead) {
        queue.push({
          id: 'tanker',
          mode: 'tanker',
          litres: loadLitres,
          progress: Math.max(0, Math.min(1, this.elapsed / lead)),
          state: 'road',
          docked: false,
        })
        roadVeh = FUEL.tankerVehPerMin
      } else {
        if (!this.docking) {
          this.docking = true
          this.dockLeft = FUEL.dockMinutes
        }
        this.dockLeft -= dt
        if (this.dockLeft > 0) {
          queue.push({
            id: 'tanker',
            mode: 'tanker',
            litres: loadLitres,
            progress: 1,
            state: 'dock',
            docked: true,
          })
          dock = DOCK
        } else {
          const room = Math.max(0, cap - litres)
          const load = Math.min(room, loadLitres)
          const bill = load * price
          if (load > 0 && bill > input.cash + 1e-6) {
            queue.push({
              id: 'tanker',
              mode: 'tanker',
              litres: load,
              progress: 1,
              state: 'wait_cash',
              docked: true,
            })
            dock = DOCK
            this.dockLeft = 0
          } else {
            litres += load
            paid += bill
            delivered += load
            this.elapsed = 0
            this.docking = false
            this.dockLeft = 0
          }
        }
      }
    }

    this.now += dt
    this.judge(litres, input.flights)
    this.view = this.pack(input, litres, cap, queue, roadVeh, dock, route, paid, delivered, truck, hydrant)
    return this.view
  }

  /**
   * Reads the tank the economy already updated. A delivery that tickFuel
   * accepted shows up here as a dock, and the inbound tanker loads the road.
   */
  observe(input: FuelWatch): FuelView {
    const cap = usable(input.capacityLitres)
    const litres = Math.min(usable(input.litres), cap)
    const truck = usable(input.truckDrawPerMin)
    const hydrant = usable(input.hydrantDrawPerMin)
    const route = deliveryPath(input.roads, input.farms, input.connectors)
    const roadOpen = route.path.length > 0
    const dt = Math.max(0, input.minutes)
    const queue: DeliveryRead[] = []
    let roadVeh = 0
    let dock: DockRead | null = null

    if (input.justDelivered) {
      this.docking = true
      this.dockLeft = FUEL.dockMinutes
    }
    if (this.docking) {
      this.dockLeft -= dt
      if (this.dockLeft > 0) {
        queue.push({
          id: 'tanker-dock',
          mode: 'tanker',
          litres: usable(input.tankerLitres),
          progress: 1,
          state: 'dock',
          docked: true,
        })
        dock = DOCK
      } else {
        this.docking = false
        this.dockLeft = 0
      }
    }

    if (input.mode === 'pipeline' && input.pipelineFlowing && roadOpen) {
      queue.push({
        id: 'pipeline',
        mode: 'pipeline',
        litres: usable(input.pipelinePerMin) * 60,
        progress: 1,
        state: 'dock',
        docked: true,
      })
      roadVeh = FUEL.pipelineVehPerMin
      dock = DOCK
    } else if (
      input.mode === 'tanker' &&
      roadOpen &&
      usable(input.leadMinutes) > 0 &&
      input.roadMinutes > 0.25 &&
      input.roadMinutes + 0.25 < input.leadMinutes &&
      litres < cap - 1
    ) {
      queue.unshift({
        id: 'tanker',
        mode: 'tanker',
        litres: usable(input.tankerLitres),
        progress: Math.max(0, Math.min(1, input.roadMinutes / input.leadMinutes)),
        state: 'road',
        docked: false,
      })
      roadVeh = FUEL.tankerVehPerMin
    }

    this.now += dt
    this.judge(litres, input.flights)
    this.view = this.pack(input, litres, cap, queue, roadVeh, dock, route, 0, 0, truck, hydrant)
    return this.view
  }

  private judge(litres: number, flights: FuelOrder['flights']): void {
    const live = new Set(flights.map((flight) => flight.id))
    for (const id of [...this.monitor.grounded]) {
      if (!live.has(id)) this.monitor.grounded.delete(id)
    }
    this.monitor.evaluate(
      this.now,
      litres,
      flights.map((flight) => ({ flightId: flight.id, litres: flight.litres, departAt: flight.departAt })),
    )
  }

  private pack(
    input: FuelOrder,
    litres: number,
    cap: number,
    queue: DeliveryRead[],
    roadVeh: number,
    dock: DockRead | null,
    route: { path: FuelView['path']; farm: FuelView['farm'] },
    paid: number,
    delivered: number,
    truck: number,
    hydrant: number,
  ): FuelView {
    const drawPerMin = truck + hydrant
    return {
      capacityLitres: cap,
      litres,
      daysCover: drawPerMin > 0 ? litres / (drawPerMin * FUEL.minutesPerDay) : Number.POSITIVE_INFINITY,
      queue,
      truckDrawPerMin: truck,
      hydrantDrawPerMin: hydrant,
      groundedIds: [...this.monitor.grounded],
      roadVehPerMin: roadVeh,
      paid,
      delivered,
      dock,
      path: route.path,
      farm: route.farm,
      wholesalePerLitre: usable(input.wholesalePerLitre),
    }
  }
}
