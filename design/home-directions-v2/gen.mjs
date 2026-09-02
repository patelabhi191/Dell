import { writeFileSync } from 'node:fs';

/* ---------- shared content (identical across all six) ---------- */
const LIVE = { game: 'Rummy', round: 7, target: 500,
  standings: [['Abhi', 412], ['Priya', 388], ['Rahul', 355], ['Nikhil', 340]] };
const TILES = [
  { name: 'Rummy',     sub: 'Last played 2 days ago',  suit: 'diamond', live: true },
  { name: 'Judgement', sub: 'Last played 6 days ago',  suit: 'spade',   live: false },
  { name: 'Bluff',     sub: 'Last played 12 days ago', suit: 'heart',   live: false },
];
const ARCHIVE = { name: 'Archives', sub: '142 sessions on record' };
const BOARD = [
  ['Abhi', 42, 15, '36%'], ['Priya', 40, 12, '30%'], ['Rahul', 38, 8, '21%'],
  ['Nikhil', 41, 5, '12%'], ['Sneha', 22, 2, '9%'],
];
const RECENT = [
  ['Judgement', '28 Aug', 'Priya', 176], ['Rummy', '24 Aug', 'Abhi', 503],
  ['Bluff', '21 Aug', 'Rahul', 240], ['Rummy', '17 Aug', 'Priya', 512],
  ['Judgement', '12 Aug', 'Abhi', 168],
];

/* ---------- icons ---------- */
const P = {
  spade: 'M12 2.5c3 4 8.5 6.6 8.5 11a4.6 4.6 0 0 1-7.3 3.7c.2 1.6.8 3 1.8 4.3H9c1-1.3 1.6-2.7 1.8-4.3A4.6 4.6 0 0 1 3.5 13.5c0-4.4 5.5-7 8.5-11z',
  heart: 'M12 21s-7.5-4.7-9.4-9.2C1 8.3 3 4.8 6.4 4.5 8.6 4.3 10.6 5.4 12 7.2c1.4-1.8 3.4-2.9 5.6-2.7C21 4.8 23 8.3 21.4 11.8 19.5 16.3 12 21 12 21z',
  diamond: 'M12 2l7 10-7 10-7-10z',
  club: 'M12 2.6a3.7 3.7 0 0 0-3.1 5.7 3.8 3.8 0 1 0-1.3 7.3c1.2 0 2.3-.6 3-1.5-.1 2-.8 3.8-2 5.3h6.8c-1.2-1.5-1.9-3.3-2-5.3.7.9 1.8 1.5 3 1.5a3.8 3.8 0 1 0-1.3-7.3A3.7 3.7 0 0 0 12 2.6z',
  play: 'M8 5l11 7-11 7z',
};
const icon = (k, s, color) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${color || 'currentColor'}" aria-hidden="true"><path d="${P[k]}"/></svg>`;
const archiveIcon = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4.5" rx="1.4"/><path d="M5 8.5v11.5h14V8.5"/><path d="M10 12.5h4"/></svg>`;
const star = (s, color) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true"><path d="M12 1.6l2.1 6.6h6.9l-5.6 4.1 2.2 6.7-5.6-4.2-5.6 4.2 2.2-6.7L3 8.2h6.9z"/></svg>`;

