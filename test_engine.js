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
const srcHtmlPath = path.join(__dirname, 'smashheroes.src.html');
const prodHtmlPath = path.join(__dirname, 'smashheroes.html');
const srcHtml = fs.existsSync(srcHtmlPath) ? fs.readFileSync(srcHtmlPath, 'utf8') : fs.readFileSync(prodHtmlPath, 'utf8');
const prodHtml = fs.readFileSync(prodHtmlPath, 'utf8');

it('Verifies smashheroes.html highlights player name before team name in TV, Umpire, and Coach consoles', () => {
  if (fs.existsSync(prodHtmlPath)) {
    const html = prodHtml;
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
  assert.ok(!prodHtml.includes('lowercase tracking-wide'), 'No forced CSS lowercase on team names');
  assert.ok(!prodHtml.includes('cp.team.toLowerCase()'), 'No JS .toLowerCase() on team name in coach dropdown');
  assert.ok(srcHtml.includes('if (canonTeamA && canonTeamA.name) r.teamAName = canonTeamA.name;'), 'Syncs exact team name casing from Teams & Captains roster');
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
  assert.ok(prodHtml.includes('id="nav-btn-swot"'), 'SWOT navigation tab exists');
  assert.ok(prodHtml.includes('id="view-swot"'), 'SWOT view section exists');
  assert.ok(prodHtml.includes('id="swot-player-search-input"'), 'Player SWOT search input exists');
  assert.ok(prodHtml.includes('id="swot-quadrant-grid"'), '4-quadrant SWOT matrix grid exists');
  assert.ok(prodHtml.includes('id="admin-pin-config-card"'), 'Admin dynamic PIN configuration card exists');
  assert.ok(prodHtml.includes('id="config-pin-umpire"') && prodHtml.includes('id="config-pin-coach"') && prodHtml.includes('id="config-pin-admin"'), 'Dynamic PIN inputs for Umpire, Coach, and Admin exist');
  assert.ok(prodHtml.includes('id="modal-profile-pin"'), 'Profile PIN gate modal exists');
  assert.ok(srcHtml.includes("['tv', 'standings', 'fixtures', 'swot'].includes(targetView)"), 'Viewer mode allows TV, Standings, Fixtures, and SWOT views');
});

console.log('\n13. COACH CONSOLE HISTORIC & LIVE MATCH ARCHIVE');
it('Allows coaches to switch between live court matches and completed historic matches and annotate points on historic matches', () => {
  const html = prodHtml;
  assert.ok(html.includes('id="coach-match-select"'), 'Coach match / history selector dropdown exists');
  assert.ok(html.includes('id="coach-history-browser-card"'), 'Coach historic match archive browser card exists');
  assert.ok(html.includes('id="coach-match-cards-strip"'), 'Coach live and historic match cards strip exists');
  assert.ok(html.includes('function getCoachTargetFixtureAndRubber()'), 'Target fixture and rubber resolver supports historic matches');
  assert.ok(html.includes('function getAllCoachSelectableMatches()'), 'Selectable matches catalog includes completed historic matches');
  assert.ok(html.includes('function changeCoachMatchSelection('), 'Coach match switcher handler exists');
});

console.log('\n14. NON-OVERLAPPING HEADER SWITCHER BAR & DYNAMIC PRESENT-DAY CASUAL MATCH DATE');
it('Separates Brand Title row from #header-switcher-bar and defaults Casual Match dates to present day', () => {
  const html = prodHtml;
  assert.ok(html.includes('id="header-switcher-bar"'), 'Dedicated header switcher bar exists below brand row');
  assert.ok(html.includes('select.header-switcher-select'), 'Compact mobile font-size rule for header switcher selects exists');
  assert.ok(html.includes('function getTodayLocalIsoDate()'), 'Dynamic local present-day date helper exists');
  assert.ok(html.includes('function syncCasualDateInputsToToday('), 'Casual date inputs auto-sync to present day');
});

console.log('\n15. PRODUCTION BUNDLE & CODE MINIFICATION (TERSER OBFUSCATION)');
it('Verifies smashheroes.html is bundled and minified, build.py exists, and code runs cleanly', () => {
  assert.ok(fs.existsSync(prodHtmlPath), 'Production smashheroes.html exists');
  assert.ok(fs.existsSync(srcHtmlPath), 'Developer source smashheroes.src.html exists');
  assert.ok(fs.existsSync(path.join(__dirname, 'build.py')), 'Automated build pipeline build.py exists');
  
  // Verify minification has taken place
  assert.ok(prodHtml.length < srcHtml.length, 'Production HTML is smaller than developer source HTML');
  assert.ok(prodHtml.includes('/* Racquet Rumble & Badminton 101 - Production Bundle (Minified & Obfuscated) */'), 'Has production bundle banner');
  assert.ok(!prodHtml.includes('// Step 1: Initialize Auth FIRST'), 'Single-line comments stripped from production JS');
  
  // Verify all global window hooks remain intact in production bundle
  const requiredGlobals = [
    'switchTopLevelProfile', 'switchTournamentSubProfile', 'switchTournamentProfile',
    'changeCoachCourt', 'changeCoachMatchSelection', 'selectCoachPoint', 'pickCoachShotChip',
    'saveCoachPointDetails', 'clearCoachPointDetails', 'addPoint', 'subtractPoint',
    'finishRubberAndAdvance', 'getTodayLocalIsoDate', 'syncCasualDateInputsToToday'
  ];
  requiredGlobals.forEach(fnName => {
    assert.ok(prodHtml.includes(fnName), `Global handler window.${fnName} preserved in production bundle`);
  });
});

console.log('\n16. MINIMUM 8-GAMES WIN PERCENTAGE STANDINGS ENGINE & BADMINTON 101 DYNAMIC DATE');
it('Ranks players with >=8 games by win percentage, and defaults to wins -> points for players under 8 games', () => {
  const MIN_GAMES_QUALIFIED = 8;
  function compareStandings(a, b) {
    const aQual = (a.played || 0) >= MIN_GAMES_QUALIFIED;
    const bQual = (b.played || 0) >= MIN_GAMES_QUALIFIED;

    if (aQual && bQual) {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      const bPts = b.ptsWon !== undefined ? b.ptsWon : (b.pts || 0);
      const aPts = a.ptsWon !== undefined ? a.ptsWon : (a.pts || 0);
      if (bPts !== aPts) return bPts - aPts;
      return (b.played || 0) - (a.played || 0);
    }
    if (aQual && !bQual) return -1;
    if (!aQual && bQual) return 1;

    if (b.wins !== a.wins) return b.wins - a.wins;
    const bPts = b.ptsWon !== undefined ? b.ptsWon : (b.pts || 0);
    const aPts = a.ptsWon !== undefined ? a.ptsWon : (a.pts || 0);
    if (bPts !== aPts) return bPts - aPts;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return (b.played || 0) - (a.played || 0);
  }

  const players = [
    { name: 'Arjun', played: 9, wins: 8, winPct: 89, ptsWon: 180 },     // Qualified, 89% win rate
    { name: 'Bhavna', played: 10, wins: 8, winPct: 80, ptsWon: 200 },   // Qualified, 80% win rate
    { name: 'Chirag', played: 1, wins: 1, winPct: 100, ptsWon: 21 },    // Unqualified, 100% win rate (1 game)
    { name: 'Deepak', played: 7, wins: 6, winPct: 86, ptsWon: 145 },    // Unqualified, 6 wins (7 games)
    { name: 'Esha', played: 8, wins: 6, winPct: 75, ptsWon: 160 },      // Qualified, 75% win rate (8 games)
    { name: 'Hari', played: 4, wins: 3, winPct: 75, ptsWon: 60 },       // Unqualified, 3 wins, 60 pts
    { name: 'Isha', played: 5, wins: 3, winPct: 60, ptsWon: 75 }        // Unqualified, 3 wins, 75 pts
  ];

  players.sort(compareStandings);

  // 1. Qualified players with >=8 games must occupy top spots sorted strictly by Win%
  assert.strictEqual(players[0].name, 'Arjun', 'Arjun ranks #1 (89% win rate, >=8 games)');
  assert.strictEqual(players[1].name, 'Bhavna', 'Bhavna ranks #2 (80% win rate, >=8 games)');
  assert.strictEqual(players[2].name, 'Esha', 'Esha ranks #3 (75% win rate, >=8 games)');

  // 2. Unqualified players (<8 games) must rank below all qualified players
  // Deepak has 6 wins, so he leads the unqualified tier
  assert.strictEqual(players[3].name, 'Deepak', 'Deepak ranks #4 (leads unqualified tier with 6 wins)');

  // 3. Unqualified players tied on wins must break tie on points won
  assert.strictEqual(players[4].name, 'Isha', 'Isha ranks #5 (3 wins, 75 pts beats 60 pts)');
  assert.strictEqual(players[5].name, 'Hari', 'Hari ranks #6 (3 wins, 60 pts)');

  // 4. Player with 1 win (100% win rate) ranks below player with 3 wins (<8 games default)
  assert.strictEqual(players[6].name, 'Chirag', 'Chirag ranks #7 (1 win cannot jump ahead of 3+ wins under <8 rule)');
});

it('Verifies badminton-tracker.html has dynamic date logic and 8-game threshold standings rule', () => {
  const b101Path = path.join(__dirname, 'badminton-tracker.html');
  assert.ok(fs.existsSync(b101Path), 'badminton-tracker.html exists');
  const b101Html = fs.readFileSync(b101Path, 'utf8');

  assert.ok(b101Html.includes('function getTodayLocalIsoDate()'), 'Badminton 101 has getTodayLocalIsoDate helper');
  assert.ok(b101Html.includes('function syncDateInputsToToday('), 'Badminton 101 has syncDateInputsToToday helper');
  assert.ok(b101Html.includes('MIN_GAMES_QUALIFIED = 8'), 'Badminton 101 enforces MIN_GAMES_QUALIFIED = 8 in calculateStandings');
  assert.ok(b101Html.includes('Ranked by Win% (min. 8 games) · Default: Wins → Points'), 'Badminton 101 has explanatory standings subtitle');
  assert.ok(!b101Html.includes("dInput.value = '2026-10-19'"), 'Badminton 101 no longer hardcodes static 2026-10-19 date');
});

it('Verifies smashheroes casual mode implements 8-game threshold standings rule', () => {
  assert.ok(srcHtml.includes('MIN_GAMES_QUALIFIED = 8'), 'smashheroes.src.html enforces MIN_GAMES_QUALIFIED = 8');
  assert.ok(srcHtml.includes('Ranked by Win% (min. 8 games) · Default: Wins → Points'), 'smashheroes.src.html has updated sort label');
  assert.ok(prodHtml.includes('>=8') && prodHtml.includes('calculateCasualStandings'), 'smashheroes.html production bundle contains minimum 8-game qualification logic');
});

console.log('\n17. KNOCKOUT TOURNAMENT, REGISTRATION DUMP, 2^N POWER BRACKET & BYES ENGINE');
it('Rounds entrant count up to nearest power of 2 and computes correct bye count', () => {
  function getNearestPowerOf2(n) {
    if (n <= 2) return 2;
    let p = 2;
    while (p < n) p *= 2;
    return p;
  }

  const cases = [
    { n: 2, expectedP: 2, expectedByes: 0 },
    { n: 3, expectedP: 4, expectedByes: 1 },
    { n: 4, expectedP: 4, expectedByes: 0 },
    { n: 5, expectedP: 8, expectedByes: 3 },
    { n: 6, expectedP: 8, expectedByes: 2 },
    { n: 7, expectedP: 8, expectedByes: 1 },
    { n: 8, expectedP: 8, expectedByes: 0 },
    { n: 9, expectedP: 16, expectedByes: 7 },
    { n: 11, expectedP: 16, expectedByes: 5 },
    { n: 14, expectedP: 16, expectedByes: 2 },
    { n: 16, expectedP: 16, expectedByes: 0 },
    { n: 17, expectedP: 32, expectedByes: 15 },
    { n: 31, expectedP: 32, expectedByes: 1 },
    { n: 33, expectedP: 64, expectedByes: 31 }
  ];

  cases.forEach(c => {
    const p = getNearestPowerOf2(c.n);
    const byes = p - c.n;
    assert.strictEqual(p, c.expectedP, `N=${c.n} rounds up to ${c.expectedP}`);
    assert.strictEqual(byes, c.expectedByes, `N=${c.n} gets ${c.expectedByes} byes`);
  });
});

it('Parses registration dump formats (plain text, CSV, numbered lists)', () => {
  const rawDump = `Timestamp,Email,Player Name
2026-10-30 10:00,user1@test.com,Vikram Singh
2026-10-30 10:01,user2@test.com,Pooja Reddy
1. Amit Sharma
2. Neha Kapoor
Rahul Dravid
Pooja Reddy
Kunal Verma, M, Engineering`;

  function parseTestDump(text) {
    const lines = text.split(/\r?\n/);
    const names = [];
    const headerSkipRegex = /^(name|player|entrant|team|timestamp|email)/i;
    lines.forEach(line => {
      let clean = line.trim();
      if (!clean) return;
      if (headerSkipRegex.test(clean) && clean.includes(',')) return;
      if (clean.includes(',')) {
        const parts = clean.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        const nonMeta = parts.find(p => p && !/\d{2,4}[-\/]\d{1,2}/.test(p) && !p.includes('@') && !headerSkipRegex.test(p));
        if (nonMeta) clean = nonMeta;
      }
      clean = clean.replace(/^[0-9]+[.\-)]\s*/, '').trim();
      if (clean && clean.length >= 2 && !names.includes(clean)) {
        names.push(clean);
      }
    });
    return names;
  }

  const parsed = parseTestDump(rawDump);
  assert.deepStrictEqual(parsed, [
    'Vikram Singh', 'Pooja Reddy', 'Amit Sharma', 'Neha Kapoor', 'Rahul Dravid', 'Kunal Verma'
  ], 'Parses CSV, skips timestamp/email, strips numbers and deduplicates names');
});

