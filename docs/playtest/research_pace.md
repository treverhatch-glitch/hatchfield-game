# Research pace — 90-day headless

Measured on `1fc1927` (15 Oct 2026). Headway is 48s. These three runs sign the Apex term and do not hire.

Careful, Greedy, and Chaotic each ran 90 sim days on the tip policy (standard difficulty, passenger focus, sandbox off). They sign Apex Local, they do not build a second strip, and they hire no researchers. The live bot policy that adds a strip and one researcher is measured separately. One day is 180 sim seconds. The driver uses the player command API at 5×, tick dt 0.25s, and looks at the board every 12 sim seconds. Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`.

The Growth tree is the only research wallet. Operations trickle, finished flights, and lab rooms pay into it. Unspent points stop at twice the next node's cost (twice the dearest node once the tree is owned). The catalog has 62 nodes.

| Persona | Day 15 nodes | Day 15 unspent | Day 30 nodes | Day 30 unspent | Day 60 nodes | Day 60 unspent | Day 90 nodes | Day 90 unspent | Tree complete | Lab at day 90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Careful | 15 | 52 | 30 | 90 | 51 | 82 | 62 | 269 | day 86 | 1 desk, 1 board, 1 bench, 0 researchers |
| Greedy expander | 24 | 34 | 40 | 39 | 56 | 113 | 62 | 324 | day 75 | 1 desk, 1 board, 1 bench, 0 researchers |
| Chaotic random clicker | 25 | 56 | 47 | 33 | 62 | 324 | 62 | 324 | day 51 | 15 desk, 19 board, 17 bench, 0 researchers |

Unspent is whole Growth-tree points still in the wallet. Nodes are Growth-tree nodes owned that day.

**Careful** ended day 90 with 62 tree nodes and 269 unspent points (1 desks, 1 boards, 1 benches).
**Greedy expander** ended day 90 with 62 tree nodes and 324 unspent points (1 desks, 1 boards, 1 benches).
**Chaotic random clicker** ended day 90 with 62 tree nodes and 324 unspent points (15 desks, 19 boards, 17 benches).
