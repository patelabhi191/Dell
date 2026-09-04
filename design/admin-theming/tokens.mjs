/* One token table. Both the prototypes and the eventual build read from this,
   so the four skins cannot drift apart. */
export const THEMES = [
  { id: 'terminal', label: 'Terminal Classic', note: 'Charcoal chrome, trapezoid plaque',
    tok: {
      bg: '#2f3134', 'bg-image': 'linear-gradient(180deg, #3a3d41 0%, #2b2d30 58%, #232528 100%)',
      ink: '#eceef0', muted: '#b0b6bd', hair: 'rgba(255,255,255,0.13)', rule: 'rgba(255,255,255,0.16)', 'mark-ink': '#d8dbdf',
      acc1: '#c9a227', 'on-acc1': '#221a05', 'acc1-text': '#e0b93a', 'on-live': '#1c0703', acc2: '#4a9d6b', acc3: '#8b1f28', acc4: '#3b6ea5', live: '#e0563f',
      'rank-bg': 'rgba(255,255,255,0.10)', 'row-hover': 'rgba(255,255,255,0.06)', 'dot-idle': 'rgba(255,255,255,0.22)',
      'font-display': "'Oswald', 'Helvetica Neue', sans-serif", 'font-body': "'Barlow', 'Helvetica Neue', sans-serif",
      'word-family': "'Oswald', sans-serif", 'word-size': '26px', 'word-track': '0.24em', 'word-weight': '300', 'word-shadow': 'none',
      'plaque-bg': 'linear-gradient(180deg, #43464a 0%, #303336 100%)', 'plaque-border': '1px solid rgba(255,255,255,0.16)',
      'plaque-ink': '#f2f4f6', 'plaque-sub': '#8d9298', 'plaque-shadow': 'none',
      frame1: '2px solid #c9a227', frame2: '2px solid #4a9d6b', frame3: '2px dashed rgba(255,255,255,0.22)', frame4: '2px solid #3b6ea5',
      art1: 'linear-gradient(180deg, rgba(201,162,39,0.20) 0%, rgba(201,162,39,0.07) 60%, rgba(0,0,0,0.32) 100%)',
      art2: 'linear-gradient(180deg, rgba(74,157,107,0.20) 0%, rgba(74,157,107,0.07) 60%, rgba(0,0,0,0.32) 100%)',
      art3: 'rgba(255,255,255,0.03)', art4: 'linear-gradient(180deg, #3a3d41 0%, #2a2c2f 100%)',
      band1: 'linear-gradient(180deg, #3c3f43 0%, #2c2f32 100%)', band2: 'linear-gradient(180deg, #3c3f43 0%, #2c2f32 100%)',
      band3: 'rgba(255,255,255,0.06)', band4: 'linear-gradient(180deg, #3c3f43 0%, #2c2f32 100%)',
      bink1: '#f2f4f6', bink2: '#f2f4f6', bink3: '#9aa0a6', bink4: '#f2f4f6', 'band-track': '0.14em',
      'tile-bg': '#26282b', 'tile-radius': '5px', 'tile-shadow': '0 8px 20px rgba(0,0,0,0.42)', 'tile-hover': '0 20px 38px rgba(0,0,0,0.62)',
      'art-meta': '#e6e8ea', 'art-meta-bg': 'rgba(0,0,0,0.45)', 'art-shadow': '0 6px 16px rgba(0,0,0,0.55)',
      'card-face': '#f4f1e8', 'suit-edge': 'rgba(244,241,232,0.40)', 'logo-ink': '#14161a', 'logo-muted': '#5f636a', 'logo-spade': '#14161a', 'logo-bar': '#c9a227',
      'logo-ring': 'rgba(255,255,255,0.2)', 'logo-hub': '#c9a227', 'logo-hub-ink': '#221a05',
      'suit-dark': '#14161a', 'suit-red': '#a8242f', 'box-line': '#1c1e21', 'ghost-line': 'rgba(255,255,255,0.3)',
      panel: 'rgba(255,255,255,0.045)', 'panel-border': '1px solid rgba(255,255,255,0.12)', 'panel-radius': '6px', 'panel-shadow': 'none',
      'strip-bg': 'linear-gradient(180deg, #34373b 0%, #26282b 100%)', 'strip-border': '1px solid rgba(255,255,255,0.14)',
      'strip-radius': '8px', 'strip-shadow': '0 6px 18px rgba(0,0,0,0.3)', 'strip-ink': '#f2f4f6', 'strip-muted': '#9aa0a6',
      'strip-accent': '#c9a227', 'strip-hair': 'rgba(255,255,255,0.16)', 'strip-icon-bg': 'rgba(201,162,39,0.15)',
      'resume-bg': 'linear-gradient(180deg, #d4ac2c 0%, #a8811c 100%)', 'resume-ink': '#221a05', 'resume-border': 'none',
      'resume-shadow': '0 3px 10px rgba(0,0,0,0.4)', 'resume-radius': '10px',
      'ground-plate': 'rgba(255,255,255,0.07)', 'ground-ink': '#eceef0', 'ground-muted': '#9aa0a6',
      bulb: '#e7dcc0', 'bulb-glow': 'rgba(231,220,192,0.85)',
    } },

  { id: 'slot', label: 'Slot Machine', note: 'Red carnival, marquee bulbs, confetti',
    tok: {
      bg: '#cf3a30', 'bg-image': 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 46px, transparent 46px, transparent 92px)',
      ink: '#17244d', muted: '#5c6484', hair: '#dfe3f0', rule: 'rgba(255,255,255,0.4)', 'mark-ink': '#ffe066',
      acc1: '#2440a8', 'on-acc1': '#ffffff', 'acc1-text': '#2440a8', 'on-live': '#ffffff', acc2: '#f7b500', acc3: '#00a878', acc4: '#17244d', live: '#e8342c',
      'rank-bg': '#e4e8f6', 'row-hover': 'rgba(36,64,168,0.08)', 'dot-idle': 'rgba(255,255,255,0.5)',
      'font-display': "'Titan One', 'Arial Black', sans-serif", 'font-body': "'Mulish', 'Helvetica Neue', sans-serif",
      'word-family': "'Titan One', sans-serif", 'word-size': '25px', 'word-track': 'normal', 'word-weight': '400', 'word-shadow': 'none',
      'plaque-bg': '#17244d', 'plaque-border': '3px solid #ffffff', 'plaque-ink': '#ffe066', 'plaque-sub': '#9aa6cf',
      'plaque-shadow': '5px 5px 0 rgba(23,36,77,0.4)',
      frame1: '3px solid #17244d', frame2: '3px solid #17244d', frame3: '3px dashed #b9c2dd', frame4: '3px solid #17244d',
      art1: 'linear-gradient(180deg, rgba(36,64,168,0.16) 0%, #ffffff 100%)', art2: 'linear-gradient(180deg, rgba(247,181,0,0.20) 0%, #ffffff 100%)',
      art3: '#f4f6fc', art4: '#eef1fa',
      band1: '#2440a8', band2: '#f7b500', band3: '#dde3f2', band4: '#17244d',
      bink1: '#ffffff', bink2: '#17244d', bink3: '#6d7699', bink4: '#ffffff', 'band-track': '0.05em',
      'tile-bg': '#ffffff', 'tile-radius': '14px', 'tile-shadow': '5px 5px 0 #17244d', 'tile-hover': '10px 13px 0 #17244d',
      'art-meta': '#17244d', 'art-meta-bg': 'rgba(255,255,255,0.9)', 'art-shadow': '0 6px 14px rgba(23,36,77,0.28)',
      'card-face': '#ffffff', 'suit-edge': '#b9c4e6', 'logo-ink': '#17244d', 'logo-muted': '#616a8c', 'logo-spade': '#101317', 'logo-bar': '#f7b500',
      'logo-ring': 'rgba(23,36,77,0.25)', 'logo-hub': '#e8342c', 'logo-hub-ink': '#ffffff',
      'suit-dark': '#17244d', 'suit-red': '#e8342c', 'box-line': '#17244d', 'ghost-line': '#b9c2dd',
      panel: '#ffffff', 'panel-border': '3px solid #17244d', 'panel-radius': '12px', 'panel-shadow': '5px 5px 0 #17244d',
      'strip-bg': '#ffffff', 'strip-border': '3px solid #17244d', 'strip-radius': '12px', 'strip-shadow': '5px 5px 0 #17244d',
      'strip-ink': '#17244d', 'strip-muted': '#6d7699', 'strip-accent': '#e8342c', 'strip-hair': '#dfe3f0', 'strip-icon-bg': '#ffe9a8',
      'resume-bg': '#2440a8', 'resume-ink': '#ffffff', 'resume-border': '3px solid #17244d', 'resume-shadow': 'none', 'resume-radius': '10px',
      'ground-plate': 'rgba(23,36,77,0.94)', 'ground-ink': '#ffffff', 'ground-muted': 'rgba(255,255,255,0.88)',
      bulb: '#ffe066', 'bulb-glow': 'rgba(255,224,102,0.95)',
    } },

  { id: 'neon', label: 'Neon Terminal', note: 'Indigo, flickering neon tube',
    tok: {
      bg: '#241350', 'bg-image': 'radial-gradient(58% 40% at 16% 0%, rgba(255,42,163,0.34) 0%, transparent 68%), radial-gradient(52% 38% at 88% 4%, rgba(0,229,255,0.30) 0%, transparent 66%)',
      ink: '#f5f0ff', muted: '#a892d8', hair: 'rgba(255,255,255,0.14)', rule: 'rgba(255,255,255,0.18)', 'mark-ink': '#00e5ff',
      acc1: '#ff2aa3', 'on-acc1': '#1a0b33', 'acc1-text': '#ff85c8', 'on-live': '#2b0417', acc2: '#00e5ff', acc3: '#b4ff39', acc4: '#ffcc00', live: '#ff2aa3',
      'rank-bg': 'rgba(255,255,255,0.10)', 'row-hover': 'rgba(255,42,163,0.14)', 'dot-idle': 'rgba(255,255,255,0.22)',
      'font-display': "'Outfit', 'Helvetica Neue', sans-serif", 'font-body': "'Outfit', 'Helvetica Neue', sans-serif",
      'word-family': "'Monoton', cursive", 'word-size': '25px', 'word-track': '0.07em', 'word-weight': '400',
      'word-shadow': '0 0 12px #00e5ff, 0 0 30px #ff2aa3',
      'plaque-bg': 'rgba(255,255,255,0.05)', 'plaque-border': '2px solid #00e5ff', 'plaque-ink': '#ffffff', 'plaque-sub': '#a892d8',
      'plaque-shadow': '0 0 26px rgba(0,229,255,0.4), inset 0 0 24px rgba(255,42,163,0.2)',
      frame1: '2px solid #ff2aa3', frame2: '2px solid #00e5ff', frame3: '2px dashed rgba(255,255,255,0.28)', frame4: '2px solid #ffcc00',
      art1: 'radial-gradient(80% 70% at 50% 42%, rgba(255,42,163,0.22) 0%, rgba(255,255,255,0.03) 72%)',
      art2: 'radial-gradient(80% 70% at 50% 42%, rgba(0,229,255,0.22) 0%, rgba(255,255,255,0.03) 72%)',
      art3: 'rgba(255,255,255,0.03)', art4: 'rgba(255,255,255,0.06)',
      band1: 'rgba(255,42,163,0.16)', band2: 'rgba(0,229,255,0.16)', band3: 'rgba(255,255,255,0.07)', band4: 'rgba(255,255,255,0.09)',
      bink1: '#ff2aa3', bink2: '#00e5ff', bink3: '#a892d8', bink4: '#ffffff', 'band-track': '0.12em',
      'tile-bg': 'rgba(255,255,255,0.05)', 'tile-radius': '14px', 'tile-shadow': '0 0 22px rgba(255,42,163,0.22)', 'tile-hover': '0 0 46px rgba(255,42,163,0.6)',
      'art-meta': '#f5f0ff', 'art-meta-bg': 'rgba(36,19,80,0.72)', 'art-shadow': '0 6px 18px rgba(0,0,0,0.5)',
      'card-face': '#f7f2ff', 'suit-edge': 'rgba(247,242,255,0.42)', 'logo-ink': '#241350', 'logo-muted': '#6b5b96', 'logo-spade': '#150f1c', 'logo-bar': '#00e5ff',
      'logo-ring': 'rgba(255,255,255,0.25)', 'logo-hub': '#ff2aa3', 'logo-hub-ink': '#1a0b33',
      'suit-dark': '#241350', 'suit-red': '#ff2aa3', 'box-line': '#1a0f3d', 'ghost-line': 'rgba(180,255,57,0.6)',
      panel: 'rgba(255,255,255,0.055)', 'panel-border': '1px solid rgba(255,255,255,0.16)', 'panel-radius': '14px', 'panel-shadow': '0 0 24px rgba(0,229,255,0.10)',
      'strip-bg': 'rgba(255,255,255,0.06)', 'strip-border': '2px solid #ff2aa3', 'strip-radius': '14px', 'strip-shadow': '0 0 30px rgba(255,42,163,0.3)',
      'strip-ink': '#ffffff', 'strip-muted': '#a892d8', 'strip-accent': '#00e5ff', 'strip-hair': 'rgba(255,255,255,0.18)', 'strip-icon-bg': 'rgba(0,229,255,0.14)',
      'resume-bg': '#ff2aa3', 'resume-ink': '#1a0b33', 'resume-border': 'none', 'resume-shadow': '0 0 24px rgba(255,42,163,0.7)', 'resume-radius': '10px',
      'ground-plate': 'rgba(255,255,255,0.08)', 'ground-ink': '#f5f0ff', 'ground-muted': '#c3b0ea',
      bulb: '#00e5ff', 'bulb-glow': 'rgba(0,229,255,0.95)',
    } },

  { id: 'tropical', label: 'Tropical Table', note: 'Turquoise felt, arched plaque',
    tok: {
      bg: '#12b0a0', 'bg-image': 'radial-gradient(circle at 88% 4%, rgba(255,183,3,0.35) 0%, transparent 34%), radial-gradient(circle at 6% 96%, rgba(255,111,89,0.28) 0%, transparent 36%)',
      ink: '#0f3d38', muted: '#3f6a64', hair: '#d6f2ec', rule: 'rgba(255,255,255,0.45)', 'mark-ink': '#fff3d0',
      acc1: '#ff6f59', 'on-acc1': '#0a2a26', 'acc1-text': '#b3301a', 'on-live': '#3d1109', acc2: '#0f8c80', acc3: '#ffb703', acc4: '#0f3d38', live: '#ff6f59',
      'rank-bg': '#d4f0ea', 'row-hover': 'rgba(18,176,160,0.12)', 'dot-idle': 'rgba(255,255,255,0.55)',
      'font-display': "'Fredoka', 'Trebuchet MS', sans-serif", 'font-body': "'Quicksand', 'Helvetica Neue', sans-serif",
      'word-family': "'Fredoka', sans-serif", 'word-size': '27px', 'word-track': 'normal', 'word-weight': '600', 'word-shadow': 'none',
      'plaque-bg': '#ffffff', 'plaque-border': '4px solid #0f3d38', 'plaque-ink': '#0f3d38', 'plaque-sub': '#7fa79f',
      'plaque-shadow': '0 8px 0 rgba(15,61,56,0.28)',
      frame1: '4px solid #ffffff', frame2: '4px solid #ffffff', frame3: '4px dashed rgba(255,255,255,0.85)', frame4: '4px solid #0f3d38',
      art1: 'linear-gradient(180deg, rgba(255,111,89,0.20) 0%, #ffffff 100%)', art2: 'linear-gradient(180deg, rgba(15,140,128,0.18) 0%, #ffffff 100%)',
      art3: 'rgba(255,255,255,0.6)', art4: '#e2efe8',
      band1: '#ff6f59', band2: '#0f8c80', band3: '#d4f0ea', band4: '#0f3d38',
      bink1: '#ffffff', bink2: '#ffffff', bink3: '#5c8c85', bink4: '#ffffff', 'band-track': '0.04em',
      'tile-bg': '#ffffff', 'tile-radius': '26px', 'tile-shadow': '0 10px 0 rgba(15,61,56,0.28)', 'tile-hover': '0 20px 0 rgba(15,61,56,0.32)',
      'art-meta': '#0f3d38', 'art-meta-bg': 'rgba(255,255,255,0.9)', 'art-shadow': '0 7px 16px rgba(15,61,56,0.24)',
      'card-face': '#ffffff', 'suit-edge': '#a8ddd4', 'logo-ink': '#0f3d38', 'logo-muted': '#3f6e68', 'logo-spade': '#101a17', 'logo-bar': '#ffb703',
      'logo-ring': 'rgba(15,61,56,0.22)', 'logo-hub': '#ff6f59', 'logo-hub-ink': '#ffffff',
      'suit-dark': '#0f3d38', 'suit-red': '#ff6f59', 'box-line': '#0f3d38', 'ghost-line': '#8fc9c0',
      panel: '#ffffff', 'panel-border': '3px solid #ffffff', 'panel-radius': '20px', 'panel-shadow': '0 8px 0 rgba(15,61,56,0.2)',
      'strip-bg': '#ffffff', 'strip-border': '4px solid #0f3d38', 'strip-radius': '999px', 'strip-shadow': '0 8px 0 rgba(15,61,56,0.28)',
      'strip-ink': '#0f3d38', 'strip-muted': '#5c8c85', 'strip-accent': '#ff6f59', 'strip-hair': '#d6f2ec', 'strip-icon-bg': '#ffe6d9',
      'resume-bg': '#ff6f59', 'resume-ink': '#ffffff', 'resume-border': 'none', 'resume-shadow': '0 6px 0 #c9503e', 'resume-radius': '999px',
      'ground-plate': 'rgba(255,255,255,0.92)', 'ground-ink': '#06322d', 'ground-muted': 'rgba(6,50,45,0.78)',
      bulb: '#ffe9a8', 'bulb-glow': 'rgba(255,233,168,0.95)',
    } },

  { id: 'glassdark', label: 'Frosted Dark', note: 'iOS glass over a night wallpaper',
    tok: {
      'bg': '#07070b', 'bg-image': 'radial-gradient(closest-side at 14% 16%, #3a3690 0%, #3a3690 56%, transparent 58%), radial-gradient(closest-side at 47% 6%, #0f5590 0%, #0f5590 52%, transparent 54%), radial-gradient(closest-side at 86% 22%, #1c7d86 0%, #1c7d86 52%, transparent 54%), radial-gradient(closest-side at 66% 52%, #2a3a94 0%, #2a3a94 48%, transparent 50%), radial-gradient(closest-side at 22% 62%, #6a2f86 0%, #6a2f86 50%, transparent 52%), radial-gradient(closest-side at 92% 78%, #12706b 0%, #12706b 50%, transparent 52%), radial-gradient(closest-side at 40% 92%, #3d2f8e 0%, #3d2f8e 52%, transparent 54%), linear-gradient(160deg, #131328 0%, #0b0b16 55%, #08080e 100%)', 'ink': '#f7f7fa', 'muted': '#a8adb8',
      'hair': 'rgba(255,255,255,0.18)', 'rule': 'rgba(255,255,255,0.22)', 'mark-ink': '#f5f5f7', 'acc1': '#0a84ff',
      'on-acc1': '#021428', 'acc1-text': '#4da6ff', 'on-live': '#2a0210', 'acc2': '#3ec98a', 'acc3': '#bf5af2',
      'acc4': '#7f8aa8', 'live': '#ff375f', 'rank-bg': 'rgba(255,255,255,0.07)', 'row-hover': 'rgba(255,255,255,0.055)',
      'dot-idle': 'rgba(255,255,255,0.26)', 'font-display': "-apple-system, 'SF Pro Rounded', 'Fredoka', sans-serif", 'font-body': "-apple-system, 'SF Pro Text', 'Quicksand', sans-serif", 'word-family': "-apple-system, 'SF Pro Rounded', 'Fredoka', sans-serif",
      'word-size': '25px', 'word-track': '-0.01em', 'word-weight': '700', 'word-shadow': 'none',
      'plaque-bg': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.22%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 100%), rgba(22,22,28,0.34)", 'plaque-border': '1px solid rgba(255,255,255,0.18)', 'plaque-ink': '#ffffff', 'plaque-sub': 'rgba(235,235,245,0.66)',
      'plaque-shadow': 'inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 24px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.18), 0 16px 48px rgba(0,0,0,0.40)', 'frame1': '1px solid rgba(10,132,255,0.60)', 'frame2': '1px solid rgba(48,201,138,0.55)', 'frame3': '1px dashed rgba(255,255,255,0.22)',
      'frame4': '1px solid rgba(160,120,220,0.55)', 'art1': 'linear-gradient(180deg, rgba(10,132,255,0.16) 0%, rgba(255,255,255,0.02) 100%)', 'art2': 'linear-gradient(180deg, rgba(48,201,138,0.14) 0%, rgba(255,255,255,0.02) 100%)', 'art3': 'rgba(255,255,255,0.02)',
      'art4': 'linear-gradient(180deg, rgba(160,120,220,0.14) 0%, rgba(255,255,255,0.02) 100%)', 'band1': 'rgba(255,255,255,0.10)', 'band2': 'rgba(255,255,255,0.10)', 'band3': 'rgba(255,255,255,0.045)',
      'band4': 'rgba(255,255,255,0.10)', 'bink1': '#ffffff', 'bink2': '#ffffff', 'bink3': 'rgba(235,235,245,0.55)',
      'bink4': '#ffffff', 'band-track': '-0.01em', 'tile-bg': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.22%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.025) 100%), rgba(16,16,21,0.46)", 'tile-radius': '22px',
      'tile-shadow': 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(255,255,255,0.05), inset 0 0 24px rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.20), 0 16px 48px rgba(0,0,0,0.44)', 'tile-hover': 'inset 0 1px 0 rgba(255,255,255,0.44), inset 0 -1px 0 rgba(255,255,255,0.07), inset 0 0 24px rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.22), 0 16px 48px rgba(0,0,0,0.55)', 'art-meta': '#ffffff', 'art-meta-bg': 'rgba(0,0,0,0.34)',
      'art-shadow': '0 8px 24px rgba(0,0,0,0.45)', 'card-face': '#ffffff', 'suit-edge': 'rgba(255,255,255,0.32)', 'logo-ink': '#0b0b10',
      'logo-muted': '#6b6f7a', 'logo-spade': '#0b0b10', 'logo-bar': '#0a84ff', 'logo-ring': 'rgba(255,255,255,0.26)',
      'logo-hub': '#0a84ff', 'logo-hub-ink': '#ffffff', 'suit-dark': '#0b0b10', 'suit-red': '#ff375f',
      'box-line': '#0b0b10', 'ghost-line': 'rgba(255,255,255,0.34)', 'panel': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.22%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.035) 46%, rgba(255,255,255,0.012) 100%), rgba(16,16,21,0.52)", 'panel-border': '1px solid rgba(255,255,255,0.14)',
      'panel-radius': '18px', 'panel-shadow': 'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(255,255,255,0.05), inset 0 0 24px rgba(255,255,255,0.045), 0 1px 2px rgba(0,0,0,0.20), 0 16px 48px rgba(0,0,0,0.42)', 'strip-bg': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.22%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 100%), rgba(16,16,21,0.48)", 'strip-border': '1px solid rgba(255,255,255,0.15)',
      'strip-radius': '20px', 'strip-shadow': 'inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.05), inset 0 0 24px rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.20), 0 16px 48px rgba(0,0,0,0.44)', 'strip-ink': '#ffffff', 'strip-muted': 'rgba(235,235,245,0.66)',
      'strip-accent': '#64b5ff', 'strip-hair': 'rgba(255,255,255,0.18)', 'strip-icon-bg': 'rgba(10,132,255,0.20)', 'resume-bg': 'linear-gradient(180deg, #0a84ff 0%, #0058cc 100%)',
      'resume-ink': '#ffffff', 'resume-border': '1px solid rgba(255,255,255,0.25)', 'resume-shadow': '0 8px 24px rgba(10,132,255,0.40)', 'resume-radius': '14px',
      'ground-plate': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.22%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%), rgba(16,16,21,0.40)", 'ground-ink': '#f5f5f7', 'ground-muted': 'rgba(235,235,245,0.66)', 'bulb': '#ffffff',
      'bulb-glow': 'rgba(255,255,255,0.70)',
    } },

  { id: 'glasslight', label: 'Frosted Light', note: 'iOS glass over a bright wallpaper',
    tok: {
      'bg': '#e9edf5', 'bg-image': 'radial-gradient(closest-side at 14% 16%, #c9cff5 0%, #c9cff5 56%, transparent 58%), radial-gradient(closest-side at 47% 6%, #bfdcf6 0%, #bfdcf6 52%, transparent 54%), radial-gradient(closest-side at 86% 22%, #c2e9e3 0%, #c2e9e3 52%, transparent 54%), radial-gradient(closest-side at 66% 52%, #d3d8fa 0%, #d3d8fa 48%, transparent 50%), radial-gradient(closest-side at 22% 62%, #e2d2f2 0%, #e2d2f2 50%, transparent 52%), radial-gradient(closest-side at 92% 78%, #c8ebe4 0%, #c8ebe4 50%, transparent 52%), radial-gradient(closest-side at 40% 92%, #cdd3f6 0%, #cdd3f6 52%, transparent 54%), linear-gradient(160deg, #f4f7fd 0%, #e9edf5 55%, #e4e9f3 100%)', 'ink': '#1c1c1e', 'muted': '#5c6069',
      'hair': 'rgba(60,60,67,0.16)', 'rule': 'rgba(60,60,67,0.20)', 'mark-ink': '#1c1c1e', 'acc1': '#0064d2',
      'on-acc1': '#ffffff', 'acc1-text': '#0057b8', 'on-live': '#3a0603', 'acc2': '#1c8c3c', 'acc3': '#8944ab',
      'acc4': '#3a3aed', 'live': '#ff3b30', 'rank-bg': 'rgba(60,60,67,0.08)', 'row-hover': 'rgba(0,100,210,0.08)',
      'dot-idle': 'rgba(60,60,67,0.24)', 'font-display': "-apple-system, 'SF Pro Rounded', 'Fredoka', sans-serif", 'font-body': "-apple-system, 'SF Pro Text', 'Quicksand', sans-serif", 'word-family': "-apple-system, 'SF Pro Rounded', 'Fredoka', sans-serif",
      'word-size': '25px', 'word-track': '-0.01em', 'word-weight': '700', 'word-shadow': 'none',
      'plaque-bg': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.16%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.48) 100%), rgba(255,255,255,0.16)", 'plaque-border': '1px solid rgba(255,255,255,0.92)', 'plaque-ink': '#1c1c1e', 'plaque-sub': 'rgba(60,60,67,0.66)',
      'plaque-shadow': 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.12), inset 0 0 24px rgba(255,255,255,0.34), 0 1px 2px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.12)', 'frame1': '1px solid rgba(0,100,210,0.45)', 'frame2': '1px solid rgba(28,140,60,0.45)', 'frame3': '1px dashed rgba(60,60,67,0.30)',
      'frame4': '1px solid rgba(137,68,171,0.45)', 'art1': 'linear-gradient(180deg, rgba(0,100,210,0.20) 0%, rgba(255,255,255,0.30) 100%)', 'art2': 'linear-gradient(180deg, rgba(28,140,60,0.18) 0%, rgba(255,255,255,0.30) 100%)', 'art3': 'rgba(255,255,255,0.30)',
      'art4': 'linear-gradient(180deg, rgba(137,68,171,0.18) 0%, rgba(255,255,255,0.30) 100%)', 'band1': 'rgba(0,100,210,0.86)', 'band2': 'rgba(20,120,52,0.86)', 'band3': 'rgba(255,255,255,0.55)',
      'band4': 'rgba(118,58,148,0.86)', 'bink1': '#ffffff', 'bink2': '#ffffff', 'bink3': 'rgba(60,60,67,0.66)',
      'bink4': '#ffffff', 'band-track': '-0.01em', 'tile-bg': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.16%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.38) 100%), rgba(255,255,255,0.16)", 'tile-radius': '22px',
      'tile-shadow': 'inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -1px 0 rgba(255,255,255,0.10), inset 0 0 24px rgba(255,255,255,0.28), 0 1px 2px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.12)', 'tile-hover': 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.12), inset 0 0 24px rgba(255,255,255,0.38), 0 1px 2px rgba(0,0,0,0.10), 0 16px 48px rgba(0,0,0,0.20)', 'art-meta': '#1c1c1e', 'art-meta-bg': 'rgba(255,255,255,0.75)',
      'art-shadow': '0 8px 24px rgba(17,24,39,0.18)', 'card-face': '#ffffff', 'suit-edge': 'rgba(60,60,67,0.28)', 'logo-ink': '#1c1c1e',
      'logo-muted': '#7a7e88', 'logo-spade': '#1c1c1e', 'logo-bar': '#0064d2', 'logo-ring': 'rgba(60,60,67,0.20)',
      'logo-hub': '#0064d2', 'logo-hub-ink': '#ffffff', 'suit-dark': '#1c1c1e', 'suit-red': '#d70015',
      'box-line': '#1c1c1e', 'ghost-line': 'rgba(60,60,67,0.32)', 'panel': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.16%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.42) 100%), rgba(255,255,255,0.18)", 'panel-border': '1px solid rgba(255,255,255,0.85)',
      'panel-radius': '18px', 'panel-shadow': 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.10), inset 0 0 24px rgba(255,255,255,0.30), 0 1px 2px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.12)', 'strip-bg': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.16%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.46) 100%), rgba(255,255,255,0.18)", 'strip-border': '1px solid rgba(255,255,255,0.90)',
      'strip-radius': '20px', 'strip-shadow': 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.10), inset 0 0 24px rgba(255,255,255,0.32), 0 1px 2px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.12)', 'strip-ink': '#1c1c1e', 'strip-muted': 'rgba(60,60,67,0.66)',
      'strip-accent': '#0064d2', 'strip-hair': 'rgba(60,60,67,0.16)', 'strip-icon-bg': 'rgba(0,100,210,0.14)', 'resume-bg': 'linear-gradient(180deg, #0a84ff 0%, #0064d2 100%)',
      'resume-ink': '#ffffff', 'resume-border': '1px solid rgba(255,255,255,0.45)', 'resume-shadow': '0 8px 24px rgba(0,100,210,0.30)', 'resume-radius': '14px',
      'ground-plate': "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.16%22/%3E%3C/svg%3E\") repeat, linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.46) 100%), rgba(255,255,255,0.18)", 'ground-ink': '#1c1c1e', 'ground-muted': 'rgba(60,60,67,0.70)', 'bulb': '#ffffff',
      'bulb-glow': 'rgba(255,255,255,0.85)',
    } },

  { id: 'midnight', label: 'Midnight Studio', note: 'Black ground, electric accents',
    tok: {
      'bg': '#0b0b0f', 'bg-image': 'radial-gradient(72% 48% at 50% -12%, rgba(124,108,255,0.24) 0%, transparent 70%)', 'ink': '#f2f2f5', 'muted': '#9a9aa6',
      'hair': 'rgba(255,255,255,0.10)', 'rule': 'rgba(255,255,255,0.14)', 'mark-ink': '#f2f2f5', 'acc1': '#7c6cff',
      'on-acc1': '#100826', 'acc1-text': '#a99bff', 'on-live': '#33110c', 'acc2': '#3fddb4', 'acc3': '#ffd84d',
      'acc4': '#4cc2ff', 'live': '#ff6b5a', 'rank-bg': 'rgba(255,255,255,0.07)', 'row-hover': 'rgba(124,108,255,0.14)',
      'dot-idle': 'rgba(255,255,255,0.20)', 'font-display': "'Space Grotesk', 'Outfit', sans-serif", 'font-body': "'Outfit', 'Quicksand', sans-serif", 'word-family': "'Space Grotesk', 'Outfit', sans-serif",
      'word-size': '24px', 'word-track': '-0.02em', 'word-weight': '700', 'word-shadow': 'none',
      'plaque-bg': '#17171f', 'plaque-border': '2px solid #2c2c38', 'plaque-ink': '#f2f2f5', 'plaque-sub': '#9a9aa6',
      'plaque-shadow': '5px 5px 0 rgba(124,108,255,0.55)', 'frame1': '2px solid #7c6cff', 'frame2': '2px solid #3fddb4', 'frame3': '2px dashed rgba(255,255,255,0.22)',
      'frame4': '2px solid #4cc2ff', 'art1': 'linear-gradient(180deg, rgba(124,108,255,0.34) 0%, rgba(11,11,15,0.92) 100%)', 'art2': 'linear-gradient(180deg, rgba(63,221,180,0.28) 0%, rgba(11,11,15,0.92) 100%)', 'art3': 'rgba(255,255,255,0.03)',
      'art4': 'linear-gradient(180deg, rgba(76,194,255,0.28) 0%, rgba(11,11,15,0.92) 100%)', 'band1': '#7c6cff', 'band2': '#3fddb4', 'band3': 'rgba(255,255,255,0.06)',
      'band4': '#4cc2ff', 'bink1': '#100826', 'bink2': '#04231a', 'bink3': '#9a9aa6',
      'bink4': '#04203a', 'band-track': '-0.01em', 'tile-bg': '#141419', 'tile-radius': '14px',
      'tile-shadow': '6px 6px 0 rgba(0,0,0,0.55)', 'tile-hover': '10px 10px 0 rgba(124,108,255,0.55)', 'art-meta': '#f2f2f5', 'art-meta-bg': 'rgba(0,0,0,0.55)',
      'art-shadow': '4px 4px 0 rgba(0,0,0,0.50)', 'card-face': '#f5f2ea', 'suit-edge': 'rgba(245,242,234,0.40)', 'logo-ink': '#0b0b0f',
      'logo-muted': '#5a5a66', 'logo-spade': '#0b0b0f', 'logo-bar': '#ffd84d', 'logo-ring': 'rgba(255,255,255,0.18)',
      'logo-hub': '#ff6b5a', 'logo-hub-ink': '#33110c', 'suit-dark': '#0b0b0f', 'suit-red': '#ff6b5a',
      'box-line': '#0b0b0f', 'ghost-line': 'rgba(255,255,255,0.26)', 'panel': '#17171f', 'panel-border': '1px solid #26262f',
      'panel-radius': '14px', 'panel-shadow': 'none', 'strip-bg': '#17171f', 'strip-border': '2px solid #7c6cff',
      'strip-radius': '14px', 'strip-shadow': '5px 5px 0 rgba(124,108,255,0.30)', 'strip-ink': '#f2f2f5', 'strip-muted': '#9a9aa6',
      'strip-accent': '#3fddb4', 'strip-hair': 'rgba(255,255,255,0.12)', 'strip-icon-bg': 'rgba(124,108,255,0.22)', 'resume-bg': '#ffd84d',
      'resume-ink': '#2b2100', 'resume-border': 'none', 'resume-shadow': '5px 5px 0 rgba(0,0,0,0.55)', 'resume-radius': '12px',
      'ground-plate': 'rgba(255,255,255,0.08)', 'ground-ink': '#f2f2f5', 'ground-muted': '#a6a6b2', 'bulb': '#ffd84d',
      'bulb-glow': 'rgba(255,216,77,0.80)',
    } },

  { id: 'daylight', label: 'Daylight Studio', note: 'Warm white, the same accents',
    tok: {
      'bg': '#f4f1ea', 'bg-image': 'radial-gradient(72% 48% at 50% -12%, rgba(91,75,232,0.12) 0%, transparent 70%)', 'ink': '#14141a', 'muted': '#6b6862',
      'hair': '#e2ddd1', 'rule': '#d8d2c4', 'mark-ink': '#14141a', 'acc1': '#5b4be8',
      'on-acc1': '#ffffff', 'acc1-text': '#5b4be8', 'on-live': '#33100a', 'acc2': '#0a7a63', 'acc3': '#e2a01a',
      'acc4': '#1f63cc', 'live': '#e8503a', 'rank-bg': 'rgba(20,20,26,0.06)', 'row-hover': 'rgba(91,75,232,0.09)',
      'dot-idle': 'rgba(20,20,26,0.20)', 'font-display': "'Space Grotesk', 'Outfit', sans-serif", 'font-body': "'Outfit', 'Quicksand', sans-serif", 'word-family': "'Space Grotesk', 'Outfit', sans-serif",
      'word-size': '24px', 'word-track': '-0.02em', 'word-weight': '700', 'word-shadow': 'none',
      'plaque-bg': '#ffffff', 'plaque-border': '2px solid #14141a', 'plaque-ink': '#14141a', 'plaque-sub': '#6b6862',
      'plaque-shadow': '5px 5px 0 #5b4be8', 'frame1': '2px solid #5b4be8', 'frame2': '2px solid #0a7a63', 'frame3': '2px dashed #cfc9ba',
      'frame4': '2px solid #1f63cc', 'art1': 'linear-gradient(180deg, rgba(91,75,232,0.18) 0%, rgba(255,255,255,0.92) 100%)', 'art2': 'linear-gradient(180deg, rgba(10,122,99,0.16) 0%, rgba(255,255,255,0.92) 100%)', 'art3': 'rgba(20,20,26,0.03)',
      'art4': 'linear-gradient(180deg, rgba(31,99,204,0.16) 0%, rgba(255,255,255,0.92) 100%)', 'band1': '#5b4be8', 'band2': '#0a7a63', 'band3': '#efece1',
      'band4': '#1f63cc', 'bink1': '#ffffff', 'bink2': '#ffffff', 'bink3': '#6b6862',
      'bink4': '#ffffff', 'band-track': '-0.01em', 'tile-bg': '#ffffff', 'tile-radius': '14px',
      'tile-shadow': '5px 5px 0 rgba(20,20,26,0.10)', 'tile-hover': '9px 9px 0 rgba(91,75,232,0.30)', 'art-meta': '#14141a', 'art-meta-bg': 'rgba(255,255,255,0.82)',
      'art-shadow': '4px 4px 0 rgba(20,20,26,0.12)', 'card-face': '#ffffff', 'suit-edge': '#cfc9ba', 'logo-ink': '#14141a',
      'logo-muted': '#8a857a', 'logo-spade': '#14141a', 'logo-bar': '#e2a01a', 'logo-ring': 'rgba(20,20,26,0.14)',
      'logo-hub': '#e8503a', 'logo-hub-ink': '#33100a', 'suit-dark': '#14141a', 'suit-red': '#d8402c',
      'box-line': '#14141a', 'ghost-line': '#cfc9ba', 'panel': '#ffffff', 'panel-border': '1px solid #e2ddd1',
      'panel-radius': '14px', 'panel-shadow': 'none', 'strip-bg': '#ffffff', 'strip-border': '2px solid #14141a',
      'strip-radius': '14px', 'strip-shadow': '5px 5px 0 rgba(91,75,232,0.25)', 'strip-ink': '#14141a', 'strip-muted': '#6b6862',
      'strip-accent': '#5b4be8', 'strip-hair': '#e2ddd1', 'strip-icon-bg': 'rgba(91,75,232,0.12)', 'resume-bg': '#5b4be8',
      'resume-ink': '#ffffff', 'resume-border': 'none', 'resume-shadow': '5px 5px 0 rgba(20,20,26,0.18)', 'resume-radius': '12px',
      'ground-plate': 'rgba(20,20,26,0.06)', 'ground-ink': '#14141a', 'ground-muted': '#6b6862', 'bulb': '#e2a01a',
      'bulb-glow': 'rgba(226,160,26,0.70)',
    } },
];