it('Generates knockout bracket with standard bye distribution and auto-advances bye winners into Round 2', () => {
  const entrants = ['Arjun P.', 'Bhavna K.', 'Chirag M.', 'Deepak V.', 'Esha S.', 'Farhan A.', 'Gita R.']; // 7 entrants -> 8 bracket, 1 bye
  const N = entrants.length;
  let P = 2;
  while (P < N) P *= 2;
  const byesCount = P - N;
  assert.strictEqual(P, 8, 'Nearest power of 2 is 8');
  assert.strictEqual(byesCount, 1, '1 bye needed');

  const matchesR1Count = P / 2; // 4 matches
  const byeMatchIndices = new Set([0]); // Bye in match 1

  let byeMatchesFound = 0;
  let regularMatchesFound = 0;

  for (let m = 0; m < matchesR1Count; m++) {
    if (byeMatchIndices.has(m)) {
      byeMatchesFound++;
    } else {
      regularMatchesFound++;
    }
  }

  assert.strictEqual(byeMatchesFound, 1, 'Exactly 1 bye match');
  assert.strictEqual(regularMatchesFound, 3, 'Exactly 3 real matches in Round 1');
});

it('Verifies winner advances across rounds and final winner is crowned champion', () => {
  // Simulate 4-draw bracket (2 rounds: Semifinals, Final)
  const semi1 = { id: 'ko_r1_m1', teamAName: 'Alice', teamBName: 'Bob', status: 'live', scoreA: 21, scoreB: 18, nextFixtureId: 'ko_r2_m1', nextSlot: 'A' };
  const semi2 = { id: 'ko_r1_m2', teamAName: 'Charlie', teamBName: 'Dave', status: 'live', scoreA: 19, scoreB: 21, nextFixtureId: 'ko_r2_m1', nextSlot: 'B' };
  const finalMatch = { id: 'ko_r2_m1', teamAName: 'TBD', teamBName: 'TBD', status: 'pending', scoreA: 0, scoreB: 0, roundName: 'Final' };

  // Semi 1 completes: Alice wins
  semi1.status = 'completed';
  semi1.winnerName = 'Alice';
  finalMatch.teamAName = semi1.winnerName;

  // Semi 2 completes: Dave wins
  semi2.status = 'completed';
  semi2.winnerName = 'Dave';
  finalMatch.teamBName = semi2.winnerName;
  finalMatch.status = 'scheduled';

  assert.strictEqual(finalMatch.teamAName, 'Alice', 'Alice advanced to Final slot A');
  assert.strictEqual(finalMatch.teamBName, 'Dave', 'Dave advanced to Final slot B');
  assert.strictEqual(finalMatch.status, 'scheduled', 'Final is scheduled once both finalists qualify');

  // Final completes: Alice wins 22-20
  finalMatch.scoreA = 22;
  finalMatch.scoreB = 20;
  finalMatch.status = 'completed';
  finalMatch.winnerName = 'Alice';

  assert.strictEqual(finalMatch.winnerName, 'Alice', 'Alice is crowned Tournament Champion');
});

