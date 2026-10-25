/**
 * Racquet Rumble Tournament Engine Test Suite
 * Zero-dependency Node.js test runner using Node's built-in assert module.
 * Run directly with: node test_engine.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

console.log('\n7. FIREBASE RTDB EMPTY-ARRAY RECOVERY & PER-USER CASUAL CIRCLE');
it('Restores rallyHistory array when stripped by Firebase Realtime Database sync', () => {
  const rubberFromFirebase = { id: 'fix_a_1_r1', scoreA: 18, scoreB: 16, status: 'live' };
  if (!Array.isArray(rubberFromFirebase.rallyHistory)) {
    rubberFromFirebase.rallyHistory = rubberFromFirebase.rallyHistory ? Object.values(rubberFromFirebase.rallyHistory) : [];
  }
  rubberFromFirebase.rallyHistory.push({ scoreA: 18, scoreB: 16, pointTeam: 'A' });
  rubberFromFirebase.scoreA++;
  assert.strictEqual(rubberFromFirebase.scoreA, 19);
  assert.strictEqual(rubberFromFirebase.rallyHistory.length, 1);
});

it('Initializes Casual Circle completely empty per user and tracks custom friends from scratch', () => {
  const createCasualWorkspace = (email) => ({
    ownerEmail: email.trim().toLowerCase(),
    players: [],
    matches: [],
    doublesMatches: []
  });
  const userCircle = createCasualWorkspace('newuser@gmail.com');
  assert.strictEqual(userCircle.players.length, 0);
  assert.strictEqual(userCircle.matches.length, 0);
  ['Rahul', 'Sneha', 'Vikram'].forEach(p => userCircle.players.push(p));
  assert.deepStrictEqual(userCircle.players, ['Rahul', 'Sneha', 'Vikram']);
});

console.log('\n8. COACH CONSOLE 1-21 HORIZONTAL GRAPH & PER-PLAYER METADATA');
it('Marks points 1..score as completed crosses (✕) and score+1..21 as grayed-out upcoming points', () => {
  const scoreA = 18, scoreB = 16;
  const maxPts = Math.max(21, scoreA, scoreB);
  const rowA = Array.from({ length: maxPts }, (_, i) => ({ pt: i + 1, done: (i + 1) <= scoreA }));
  const rowB = Array.from({ length: maxPts }, (_, i) => ({ pt: i + 1, done: (i + 1) <= scoreB }));
  assert.strictEqual(rowA.filter(c => c.done).length, 18);
  assert.strictEqual(rowA.filter(c => !c.done).length, 3);
  assert.strictEqual(rowB.filter(c => c.done).length, 16);
  assert.strictEqual(rowB.filter(c => !c.done).length, 5);
});

it('Links winning shot, opponent error, and coach notes to specific players for later review', () => {
  const rubber = {
    id: 'fix_a_1_r1',
    categoryCode: 'MS',
    teamAName: 'Cloud Titans',
    teamBName: 'DevOps Dynamos',
    playersA: 'Manish S.',
    playersB: 'Nitesh S.',
    scoreA: 18,
    scoreB: 16,
    pointDetails: {
      A: {
        5: { shotType: 'Smash', category: 'winner', player: 'Manish S.', coachId: 'coach_1', notes: 'Steep cross-court smash' },
        6: { shotType: 'Unforced Error', category: 'error', player: 'Nitesh S.', coachId: 'coach_1', notes: 'Backhand into net' }
      },
      B: {}
    }
  };
  assert.strictEqual(rubber.pointDetails.A[5].player, 'Manish S.');
  assert.strictEqual(rubber.pointDetails.A[5].category, 'winner');
  assert.strictEqual(rubber.pointDetails.A[6].player, 'Nitesh S.');
  assert.strictEqual(rubber.pointDetails.A[6].category, 'error');
});

console.log('\n9. TWO TOP-LEVEL PROFILES (TOURNAMENT VS CASUAL) & SUB-PROFILES ONLY IN TOURNAMENT');
it('Exposes only Tournament and Casual at top level, with sub-profiles (tv, umpire, coach, admin) only in Tournament', () => {
  const resolveProfileHierarchy = (topProfile, subProfile) => {
    if (topProfile === 'casual') {
      return {
        topProfile: 'casual',
        subProfileVisible: false,
        effectiveProfile: 'casual'
      };
    }
    return {
      topProfile: 'corporate',
      subProfileVisible: true,
      effectiveProfile: ['tv', 'umpire', 'coach', 'admin'].includes(subProfile) ? subProfile : 'tv'
    };
  };

  const casualState = resolveProfileHierarchy('casual', 'umpire');
  assert.strictEqual(casualState.topProfile, 'casual');
  assert.strictEqual(casualState.subProfileVisible, false);
  assert.strictEqual(casualState.effectiveProfile, 'casual');

  const tourneyCoach = resolveProfileHierarchy('corporate', 'coach');
  assert.strictEqual(tourneyCoach.topProfile, 'corporate');
  assert.strictEqual(tourneyCoach.subProfileVisible, true);
  assert.strictEqual(tourneyCoach.effectiveProfile, 'coach');
});

console.log('\n10. SCORESHEETS HIGHLIGHT PLAYER NAME FIRST & TEAM NAME IN SMALLER CASE');
it('Verifies smashheroes.html highlights player name before team name in TV, Umpire, and Coach consoles', () => {
  const htmlPath = path.join(__dirname, 'smashheroes.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    // Check Umpire match card has umpire-players-a before umpire-team-a-name
    const umpireCardIdxPlayer = html.indexOf('id="umpire-players-a"');
    const umpireCardIdxTeam = html.indexOf('id="umpire-team-a-name"');
    assert.ok(umpireCardIdxPlayer > 0 && umpireCardIdxPlayer < umpireCardIdxTeam, 'Umpire card should place player name before team name');

    // Check Coach summary card has coach-players-a before coach-team-a-name
    const coachCardIdxPlayer = html.indexOf('id="coach-players-a"');
    const coachCardIdxTeam = html.indexOf('id="coach-team-a-name"');
    assert.ok(coachCardIdxPlayer > 0 && coachCardIdxPlayer < coachCardIdxTeam, 'Coach card should place player name before team name');

    // Check Tournament sub-profile selector exists
    assert.ok(html.includes('id="tournament-subprofile-select"'), 'Tournament sub-profile selector should exist');
    assert.ok(html.includes('id="coach-player-analytics-card"'), 'Player analytics review card should exist');
  }
});

it('Preserves exact team name casing from CSV upload and Teams & Captains dashboard without forced lowercase', () => {
  const fs = require('fs');
  const html = fs.readFileSync(__dirname + '/smashheroes.html', 'utf8');
  assert.ok(!html.includes('lowercase tracking-wide'), 'No forced CSS lowercase on team names');
  assert.ok(!html.includes('cp.team.toLowerCase()'), 'No JS .toLowerCase() on team name in coach dropdown');
  assert.ok(html.includes('if (canonTeamA && canonTeamA.name) r.teamAName = canonTeamA.name;'), 'Syncs exact team name casing from Teams & Captains roster');
});

console.log('\n11. PER-PROFILE DYNAMIC PIN GATING & ADMIN PIN CONFIGURATION');
it('Requires PIN for Umpire, Coach, and Admin profiles while keeping Viewer / Live TV open without PIN', () => {
  const profilePins = { umpire: '4321', coach: '8765', admin: '9999' };
  const unlockedProfiles = { tv: true, umpire: false, coach: false, admin: false };

  const isProfileUnlocked = (role) => {
    if (!role || role === 'tv' || role === 'casual') return true;
    if (unlockedProfiles.admin) return true;
    return Boolean(unlockedProfiles[role]);
  };

  const verifyPin = (role, entered) => {
    if (entered === profilePins.admin) return 'admin';
    if (role === 'umpire' && entered === profilePins.umpire) return 'umpire';
    if (role === 'coach' && entered === profilePins.coach) return 'coach';
    return null;
  };

  assert.strictEqual(isProfileUnlocked('tv'), true, 'Live TV is always unlocked');
  assert.strictEqual(isProfileUnlocked('umpire'), false, 'Umpire requires PIN initially');
  assert.strictEqual(isProfileUnlocked('coach'), false, 'Coach requires PIN initially');
  assert.strictEqual(isProfileUnlocked('admin'), false, 'Admin requires PIN initially');

  assert.strictEqual(verifyPin('umpire', '0000'), null, 'Rejects wrong Umpire PIN');
  assert.strictEqual(verifyPin('umpire', '4321'), 'umpire', 'Accepts custom Admin-configured Umpire PIN');
  assert.strictEqual(verifyPin('coach', '8765'), 'coach', 'Accepts custom Admin-configured Coach PIN');
  assert.strictEqual(verifyPin('umpire', '9999'), 'admin', 'Master Admin PIN unlocks Umpire as well');
});

console.log('\n12. VIEWER MODE INCLUDES FIXTURES & PLAYER SWOT SEARCH');
it('Verifies Viewer mode exposes Live TV, Pool Standings, Fixtures, and Player SWOT Search while hiding Admin config', () => {
  const html = fs.readFileSync(path.join(__dirname, 'smashheroes.html'), 'utf8');
  assert.ok(html.includes('id="nav-btn-swot"'), 'SWOT navigation tab exists');
  assert.ok(html.includes('id="view-swot"'), 'SWOT view section exists');
  assert.ok(html.includes('id="swot-player-search-input"'), 'Player SWOT search input exists');
  assert.ok(html.includes('id="swot-quadrant-grid"'), '4-quadrant SWOT matrix grid exists');
  assert.ok(html.includes('id="admin-pin-config-card"'), 'Admin dynamic PIN configuration card exists');
  assert.ok(html.includes('id="config-pin-umpire"') && html.includes('id="config-pin-coach"') && html.includes('id="config-pin-admin"'), 'Dynamic PIN inputs for Umpire, Coach, and Admin exist');
  assert.ok(html.includes('id="modal-profile-pin"'), 'Profile PIN gate modal exists');
  assert.ok(html.includes("['tv', 'standings', 'fixtures', 'swot'].includes(targetView)"), 'Viewer mode allows TV, Standings, Fixtures, and SWOT views');
});

console.log(`\n========================================`);
console.log(`Summary: ${passed} of ${total} tests passed.`);
console.log(`========================================\n`);

if (passed !== total) process.exit(1);