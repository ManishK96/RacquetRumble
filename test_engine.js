/**
 * Racquet Rumble Tournament Engine Test Suite
 * Zero-dependency Node.js test runner using Node's built-in assert module.
 * Run directly with: node test_engine.js
 */

const assert = require('assert');

// --- PURE TOURNAMENT ENGINE LOGIC ---

function evaluateGameScore(scoreA, scoreB) {
  // Badminton BWF / Corporate Single-Set 21 rules:
  // Win condition: >= 21 pts with >= 2 pt lead, or first to 30 (sudden death)
  if (scoreA >= 30) return { finished: true, winner: 'A' };
  if (scoreB >= 30) return { finished: true, winner: 'B' };
  if (scoreA >= 21 && scoreA - scoreB >= 2) return { finished: true, winner: 'A' };
  if (scoreB >= 21 && scoreB - scoreA >= 2) return { finished: true, winner: 'B' };
  return { finished: false, winner: null };
}

function resolveFixtureWinner(teamAScore, teamBScore, totalPtsA, totalPtsB, rubbersCompleted) {
  // A tie consists of 6 rubbers (MS, MD, WS, XD, RMS, RMD)
  if (rubbersCompleted < 6) {
    return { completed: false, winnerId: null, poolPointsAwarded: false };
  }
  let winner = null;
  if (teamAScore > teamBScore) winner = 'A';
  else if (teamBScore > teamAScore) winner = 'B';
  else {
    // 3-3 tiebreak by cumulative points
    winner = totalPtsA >= totalPtsB ? 'A' : 'B';
  }
  return { completed: true, winner, poolPointsAwarded: true, pointsAwarded: 2 };
}

function validateTeamLineup(roster, assignedPlayers) {
  // 6 players per team (4 M, 2 F). Every player must play >= 1 match.
  const assignedSet = new Set(assignedPlayers);
  const missing = roster.filter(p => !assignedSet.has(p.name));
  return {
    isValid: missing.length === 0,
    missingPlayers: missing.map(p => p.name)
  };
}

function calculateStandings(teams, completedFixtures) {
  const table = {};
  teams.forEach(t => {
    table[t.id] = {
      id: t.id,
      name: t.name,
      played: 0,
      wins: 0,
      losses: 0,
      rubbersWon: 0,
      rubbersLost: 0,
      pointsWon: 0,
      poolPoints: 0
    };
  });

  completedFixtures.forEach(f => {
    if (!f.completed) return; // Strict rule: only completed fixtures count
    const tA = table[f.teamAId];
    const tB = table[f.teamBId];

    tA.played++;
    tA.rubbersWon += f.teamAScore;
    tA.rubbersLost += f.teamBScore;
    tA.pointsWon += f.totalPtsA;

    tB.played++;
    tB.rubbersWon += f.teamBScore;
    tB.rubbersLost += f.teamAScore;
    tB.pointsWon += f.totalPtsB;

    if (f.winnerId === f.teamAId) {
      tA.wins++;
      tA.poolPoints += 2;
      tB.losses++;
    } else {
      tB.wins++;
      tB.poolPoints += 2;
      tA.losses++;
    }
  });

  // Sort ranking: Pool Points (desc) -> Rubbers Won (desc) -> Points Won (desc)
  return Object.values(table).sort((a, b) => {
    if (b.poolPoints !== a.poolPoints) return b.poolPoints - a.poolPoints;
    if (b.rubbersWon !== a.rubbersWon) return b.rubbersWon - a.rubbersWon;
    return b.pointsWon - a.pointsWon;
  });
}

function simulateSubtractPoint(rubber, fixture, team) {
  if (team === 'A') {
    if (rubber.scoreA <= 0) return false;
    rubber.scoreA--;
    if (fixture.totalPtsA > 0) fixture.totalPtsA--;
    for (let i = rubber.rallyHistory.length - 1; i >= 0; i--) {
      if (rubber.rallyHistory[i].pointTeam === 'A') {
        rubber.rallyHistory.splice(i, 1);
        break;
      }
    }
    return true;
  } else {
    if (rubber.scoreB <= 0) return false;
    rubber.scoreB--;
    if (fixture.totalPtsB > 0) fixture.totalPtsB--;
    for (let i = rubber.rallyHistory.length - 1; i >= 0; i--) {
      if (rubber.rallyHistory[i].pointTeam === 'B') {
        rubber.rallyHistory.splice(i, 1);
        break;
      }
    }
    return true;
  }
}