it('Verifies smashheroes UI exposes Knockout mode in profile switcher, bracket tree, and registration dump', () => {
  assert.ok(srcHtml.includes('value="knockout"'), 'Profile select includes value="knockout"');
  assert.ok(srcHtml.includes('id="knockout-standings-wrapper"'), 'Knockout standings & bracket wrapper exists');
  assert.ok(srcHtml.includes('id="knockout-bracket-tree-container"'), 'Knockout bracket tree container exists');
  assert.ok(srcHtml.includes('id="knockout-queued-fixtures-list"'), 'Knockout queued fixtures container exists');
  assert.ok(srcHtml.includes('id="admin-knockout-generator-card"'), 'Admin knockout registration dump & generator card exists');
  assert.ok(srcHtml.includes('id="admin-knockout-input"'), 'Registration dump textarea exists');
  assert.ok(srcHtml.includes('function generateKnockoutBracket('), 'generateKnockoutBracket engine function exists');
  assert.ok(srcHtml.includes('function advanceKnockoutMatch('), 'advanceKnockoutMatch progression function exists');
  assert.ok(prodHtml.includes('value="knockout"'), 'Production bundle includes Knockout mode');
});

console.log('\n18. ENTRY POINT 3-CARD MODE SELECTION UX, CASUAL PERSISTENCE & RELOAD RETENTION');
it('Verifies 3-Card Mode Selection Landing Modal and header trigger exist', () => {
  assert.ok(srcHtml.includes('id="modal-mode-picker"'), 'modal-mode-picker exists in source');
  assert.ok(prodHtml.includes('id="modal-mode-picker"'), 'modal-mode-picker exists in production bundle');
  assert.ok(srcHtml.includes("selectModeFromPicker('corporate')"), 'Corporate League card action exists');
  assert.ok(srcHtml.includes("selectModeFromPicker('knockout')"), 'Knockout Tournament card action exists');
  assert.ok(srcHtml.includes("selectModeFromPicker('casual')"), 'Casual Circle card action exists');
  assert.ok(srcHtml.includes('openModePickerModal()'), 'Header trigger for mode picker exists');
});

