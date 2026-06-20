import { buildTurnByTurnSteps, type PathNodeLite } from '../src/services/turnByTurnSteps';

function lift(floor: number, type: 'STAIRS' | 'LIFT' = 'STAIRS'): PathNodeLite {
  return {
    label: 'STAIRCASE & LIFT 1',
    x: 10,
    y: 20,
    floor,
    type,
  };
}

function corridor(floor: number, n: number): PathNodeLite {
  return { label: `Path point ${n}`, x: 15 + n, y: 25, floor, type: 'CORRIDOR' };
}

const path: PathNodeLite[] = [
  { label: 'CAFETERIA', x: 5, y: 5, floor: 0, type: 'ROOM' },
  corridor(0, 1),
  lift(0),
  lift(1),
  lift(2, 'LIFT'),
  lift(3, 'STAIRS'),
  lift(4),
  lift(5, 'LIFT'),
  lift(6),
];

const steps = buildTurnByTurnSteps(path, 'CAFETERIA');
const vertical = steps.filter((s) => /lift|stair/i.test(s.instruction));
console.log('Vertical steps:', vertical.map((s) => s.instruction));

const takeSteps = steps.filter((s) => s.instruction.startsWith('Take '));
if (takeSteps.length !== 1) {
  console.error('Expected 1 Take step, got', takeSteps.length, takeSteps);
  process.exit(1);
}
if (!takeSteps[0].instruction.includes('Floor 6')) {
  console.error('Expected single ride to Floor 6, got', takeSteps[0].instruction);
  process.exit(1);
}
console.log('OK — merged into one lift ride');
