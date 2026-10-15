import { describe, expect, it } from 'vitest';
import {
  CarbonBook,
  buildingEmissions,
  dailyEmissions,
  flightEmission,
  netZeroProgress,
  offsetCost,
} from './carbon';
import {
  GROUND_OPS_KG_PER_DAY_PER_MW,
  KG_CO2_PER_LTO,
  OFFSET_COST_PER_TONNE,
  SAF_CUT_FACTOR,
} from './data';

describe('sustainability data constants', () => {
  it('defines correct kg CO2 per LTO for each aircraft class', () => {
    expect(KG_CO2_PER_LTO.small).toBe(300);
    expect(KG_CO2_PER_LTO.regional).toBe(800);
    expect(KG_CO2_PER_LTO.narrowbody).toBe(2500);
    expect(KG_CO2_PER_LTO.widebody).toBe(6000);
    expect(KG_CO2_PER_LTO.jumbo).toBe(10000);
  });

  it('defines correct ground ops rate and offset cost per tonne', () => {
    expect(GROUND_OPS_KG_PER_DAY_PER_MW).toBe(900);
    expect(SAF_CUT_FACTOR).toBe(0.8);
    expect(OFFSET_COST_PER_TONNE).toBe(25);
  });
});

describe('dailyEmissions', () => {
  it('calculates flight emissions with no SAF and zero ground power', () => {
    const res = dailyEmissions({
      movements: { small: 2, narrowbody: 1 },
      powerMW: 0,
      safBlend: 0,
      solarMW: 0,
    });

    // small: 2 * 300 = 600 kg
    // narrowbody: 1 * 2500 = 2500 kg
    // Total flight = 3100 kg
    expect(res.flightKg).toBe(3100);
    expect(res.groundKg).toBe(0);
    expect(res.totalKg).toBe(3100);
    expect(res.totalTonnes).toBe(3.1);
  });

  it('handles movement array input formats', () => {
    const resArrayStrings = dailyEmissions({
      movements: ['regional', 'widebody'],
      powerMW: 0,
      safBlend: 0,
      solarMW: 0,
    });
    // regional (800) + widebody (6000) = 6800 kg
    expect(resArrayStrings.flightKg).toBe(6800);

    const resArrayObjects = dailyEmissions({
      movements: [
        { class: 'jumbo', count: 2 },
        { class: 'small', count: 1 },
      ],
      powerMW: 0,
      safBlend: 0,
      solarMW: 0,
    });
    // jumbo: 2 * 10000 = 20000 kg, small: 1 * 300 = 300 kg -> 20300 kg
    expect(resArrayObjects.flightKg).toBe(20300);
  });

  it('calculates ground ops emissions and solar MW offset', () => {
    const res = dailyEmissions({
      movements: {},
      powerMW: 10,
      safBlend: 0,
      solarMW: 4,
    });

    // Net power = 10 - 4 = 6 MW
    // 6 MW * 900 kg/MW = 5400 kg CO2
    expect(res.flightKg).toBe(0);
    expect(res.groundKg).toBe(5400);
    expect(res.totalKg).toBe(5400);
    expect(res.totalTonnes).toBe(5.4);
  });

  it('clamps net power to zero when solar exceeds power demand', () => {
    const res = dailyEmissions({
      movements: {},
      powerMW: 5,
      safBlend: 0,
      solarMW: 10,
    });

    expect(res.groundKg).toBe(0);
    expect(res.totalKg).toBe(0);
    expect(res.totalTonnes).toBe(0);
  });

  it('applies SAF blend reduction to flight emissions (blend% x 0.8)', () => {
    // 50% SAF blend (0.5) -> reduction = 0.5 * 0.8 = 0.4 (40% reduction)
    const resFraction = dailyEmissions({
      movements: { narrowbody: 1 }, // 2500 kg
      powerMW: 0,
      safBlend: 0.5,
      solarMW: 0,
    });

    // Remaining flight CO2 = 2500 * (1 - 0.4) = 1500 kg
    expect(resFraction.flightKg).toBe(1500);

    // 50 passed as percentage 50%
    const resPercent = dailyEmissions({
      movements: { narrowbody: 1 },
      powerMW: 0,
      safBlend: 50,
      solarMW: 0,
    });
    expect(resPercent.flightKg).toBe(1500);

    // 100% SAF blend -> 80% reduction -> 20% remaining (500 kg)
    const resFullSaf = dailyEmissions({
      movements: { narrowbody: 1 },
      powerMW: 0,
      safBlend: 1.0,
      solarMW: 0,
    });
    expect(resFullSaf.flightKg).toBe(500);
  });
});