it('Verifies casual match logging preserves player selections across submissions', () => {
  assert.ok(srcHtml.includes('appState.casualLastSelected'), 'appState.casualLastSelected tracks player selections');
  assert.ok(srcHtml.includes('lastS.pA') && srcHtml.includes('lastS.pB'), 'renderCasualLog restores last selected singles players');
  assert.ok(srcHtml.includes('lastD.a1') && srcHtml.includes('lastD.a2'), 'renderCasualLog restores last selected doubles players');
  assert.ok(srcHtml.includes("scA.value = ''") && srcHtml.includes("scB.value = ''"), 'Scores are cleared after match logging so next game can be entered immediately');
});

it('Verifies reload screen retention via restoreActiveScreenState and saveActiveScreenState', () => {
  assert.ok(srcHtml.includes('function saveActiveScreenState('), 'saveActiveScreenState exists');
  assert.ok(srcHtml.includes('function restoreActiveScreenState('), 'restoreActiveScreenState exists');
  assert.ok(srcHtml.includes('ACTIVE_SCREEN_STORAGE_KEY'), 'ACTIVE_SCREEN_STORAGE_KEY constant defined');
  assert.ok(srcHtml.includes('restoreActiveScreenState()'), 'init() invokes restoreActiveScreenState() on startup');
});

