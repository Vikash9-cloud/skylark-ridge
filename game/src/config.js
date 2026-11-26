// Skylark Ridge — every tuning number and colour in one place.
// Logical playfield is 1280x720; the renderer scales it to the window.
export const FIELD = { width: 1280, height: 720, horizonY: 292 };
export const STEP = 1 / 60;
export const LIVES = 3;
export const FOCAL = 330;
export const WORLD = {
  maxLateral: 46,
  cruiseAlt: 26,
  minAlt: 4,
  maxAlt: 72,
  baseSpeed: 34,
  maxSpeed: 62,
  ringEvery: 170,
  fuelMax: 100,
  // Fuel is a real decision now: at full throttle the burn (0.85 x 1.45)
  // outruns the +4 fuel a ring gives, so full-throttle flying slowly
  // drains the tank and cruise throttle sustains it; missing rings hurts.
  fuelBurn: 0.85,
  ringFuel: 4,
  ringPoints: 100,
  // Risk-vs-reward hooks (allowed by the rules: fun/depth, fuel/damage
  // decisions, missions with different goals). Golden rings every 5th
  // spawn are worth +250 and +8 fuel; threading a ring near its edge is a
  // near miss (+150); skimming the valley floor builds Ridge Runner +25s.
  goldenEvery: 5,
  goldenPoints: 250,
  // Golden rings pay in points only (+250), not extra fuel: +8 fuel
  // undid the fuel decision (autopilot fuel rose to 77%), so fuel stays +4.
  goldenFuel: 4,
  nearMissPoints: 150,
  skimPoints: 25,
  skimSeconds: 2,
};
export const PALETTE = {
  skyTop: '#2b6fc4', skyMid: '#7fbde8', skyLow: '#ffd9a0',
  sun: '#fff3c4', sunGlow: '#ffdf8a',
  mountainFar: '#7d8fb5', mountainNear: '#5d7396', snow: '#f4f8ff',
  fieldGreen: ['#5da24a', '#6fb457', '#4c8f3e', '#7fae4e', '#8aa84f'],
  fieldWheat: '#d9b45c', fieldPlough: '#9a6b42', fieldMeadow: '#79c25f',
  river: '#4aa8d8', road: '#5a5a60', runway: '#3d4148', runwayMark: '#f5f2e6',
  townRoof: '#c65b4a', townWall: '#e8dcc8',
  planeBody: '#f2f5f7', planeBelly: '#d8433c', planeTrim: '#1e6fb8',
  planeGlass: '#17324a', hudBg: 'rgba(8,22,38,0.72)', hudLine: '#7fd4ff',
  hudText: '#eaf7ff', hudAmber: '#ffc44d', hudGreen: '#7dff9e', hudRed: '#ff6b5e',
  ring: '#ffd23e', ringGlow: '#ff9d00',
  panel: 'rgba(10,26,44,0.82)', text: '#eef6ff', muted: '#b9d2e6',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'skylark-ridge.best';
export const GAME_NAME = 'Skylark Ridge';
