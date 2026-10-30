# Racquet Rumble & Badminton 101 - Triple-Mode Badminton Suite

A mobile-responsive Progressive Web App (PWA) and arena display engine for corporate pool leagues, open knockout tournaments, and casual weekend friend circles.

## 🚀 Instant Deployment (Zero Build Steps Required)
- **Direct Launch**: The repository already includes pre-built, production-minified `index.html` (and standalone `badminton-tracker.html`). You can commit directly to GitHub and enable **GitHub Pages** (or drag & drop to Netlify / Vercel) with **zero server setup, zero dependencies, and zero build commands**.
- **Developer Pipeline**: If you edit source code in the future, run `python3 build.py` to re-minify and generate `smashheroes.html` / `index.html`.

---

## 🌟 Three Modes in One App

1. **🏢 Corporate League (Pool Mode)**
   - **8 Teams across 2 Pools** (Pool A & Pool B) with 6 players each (4 Male, 2 Female) and 1 designated Captain.
   - **6-Category Fixtures**: MS, MD, WS, XD, RMS, and RMD (single set of 21 points each).
   - **Mandatory Participation Rule**: Validates that all 6 roster players participate in at least one category.
   - **Pool Table Standings**: Standings update once all 6 rubbers in a fixture finish, breaking ties via head-to-head.

2. **⚡ Knockout Tournament (Elimination Bracket Mode - NEW)**
   - **Registration Form Dump**: Organisers can dump registration form data (Google Form responses, Excel CSV, or a list of player/team names).
   - **Randomised Draw & Nearest 2^n Sizing**: Rounds up entrant count to the nearest power of 2 (4, 8, 16, 32, 64) and automatically assigns standard tournament Byes.
   - **Bye Auto-Advancement**: Bye recipients advance automatically to Round 2 without playing Round 1.
   - **Next Set of Fixtures (Court Queue)**: Replaces pool tables with a live Next Set of Fixtures queue (live courts + up next in line) and an interactive visual Knockout Bracket tree.
   - **Seamless Scoring**: Umpire and Coach consoles score and track knockout matches on Courts 1-4 with identical steppers and shot logs, auto-advancing winners to the next round.
   - **Championship Crowning**: Winner of the Grand Final is crowned Tournament Champion with confetti celebration.

3. **🏸 Casual Circle (Badminton 101)**
   - Tracks friends in Singles (1v1) and Doubles (2v2) matches.
   - **8-Game Win% Rule**: Players with 8+ matches in a month qualify for win percentage ranking; otherwise ranks by wins then points.
   - **👑 Adjudge Winner**: Crowning celebration for the monthly champion.
   - **Head to Head & Partner Chemistry**: Direct 1v1 matchup breakdown and win rates when two players partner on the same team.

---

## 🔒 Role-Based Profiles & Dynamic PINs
- `Viewer / Live TV`: Open to all viewers without a PIN. TV Hub, Next Fixtures Queue, Bracket Tree, and Player SWOT.
- `Umpire Profile`: Secured via dynamic PIN. Court officiating console with `+` and `−` steppers, deuce sudden-death logic, and rapid shot drawer.
- `Coach Profile`: Secured via dynamic PIN. 1-21 horizontal point graph, shot/notes logging, and historic match archive browser.
- `Admin Profile`: Secured via master PIN. Full tournament config, registration dump, randomised draw generator, and PIN manager.

---

## 🧪 Automated Test Suite (`test_engine.js`)
34 zero-dependency unit and regression tests verify all tournament mathematics:
- Single set of 21, 20–20 deuce lead requirements, and sudden-death cap at 30–29.
- 2-point pool award strictly upon completion of all 6 rubbers in a fixture.
- 6-player roster participation validator.
- 8-game threshold Win% standings comparator engine.
- Nearest power of 2 bracket sizing and standard bye distribution.
- Winner progression and championship crowning in Knockout tournaments.
- Dedicated `+` and `−` stepper undo logic.
- Dynamic present-day local date synchronization.

Run tests locally:
```bash
node test_engine.js
```