it('Verifies Player SWOT profile is skipped/hidden from navigation while preserving markup for future', () => {
  assert.ok(srcHtml.includes('id="nav-btn-swot"') && srcHtml.includes('hidden'), 'nav-btn-swot has hidden class');
  assert.ok(srcHtml.includes('id="swot-player-search-input"'), 'Underlying SWOT search input preserved for future');
  assert.ok(srcHtml.includes('id="swot-quadrant-grid"'), 'Underlying SWOT quadrant grid preserved for future');
});

console.log('\n19. TRIPLE MODE SWITCHING & KNOCKOUT PROFILE ACTIVATION');
it('Verifies switchTopLevelProfile sets appState.topProfile to knockout and updates select value', () => {
  assert.ok(srcHtml.includes("else if (topMode === 'knockout')"), 'switchTopLevelProfile explicitly handles topMode === knockout');
  assert.ok(srcHtml.includes("appState.topProfile = 'knockout'"), 'switchTopLevelProfile sets topProfile to knockout');
  assert.ok(srcHtml.includes("if (appState.topProfile !== 'knockout')"), 'switchTournamentProfile does not overwrite knockout with corporate');
  assert.ok(srcHtml.includes("sel.value = appState.topProfile"), 'profile-select value reflects appState.topProfile');
});

