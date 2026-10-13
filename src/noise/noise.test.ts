import { describe, it } from 'vitest'
import { isNight, movementNoise, dailyNoiseReport, type Movement } from './noise';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runTests() {
  // isNight tests
  assert(isNight(23) === true, '23 is night');
  assert(isNight(0) === true, '0 is night');
  assert(isNight(5) === true, '5 is night');
  assert(isNight(5.99) === true, '5.99 is night');
  assert(isNight(6) === false, '6 is day');
  assert(isNight(12) === false, '12 is day');
  assert(isNight(22) === false, '22 is day');
  assert(isNight(22.99) === false, '22.99 is day');

  // wraparound
  assert(isNight(-1) === true, '-1 is 23 (night)');
  assert(isNight(27) === true, '27 is 3 (night)');
  assert(isNight(30) === false, '30 is 6 (day)');
  assert(isNight(-18) === false, '-18 is 6 (day)');

  // movementNoise tests
  assert(movementNoise({ cls: 'narrowbody', hour: 12 }) === 4, 'day narrowbody');
  assert(movementNoise({ cls: 'narrowbody', hour: 23 }) === 12, 'night narrowbody');
  assert(movementNoise({ cls: 'small', hour: 10 }) === 1, 'small');
  assert(movementNoise({ cls: 'regional', hour: 10 }) === 2, 'regional');
  assert(movementNoise({ cls: 'widebody', hour: 10 }) === 7, 'widebody');
  assert(movementNoise({ cls: 'jumbo', hour: 10 }) === 10, 'jumbo');
  assert(movementNoise({ cls: 'military', hour: 10 }) === 8, 'military');
  assert(movementNoise({ cls: 'helicopter', hour: 10 }) === 2, 'helicopter');

  // dailyNoiseReport tests
  const emptyReport = dailyNoiseReport([], true);
  assert(emptyReport.points === 0, 'empty report points');
  assert(emptyReport.nightMovements === 0, 'empty report nightMovements');
  assert(emptyReport.fines === 0, 'empty report fines');
  assert(emptyReport.approvalDelta === 0, 'empty report approvalDelta');
  assert(!Number.isNaN(emptyReport.points), 'no NaN points');
  assert(!Number.isNaN(emptyReport.fines), 'no NaN fines');
  assert(!Number.isNaN(emptyReport.approvalDelta), 'no NaN approvalDelta');

  const movements: Movement[] = [
    { cls: 'small', hour: 2 }, // night: base 1 -> class factor 1 -> fine 1200
    { cls: 'widebody', hour: 23 }, // night: base 7 -> class factor 1.75 -> fine 2100
    { cls: 'jumbo', hour: 14 }, // day
  ];

  const noCurfewReport = dailyNoiseReport(movements, false);
  assert(noCurfewReport.nightMovements === 2, 'night movements count');
  assert(noCurfewReport.fines === 0, 'no curfew fines');

  const curfewReport = dailyNoiseReport(movements, true);
  assert(curfewReport.nightMovements === 2, 'night movements count');
  assert(curfewReport.fines === 3300, 'curfew fines calculated');

  // approval loss
  const lowMovements: Movement[] = Array(5).fill({ cls: 'narrowbody', hour: 12 });
  const lowReport = dailyNoiseReport(lowMovements, false);
  assert(lowReport.points === 20, 'low points');
  assert(lowReport.approvalDelta === 0, 'low approval delta');

  const medMovements: Movement[] = Array(25).fill({ cls: 'narrowbody', hour: 12 });
  const medReport = dailyNoiseReport(medMovements, false);
  assert(medReport.points === 100, 'med points');
  assert(medReport.approvalDelta === -2, 'med approval delta');

  const highMovements: Movement[] = Array(50).fill({ cls: 'narrowbody', hour: 12 });
  const highReport = dailyNoiseReport(highMovements, false);
  assert(highReport.points === 200, 'high points');
  assert(highReport.approvalDelta === -5, 'capped approval delta');

}

describe('noise model', () => {
  it('covers night wrap, movement points, and curfew fines', () => {
    runTests()
  })
})