/* ---------- shared FX ---------- */
const fxCss = (t) => `
    @keyframes dcPop { from { opacity: 0; transform: translateY(24px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes dcDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.4; } }
    @keyframes dcSweep { 0% { transform: translateX(-140%) skewX(-20deg); } 55%, 100% { transform: translateX(400%) skewX(-20deg); } }
    @keyframes dcBulb { 0%, 100% { opacity: 1; box-shadow: 0 0 10px ${t.bulbGlow}; } 50% { opacity: 0.2; box-shadow: 0 0 0 rgba(0,0,0,0); } }
    @keyframes dcConfetti { 0% { transform: translateY(-40px) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(220px) rotate(420deg); opacity: 0; } }
    @keyframes dcCoin { 0%, 100% { transform: rotateY(0deg); } 50% { transform: rotateY(180deg); } }
    @keyframes dcReel { 0%, 82%, 100% { transform: translateY(0); } 86% { transform: translateY(-8px); } 92% { transform: translateY(5px); } }
    @keyframes dcTwinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(20deg); } }
    @keyframes dcJiggle { 0%, 100% { transform: rotate(0deg); } 30% { transform: rotate(-1.6deg); } 70% { transform: rotate(1.6deg); } }
    @keyframes dcSpin { to { transform: rotate(360deg); } }

    .tile { animation: dcPop 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both; transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.24s ease; }
    .tile:nth-of-type(1) { animation-delay: 0.06s; }
    .tile:nth-of-type(2) { animation-delay: 0.14s; }
    .tile:nth-of-type(3) { animation-delay: 0.22s; }
    .tile:nth-of-type(4) { animation-delay: 0.30s; }
    .tile:hover { transform: translateY(-8px); box-shadow: ${t.tileHoverShadow}; }
    .tile:hover .tilesuit { animation: dcJiggle 0.5s ease; }

    .banner { position: relative; overflow: hidden; animation: dcPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .resume { position: relative; overflow: hidden; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease; }
    .resume:hover { transform: translateY(-3px) scale(1.03); }
    .resume::after { content: ""; position: absolute; top: 0; left: 0; width: 30%; height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.65), rgba(255,255,255,0)); animation: dcSweep 3.2s ease-in-out infinite; pointer-events: none; }

    .livedot { animation: dcDot 1.5s ease-in-out infinite; }
    .bulbs { position: absolute; left: 14px; right: 14px; display: flex; justify-content: space-between; pointer-events: none; }
    .bulbs span { width: 7px; height: 7px; border-radius: 50%; background: ${t.bulb}; animation: dcBulb 1.5s ease-in-out infinite; }
    .bulbs span:nth-child(2n) { animation-delay: 0.25s; }
    .bulbs span:nth-child(3n) { animation-delay: 0.5s; }
    .bulbs span:nth-child(5n) { animation-delay: 0.78s; }
    .confetti span { position: absolute; width: 8px; height: 12px; border-radius: 2px; animation: dcConfetti 4.6s linear infinite; }
    .twinkle { animation: dcTwinkle 2.2s ease-in-out infinite; }
    .twinkle:nth-of-type(2) { animation-delay: 0.6s; }
    .twinkle:nth-of-type(3) { animation-delay: 1.2s; }
    .reelnum { display: inline-block; animation: dcReel 5s ease-in-out infinite; }
    .row { transition: background 0.18s ease, transform 0.18s ease; }
    .row:hover { background: ${t.rowHover}; transform: translateX(3px); }

    @media (prefers-reduced-motion: reduce) {
      *, *::after { animation: none !important; transition: none !important; }
    }
`;

const bulbs = (n) => `<div class="bulbs" style="top: 8px;">${'<span></span>'.repeat(n)}</div>`;
const confetti = (t) => {
  const cols = t.accents.concat([t.live]);
  let out = '';
  for (let i = 0; i < 16; i++) {
    const left = 3 + i * 6.1, c = cols[i % cols.length], d = (i * 0.29).toFixed(2), r = (i * 23) % 60;
    out += `<span style="left: ${left}%; top: -20px; background: ${c}; transform: rotate(${r}deg); animation-delay: ${d}s;"></span>`;
  }
  return `<div class="confetti" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;">${out}</div>`;
};