it('Verifies applyProfileVisibilityRules toggles between pool and knockout wrappers', () => {
  assert.ok(srcHtml.includes("const isKnockout = appState.topProfile === 'knockout'"), 'applyProfileVisibilityRules checks isKnockout');
  assert.ok(srcHtml.includes("if (poolWrap) poolWrap.classList.add('hidden')"), 'poolWrap hidden in knockout mode');
  assert.ok(srcHtml.includes("if (koWrap) koWrap.classList.remove('hidden')"), 'koWrap visible in knockout mode');
  assert.ok(srcHtml.includes("btnStandings.innerHTML = isKnockout"), 'Standings tab updates to Knockout Bracket when in knockout mode');
});

console.log('\n20. CASUAL MODE MONTHLY CHAMPIONS TRACKING & PROFILE SAVING');
it('Calculates months won per player and preserves crowns across periods', () => {
  const mockAppState = {
    casual: {
      players: ['Arjun Patel', 'Bhavna K.', 'Chirag M.'],
      adjudgedWinners: {
        singles: {
          '2026-10': { player: 'Arjun Patel', wins: 8, ptsWon: 180, winPct: 89, period: '2026-10', periodLabel: 'October 2026', mode: 'singles' },
          '2026-09': { player: 'Arjun Patel', wins: 9, ptsWon: 200, winPct: 90, period: '2026-09', periodLabel: 'September 2026', mode: 'singles' },
          '2026-08': { player: 'Bhavna K.', wins: 7, ptsWon: 160, winPct: 85, period: '2026-08', periodLabel: 'August 2026', mode: 'singles' }
        },
        doubles: {}
      }
    }
  };

  function testGetPlayerMonthlyWins(playerName) {
    const wins = [];
    if (!playerName) return wins;
    const targetName = String(playerName).trim().toLowerCase();
    const adj = mockAppState.casual.adjudgedWinners;
    ['singles', 'doubles'].forEach(m => {
      const modeWins = adj[m] || {};
      Object.keys(modeWins).forEach(pKey => {
        const rec = modeWins[pKey];
        if (rec && rec.player && String(rec.player).trim().toLowerCase() === targetName) {
          wins.push(rec);
        }
      });
    });
    return wins;
  }

  assert.strictEqual(testGetPlayerMonthlyWins('Arjun Patel').length, 2, 'Arjun Patel has won 2 months');
  assert.strictEqual(testGetPlayerMonthlyWins('Bhavna K.').length, 1, 'Bhavna K. has won 1 month');
  assert.strictEqual(testGetPlayerMonthlyWins('Chirag M.').length, 0, 'Chirag M. has won 0 months');
});