function parseGoogleFormRosterRow(rowStr) {
  // Format: Team Name, Pool, Captain, Male 2, Male 3, Male 4, Female 1, Female 2
  const parts = rowStr.split(/[\t,]/).map(p => p.trim());
  if (parts.length < 8) return null;
  return {
    name: parts[0],
    pool: parts[1].toUpperCase().includes('B') ? 'B' : 'A',
    captain: parts[2],
    malePlayers: [parts[2], parts[3], parts[4], parts[5]],
    femalePlayers: [parts[6], parts[7]]
  };
}

// --- TEST CASES ---

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n=== RACQUET RUMBLE BADMINTON TEST SUITE ===\n');

console.log('1. SCORING & DEUCE LOGIC (Single Set of 21)');
it('Regular win: reaches 21 with a 2-point lead (21-19)', () => {
  const res = evaluateGameScore(21, 19);
  assert.strictEqual(res.finished, true);
  assert.strictEqual(res.winner, 'A');
});

it('Deuce active: 20-20 does not finish game', () => {
  const res = evaluateGameScore(20, 20);
  assert.strictEqual(res.finished, false);
});

it('Deuce active: 21-20 does not finish game (requires 2-pt lead)', () => {
  const res = evaluateGameScore(21, 20);
  assert.strictEqual(res.finished, false);
});

it('Deuce win: reaches 22-20 with a 2-point lead', () => {
  const res = evaluateGameScore(22, 20);
  assert.strictEqual(res.finished, true);
  assert.strictEqual(res.winner, 'A');
});

it('Sudden death: 29-29 game capped at 30 (30-29 wins without 2-pt lead)', () => {
  const res = evaluateGameScore(30, 29);
  assert.strictEqual(res.finished, true);
  assert.strictEqual(res.winner, 'A');
});

console.log('\n2. FIXTURE COMPLETION & 2-POINT POOL RULE');
it('Incomplete fixture (< 6 rubbers) does not award pool points', () => {
  const res = resolveFixtureWinner(3, 1, 80, 65, 4);
  assert.strictEqual(res.completed, false);
  assert.strictEqual(res.poolPointsAwarded, false);
});

it('Complete fixture (6 rubbers, 4-2) awards 2 pool points to winner', () => {
  const res = resolveFixtureWinner(4, 2, 120, 110, 6);
  assert.strictEqual(res.completed, true);
  assert.strictEqual(res.winner, 'A');
  assert.strictEqual(res.pointsAwarded, 2);
});

it('Complete fixture tied 3-3 breaks tie on cumulative points', () => {
  const resA = resolveFixtureWinner(3, 3, 118, 114, 6);
  assert.strictEqual(resA.winner, 'A');

  const resB = resolveFixtureWinner(3, 3, 110, 125, 6);
  assert.strictEqual(resB.winner, 'B');
});

console.log('\n3. 6-PLAYER ROSTER PARTICIPATION VALIDATION');
const sampleRoster = [
  { name: 'Arun V', gender: 'M' },
  { name: 'David K', gender: 'M' },
  { name: 'Rohan P', gender: 'M' },
  { name: 'Karthik S', gender: 'M' },
  { name: 'Priya N', gender: 'F' },
  { name: 'Sneha R', gender: 'F' }
];

it('Passes when all 6 players are assigned across categories', () => {
  const assigned = ['Arun V', 'David K', 'Rohan P', 'Priya N', 'Karthik S', 'Sneha R'];
  const res = validateTeamLineup(sampleRoster, assigned);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.missingPlayers.length, 0);
});