export const FONTS = 'Oswald:wght@300;400;500;600&family=Barlow:wght@400;500;600;700&family=Titan+One&family=Mulish:wght@400;600;700;800&family=Monoton&family=Outfit:wght@300;400;500;600;700&family=Fredoka:wght@500;600;700&family=Quicksand:wght@400;500;600;700&family=Space+Grotesk:wght@500;700';

export const tokenCss = (indent = '    ') => THEMES.map((t) =>
  `${indent}[data-theme="${t.id}"] {\n` +
  Object.entries(t.tok).map(([k, v]) => `${indent}  --${k}: ${v};`).join('\n') +
  `\n${indent}}`).join('\n');

/* structural switches — not colour, so they are rules rather than tokens */
export const structuralCss = (indent = '    ') => `
${indent}/* plaque shape */
${indent}[data-theme="terminal"] .pshape { clip-path: polygon(0 0, 100% 0, 100% 64%, 88% 100%, 12% 100%, 0 64%); border-radius: 0; }
${indent}[data-theme="slot"] .pshape { border-radius: 10px; }
${indent}[data-theme="neon"] .pshape { border-radius: 12px; }
${indent}[data-theme="tropical"] .pshape { border-radius: 26px 26px 12px 12px; }
${indent}/* marquee bulbs: slot only */
${indent}.bulbs { display: none; }
${indent}[data-theme="slot"] .bulbs { display: flex; }
${indent}/* ambient effect: exactly one per theme */
${indent}.conf, .felt { display: none; }
${indent}[data-theme="slot"] .conf { display: block; }
${indent}[data-theme="tropical"] .felt { display: block; }
${indent}[data-theme="neon"] .wordmark { animation: dcFlicker 7s steps(1, end) infinite; }
${indent}[data-theme="glassdark"] .pshape, [data-theme="glasslight"] .pshape { border-radius: 22px; }
${indent}[data-theme="midnight"] .pshape { border-radius: 14px; }
${indent}[data-theme="daylight"] .pshape { border-radius: 14px; }
${indent}/* frosted glass: the chrome is blurred, never the rows inside it. Dozens of
${indent}   backdrop-filtered layers per screen is what makes glassmorphism crawl on a
${indent}   phone, and rows sitting on an already-frosted panel gain nothing from it. */
${indent}/* Material tiers. iOS does not blur everything by the same amount — nav
${indent}   chrome is a thinner, brighter material than the cards it floats over, and
${indent}   the filter darkens (or lightens) the backdrop as well as blurring it. That
${indent}   difference between tiers is most of what reads as depth. */
${indent}:is([data-theme="glassdark"], [data-theme="glasslight"])
${indent}  :is(.pshape, .deskhead, .pagehead, .tabs, .livecount, .backlink, .opmark) {
${indent}  -webkit-backdrop-filter: blur(30px) saturate(190%) brightness(0.88);
${indent}  backdrop-filter: blur(30px) saturate(190%) brightness(0.88);
${indent}}
${indent}:is([data-theme="glassdark"], [data-theme="glasslight"])
${indent}  :is(.bar, .panel, .console, .podwrap, .ledger, .sheetpanel, .setpanel, .themecard, .tile) {
${indent}  -webkit-backdrop-filter: blur(22px) saturate(175%) brightness(0.94);
${indent}  backdrop-filter: blur(22px) saturate(175%) brightness(0.94);
${indent}}
${indent}[data-theme="glasslight"]
${indent}  :is(.pshape, .deskhead, .pagehead, .tabs, .livecount, .backlink, .opmark) {
${indent}  -webkit-backdrop-filter: blur(30px) saturate(190%) brightness(1.08);
${indent}  backdrop-filter: blur(30px) saturate(190%) brightness(1.08);
${indent}}
${indent}[data-theme="glasslight"]
${indent}  :is(.bar, .panel, .console, .podwrap, .ledger, .sheetpanel, .setpanel, .themecard, .tile) {
${indent}  -webkit-backdrop-filter: blur(22px) saturate(175%) brightness(1.04);
${indent}  backdrop-filter: blur(22px) saturate(175%) brightness(1.04);
${indent}}
${indent}/* the glass skins want iOS geometry: continuous corners and hairline rules */
${indent}:is([data-theme="glassdark"], [data-theme="glasslight"]) :is(.pod, .pick, .lrow, .row) {
${indent}  border-radius: 12px;
${indent}}
`;
