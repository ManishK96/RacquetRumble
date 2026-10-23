# Racquet Rumble & Badminton 101 - Dual-Profile Badminton Suite

A mobile-responsive Progressive Web App (PWA) and arena display engine for corporate badminton tournaments and casual weekend friend circles.

## 📱 Mobile-First Responsive Layout
- **Full Viewport Auto-Fit**: Optimized for all smartphone displays (360px–430px widths including iPhone SE, iPhone 14/15/16 Pro, Samsung Galaxy, and Google Pixel) without horizontal scrolling, clipping, or auto-zoom.
- **Auto-Fit Touchpads & Steppers**: Responsive score typography with dedicated `+` and `−` steppers right on the touchpads for instantaneous score adjustment and accidental tap undo.
- **Dedicated Scorer / Coach Console**: Rapid 1-tap shot classification (Smash, Drop, Drive, Net Kill, Ace, Unforced Error) designed for mobile courtside scorers.

---

## 🌟 Two Profiles in One App

Toggle between profiles seamlessly from the top header dropdown:

1. **🏢 Corporate League (Racquet Rumble)**
   - **8 Teams across 2 Pools** (Pool A & Pool B) with 6 players each (4 Male, 2 Female) and 1 designated Captain.
   - **6-Category Fixtures**: MS, MD, WS, XD, RMS, and RMD (single set of 21 points each).
   - **Mandatory Participation Rule**: Validates that all 6 roster players participate in at least one category.
   - **Single-Court Assignment**: The entire fixture runs sequentially on its assigned court console.
   - **Umpire Console**: Dual split touch pads, haptic feedback, audio whistle, and a rapid 2.5-second sliding shot-tagging drawer.
   - **Pool Table Standings**: Standings update only when all 6 rubbers in a fixture finish (winner awarded 2 pts). Includes an interactive **🔍 H2H Breakdown** showing match-by-match results against the other 3 pool teams.
   - **Office TV Live Hub**: 16:9 arena stream displaying all active courts and live standings ticker. Append `#tv` to the URL for clean TV mode.

2. **🏸 Casual Circle (Badminton 101)**
   - Tracks 3–8 friends in Singles (1v1) and Doubles (2v2) matches.
   - Monthly period filtering (October 2026, September 2026, All Time).
   - Standings table with wins, losses, win percentage, and total points won.
   - **👑 Adjudge Winner**: Confetti celebration for crowning the monthly champion.
   - **Head to Head & Partner Chemistry**: Direct 1v1 matchup breakdown and win rates when two players partner on the same team.
   - Quick badminton scoring presets (21-19, 21-15, 22-20, etc.).

---

## 🔒 View Only by Default & Role-Based Permissions

- **Default State (View Only)**:
  - Anyone can open the app and view live court scoreboards, pool standings, head-to-head records, and the Office TV Hub.
  - Scoring touchpads, court scheduling, lineup assignment, and match logging are locked to prevent accidental or unauthorized score edits.
- **Authorized Admin & Volunteer Access**:
  - **Admin Account**: `Manish.shreedhar@gmail.com` (authenticated via Google Sign-In with full access to assign courts, create fixtures, and manage lineups).
  - **Volunteer / Umpire Scoring Access**: Volunteers and court umpires unlock scoring access using the organizer PIN (shared offline by the tournament director).

---

## ☁️ Firebase Realtime Database & Authentication Setup

To sync scores in real-time across multiple court umpires, players, and office TV displays:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
2. Enable **Authentication**:
   - Go to **Build** → **Authentication** → **Sign-in method**.
   - Enable **Google** provider.
   - Under **Authorized domains**, add your GitHub Pages domain (`<username>.github.io`) and `localhost`.
3. Enable **Realtime Database**:
   - Go to **Build** → **Realtime Database** → **Create Database**.
   - Start in test mode or add the following security rules:
     ```json
     {
       "rules": {
         "racquet_rumble_shared_data": {
           ".read": true,
           ".write": "auth != null"
         }
       }
     }
     ```
4. Copy your Firebase Config:
   - In Project Settings (General), copy the Web app config snippet.
   - Paste it into the app via the **☁️ Cloud Sync** modal in the top header, or paste it directly into `EMBEDDED_FIREBASE_CONFIG` in `index.html`.

---

## 🚀 Live TV Display URL

To display the live multi-court arena stream on Smart TVs or projectors:
`https://<your-username>.github.io/<repo-name>/#tv`

---

## 🧪 Automated Test Suite (`test_engine.js`)

A zero-dependency test runner verifies all tournament mathematics and BWF edge cases:
- Single set of 21, 20–20 deuce lead requirements, and sudden-death cap at 30–29.
- 2-point pool award strictly upon completion of all 6 rubbers in a fixture.
- 6-player roster participation validator.
- Pool standings ranking engine (Pool Points → Rubbers Won → Points Won).
- Dedicated `+` and `−` stepper undo logic.
- Google Form / Excel roster import parsing.

Run tests locally:
```bash
node test_engine.js
```