it('Fails when 1 or more roster players are not assigned', () => {
  const assigned = ['Arun V', 'David K', 'Rohan P', 'Priya N']; // Sneha & Karthik omitted
  const res = validateTeamLineup(sampleRoster, assigned);
  assert.strictEqual(res.isValid, false);
  assert.deepStrictEqual(res.missingPlayers, ['Karthik S', 'Sneha R']);
});

console.log('\n4. POOL STANDINGS RANKING ENGINE');
it('Correctly ranks teams by Pool Points -> Rubbers Won -> Points Won', () => {
  const teams = [
    { id: 'T1', name: 'Shuttle Stormers' },
    { id: 'T2', name: 'Net Ninjas' },
    { id: 'T3', name: 'Smash Syndicate' },
    { id: 'T4', name: 'Court Crusaders' }
  ];

  const fixtures = [
    { completed: true, teamAId: 'T1', teamBId: 'T2', teamAScore: 4, teamBScore: 2, totalPtsA: 120, totalPtsB: 100, winnerId: 'T1' },
    { completed: true, teamAId: 'T1', teamBId: 'T3', teamAScore: 5, teamBScore: 1, totalPtsA: 124, totalPtsB: 90, winnerId: 'T1' },
    { completed: true, teamAId: 'T2', teamBId: 'T3', teamAScore: 4, teamBScore: 2, totalPtsA: 115, totalPtsB: 110, winnerId: 'T2' }
  ];

  const standings = calculateStandings(teams, fixtures);
  assert.strictEqual(standings[0].id, 'T1');
  assert.strictEqual(standings[0].poolPoints, 4);
  assert.strictEqual(standings[1].id, 'T2');
  assert.strictEqual(standings[1].poolPoints, 2);
  assert.strictEqual(standings[2].id, 'T3');
  assert.strictEqual(standings[2].poolPoints, 0);
});

console.log('\n5. DEDICATED (-) STEPPER FOR UNDOING ACCIDENTAL TAPS');
it('Accidental tap correction: Decrementing Team A reduces score and pops last Team A rally', () => {
  const rubber = {
    scoreA: 14,
    scoreB: 11,
    rallyHistory: [
      { pointTeam: 'A', shotType: 'Smash Winner' },
      { pointTeam: 'B', shotType: 'Drop Winner' },
      { pointTeam: 'A', shotType: null } // accidental tap
    ]
  };
  const fixture = { totalPtsA: 64, totalPtsB: 50 };

  const success = simulateSubtractPoint(rubber, fixture, 'A');
  assert.strictEqual(success, true);
  assert.strictEqual(rubber.scoreA, 13);
  assert.strictEqual(fixture.totalPtsA, 63);
  assert.strictEqual(rubber.rallyHistory.length, 2);
  assert.strictEqual(rubber.rallyHistory[rubber.rallyHistory.length - 1].pointTeam, 'B');
});

it('Accidental tap correction: Cannot decrement below 0', () => {
  const rubber = { scoreA: 0, scoreB: 5, rallyHistory: [] };
  const fixture = { totalPtsA: 0, totalPtsB: 20 };

  const success = simulateSubtractPoint(rubber, fixture, 'A');
  assert.strictEqual(success, false);
  assert.strictEqual(rubber.scoreA, 0);
});

console.log('\n6. GOOGLE FORM / EXCEL ROSTER IMPORT PARSING');
it('Correctly parses Google Form / Excel row per team (8 columns)', () => {
  const row = 'Cloud Titans, Pool A, Manish S., Pranav S., Karthik R., Rohan V., Ananya R., Sneha P.';
  const team = parseGoogleFormRosterRow(row);
  assert.strictEqual(team.name, 'Cloud Titans');
  assert.strictEqual(team.pool, 'A');
  assert.strictEqual(team.captain, 'Manish S.');
  assert.strictEqual(team.malePlayers.length, 4);
  assert.strictEqual(team.femalePlayers.length, 2);
});

console.log(`\n========================================`);
console.log(`Summary: ${passed} of ${total} tests passed.`);
console.log(`========================================\n`);

if (passed !== total) process.exit(1);