/* ---------- tile renderers ---------- */
function tile(t, item, i) {
  const acc = t.accents[i % t.accents.length];
  const isArchive = item.archive;
  const v = t.tileVariant;

  if (v === 'block') {
    const bg = isArchive ? t.ink : acc, fg = isArchive ? t.bg : '#fffdf5';
    return `<div class="tile" style="height: 196px; box-sizing: border-box; background: ${bg}; color: ${fg}; border: 3px solid ${t.ink}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; padding: 18px 20px; display: flex; flex-direction: column; justify-content: space-between;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between;">
        <span class="tilesuit" style="display: inline-flex;">${isArchive ? archiveIcon(28) : icon(item.suit, 28)}</span>
        ${item.live ? `<span style="font-family: ${t.display}; font-size: 10px; letter-spacing: 0.08em; background: ${t.ink}; color: ${t.bg}; padding: 5px 10px; border-radius: 999px;">LIVE</span>` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="font-family: ${t.display}; font-size: 23px; line-height: 1.05;">${item.name}</div>
        <div style="font-size: 12px; opacity: 0.85;">${item.sub}</div>
      </div>
      <div style="font-family: ${t.display}; font-size: 11px; letter-spacing: 0.06em;">${isArchive ? 'BROWSE ALL' : 'NEW SESSION'}</div>
    </div>`;
  }

  if (v === 'chip') {
    return `<div class="tile" style="height: 196px; box-sizing: border-box; background: ${t.panel}; border: 2px solid ${t.panelBorder}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; padding: 16px 18px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center;">
      <div class="tilesuit" style="width: 68px; height: 68px; border-radius: 50%; background: ${isArchive ? t.ink : acc}; border: 4px dashed rgba(255,255,255,0.85); box-shadow: 0 6px 0 rgba(0,0,0,0.14), inset 0 3px 8px rgba(255,255,255,0.45); color: #fffdf7; display: flex; align-items: center; justify-content: center;">${isArchive ? archiveIcon(28) : icon(item.suit, 30)}</div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-family: ${t.display}; font-size: 21px; line-height: 1.05; color: ${t.ink};">${item.name}</div>
        <div style="font-size: 12px; color: ${t.muted};">${item.sub}</div>
      </div>
      <div style="font-family: ${t.display}; font-size: 12px; color: ${isArchive ? t.ink : acc};">${isArchive ? 'Browse all' : 'New session'}${item.live ? ' &middot; live' : ''}</div>
    </div>`;
  }

  if (v === 'neon') {
    const c = isArchive ? t.live : acc;
    return `<div class="tile" style="height: 196px; box-sizing: border-box; background: rgba(255,255,255,0.04); border: 2px solid ${c}; border-radius: ${t.radius}; box-shadow: 0 0 22px ${c}44, inset 0 0 22px ${c}22; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between;">
        <span class="tilesuit" style="display: inline-flex; color: ${c}; filter: drop-shadow(0 0 8px ${c});">${isArchive ? archiveIcon(26) : icon(item.suit, 26)}</span>
        ${item.live ? `<span style="font-size: 10px; letter-spacing: 0.18em; color: ${t.live}; text-shadow: 0 0 10px ${t.live};">LIVE</span>` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="font-family: ${t.display}; font-size: 20px; line-height: 1.1; color: #fff; text-shadow: 0 0 14px ${c};">${item.name}</div>
        <div style="font-size: 12px; color: ${t.muted};">${item.sub}</div>
      </div>
      <div style="font-size: 11px; letter-spacing: 0.14em; color: ${c}; text-transform: uppercase;">${isArchive ? 'Browse all' : 'New session'}</div>
    </div>`;
  }

  if (v === 'wave') {
    return `<div class="tile" style="height: 196px; box-sizing: border-box; background: ${t.panel}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; overflow: hidden; display: flex; flex-direction: column;">
      <div style="height: 74px; background: ${isArchive ? t.ink : acc}; border-radius: 0 0 60% 60% / 0 0 26px 26px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; color: #fffdf7;">
        <span class="tilesuit" style="display: inline-flex;">${isArchive ? archiveIcon(26) : icon(item.suit, 28)}</span>
        ${item.live ? `<span style="font-size: 10px; font-weight: 700; letter-spacing: 0.12em; background: rgba(255,255,255,0.25); padding: 4px 9px; border-radius: 999px;">LIVE</span>` : ''}
      </div>
      <div style="flex-grow: 1; padding: 12px 18px 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="font-family: ${t.display}; font-size: 21px; color: ${t.ink};">${item.name}</div>
          <div style="font-size: 12px; color: ${t.muted};">${item.sub}</div>
        </div>
        <div style="font-family: ${t.display}; font-size: 13px; color: ${isArchive ? t.ink : acc};">${isArchive ? 'Browse all' : 'New session'} &rarr;</div>
      </div>
    </div>`;
  }

  if (v === 'arch') {
    return `<div class="tile" style="height: 196px; box-sizing: border-box; background: ${t.panel}; border: 2px solid ${t.ink}; border-radius: 96px 96px ${t.radius} ${t.radius}; box-shadow: ${t.shadow}; padding: 20px 18px 16px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center;">
      <div class="tilesuit" style="display: inline-flex; color: ${isArchive ? t.ink : acc};">${isArchive ? archiveIcon(26) : icon(item.suit, 28)}</div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-family: ${t.display}; font-size: 20px; line-height: 1.1; color: ${t.ink};">${item.name}</div>
        <div style="font-size: 11px; color: ${t.muted};">${item.sub}</div>
      </div>
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: ${isArchive ? t.ink : acc}; text-transform: uppercase;">${isArchive ? 'Browse all' : 'New session'}${item.live ? ' &middot; live' : ''}</div>
    </div>`;
  }

  // 'reel'
  return `<div class="tile" style="height: 196px; box-sizing: border-box; background: ${t.panel}; border: 3px solid ${t.ink}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
    <div class="tilesuit" style="height: 78px; border-radius: 10px; background: ${isArchive ? t.ink : acc}; border: 2px solid ${t.ink}; display: flex; align-items: center; justify-content: center; gap: 14px; color: #fffdf7; box-shadow: inset 0 6px 14px rgba(0,0,0,0.22), inset 0 -6px 14px rgba(0,0,0,0.22);">
      ${isArchive ? archiveIcon(26) : icon(item.suit, 24)}${isArchive ? archiveIcon(30) : icon(item.suit, 30)}${isArchive ? archiveIcon(26) : icon(item.suit, 24)}
    </div>
    <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px;">
      <div style="font-family: ${t.display}; font-size: 19px; color: ${t.ink};">${item.name}</div>
      ${item.live ? `<span style="font-size: 9px; font-weight: 800; letter-spacing: 0.1em; background: ${t.live}; color: #fff; padding: 4px 8px; border-radius: 999px;">LIVE</span>` : ''}
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto;">
      <span style="font-size: 11px; color: ${t.muted};">${item.sub}</span>
      <span style="font-size: 11px; font-weight: 800; color: ${isArchive ? t.ink : acc};">${isArchive ? 'OPEN' : 'NEW'} &rarr;</span>
    </div>
  </div>`;
}

