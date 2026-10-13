# Hatchfield: Airline Diplomacy V2 (APPROVED)
Status: research-backed redesign of AIRLINE_DIPLOMACY.md (v1). **APPROVED** by the owner on Oct 13, 2026; ready to build. Decisions in §16 override any conflicting text.
Tags: **[S]** sourced (URL in §17), **[U]** unverified/inferred, **[H]** Hatchfield original. All numbers are balance suggestions.

---
## 0. What changed from v1
- Standing math rebuilt on **two layers**: a slow *performance* score (Airport CEO-style) plus decaying *event* modifiers (CK3/Victoria 3-style), instead of one number.
- Proposals cost **money** (owner decision: no Clout currency); a third response besides yes/no ("Counter", like AT3 renegotiate) everywhere.
- Demands now generated from **airline interests** (Victoria 3 lobby demands: +3 met / −5 timeout pattern), not a flat pool.
- Real-world layer: **incentive deals, slot rights (80/20), base/hub status, fee disputes** (Ryanair–Aena 2025) drive churn plausibly.
- Departures go through a **"Capacity Cut" stage** before full exit (real airlines cut seats first).
- Re-signing returns at **one level below** previous, not reset (Airport CEO forum proposal).
- Pacing table per tier, a 2-hour walkthrough, and explicit failure modes.

---
## 1. Research digest (what we take, what we avoid)
| Source | Mechanic [S] | Take | Avoid |
|---|---|---|---|
| **Civ VII** | Relationship tiers Hostile < −60, Unfriendly −60..−20, Neutral ±20, Friendly 20..60, Helpful > 60; Helpful enables Alliance. Actions cost Influence; target can Accept (free), Support (pays, both gain more, +12 rel), Reject (pays double back). Endeavors ~15 turns, Accept +5 / Support +12. Sanctions −30 rel for 10 turns. Modifiers reset each Age into one toned-down carry-over. | 5 named bands; Accept/Support/Reject on airline proposals; periodic "era reset" at tier-up to stop ancient grudges; Sanction-lite (fee penalty) | Pure transactional feel, unexplained modifiers, "snowball" where hostility is unrecoverable (wiki itself says recovery from Hostile is extremely difficult) |
| **Victoria 3** | Interest-group approval capped ±20; traits switch on at +5/+10, malus at −5, Angry at −10. Clout = zero-sum share of power; Powerful (>20%) doubles traits, Marginalized (<4–5%) disables them. Lobby appeasement ±10 decays to 0; lobby demand met +3, timeout −5. Law-change approval effect decays over 5 years. | Airlines as "interest groups" of your airport: **Share** (traffic share) = clout; big-share airlines' moods matter double; demands derived from interests; approval effects decay | Opaque math walls |
| **Airport CEO** | Master contract (framework, no expiry) → airline proposes flights; 1–5★ flights need more services; per-flight evaluation (pax, bags, delay; 1 h grace) sets satisfaction; low satisfaction → may cancel master contract; high → raises base prices & higher-star flights. Players complained they "can't see why" rating drops; autoplanner "doom loop" when too many contracts per stand. | Per-turnaround evaluation; star-gated flight offers; better standing = better prices | Hidden reasons; doom loops from slot shortage |
| **Airport Tycoon 3** | Master Business Contract (signing bonus) → per-plane Flight Contracts (auto-renew) → HUB Contracts after years of good terms + maintenance level 3. Accept/Reject/Renegotiate with line-item ticks; success depends on experience, facilities, reputation. Admin building reveals **one** blocking reason per airline at a time. Reviews: "tedious", Metacritic 46. | 3-step contract ladder ending in Hub; line-item renegotiation | One-reason-at-a-time drip; tedium |
| **CK3** | Opinion = sum of itemised modifiers; modifiers can decay monthly toward 0; Hooks (favor hook ~10 yrs; strong vs weak) force or ease requests; personality traits + compatibility. | Itemised breakdown, decaying modifiers, **Favours = weak hooks**, **Leverage = strong hook** (rare) | Overwhelming modifier lists (cap visible lines at ~6 + "more") |
| **Football Manager** | Board/agent **promises** with deadlines; agents dislike unrequested promises; failed negotiations damage relationship; community repeatedly reports promise-breach sackings that feel buggy/unfair. | Promises as explicit cards with progress bars; agent-style "what they asked for" highlighted | Ambiguous success criteria (FM bug reports show the pain) |
| **Real world** | US airport incentive programs: published, non-discriminatory, fee waivers/marketing for new routes, ~up to 2 yrs new destination / 1 yr new entrant (FAA policy). CPH Hub Incentive: ≥2 daily departures year-round. IATA WASG slots: keep series if ≥80% used; non-use excused for weather/strikes. Ryanair 2025: exited Valladolid/Jerez, closed Santiago base, cut 1M+ seats after Aena 6.5% fee rise; airport said "others will take its place". Lounge access via commercial agreements. | Incentive Deals, Slot Series + 80% rule, Hub tier, fee-rise reactions, capacity-cut-before-exit, public spat events, replacement narrative | Legal minutiae |