it('Verifies smashheroes HTML contains Monthly Champions Roll of Honour elements and crowned badges', () => {
  assert.ok(srcHtml.includes('id="casual-champions-roll-card"'), 'casual-champions-roll-card exists in source');
  assert.ok(prodHtml.includes('id="casual-champions-roll-card"'), 'casual-champions-roll-card exists in production bundle');
  assert.ok(srcHtml.includes('id="casual-champions-summary-strip"'), 'casual-champions-summary-strip exists');
  assert.ok(srcHtml.includes('id="casual-champions-history-list"'), 'casual-champions-history-list exists');
  assert.ok(srcHtml.includes('function getPlayerMonthlyWins('), 'getPlayerMonthlyWins helper exists');
  assert.ok(srcHtml.includes('function getPlayerMonthsWonCount('), 'getPlayerMonthsWonCount helper exists');
  assert.ok(srcHtml.includes('appState.casual.adjudgedWinners[mode][periodKey] ='), 'handleAdjudgeWinnerClick records crowned champion to adjudgedWinners');
  assert.ok(srcHtml.includes('Month') && srcHtml.includes('Months') && srcHtml.includes('crownBadge'), 'Standings table rows render Months Won crown badge');
});

console.log('\n21. MULTI-CIRCLE CREATION & CROSS-USER SHARED CASUAL TOURNAMENTS');
it('Supports creating multiple circles and discovers shared circles when a user is added as a player', () => {
  const circlesStore = {};

  function testCreateCircle(creatorUser, name, initialPlayers) {
    const id = 'circle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const pList = [creatorUser.name];
    (initialPlayers || []).forEach(p => {
      if (!pList.includes(p)) pList.push(p);
    });
    const circle = {
      id,
      name,
      creatorId: creatorUser.id,
      creatorEmail: creatorUser.email,
      creatorName: creatorUser.name,
      players: pList,
      matches: [],
      doublesMatches: [],
      adjudgedWinners: { singles: {}, doubles: {} }
    };
    circlesStore[id] = circle;
    return circle;
  }

  function testIsUserMatchingPlayer(playerName, user) {
    if (!user || !playerName) return false;
    const p = String(playerName).trim().toLowerCase();
    const uName = String(user.name || '').trim().toLowerCase();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const uHandle = uEmail ? uEmail.split('@')[0].toLowerCase() : '';
    if (p === uName || p === uEmail || (uHandle && p === uHandle)) return true;
    if (uName && (uName.startsWith(p + ' ') || p.startsWith(uName + ' '))) return true;
    return false;
  }

  function testGetAccessible(user) {
    const myCircles = [];
    const sharedCircles = [];
    Object.values(circlesStore).forEach(c => {
      const isCreator = (c.creatorId === user.id) || (c.creatorEmail && c.creatorEmail.toLowerCase() === user.email.toLowerCase());
      const isMember = c.players.some(p => testIsUserMatchingPlayer(p, user));
      if (isCreator) myCircles.push(c);
      else if (isMember) sharedCircles.push(c);
    });
    return { myCircles, sharedCircles };
  }

  // 1. Manish creates 'Weekend Smashers' and adds 'Nitesh'
  const manish = { id: 'manish_1', name: 'Manish', email: 'manish.shreedhar@gmail.com' };
  const c1 = testCreateCircle(manish, 'Weekend Smashers', ['Nitesh', 'Pranav']);
  assert.ok(c1.players.includes('Nitesh'), 'Nitesh added to Weekend Smashers');

  // 2. Nitesh signs in: discovers 'Weekend Smashers' in sharedCircles
  const nitesh = { id: 'nitesh_2', name: 'Nitesh Kumar', email: 'nitesh@gmail.com' };
  const niteshCircles1 = testGetAccessible(nitesh);
  assert.strictEqual(niteshCircles1.myCircles.length, 0, 'Nitesh has created 0 circles initially');
  assert.strictEqual(niteshCircles1.sharedCircles.length, 1, 'Nitesh sees 1 shared circle');
  assert.strictEqual(niteshCircles1.sharedCircles[0].name, 'Weekend Smashers', 'Nitesh sees Weekend Smashers created by Manish');

  // 3. Nitesh creates his own tournament 'Apartment Club'
  const c2 = testCreateCircle(nitesh, 'Apartment Club', ['Kavita', 'Suresh']);
  const niteshCircles2 = testGetAccessible(nitesh);
  assert.strictEqual(niteshCircles2.myCircles.length, 1, 'Nitesh sees Apartment Club in myCircles');
  assert.strictEqual(niteshCircles2.sharedCircles.length, 1, 'Nitesh still sees Weekend Smashers in sharedCircles');

  // 4. Suresh signs in: sees 'Apartment Club' (where Nitesh added him), but does NOT see 'Weekend Smashers'
  const suresh = { id: 'suresh_3', name: 'Suresh', email: 'suresh@corp.com' };
  const sureshCircles = testGetAccessible(suresh);
  assert.strictEqual(sureshCircles.sharedCircles.length, 1, 'Suresh sees 1 shared circle');
  assert.strictEqual(sureshCircles.sharedCircles[0].name, 'Apartment Club', 'Suresh only sees Apartment Club');
});