describe('netZeroProgress', () => {
  it('returns net CO2 and net-zero boolean for numeric emissions history', () => {
    // 3 days of emissions in tonnes: 10, 15, 25 = 50 tonnes total
    const history = [10, 15, 25];

    const progressShort = netZeroProgress(history, 30);
    expect(progressShort.net).toBe(20);
    expect(progressShort.isNetZero).toBe(false);

    const progressExact = netZeroProgress(history, 50);
    expect(progressExact.net).toBe(0);
    expect(progressExact.isNetZero).toBe(true);

    const progressSurplus = netZeroProgress(history, 60);
    expect(progressSurplus.net).toBe(-10);
    expect(progressSurplus.isNetZero).toBe(true);
  });

  it('accepts DailyEmissionsResult objects in history', () => {
    const day1 = dailyEmissions({
      movements: { narrowbody: 2 }, // 5000 kg = 5 t
      powerMW: 5,                   // 4500 kg = 4.5 t -> total 9.5 t
      safBlend: 0,
      solarMW: 0,
    });

    const day2 = dailyEmissions({
      movements: { widebody: 1 },   // 6000 kg = 6 t
      powerMW: 0,
      safBlend: 0,
      solarMW: 0,
    });

    const progress = netZeroProgress([day1, day2], 15.5);
    expect(progress.totalEmissions).toBe(15.5);
    expect(progress.net).toBe(0);
    expect(progress.isNetZero).toBe(true);
  });

  it('supports array destructuring [net, isNetZero]', () => {
    const history = [10, 20];
    const [net, isNetZero] = netZeroProgress(history, 30);

    expect(net).toBe(0);
    expect(isNetZero).toBe(true);
  });
});

describe('offsetCost', () => {
  it('calculates cost at $25 per tonne', () => {
    expect(offsetCost(0)).toBe(0);
    expect(offsetCost(10)).toBe(250);
    expect(offsetCost(100)).toBe(2500);
    expect(offsetCost(1000)).toBe(25000);
  });

  it('handles negative tonnage safely', () => {
    expect(offsetCost(-5)).toBe(0);
  });
});

describe('CarbonBook', () => {
  it('keeps per-flight and per-building emissions in the daily audit', () => {
    const book = new CarbonBook();
    book.recordFlight({
      id: 'f1',
      flightNo: 'HF101',
      aircraft: 'Boeing 737-800',
      aircraftClass: 'narrowbody',
      safBlend: 0,
    });
    book.recordFlight({
      id: 'f1',
      flightNo: 'HF101',
      aircraft: 'Boeing 737-800',
      aircraftClass: 'narrowbody',
      safBlend: 0,
    });
    const day = book.closeDay(1, [
      { id: 'terminal:1,1', type: 'terminal' },
      { id: 'fuel:2,2', type: 'fuel' },
      { id: 'road:3,3', type: 'road' },
    ]);

    expect(day.flights).toHaveLength(1);
    expect(day.flights[0].kg).toBe(2500);
    expect(day.buildings.map((row) => row.label)).toEqual(['Terminal', 'Fuel farm']);
    expect(day.buildingKg).toBe(300);
    expect(day.totalKg).toBe(2800);
  });

  it('applies SAF to each flight and exposes configured building rows', () => {
    expect(flightEmission({
      id: 'f2',
      flightNo: 'HF202',
      aircraft: 'A320',
      aircraftClass: 'narrowbody',
      safBlend: 0.5,
    }).kg).toBe(1500);
    expect(buildingEmissions([{ id: 'mro:4,4', type: 'mro' }])).toEqual([
      { id: 'mro:4,4', type: 'mro', label: 'MRO hangar', kg: 260 },
    ]);
  });

  it('completes and restores Green Pioneer after a tracked day is fully offset', () => {
    const book = new CarbonBook();
    expect(book.startGreenPioneer(3, 40)).toBe(true);
    book.recordFlight({
      id: 'f3',
      flightNo: 'HF303',
      aircraft: 'E175',
      aircraftClass: 'regional',
      safBlend: 0,
    });
    book.closeDay(4, []);
    expect(book.view().greenPioneer?.status).toBe('running');
    book.purchaseOffsets(0.8, 4);
    expect(book.view().greenPioneer?.status).toBe('met');

    const restored = CarbonBook.restore(JSON.parse(JSON.stringify(book.save())));
    expect(restored.view().greenPioneer?.status).toBe('met');
    expect(restored.view().netTonnes).toBe(0);
  });

  it('loads an older save with no carbon state as an empty compatible book', () => {
    expect(CarbonBook.restore(undefined).view()).toMatchObject({
      daysTracked: 0,
      totalEmissionsTonnes: 0,
      offsetsTonnes: 0,
      greenPioneer: null,
    });
  });
});