---
## 2. Core loop [H]
1. **Prospect** – airline appears as a card (letter from the left). Shows needs/wants and what it *proposes* (flights/week, fee offer, star level).
2. **Negotiate** – Accept / Counter (line-item, AT3-style, costs money and has a success chance shown as a %) / Decline.
3. **Operate** – every turnaround is graded A–F (on-time w/ 60-min grace [S ACEO], bag time, pax mood, stand fit). Grades feed Performance.
4. **Relate** – events, proposals and demands shift Standing; spend money on Endeavors (e.g. joint marketing) or Incentive Deals.
5. **Grow or shrink** – airline adds flights, upgrades star level, asks for **Base** then **Hub** status; or cuts capacity, then threatens exit.
6. **Churn** – departures open slots; a newcomer competes for them. Loop repeats at a higher tier.

The player's *one* question each session: "Who do I prioritise with my stands and money this year?"

---
## 3. Standing math
**Standing S ∈ [−100, +100]**, displayed as 5 bands (Civ VII cut points [S], renamed):
| Band | Range | Effect |
|---|---|---|
| Hostile | < −60 | Capacity Cut active; exit countdown possible |
| Cold | −60..−20 | No new flights; demands sharper |
| Neutral | −20..+20 | Normal |
| Warm | +20..+60 | +flights offered, +1★ offers, price +5% |
| Partner | > +60 | Perks, Base/Hub eligible (one Hub airline at a time), Alliance-style mutual favours |

Hysteresis: lose a band only 5 points past its edge.

**S = P + ΣM + T**
- **P – Performance** (range −40..+40): exponential moving average of turnaround grades, half-life 30 game-days. A=+40, B=+20, C=0, D=−20, F=−40. Excused delays (weather/ATC events) count as C, mirroring WASG force-majeure [S]. Moves slowly → readable.
- **M – Event modifiers**: each has value, label, source, and decay (linear to 0 over its duration; CK3 `monthly_change` style [S]). Visible list capped at 6 biggest + "N more".
  - Signed rival −10 (12 mo) · Signed ally +5 (12 mo) · Demand met +15 (18 mo) · Demand timeout −10 (12 mo) [scaled from Vic3 +3/−5 ratio] · Endeavor accepted +5, supported +12 (Civ VII [S], 12 mo) · Fee rise −3 per 1% (12 mo) · Incident on their flight −20 (24 mo) · First-meet tone −5..+8 (24 mo).
  - Same-type modifiers stack with diminishing returns: 2nd ×0.5, 3rd ×0.25.
- **T – Trait bias**: static −10..+10 from key figure traits vs your airport (e.g. Green likes solar coverage %).
- **Share multiplier** (Victoria 3 clout analogue): airlines with >20% of your traffic are **Major**: their band effects (good and bad) ×1.5 and they get one extra demand slot. <5% are **Minor**: no demands, no perks.
- **Tier-up "era reset"** (Civ VII [S]): when your Field Level crosses a tier, all M collapse into one carry-over modifier = 30% of their sum, 24 mo decay. Stops 10-year grudges.

Clamp final S. Tooltip formula is shown literally: "Performance +18 · Modifiers −7 · Traits +4 = +15 Neutral".

