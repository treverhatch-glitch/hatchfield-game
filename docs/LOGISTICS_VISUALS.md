# Hatchfield: Logistics Visuals (Manor Lords techniques → airport)
Sources: Manor Lords Official Wiki pages
- Storehouse: https://wiki.hoodedhorse.com/Manor_Lords/Storehouse
- Granary: https://wiki.hoodedhorse.com/Manor_Lords/Granary
- Buildings: https://wiki.hoodedhorse.com/Manor_Lords/Buildings
- Buildings (en): https://wiki.hoodedhorse.com/Manor_Lords/Buildings/en
- Logging camp: https://wiki.hoodedhorse.com/Manor_Lords/Logging_camp
- Hitching post: https://wiki.hoodedhorse.com/Manor_Lords/Hitching_post

Guides:
- Eurogamer: https://www.eurogamer.net/how-to-move-supplies-in-manor-lords
- GameRant: https://gamerant.com/manor-lords-how-move-supplies-storehouse-granary/

## Part 1: What Manor Lords does (sourced)
1. **Oxen drag the heavy goods.** People cannot carry timber; an ox must move it from the logging camp to building sites and sawpits. A worker has to fetch the ox and guide it. A family assigned to a hitching post becomes a dedicated ox guide, so other workers don't lose time fetching one. An ox can also be assigned permanently to a camp. (Logging camp, Hitching post)
2. **Carrying by hand vs handcart.** With no storehouse workers, production workers carry surplus 1 item per trip and stop producing while they do it. Storehouse and granary workers carry 10 per trip in handcarts, on roads. (GameRant, Storehouse)
3. **Storage buildings.**
   - Storehouse: 250 general goods, upgrades to 2,500; 3 to 6 families; 2 to 6 carts.
   - Granary: 500 food, upgrades to 2,500; reduces spoilage.
   - Workers collect from other buildings' local stores all the time, but slowly. (Storehouse, Granary)
4. **Loose piles and weather.** Goods left in outdoor piles can spoil in the rain, and storage workers bring them inside. (Storehouse; Eurogamer)
5. **Construction delivery.** Unassigned people level the building site, oxen bring the timber, and people carry the other materials. (Buildings)
6. **Consumption at market and homes.** Storage workers set up market stalls (20 resources per stall) that supply the burgage plots (homes). Supply versus demand drives Approval. Placing the market near storage shortens trips. (Buildings/en; Eurogamer)
7. **Trade animals.** Mules carry 20 goods per trip between regions; the trading post can order horses. (Buildings/en)
8. **Visible stockpiles and stacks.** Goods are said to appear as physical piles and stacks, but no source above describes how the stacks look, so treat it as **unverified detail**.

## Part 2: Airport mapping
Difficulty: E = easy, M = medium, H = hard (browser, Three.js, with an AI coder).

| Manor Lords technique | Airport equivalent | Three.js implementation | Diff |
|---|---|---|---|
| Ox drags heavy goods; needs a guide | Tug + baggage dolly train or ULD dollies, which need a driver. No driver means the cart waits at the bag hall. | Tug = 1 mesh; dollies = InstancedMesh following the tug's path with an offset (store the last N positions in a ring buffer). Driver = agent assigned to the tug. | M |
| Hand-carry 1 vs cart 10 | Passengers carry their own carry-on; handlers hand-load bulk holds at about 1 bag per trip; belt loader or ULD = many | Passenger carry-on = child mesh on the passenger. Loading animation = bag cube lerping from belt to hold door, one per trip, every 1.5 s. | E |
| Storehouse / granary capacity and upgrade | Bag hall (make-up area), cargo shed (ULD racks), catering unit, fuel farm, retail stockroom | Building has `stock`, `cap` and `level`; upgrading changes the cap and the rack mesh. | E |
| Visible stacks | Bag piles at make-up, ULDs on racks, catering trolleys, fuel tank level, shop shelves | Stack meshes: an InstancedMesh with `count = min(stock, maxVisible)`, placed on a precomputed slot grid (layers x rows). Change `mesh.count`; don't create objects. Fuel = scale a cylinder's Y. | E |
| Outdoor piles spoil in rain | Bags left on the apron in rain get wet (passenger Happiness hit); late cold-chain cargo spoils | `exposedSec` timer on the pile; a tint shift plus an icon when it passes the limit. | M |
| Construction delivery (ox brings timber, people bring the rest) | Optional for later: building a stand needs a concrete truck (parked; BOM is a non-goal) | Skip for now. | H |
| Market stalls feed homes | Retail stock: a stock cart from landside storage refills shops and food; empty shelves mean no spend and a Happiness hit | Shop `stock`; a stock-runner agent travels storeroom → shop; shelf instance count = stock. | M |
| Workers walking to work | Handlers, cleaners and security walk from the staff room to their post at shift change | Same agent system as passengers, with a role colour. | E |
| Dedicated guide speeds logistics | A dedicated tug driver per stand (an upgrade) | A flag that skips the fetch-driver step. | E |
| Mules: 20 per trip between regions | City cargo trucks (BUILD slice 2): truck gate → cargo shed | A truck agent on the road spline, with dwell to unload. | M |
| Passengers as goods | Passengers ARE the flow: jet → bus/jetway → claim | Bus = vehicle with `load`; boarding = passengers lerp to the door; the passenger hides once inside. | M |
| Catering | Catering hi-lift truck: catering unit → stand → raises the box → swaps trolleys → returns | The truck body moves its Y up during dwell; trolley InstancedMesh count goes down on the truck and up on the plane. | M |
| Fuel | Fuel bowser from fuel farm to stand; the hose appears during dwell; farm level drops | Tank Y-scale; a hose line (Line or cylinder) shown during dwell; the cost posts on done. | E |

## Core state machine (all movers)
`idle → travelTo(pickup) → dwell(load, t) → travelTo(dropoff) → dwell(unload, t) → done → idle`

```ts
type Job = { from: NodeId; to: NodeId; qty: number; loadSec: number; unloadSec: number; onDone: () => void };
type Mover = {
  state: 'idle' | 'toPickup' | 'loading' | 'toDrop' | 'unloading';
  path: Vec3[]; t: number; cargo: number; job?: Job;
};
```

- Transfer goods one unit at a time during dwell (`qty` per `loadSec / qty`), so stacks drain and fill visibly. This is the Manor Lords load/unload law.
- Cash and Standing post only in `onDone` ("money equals picture").
- If there's no path or no driver, the mover goes to `blocked` and shows an icon above itself. Never fail silently (Airport CEO's top complaint).

## Performance tips
- One InstancedMesh per prop type: bags, ULDs, passengers, trolleys. Update `instanceMatrix` only for movers that changed; set `mesh.count` for stacks.
- Run the sim at a fixed 10 Hz and interpolate in the renderer. Pathfind only when a job is assigned (capped search); cache routes between nodes.
- Above the agent cap, aggregate: show one bag cube for every 5 bags, and simulate distant passengers without rendering them.
- Hide the Hall interior when in Apron view (layers or visibility).
- Avoid per-frame allocations; reuse Matrix4/Vector3 objects.
- Autosave in idle time via a structured clone, so it doesn't hitch (Manor Lords players complain of autosave stutter).

## Build order suggestion
Visible stacks (E) → bag dolly train with load/unload (M) → fuel bowser (E) → catering hi-lift (M) → retail stock runner (M) → rain exposure (M).
