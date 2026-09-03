/* One token table. Both the prototypes and the eventual build read from this,
   so the four skins cannot drift apart. */
export const THEMES = [
  { id: 'terminal', label: 'Terminal Classic', note: 'Charcoal chrome, trapezoid plaque',
    tok: {
      bg: '#2f3134', 'bg-image': 'linear-gradient(180deg, #3a3d41 0%, #2b2d30 58%, #232528 100%)',
      ink: '#eceef0', muted: '#9aa0a6', hair: 'rgba(255,255,255,0.13)', rule: 'rgba(255,255,255,0.16)', 'mark-ink': '#d8dbdf',
      acc1: '#c9a227', acc2: '#4a9d6b', acc3: '#8b1f28', acc4: '#3b6ea5', live: '#e0563f',
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
      bg: '#e8342c', 'bg-image': 'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 46px, transparent 46px, transparent 92px)',
      ink: '#17244d', muted: '#6d7699', hair: '#dfe3f0', rule: 'rgba(255,255,255,0.4)', 'mark-ink': '#ffe066',
      acc1: '#2440a8', acc2: '#f7b500', acc3: '#00a878', acc4: '#17244d', live: '#e8342c',
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
      acc1: '#ff2aa3', acc2: '#00e5ff', acc3: '#b4ff39', acc4: '#ffcc00', live: '#ff2aa3',
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
      ink: '#0f3d38', muted: '#5c8c85', hair: '#d6f2ec', rule: 'rgba(255,255,255,0.45)', 'mark-ink': '#fff3d0',
      acc1: '#ff6f59', acc2: '#0f8c80', acc3: '#ffb703', acc4: '#0f3d38', live: '#ff6f59',
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
];

export const FONTS = 'Oswald:wght@300;400;500;600&family=Barlow:wght@400;500;600;700&family=Titan+One&family=Mulish:wght@400;600;700;800&family=Monoton&family=Outfit:wght@300;400;500;600;700&family=Fredoka:wght@500;600;700&family=Quicksand:wght@400;500;600;700';

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
`;
