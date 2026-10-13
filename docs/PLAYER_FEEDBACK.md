# Hatchfield: Player Feedback Research (comparable games)
Researched Oct 13, 2026. Scores and themes come from the cited pages. Quotes are copied word for word. Anything I could not confirm is marked **unverified**.

## Airport Tycoon 3 (2003)
- **Rating:** critic reception was poor. A search summary said Metacritic shows 5.5/10, "Generally Unfavorable" (**unverified**: I did not open the page; check https://www.metacritic.com/game/airport-tycoon-3/).
- **Liked:** you build the whole airport from an empty plot. Shops, casinos and hotels come in through contracts, and you pick real cities with different weather and traffic (https://www.mobygames.com/game/30248/airport-tycoon-3/). Custom terminal interiors and Retail Area contracts (https://www.cheatbook.de/files/airporttycoon3.htm).
- **Complaints:** a search summary attributed these to reviews: IGN called it irritating, monotonous and poorly documented, with a frustrating economy; GameSpot called it mediocre, with bad pacing and weak execution (**unverified**: I did not open these reviews).
- Design limits: max 4 terminals, and terminals can't simply be demolished (cheatbook link above).

## Airport CEO (Apog Labs, 2021)
- **Rating:** Steam Very Positive, 82% of 4,695 English reviews (https://store.steampowered.com/app/673610/Airport_CEO/). Steambase gives 83/100 from 8,368 total reviews (https://steambase.io/games/airport-ceo/reviews).
- **Liked:** the "fun, addictive gameplay loop" is the most praised point in a 103-review sample (79 of 103) (https://steamcozy.com/games/airport-ceo.html). Players also like the deep, detailed management and custom building with drawn queues.
- **Complaints** (from SteamStat's automatic summary of 120 reviews, https://steamstat.io/app/673610):
  - Late-game performance and stutter: 45 of 120.
  - Pathfinding: passengers, staff and vehicles get stuck: 42 of 120.
  - No updates since late 2023: 28 of 120.
  - Poor tutorial: 24 of 120.
- SteamCozy found 20 of 103 reviews naming pathfinding and baggage bugs. Quote: "There's an insane amount of bugs, especially with the pathfinding for passengers and vehicles."
- Indowhiz: steep learning curve, slows down with more passengers, crashes, and one road cut-off can stall service vehicles like catering airport-wide (https://www.indowhiz.com/articles/en/airport-ceo-pc-review/).

## Manor Lords (Slavic Magic / Hooded Horse, Early Access 2024)
- **Rating:** Metacritic critic early-access scores include 70, 75, 75 and 80 (https://www.metacritic.com/game/manor-lords/). I did not record the Steam percentage (**not looked up**).
- **Liked:** the atmosphere, the "backyard economy" and the building system. One negative review still says: "NPCs lively, pop system is great, building system - chef's kiss. Graphic - muah, awesome." (https://steamcommunity.com/app/1363080/negativereviews/?l=english). A historian reviewer praised its authenticity (https://steamcommunity.com/app/1363080/reviews/?browsefilter=toprated).
- **Complaints:**
  - Missing content: production lines and tiers run thin, and the policy and progression trees are still being built (Metacritic critics).
  - Economy and trade feel "dead" (negative review above).
  - Rival AI expands too aggressively (top-rated review).
  - Combat is too easy (https://www.ign.com/articles/manor-lords-review-early-access).
  - Stutter at a population of 400+ and autosave lag (https://steamcommunity.com/app/1363080/discussions/0/4362376876612241456/).

## Cities: Skylines (2015)
- **Rating:** Metacritic 85, Generally Favorable, from 60 critics (https://www.metacritic.com/game/cities-skylines/). Steambase gives 93/100 from 291,166 reviews (https://steambase.io/games/cities-skylines/reviews).
- **Liked:** "the glee of expansion", plus mods and assets (Metacritic).
- **Complaints** (a Metacritic user review): needs lots of DLC and mods, too easy (hard to go bankrupt), endless freight traffic fixing, and "deathwaves".

## Cities: Skylines II (2023)
- **Rating:** Steam overall Mixed, 56–57% of about 34k English reviews. Recent reviews are Mostly Positive, 73–74% (https://store.steampowered.com/app/949230/Cities_Skylines_II_2/).
- **Complaints:** a launch with severe performance problems, glitches and no mods. Reviews sat around 50% until a new developer, Iceflake, fixed things (https://www.forbes.com/sites/barrycollins/2026/07/04/cities-skylines-ii-is-staging-a-remarkable-comeback/).
- **Liked:** big scale and an ambitious simulation, now more stable.

## Lessons for Hatchfield
**Do**
1. Make pathfinding robust before adding content. It is Airport CEO's number 2 complaint, so keep the shallow, capped search and add a "stuck" auto-recovery and a debug overlay.
2. Budget performance early: cap the number of agents, use instanced meshes, and save in the background without hitching. This was the top complaint for Airport CEO and CS2, and a common one for Manor Lords.
3. Ship a real guided first hour (the AT3 stamp-and-letter opening). A poor tutorial is a top-4 Airport CEO complaint.
4. Make chains readable. Show why a bag or catering truck is stuck (blocked road, missing belt) with icons. Airport CEO's road cut-off stalls service vehicles across the whole airport.
5. Keep the economy biting. Easy money (a CS1 complaint) and a dead economy (a Manor Lords complaint) both kill the long game.
6. Keep progression deep enough for the late game: Field Levels, carrier tiers and prestige forks. Manor Lords got criticism for thin tiers.
7. Keep modding and save stability in mind; that is part of CS1's long life.

**Avoid**
1. Releasing with known pathfinding or baggage bugs.
2. Slowing down as the field grows: stress-test with 2,000 passengers.
3. Hiding mechanics so players need YouTube to learn them.
4. Opponents (rival airports or airlines) that snowball unfairly.
5. Content walls where "coming soon" trees are locked.
6. Anything that can't be undone or demolished (AT3's terminals).