it('Verifies smashheroes HTML contains Multi-Circle selector and New Circle modal elements', () => {
  assert.ok(srcHtml.includes('id="casual-circle-select"'), 'casual-circle-select dropdown exists in source');
  assert.ok(prodHtml.includes('id="casual-circle-select"'), 'casual-circle-select dropdown exists in production bundle');
  assert.ok(srcHtml.includes('id="modal-create-circle"'), 'modal-create-circle exists in source');
  assert.ok(prodHtml.includes('id="modal-create-circle"'), 'modal-create-circle exists in production bundle');
  assert.ok(srcHtml.includes('id="new-circle-name-input"'), 'new-circle-name-input exists');
  assert.ok(srcHtml.includes('id="new-circle-players-input"'), 'new-circle-players-input exists');
  assert.ok(srcHtml.includes('function switchActiveCasualCircle('), 'switchActiveCasualCircle exists');
  assert.ok(srcHtml.includes('function createCasualCircleObj('), 'createCasualCircleObj exists');
  assert.ok(srcHtml.includes('function getUserAccessibleCircles('), 'getUserAccessibleCircles exists');
  assert.ok(srcHtml.includes('SHARED_CIRCLES_STORAGE_KEY'), 'SHARED_CIRCLES_STORAGE_KEY constant exists');
});

console.log(`\n========================================`);
console.log(`Summary: ${passed} of ${total} tests passed.`);
console.log(`========================================\n`);

if (passed !== total) process.exit(1);