---
## 4. Currencies [H]
- **Money** (decision 14, no Clout currency): Counter offers, Endeavors, Incentive Deals and mediation cost cash, scaled by airline tier.
- **Favours** (CK3 weak hook): an airline owes you one after you accept a costly ask (night diversion, fee freeze). Spend to extend a deadline +50%, waive one timeout, or make them accept a Counter. Cap 3 per airline, expire 5 yrs [S CK3 favor hook ~10 yrs, halved].
- **Leverage** (strong hook, rare): only from exclusivity (you are their only Base in region) or slot dominance. Lets you refuse a demand at no cost once. [U real-world analogue: airport monopoly power, cf. Aena dispute.]

---
## 5. How demands are generated
Each airline has 3 **Interests** weighted from its business model + traits (Vic3 ideology analogue [S/H]):
`Cost` · `Punctuality` · `Premium` · `Capacity` · `Green` · `Family` · `Prestige` · `Cargo`.

Every 30 days per Major/Normal airline:
1. Compute **pressure** per interest = weight × gap (how far the airport is from the interest's target metric, e.g. Premium → lounge seats per premium pax).
2. If max pressure > threshold and demand caps allow (≤1 open per airline; ≤3 global; ≤1 new per 60 days globally), issue a demand for that interest.
3. Pick the concrete ask from the interest's template list, sized to tier and current airport (never ask for something not yet unlockable — FM lesson: clear, achievable criteria).
4. Deadline 60–180 days scaled by build cost; reward = +15 S + (perk | price rise | more flights); penalty = −10 S. Hardball trait ×1.5 both ways.
5. Rivals roll **Back / Oppose / Ignore** and show it on the card before you decide (v1, kept).

Responses: **Accept** · **Counter** (lighter version or longer deadline; money or Favour) · **Decline politely** (−4 now, no timeout) · **Ignore** (timeout −10).

Template examples:
| Interest | T1–2 asks | T3–5 asks |
|---|---|---|
| Cost | No fee rise this year | Incentive Deal: 20% landing discount for new route 12 mo [S FAA] |
| Punctuality | On-time ≥85% 30 d | Dedicated stand pair; ≥90% 60 d |
| Premium | Café at gate | Branded lounge (lounge agreement [S]) |
| Capacity | +1 stand | Guaranteed slot series at peak; widebody stand |
| Green | Electric tug | Solar canopy; SAF tank farm [U] |
| Family | Play corner | Family security lane |
| Prestige | Livery on billboard | Exclusive pier, Hub status ceremony |
| Cargo | Night slot | Cold-chain room |

Real-world-style **airline-initiated proposals** (not demands; Civ VII Endeavor analogue): "Base proposal: we'll station 2 aircraft overnight if you give 15% off for 2 years." Accept/Support/Reject.

---
## 6. Rival reactions
- Rivalries generated from **overlapping interests + same passenger type + same tier** (direct competitors) and trait incompatibility (v1 table kept).
- Triggers: signing a rival (−10), giving rival a perk/exclusive (−6), giving rival peak slots you took from them (−12), rival gets Hub (−15 to all same-tier rivals unless allied).
- **Alliances** (T4–5): 2–3 airlines; meeting one member's demand gives +4 to others; a member exit makes others −8 "Partner left".
- **Public spat event** [S Ryanair–Aena]: if a Major airline hits Cold after a fee rise, it issues a press statement: −2 Reputation/month until resolved; rivals may *publicly offer* to take its slots (+opportunity). A rival **airport** (tycoon hook) can be the one poaching airlines. Player can respond: concede (cut fee), hold firm (Leverage check), or court a rival.
- Rival preview always on the sign/perk button.

---
## 7. Roster churn & replacements
Departure is staged (real airlines cut capacity before leaving [S Ryanair]):
1. **Cold warning** letter (S < −20 for 30 d).
2. **Capacity Cut** (S < −60 or Hostile 30 d): −30% flights, slots freed into "Available" pool. Rescue still possible.
3. **Exit notice**: 45-day countdown, shows top 2 causes with "Show me".
4. **Exit**: flights end at season boundary; card to "Former partners".
- Re-entry after ≥2 game-years, starts at **one band below** its last band before exit (ACEO forum proposal [S], adjusted). Player-initiated cancellation: allowed; re-entry one band below current. Cancelling before the contract term ends costs an early-termination fee plus a credit and favour loss with that airline.
- **Hostile actions:** airlines in the Hostile band can sue (legal-fee events) or take actions that make the airport run less smoothly (late slot changes, refused gates, slowed turnarounds).
- **Slot series** [S WASG] (**optional toggle**, off by default): an airline keeps its peak slots each season if ≥80% used; if it drops below, slots return to you — a soft, non-hostile churn source.
- **Replacement**: 30–90 days after a slot pool opens, 1–2 newcomer letters. Generator (v1 kept: name pools, blocklist vs real airlines, livery, seeded RNG) plus:
  - Must differ from the leaver on ≥1 of passenger type / interest top-1 / fleet family.
  - Newcomer arrives with an **Incentive ask** (new-entrant discount, ≤1 yr [S FAA]) — accepting is the cheap way to fill slots fast.
  - Narrative line referencing the gap: "We hear Meridian's slots are free."
- Tier floor: always ≥2 prospects per unlocked tier.
- Global churn cap: ≤1 airline in Exit stage at a time; ≤2 exits per game-year (pauses others' countdown, v1 rule kept).

---
## 8. Key figures (special airlines)
- Only T3+, ~50% of airlines; T1–2 are logo-only contacts.
- Fields: name, title, portrait seed, 2 traits, 1 **Agenda** (Civ VII leader agenda analogue: e.g. "Wants to be the biggest at every field it flies to" → hates any rival with higher Share), **voice style**, **memory**: 3 remembered events quoted back in letters ("You kept your word on the lounge.").
- **Succession** [S FM chairperson-takeover anecdote; CK3 succession]: every 4–8 game-years a key figure may retire; the successor keeps 50% of Standing modifiers and rolls 1 new trait. Spoken in a letter. Gives late-game freshness.
- Personality must surface every interaction (Civ VII review lesson [S]): every letter has 1 trait-flavoured line; every modifier names its cause.

---
## 9. First-meet scene (T3+ key figures)
- Triggered on first contact; auto-pause (option).
- Portrait + 2–3 line greeting from traits/agenda; **"What they've heard"** line summarising your Reputation and one fact (e.g. on-time %).
- 3 choices (v1 Formal / Warm / Bold kept) + 4th **"Show them around"**: camera tours your terminal for 6 s; score = how well current airport matches their top interest (−5..+10). Showcases the 3D game and rewards building for them.
- Bold pitch creates a **Promise** card (FM-style) with progress bar and deadline; broken = −15, kept = +10.
- Outcome summary toast: "Isabella: +6 (Formal, Punctual liked it)".

---
## 10. Perks (Partner band unless noted)
| Perk | Source | Effect |
|---|---|---|
| Price uplift | ACEO [S] | +5% Warm, +10% Partner on fees |
| Higher-★ flights | ACEO [S] | unlock next star tier of offers |
| **Base** | Real [S] | airline parks 1–3 aircraft overnight: guaranteed early departures, +staff jobs, needs hangar/stand |
| **Hub contract** | AT3 [S] / CPH [S] | needs ≥2 daily departures year-round + maintenance level; big Share boost, transfer pax, but rivals −15 |
| Branded lounge | Real [S] | airline co-funds 50% of a lounge; exclusive item |
| Marketing push | FAA incentives [S] | +demand on their routes 6 mo |
| Favour | CK3 [S] | 1 free Favour per year |
| Vouch | [H] | mediates for you with an ally (+5) |
Perks revoke when dropping below Warm−5 (hysteresis).

---
## 11. Recovery paths
1. **Fix the cause**: top 2 negative lines have "Show me" (camera jump). Performance P recovers on its own in ~1–2 months once fixed.
2. **Apology package**: fee discount 90 d, +8 (2nd in a year +4, no 3rd) — OpenTTD anti-exploit lesson (v1).
3. **Endeavor**: spend money on a joint project (e.g. "Route launch party") +5/+12.
4. **Incentive Deal**: published discount scheme applies to *all* airlines in a tier (non-discriminatory, like FAA policy [S]) — fixes many at once but costs revenue; neat trade-off.
5. **Mediation** by a Partner ally (+5, costs a mediation fee).
6. **Counter at Exit notice**: last-chance Counter with +20% success if you spend a Favour.
7. **Era reset** at tier-up (§3).
8. **Early safety**: T1 airlines can't drop below Cold in the first 2 game-years.

---
## 12. Pacing per tier (5 tiers × 3–4 airlines)
| Tier | Unlock (Field Level) | Airlines | Contact type | Systems introduced | Expected session time |
|---|---|---|---|---|---|
| T1 Regional | FL1 | 3 (Northline, Puddle Air, Coastal Hop) | Logo + letter | Accept/Decline, turnaround grades, Standing bar only (bands, no modifiers list) | 0–20 min |
| T2 Low-cost | FL3 | 3–4 (SkyPenny, Zoomjet, Budgie Air) | Logo + letter | Fee sensitivity (Cost interest), simple demands, rival −2 hints, Slot series | 20–50 min |
| T3 Full-service | FL5 | 3–4 (Meridian★, Atlas Blue, Verdant★) | First key figures | First-meet, full modifier breakdown, rivals, paid Counter, Favours | 50–90 min |
| T4 Long-haul | FL7 | 3–4 (SkyGlass★, Orient Crown★, Southern Cross) | Key figures + alliances | Alliances, Base status, Capacity Cut/Exit, Public spats, Incentive Deals | 90–150 min |
| T5 Flag/Hub | FL9 | 3 (Royal Aurum★, Global One★, Aurora Pacific) | Key figures, succession | Hub contracts, Leverage, succession, yearly awards | 150 min+ |
Cargo ladder mirrors this with key figures from T3 (v1).
Rule: each tier introduces ≤2 new concepts, taught by its first letter.

---
## 13. UI touchpoints (must obey the UI redesign rules: slim bar, one panel at a time, never block the field)
- **Letters** slide in from the left, max 3 stacked, compact (≤280 px wide), auto-collapse to a badge after 8 s.
- **Airlines panel** (bottom-bar icon + hotkey `L`): single compact side panel; tier tabs; cards with livery strip, band chip, Share %, trend arrow.
- **Card detail**: formula line (§3), top 6 modifiers with fade bars, needs ✓/✗ + Show me, interests, open demand/promise, rivals/allies mini-graph, history.
- **Sign/perk buttons** show rival preview.
- **In-world**: airline-coloured stand markers; Partner airlines get a small flag on their stands; Capacity Cut shows empty stands greyed — the diplomacy is *visible on the field*.
- **Yearly report** page: Standing chart per airline, exits/arrivals.
- Accessibility: band = colour + icon + word.

---
## 14. Failure modes to avoid
1. **Opaque drops** (ACEO forum "we can't improve if we don't know why" [S]; Civ VII AESA review [S]) → formula tooltip + named modifiers.
2. **Doom loops** (ACEO autoplanner [S]; Civ VII snowball [S]) → sign button warns "Stands at 95%: risk of delays"; era reset; early safety floor.
3. **Tedium / drip-feed** (AT3 one-reason admin building, reviews [S]) → all blocking reasons listed at once.
4. **Transactional, faceless** (Civ VII reviews [S]) → trait lines, memory, first-meet tour.
5. **Ambiguous promises** (FM bug threads [S]) → every promise/demand has a numeric progress bar and exact criterion.
6. **Notification spam** → caps in §5/§7.
7. **Exploits** (OpenTTD trees [S, v1]) → diminishing returns everywhere.
8. **Unwinnable choices**: never two Major airlines with mutually exclusive demands open at once [H].
9. **UI blocking the field** → owner's hard rule; diplomacy UI is compact and dismissable.
10. **Real-name lawsuits** → blocklist real airline names/logos; real events inspire, never named.

---
## 15. Sample 2-hour walkthrough [H]
- **0:00** Starter kit. Letter: *Northline* (T1, goose logo) proposes 6 turboprop flights/week, Accept. First landing at 0:04. Turnaround grade B; Standing chip "Neutral +8".
- **0:12** *Puddle Air* letter. Single-stand field — sign button warns "Stands at 100%". I build a second stand first, then sign. 
- **0:22** FL3 → T2. *SkyPenny* (Cost interest) and *Zoomjet* arrive; Zoomjet's card shows "Rival: SkyPenny". I sign SkyPenny; Zoomjet −2 hint. Security queues spike, grades drop to D; card says "Performance −12: Security queue 14 min · Show me". Second lane built at 0:30; P recovers by 0:38.
- **0:42** First demand: SkyPenny "No fee rise this year" (60 d). I Accept — it costs me future revenue; SkyPenny now owes me a Favour.
- **0:50** FL5 → T3. Gold letter: **Isabella Okafor, Meridian** (Punctual, Proud; agenda "Never second at any field"). I choose *Show them around*: my on-time 93% → +8. Signed at +14.
- **1:05** *Verdant Air* (Tomas Lind, Green · Lavish) proposes more flights at +15% fees. Preview: "Meridian −10 (rival), −6 more (Proud: shared pier)". I sign; Meridian drops to −2.
- **1:12** Verdant demand: solar canopy, 150 d, Meridian *Opposes*. Short on cash, I pay for a Counter → 220 d.
- **1:25** Storm: 3 diversions. Excused as weather (graded C), so Meridian's P barely moves — the tooltip says why. 
- **1:30** I raise landing fees 5% for cash. SkyPenny (Cost, Major 24% share) goes Cold: **public spat** — "Hatchfield's greedy fees". Reputation −2/mo. Zoomjet publicly offers to take SkyPenny's peak slots. Choice: concede, or court Zoomjet. I court Zoomjet (sign more flights), SkyPenny triggers **Capacity Cut** (−30%).
- **1:38** Solar canopy done: Verdant +15, now Partner → branded lounge co-funding perk. Meridian −5 for compliance, hits Cold. Exit-free for now.
- **1:45** FL7 → T4, **era reset**: all modifiers collapse to 30%; Meridian back to Neutral −8. SkyGlass★ and Orient Crown★ appear, an alliance "Orbit" with Verdant. Verdant vouches for me (+5 with SkyGlass).
- **1:52** SkyPenny's slot series fell under 80%; its peak slots revert to me. Newcomer letter: *Coral Pacificline* (Amara Reyes, Showman · Family-minded), asking a 1-year new-entrant incentive. Accept — my empty stands fill.
- **2:00** Status: 7 airlines, 1 Partner, 1 Capacity Cut, first Base proposal from Verdant on the table. I'm deciding whether a Hub for Verdant is worth Meridian's fury — the exact kind of question the system should leave me with.

---
## 16. Decisions (Oct 13)
13. **Standing scale:** −100..+100. Hostile airlines can sue or take actions that make the airport run less smoothly.
14. **Currency:** actions cost money; no Clout currency.
15. **Drama:** public spats and a rival airport that poaches airlines are both in.
16. **Succession:** keep key-figure succession.
17. **Cancellation:** the player can cancel an airline; cancelling before the contract term ends costs a fee plus a credit and favour loss.
18. **Exit timing:** exits happen at season end.
19. **Portraits:** 2D illustrated cards for now.
20. **Hub:** one hub airline for now.
21. **80% slot rule:** optional toggle.
22. **Names:** airline names stay as placeholders.

---
## 17. Sources
- Civ VII diplomacy/relationship tiers, actions, Endeavor +5/+12, Sanction −30, Age reset: https://civilization.fandom.com/wiki/Relationship_(Civ7)
- Civ VII overview/reviews (from v1): https://www.gamesradar.com/games/strategy/civilization-7-diplomacy/ · https://www.pcgamer.com/games/strategy/civilization-7-review/ · https://www.tomsguide.com/gaming/civilization-vii-review · https://www.aesa.org.au/popular/review-of-civilization-7.html
- Victoria 3 interest groups (approval ±20, trait thresholds, clout bands, 5-yr decay): https://vic3.paradoxwikis.com/index.php?title=Interest_Groups · https://www.thegamer.com/victoria-3-interest-groups-political-parties-approval-bolster-suppression-clout-traits-ideaologies/
- Victoria 3 lobbies & demands (+3/−5, appeasement ±10): https://vic3.paradoxwikis.com/Political_lobby
- Victoria 3 plays/obligations (v1): https://vic3.paradoxwikis.com/Diplomatic_plays · https://vic3.paradoxwikis.com/Obligations
- Airport CEO contracts & satisfaction: https://www.airportceo.com/post/dev-blog-97-alpha-24-deployed-airline-livery-modding-enabled-steam-cloud-saves-enabled-and-the-future-of-the-airline-contract-system · https://forum.apoglabs.com/t/airport-ceo-alpha-24-3-released/6444 · https://forum.apoglabs.com/t/individual-airline-satisfaction/17692 · https://forum.apoglabs.com/t/airline-contracts-2-5/14734 (player proposal, not shipped)
- Airport Tycoon 3: https://gamefaqs.gamespot.com/pc/917833-airport-tycoon-3/faqs/62508 · https://www.ign.com/articles/2003/02/25/airport-tycoon-walkthroughfaq-381852 · https://en.wikipedia.org/wiki/Airport_Tycoon_3 · manual (AT1, renegotiate ticks): https://oldgamesdownload.com/wp-content/uploads/manuals/airport-tycoon_win_manual_en_6zv.pdf
- CK3 opinion & hooks: https://ck3.paradoxwikis.com/Hook · https://github.com/jesec/ck3-modding-wiki/blob/HEAD/wiki_pages/Commands.md
- Football Manager promises: https://community.sports-interactive.com/forums/topic/589115-player-promises/ · https://community.sports-interactive.com/forums/topic/589555-board-promise-bug-query/ · https://community.sports-interactive.com/bugtracker/previous-versions/football-manager-2024-early-access-bugs-tracker/all-other-issues/broken-promise-system-play-youth-r23468/
- Incentives: https://www.federalregister.gov/documents/2023/12/07/2023-26809/faa-policy-regarding-air-carrier-incentive-program · https://dwuconsulting.com/dwu-ai/air-service-incentive-programs-airport-finance · CPH hub incentive: https://www.cph.dk/4ab33a/globalassets/9.-cph-business/5.-aviation/charges-and-slot/incentives%202024/hub%20incentive%202024%20final.pdf
- Slots (80/20, force majeure): https://www.iata.org/en/programs/ops-infra/slots/slot-guidelines/ · https://aci.aero/wp-content/uploads/2025/06/WASG-Edition-4-1.pdf
- Airline pull-outs: https://www.reuters.com/sustainability/boards-policy-regulation/ryanair-cuts-capacity-spain-after-airport-fee-hike-move-operator-calls-blackmail-2025-09-03/ · https://inspain.news/ryanair-withdraws-from-valladolid-and-jerez-airports-amid-dispute-over-costs/ · https://www.independent.co.uk/travel/news-and-advice/ryanair-spain-airport-flights-seats-cut-b2819852.html · https://corporate.ryanair.com/news/ryanair-cuts-1-2m-seats-for-s26-from-regional-spain-closes-all-asturias-flights-as-govt-fails-to-stop-aena-monopoly-fee-rises-or-bustinduys-illegal-bag-fines/

### Unverified / caveats
- Sources were read as search snippets and wiki pages; I didn't open the full PDFs (WASG, FAA). The figures 80%, 1 yr and 2 yr come from those snippets. [U-partial]
- I didn't fetch the CK3 favour-hook duration of about 10 years from the wiki page itself; it comes from search synthesis. [U]
- The Airport CEO 1-hour grace period is from the Alpha 24.3 notes and may have changed since. [U]
- The "Contracts 2.5" forum post (re-sign one level below) is a player proposal, not a shipped feature. [S as proposal]
- Leverage-as-monopoly, the SAF tank, and successor carry-over are design inventions. [H/U]
- I found no source for how Airport Tycoon 3 handles airlines leaving. [U]
