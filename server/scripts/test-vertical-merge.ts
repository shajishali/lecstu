/**
 * Quick check: Ground → Floor 9 via same shaft with corridor landings must merge
 * to ONE exit on Floor 9 (no "Exit on Floor 2").
 *
 *   npx tsx server/scripts/test-vertical-merge.ts
 */
import { buildTurnByTurnSteps } from '../src/services/turnByTurnSteps';

const shaft = 'STAIRCASE & LIFT 1';
const path = [
  { label: 'ENTRANCE', floor: 0, x: 10, y: 50, type: 'ENTRANCE' as const },
  { label: 'corridor', floor: 0, x: 20, y: 50, type: 'CORRIDOR' as const },
  { label: shaft, floor: 0, x: 30, y: 40, type: 'STAIRS' as const },
  { label: shaft, floor: 1, x: 30, y: 40, type: 'STAIRS' as const },
  { label: 'corridor landing', floor: 1, x: 35, y: 40, type: 'CORRIDOR' as const },
  { label: shaft, floor: 1, x: 30, y: 40, type: 'STAIRS' as const },
  { label: shaft, floor: 2, x: 30, y: 40, type: 'STAIRS' as const },
  { label: 'corridor landing', floor: 2, x: 35, y: 40, type: 'CORRIDOR' as const },
  { label: shaft, floor: 2, x: 30, y: 40, type: 'STAIRS' as const },
  { label: shaft, floor: 9, x: 30, y: 40, type: 'STAIRS' as const },
  { label: 'LECTURE ROOM', floor: 9, x: 60, y: 70, type: 'ROOM' as const },
];

const steps = buildTurnByTurnSteps(path, 'LECTURE ROOM');
const exitSteps = steps.filter((s) => /exit at/i.test(s.instruction));

console.log('Total steps:', steps.length);
console.log('Exit steps:', exitSteps.length);
exitSteps.forEach((s) => console.log(`  [floor ${s.floor}] ${s.instruction}`));

const bad = exitSteps.filter((s) => s.instruction.includes('Floor 2'));
if (bad.length > 0) {
  console.error('\nFAIL: intermediate exit on Floor 2');
  process.exit(1);
}
if (!exitSteps.some((s) => s.instruction.includes('Floor 9'))) {
  console.error('\nFAIL: missing exit on Floor 9');
  process.exit(1);
}
console.log('\nOK: single shaft run exits on target floor only');
