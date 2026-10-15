# Research pace — 90-day headless

Careful, Greedy, and Chaotic each ran 90 sim days on this branch (standard difficulty, passenger focus, sandbox off). One day is 180 sim seconds. The driver uses the player command API at 5×, tick dt 0.25s, and looks at the board every 12 sim seconds. Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`.

The Growth tree is the only research wallet. Operations trickle, finished flights, and lab rooms pay into it. Unspent points stop at twice the next node's cost (twice the dearest node once the tree is owned). The catalog has 62 nodes.

| Persona | Day 15 nodes | Day 15 unspent | Day 30 nodes | Day 30 unspent | Day 60 nodes | Day 60 unspent | Day 90 nodes | Day 90 unspent | Tree complete | Lab at day 90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Careful | 15 | 76 | 30 | 88 | 51 | 84 | 62 | 275 | day 85 | 1 desk, 1 board, 1 bench, 0 researchers |
| Greedy expander | 24 | 64 | 40 | 71 | 57 | 45 | 62 | 324 | day 74 | 1 desk, 1 board, 1 bench, 0 researchers |
| Chaotic random clicker | 25 | 43 | 46 | 15 | 62 | 324 | 62 | 324 | day 53 | 10 desk, 2 board, 4 bench, 0 researchers |

Unspent is whole Growth-tree points still in the wallet. Nodes are Growth-tree nodes owned that day.

**Careful** ended day 90 with 62 tree nodes and 275 unspent points (1 desks, 1 boards, 1 benches).
**Greedy expander** ended day 90 with 62 tree nodes and 324 unspent points (1 desks, 1 boards, 1 benches).
**Chaotic random clicker** ended day 90 with 62 tree nodes and 324 unspent points (10 desks, 2 boards, 4 benches).