/* ---------- page ---------- */
function page(t) {
  const items = TILES.map((x) => ({ ...x })).concat([{ ...ARCHIVE, archive: true }]);
  const tiles = items.map((it, i) => tile(t, it, i)).join('\n      ');

  const standings = LIVE.standings.map(([n, s], i) => {
    const lead = i === 0;
    return `<div style="flex-grow: 1; border-radius: ${t.chipRadius}; padding: 11px 14px; background: ${lead ? t.leadChipBg : t.chipBg}; border: ${t.chipBorder}; display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; font-weight: 600; color: ${lead ? t.leadChipInk : t.muted};">${n}</span>
          <span class="${lead ? 'reelnum' : ''}" style="font-family: ${t.num}; font-size: 28px; line-height: 1; color: ${lead ? t.leadChipInk : t.ink};">${s}</span>
        </div>`;
  }).join('\n        ');

  const board = BOARD.map(([n, p, w, r], i) => `<div class="row" style="display: flex; align-items: center; gap: 14px; padding: 9px 10px; border-radius: 10px;">
          <span style="width: 26px; height: 26px; border-radius: 50%; background: ${i === 0 ? t.accents[0] : t.rankBg}; color: ${i === 0 ? '#fffdf7' : t.muted}; font-family: ${t.display}; font-size: 12px; display: flex; align-items: center; justify-content: center;">${i + 1}</span>
          <span style="flex-grow: 1; font-size: 15px; font-weight: 600; color: ${t.ink};">${n}</span>
          <span style="width: 42px; text-align: right; font-size: 14px; color: ${t.muted};">${p}</span>
          <span style="width: 38px; text-align: right; font-size: 14px; font-weight: 700; color: ${t.ink};">${w}</span>
          <span style="width: 56px; text-align: right; font-family: ${t.num}; font-size: 17px; color: ${i === 0 ? t.accents[0] : t.ink};">${r}</span>
        </div>`).join('\n        ');

  const recent = RECENT.map(([g, d, w, s]) => `<div class="row" style="display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 10px;">
          <span style="width: 92px; font-size: 14px; font-weight: 600; color: ${t.ink};">${g}</span>
          <span style="width: 62px; font-size: 12px; color: ${t.muted};">${d}</span>
          <span style="flex-grow: 1; font-size: 14px; font-weight: 700; color: ${t.accents[1]};">${w}</span>
          <span style="font-family: ${t.num}; font-size: 18px; color: ${t.ink};">${s}</span>
        </div>`).join('\n        ');

  const panel = (title, meta, body) => `<div style="background: ${t.panel}; border: ${t.panelBorderCss}; border-radius: ${t.radius}; box-shadow: ${t.panelShadow}; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; overflow: hidden;">
      <div style="display: flex; align-items: baseline; justify-content: space-between;">
        <div style="font-family: ${t.display}; font-size: 19px; color: ${t.ink};">${title}</div>
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: ${t.muted}; text-transform: uppercase;">${meta}</div>
      </div>
      <div style="display: flex; flex-direction: column;">
        ${body}
      </div>
    </div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${t.fontsQuery}&display=swap">
  <style>
    body { margin: 0; }
    a { color: ${t.accents[0]}; } a:hover { color: ${t.accents[1]}; }
${fxCss(t)}  </style>
</helmet>

<div style="position: relative; width: 1280px; height: 1000px; box-sizing: border-box; padding: 34px 36px 36px; display: flex; flex-direction: column; gap: 20px; overflow: hidden; font-family: ${t.body}; color: ${t.ink}; background-color: ${t.bg};${t.bgImage ? ' background-image: ' + t.bgImage + ';' : ''}">
  ${t.decor || ''}

  <div style="position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px;">
    <div style="display: flex; align-items: center; gap: 13px;">
      ${t.mark}
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="font-family: ${t.display}; font-size: ${t.wordmarkSize}; line-height: 1; color: ${t.wordmarkInk};${t.wordmarkExtra || ''}">NAME TBA</div>
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.18em; color: ${t.muted}; text-transform: uppercase;">Placeholder wordmark</div>
      </div>
      ${t.twinkles || ''}
    </div>
    <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;">
      <div style="padding: 10px 18px; border-radius: 999px; background: ${t.navBg}; color: ${t.navInk}; border: ${t.navBorder};">Players</div>
      <div style="padding: 10px 18px; border-radius: 999px; background: ${t.navBg}; color: ${t.navInk}; border: ${t.navBorder};">Settings</div>
    </div>
  </div>

  <div class="banner" style="background: ${t.bannerBg}; border: ${t.bannerBorder}; border-radius: ${t.radius}; box-shadow: ${t.panelShadow}; padding: ${t.bannerPad}; display: flex; align-items: center; gap: 26px; color: ${t.bannerInk};">
    ${t.bannerFx || ''}
    <div style="position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 236px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="livedot" style="width: 8px; height: 8px; border-radius: 50%; background: ${t.live};"></span>
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; color: ${t.live}; text-transform: uppercase;">Live now</span>
      </div>
      <div style="font-family: ${t.display}; font-size: 36px; line-height: 1; color: ${t.bannerInk};">${LIVE.game}</div>
      <div style="font-size: 13px; font-weight: 500; color: ${t.bannerMuted};">Round ${LIVE.round} &middot; first to ${LIVE.target} &middot; ${LIVE.standings.length} players</div>
    </div>

    <div style="position: relative; flex-grow: 1; display: flex; gap: 10px;">
        ${standings}
    </div>

    <div class="resume" style="position: relative; display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 26px; border-radius: ${t.chipRadius}; background: ${t.resumeBg}; color: ${t.resumeInk}; border: ${t.resumeBorder}; box-shadow: ${t.resumeShadow}; font-family: ${t.display}; font-size: 15px; letter-spacing: 0.04em;">
      ${icon('play', 15)} RESUME
    </div>
  </div>

  <div style="position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">
      ${tiles}
  </div>

  <div style="position: relative; flex-grow: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
    ${panel('All-time standings', 'played / won / rate', board)}
    ${panel('Recent results', 'see all', recent)}
  </div>

</div>
</x-dc>
</body>
</html>
`;
}

