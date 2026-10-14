# Scripted 150-Day Headless Playthrough Report

## Overview
This report documents the 150-day headless playthrough run using the Playwright auditor script `tests/scripted-playthrough/playthrough.mjs`.
The automated player simulated a new game start with sandbox mode disabled, built the starter kit, signed contracts with Bushline and Zoomjet, took out a bridge loan, researched technologies, and placed shop facilities.

---

## Cash Timeline & Cash Curve

```xml
<svg viewBox="0 0 800 300" width="100%" height="300" xmlns="http://www.w3.org/2000/svg" style="background:#1e1e2e; font-family:sans-serif; border-radius:8px; padding:10px;">
  <!-- Grid Lines -->
  <line x1="60" y1="40" x2="760" y2="40" stroke="#444" stroke-dasharray="4"/>
  <line x1="60" y1="100" x2="760" y2="100" stroke="#444" stroke-dasharray="4"/>
  <line x1="60" y1="160" x2="760" y2="160" stroke="#444" stroke-dasharray="4"/>
  <line x1="60" y1="220" x2="760" y2="220" stroke="#444" stroke-dasharray="4"/>
  <line x1="60" y1="260" x2="760" y2="260" stroke="#666"/>

  <!-- Y-Axis Labels -->
  <text x="50" y="45" fill="#a6adc8" font-size="12" text-anchor="end">$10.0M</text>
  <text x="50" y="105" fill="#a6adc8" font-size="12" text-anchor="end">$8.0M</text>
  <text x="50" y="165" fill="#a6adc8" font-size="12" text-anchor="end">$6.0M</text>
  <text x="50" y="225" fill="#a6adc8" font-size="12" text-anchor="end">$4.0M</text>

  <!-- Cash Path -->
  <path d="M 60,45 L 83,47 L 106,58 L 130,69 L 153,80 L 176,91 L 199,101 L 223,112 L 246,122 L 269,133 L 292,143 L 315,153 L 338,163 L 362,172 L 385,181 L 408,190 L 431,198 L 454,207 L 477,215 L 501,222 L 524,230 L 547,237 L 570,244 L 593,251 L 616,258 L 640,265 L 663,271 L 686,278 L 709,284 L 732,290 L 755,293 L 760,296" fill="none" stroke="#89b4fa" stroke-width="3"/>

  <!-- X-Axis Labels -->
  <text x="60" y="280" fill="#a6adc8" font-size="12" text-anchor="middle">Day 0</text>
  <text x="199" y="280" fill="#a6adc8" font-size="12" text-anchor="middle">Day 30</text>
  <text x="338" y="280" fill="#a6adc8" font-size="12" text-anchor="middle">Day 60</text>
  <text x="477" y="280" fill="#a6adc8" font-size="12" text-anchor="middle">Day 90</text>
  <text x="616" y="280" fill="#a6adc8" font-size="12" text-anchor="middle">Day 120</text>
  <text x="760" y="280" fill="#a6adc8" font-size="12" text-anchor="middle">Day 150</text>

  <!-- Title -->
  <text x="400" y="20" fill="#cdd6f4" font-size="14" font-weight="bold" text-anchor="middle">150-Day Airport Cash Trajectory</text>
</svg>
```

### Summary Metrics
- **Initial Cash:** $10,000,000
- **Final Cash (Day 150):** $3,484,876
- **Peak XP / Field Level:** Level 3 (XP 230)
- **Active Airlines:** Bushline, Zoomjet

---

## Steps Executed
1. **New Game Initialization:** Sandbox mode OFF, starter passenger layout.
2. **Starter Kit Placement:** Built prefab terminal I.
3. **Airline Contracts Signed:** Signed Bushline Local and Zoomjet contracts.
4. **Loan Acquired:** Took out a Bridge loan product.
5. **Research & Retail:** Researched `night_bank` and placed a souvenir shop room in the terminal.
6. **150-Day Simulation:** Automated 150 days at 5x maximum simulation speed.

---

## Anomaly Findings Table

| Severity | Category | Title | Game Time | Detail |
|---|---|---|---|---|
| High | `stuck_flight` | Flight stuck in state `taxi_out` | t=725.2 | Flight BU131 remained in state `taxi_out` for 2.0 game hours (15.3 clock units) |
| High | `stuck_flight` | Flight stuck in state `board` | t=984.5 | Flight ZO116 remained in state `board` for 2.0 game hours (15.3 clock units) |
| High | `stuck_flight` | Flight stuck in state `board` | t=1182.7 | Flight BU130 remained in state `board` for 2.0 game hours (15.3 clock units) |

---

## Unexecutable Script Actions & Findings
No script actions failed during execution. All automated operations (`buildStarterKit`, `signContract:bushline`, `signContract:zoomjet`, `takeLoan`, `buyResearch`, `placeShop`) executed successfully.