/* ---------- the six directions ---------- */
const base = {
  radius: '16px', chipRadius: '12px', wordmarkSize: '30px',
  panelShadow: 'none', shadow: 'none', panelBorderCss: 'none',
  bannerPad: '22px 26px',
};

const themes = {
  'Main.dc.html': { ...base, // JACKPOT POP
    fontsQuery: 'Bungee&family=Rubik:wght@400;500;600;700',
    display: "'Bungee', 'Impact', sans-serif", body: "'Rubik', 'Helvetica Neue', sans-serif", num: "'Bungee', sans-serif",
    bg: '#ffd23f', bgImage: 'radial-gradient(#1d150822 1.4px, transparent 1.5px)', ink: '#1d1508', muted: '#8a7434',
    accents: ['#e63946', '#0ead9b', '#3d5afe', '#ff8c42'], live: '#e63946',
    bulb: '#fff6d6', bulbGlow: 'rgba(255,246,214,0.95)', rowHover: '#ffd23f33', rankBg: '#efe4c4',
    panel: '#fffdf5', panelBorder: '#1d1508', panelBorderCss: '3px solid #1d1508', panelShadow: '5px 5px 0 #1d1508',
    shadow: '5px 5px 0 #1d1508', tileHoverShadow: '9px 11px 0 #1d1508', tileVariant: 'block',
    bannerBg: '#1d1508', bannerBorder: '3px solid #1d1508', bannerInk: '#fffdf5', bannerMuted: '#c9b98e',
    bannerPad: '28px 26px 22px', live: '#ff5a5f',
    chipBg: 'rgba(255,255,255,0.08)', leadChipBg: '#ffd23f', leadChipInk: '#1d1508', chipBorder: 'none',
    resumeBg: '#ffd23f', resumeInk: '#1d1508', resumeBorder: '3px solid #fffdf5', resumeShadow: '0 6px 0 rgba(255,253,245,0.35)',
    navBg: '#fffdf5', navInk: '#1d1508', navBorder: '2px solid #1d1508',
    wordmarkInk: '#1d1508', wordmarkSize: '32px',
    mark: `<div style="width: 46px; height: 46px; border-radius: 12px; background: #e63946; border: 3px solid #1d1508; box-shadow: 3px 3px 0 #1d1508; display: flex; align-items: center; justify-content: center; color: #fffdf5;">${icon('diamond', 24)}</div>`,
    twinkles: `<span class="twinkle" style="display: inline-flex; margin-left: 4px;">${star(15, '#e63946')}</span><span class="twinkle" style="display: inline-flex;">${star(11, '#0ead9b')}</span><span class="twinkle" style="display: inline-flex;">${star(13, '#3d5afe')}</span>`,
    get bannerFx() { return bulbs(34) + confetti(this); },
  },

  'CandyChips.dc.html': { ...base, // CANDY CHIPS
    fontsQuery: 'Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700',
    display: "'Baloo 2', 'Trebuchet MS', cursive", body: "'Nunito', 'Helvetica Neue', sans-serif", num: "'Baloo 2', cursive",
    bg: '#fff4e6', bgImage: 'radial-gradient(circle at 12% 8%, #ffd9e8 0%, transparent 34%), radial-gradient(circle at 88% 4%, #d6f5ff 0%, transparent 32%)',
    ink: '#3a2a3f', muted: '#9b8aa3',
    accents: ['#ff5d8f', '#22c1a4', '#7c4dff', '#ffb703'], live: '#ff5d8f',
    bulb: '#ff5d8f', bulbGlow: 'rgba(255,93,143,0.8)', rowHover: '#ff5d8f14', rankBg: '#f0e7f5',
    panel: '#ffffff', panelBorder: '#f0e2ea', panelBorderCss: '2px solid #f4e6ee', panelShadow: '0 8px 22px rgba(58,42,63,0.10)',
    shadow: '0 8px 20px rgba(58,42,63,0.12)', tileHoverShadow: '0 18px 34px rgba(58,42,63,0.20)', tileVariant: 'chip',
    bannerBg: '#ffffff', bannerBorder: '2px solid #f4e6ee', bannerInk: '#3a2a3f', bannerMuted: '#9b8aa3',
    bannerPad: '26px 26px 22px',
    chipBg: '#faf5fb', leadChipBg: '#ff5d8f', leadChipInk: '#ffffff', chipBorder: 'none',
    resumeBg: '#22c1a4', resumeInk: '#ffffff', resumeBorder: 'none', resumeShadow: '0 8px 0 #16957e',
    navBg: '#ffffff', navInk: '#6b5a73', navBorder: '2px solid #f4e6ee',
    wordmarkInk: '#3a2a3f', wordmarkSize: '31px',
    mark: `<div style="width: 46px; height: 46px; border-radius: 50%; background: #ff5d8f; border: 4px dashed #ffffff; box-shadow: 0 6px 0 rgba(58,42,63,0.14); display: flex; align-items: center; justify-content: center; color: #ffffff;">${icon('heart', 22)}</div>`,
    get bannerFx() { return bulbs(30) + confetti(this); },
  },

  'NeonArcade.dc.html': { ...base, // NEON ARCADE
    fontsQuery: 'Monoton&family=Outfit:wght@300;400;500;600;700',
    display: "'Outfit', 'Helvetica Neue', sans-serif", body: "'Outfit', 'Helvetica Neue', sans-serif", num: "'Outfit', sans-serif",
    bg: '#241350', bgImage: 'radial-gradient(60% 45% at 14% 0%, rgba(255,42,163,0.34) 0%, transparent 68%), radial-gradient(55% 45% at 90% 6%, rgba(0,229,255,0.30) 0%, transparent 66%)',
    ink: '#f5f0ff', muted: '#a892d8',
    accents: ['#ff2aa3', '#00e5ff', '#b4ff39', '#ffcc00'], live: '#ff2aa3',
    bulb: '#00e5ff', bulbGlow: 'rgba(0,229,255,0.95)', rowHover: 'rgba(255,42,163,0.14)', rankBg: 'rgba(255,255,255,0.10)',
    panel: 'rgba(255,255,255,0.055)', panelBorder: 'rgba(255,255,255,0.16)', panelBorderCss: '1px solid rgba(255,255,255,0.16)',
    panelShadow: '0 0 26px rgba(0,229,255,0.12)', shadow: 'none', tileHoverShadow: '0 0 34px rgba(255,42,163,0.45)', tileVariant: 'neon',
    bannerBg: 'rgba(255,255,255,0.06)', bannerBorder: '2px solid #ff2aa3', bannerInk: '#ffffff', bannerMuted: '#bda9e6',
    bannerPad: '26px 26px 22px', radius: '18px',
    chipBg: 'rgba(255,255,255,0.06)', leadChipBg: 'rgba(0,229,255,0.16)', leadChipInk: '#ffffff', chipBorder: '1px solid rgba(0,229,255,0.55)',
    resumeBg: '#ff2aa3', resumeInk: '#1a0b33', resumeBorder: 'none', resumeShadow: '0 0 26px rgba(255,42,163,0.7)',
    navBg: 'rgba(255,255,255,0.07)', navInk: '#d9c9ff', navBorder: '1px solid rgba(255,255,255,0.18)',
    wordmarkInk: '#ffffff', wordmarkSize: '30px',
    wordmarkExtra: " font-family: 'Monoton', cursive; letter-spacing: 0.06em; text-shadow: 0 0 12px #00e5ff, 0 0 30px #ff2aa3;",
    mark: `<div style="width: 46px; height: 46px; border-radius: 12px; border: 2px solid #00e5ff; box-shadow: 0 0 18px rgba(0,229,255,0.6), inset 0 0 14px rgba(0,229,255,0.28); display: flex; align-items: center; justify-content: center; color: #00e5ff;">${icon('club', 24)}</div>`,
    get bannerFx() { return bulbs(30); },
  },

  'TropicalTable.dc.html': { ...base, // TROPICAL TABLE
    fontsQuery: 'Fredoka:wght@500;600;700&family=Quicksand:wght@400;500;600;700',
    display: "'Fredoka', 'Trebuchet MS', sans-serif", body: "'Quicksand', 'Helvetica Neue', sans-serif", num: "'Fredoka', sans-serif",
    bg: '#e6fbf6', bgImage: 'radial-gradient(circle at 92% 6%, #ffe0b2 0%, transparent 30%), radial-gradient(circle at 6% 92%, #b9f0e2 0%, transparent 34%)',
    ink: '#0f3d38', muted: '#5c8c85',
    accents: ['#12b0a0', '#ff6f59', '#ffb703', '#4d96ff'], live: '#ff6f59',
    bulb: '#ffb703', bulbGlow: 'rgba(255,183,3,0.85)', rowHover: '#12b0a018', rankBg: '#d4f0ea',
    panel: '#ffffff', panelBorder: '#cceee7', panelBorderCss: '2px solid #d6f2ec', panelShadow: '0 8px 20px rgba(15,61,56,0.10)',
    shadow: '0 8px 18px rgba(15,61,56,0.12)', tileHoverShadow: '0 18px 30px rgba(15,61,56,0.20)', tileVariant: 'wave',
    bannerBg: '#0f8c80', bannerBorder: 'none', bannerInk: '#ffffff', bannerMuted: '#b6e6df',
    bannerPad: '26px 26px 22px', radius: '20px', chipRadius: '14px',
    chipBg: 'rgba(255,255,255,0.14)', leadChipBg: '#ffb703', leadChipInk: '#0f3d38', chipBorder: 'none',
    resumeBg: '#ff6f59', resumeInk: '#ffffff', resumeBorder: 'none', resumeShadow: '0 7px 0 #c9503e',
    navBg: '#ffffff', navInk: '#0f3d38', navBorder: '2px solid #d6f2ec',
    wordmarkInk: '#0f3d38', wordmarkSize: '31px',
    mark: `<div style="width: 46px; height: 46px; border-radius: 16px; background: #12b0a0; box-shadow: 0 6px 0 #0c7d71; display: flex; align-items: center; justify-content: center; color: #ffffff;">${icon('spade', 24)}</div>`,
    get bannerFx() { return bulbs(30); },
  },

  'RetroVegas.dc.html': { ...base, // RETRO VEGAS
    fontsQuery: 'Alfa+Slab+One&family=DM+Sans:wght@400;500;700',
    display: "'Alfa Slab One', Georgia, serif", body: "'DM Sans', 'Helvetica Neue', sans-serif", num: "'Alfa Slab One', serif",
    bg: '#f6ecd9', bgImage: 'repeating-linear-gradient(135deg, rgba(214,109,43,0.07) 0px, rgba(214,109,43,0.07) 12px, transparent 12px, transparent 26px)',
    ink: '#2b1b12', muted: '#8a6f57',
    accents: ['#d64545', '#e08d1e', '#1b9aaa', '#6a4c93'], live: '#d64545',
    bulb: '#e08d1e', bulbGlow: 'rgba(224,141,30,0.9)', rowHover: '#d6454514', rankBg: '#e8dbc2',
    panel: '#fffaf0', panelBorder: '#2b1b12', panelBorderCss: '2px solid #2b1b12', panelShadow: '4px 4px 0 #2b1b12',
    shadow: '4px 4px 0 #2b1b12', tileHoverShadow: '8px 10px 0 #2b1b12', tileVariant: 'arch',
    bannerBg: '#1b9aaa', bannerBorder: '2px solid #2b1b12', bannerInk: '#fffaf0', bannerMuted: '#bfe6ea',
    bannerPad: '28px 26px 22px', radius: '14px',
    chipBg: 'rgba(255,255,255,0.16)', leadChipBg: '#e08d1e', leadChipInk: '#2b1b12', chipBorder: '2px solid #2b1b12',
    resumeBg: '#d64545', resumeInk: '#fffaf0', resumeBorder: '2px solid #2b1b12', resumeShadow: '4px 4px 0 #2b1b12',
    navBg: '#fffaf0', navInk: '#2b1b12', navBorder: '2px solid #2b1b12',
    wordmarkInk: '#2b1b12', wordmarkSize: '28px',
    mark: `<div style="width: 46px; height: 46px; border-radius: 50%; background: #e08d1e; border: 2px solid #2b1b12; box-shadow: 3px 3px 0 #2b1b12; display: flex; align-items: center; justify-content: center; color: #2b1b12;">${icon('diamond', 22)}</div>`,
    twinkles: `<span class="twinkle" style="display: inline-flex; margin-left: 4px;">${star(16, '#d64545')}</span><span class="twinkle" style="display: inline-flex;">${star(12, '#e08d1e')}</span><span class="twinkle" style="display: inline-flex;">${star(10, '#1b9aaa')}</span>`,
    get bannerFx() { return bulbs(32); },
  },

  'SlotMachine.dc.html': { ...base, // SLOT MACHINE
    fontsQuery: 'Titan+One&family=Mulish:wght@400;600;700;800',
    display: "'Titan One', 'Arial Black', sans-serif", body: "'Mulish', 'Helvetica Neue', sans-serif", num: "'Titan One', sans-serif",
    bg: '#e8342c', bgImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 46px, transparent 46px, transparent 92px)',
    ink: '#17244d', muted: '#6d7699',
    accents: ['#2440a8', '#f7b500', '#00a878', '#e8342c'], live: '#e8342c',
    bulb: '#ffe066', bulbGlow: 'rgba(255,224,102,0.95)', rowHover: '#2440a814', rankBg: '#e4e8f6',
    panel: '#ffffff', panelBorder: '#17244d', panelBorderCss: '3px solid #17244d', panelShadow: '5px 5px 0 #17244d',
    shadow: '5px 5px 0 #17244d', tileHoverShadow: '9px 11px 0 #17244d', tileVariant: 'reel',
    bannerBg: '#ffffff', bannerBorder: '3px solid #17244d', bannerInk: '#17244d', bannerMuted: '#6d7699',
    bannerPad: '28px 26px 22px', radius: '14px',
    chipBg: '#eef1fa', leadChipBg: '#f7b500', leadChipInk: '#17244d', chipBorder: '2px solid #17244d',
    resumeBg: '#2440a8', resumeInk: '#ffffff', resumeBorder: '3px solid #17244d', resumeShadow: '5px 5px 0 #17244d',
    navBg: '#ffffff', navInk: '#17244d', navBorder: '3px solid #17244d',
    wordmarkInk: '#ffffff', wordmarkSize: '30px', wordmarkExtra: ' text-shadow: 3px 3px 0 #17244d;',
    mark: `<div style="width: 46px; height: 46px; border-radius: 10px; background: #f7b500; border: 3px solid #17244d; display: flex; align-items: center; justify-content: center; color: #17244d;">${icon('club', 24)}</div>`,
    get bannerFx() { return bulbs(34) + confetti(this); },
  },
};

for (const [file, t] of Object.entries(themes)) {
  const html = page(t);
  writeFileSync(file, html);
  console.log(`${file}: ${html.length} bytes, tiles=${(html.match(/class="tile"/g) || []).length}`);
}
