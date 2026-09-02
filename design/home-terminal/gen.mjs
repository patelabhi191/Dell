import { writeFileSync } from 'node:fs';

/* ---------- shared content ---------- */
const LIVE = { game: 'Rummy', round: 7, target: 500,
  standings: [['Abhi', 412], ['Priya', 388], ['Rahul', 355], ['Nikhil', 340]] };
const TILES = [
  { name: 'Rummy',     sub: '2 days ago',  suit: 'diamond', scene: 'fan',    live: true },
  { name: 'Judgement', sub: '6 days ago',  suit: 'spade',   scene: 'chips',  live: false },
  { name: 'Bluff',     sub: '12 days ago', suit: 'heart',   scene: 'table',  live: false },
  { name: 'Archives',  sub: '142 sessions', suit: 'club',   scene: 'box',    live: false, archive: true },
];
const BOARD = [['Abhi', 42, 15, '36%'], ['Priya', 40, 12, '30%'], ['Rahul', 38, 8, '21%'],
  ['Nikhil', 41, 5, '12%'], ['Sneha', 22, 2, '9%']];
const RECENT = [['Judgement', '28 Aug', 'Priya', 176], ['Rummy', '24 Aug', 'Abhi', 503],
  ['Bluff', '21 Aug', 'Rahul', 240], ['Rummy', '17 Aug', 'Priya', 512], ['Judgement', '12 Aug', 'Abhi', 168]];

const P = {
  spade: 'M12 2.5c3 4 8.5 6.6 8.5 11a4.6 4.6 0 0 1-7.3 3.7c.2 1.6.8 3 1.8 4.3H9c1-1.3 1.6-2.7 1.8-4.3A4.6 4.6 0 0 1 3.5 13.5c0-4.4 5.5-7 8.5-11z',
  heart: 'M12 21s-7.5-4.7-9.4-9.2C1 8.3 3 4.8 6.4 4.5 8.6 4.3 10.6 5.4 12 7.2c1.4-1.8 3.4-2.9 5.6-2.7C21 4.8 23 8.3 21.4 11.8 19.5 16.3 12 21 12 21z',
  diamond: 'M12 2l7 10-7 10-7-10z',
  club: 'M12 2.6a3.7 3.7 0 0 0-3.1 5.7 3.8 3.8 0 1 0-1.3 7.3c1.2 0 2.3-.6 3-1.5-.1 2-.8 3.8-2 5.3h6.8c-1.2-1.5-1.9-3.3-2-5.3.7.9 1.8 1.5 3 1.5a3.8 3.8 0 1 0-1.3-7.3A3.7 3.7 0 0 0 12 2.6z',
  play: 'M8 5l11 7-11 7z',
};
const icon = (k, s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c || 'currentColor'}" aria-hidden="true"><path d="${P[k]}"/></svg>`;

/* ---------- tile art scenes (drawn, no photography) ---------- */
const card = (w, h, rot, dx, dy, suit, col, shadow) =>
  `<div style="position: absolute; left: 50%; top: 50%; width: ${w}px; height: ${h}px; margin: ${-h / 2 + dy}px 0 0 ${-w / 2 + dx}px; background: #fffdf8; border-radius: 7px; box-shadow: ${shadow}; transform: rotate(${rot}deg); display: flex; align-items: center; justify-content: center; color: ${col};">${icon(suit, Math.round(w * 0.42))}<span style="position: absolute; top: 5px; left: 7px; font-size: 12px; font-weight: 800;">A</span></div>`;

const chip = (size, x, y, col, ring) =>
  `<div style="position: absolute; left: 50%; top: 50%; width: ${size}px; height: ${size}px; margin: ${-size / 2 + y}px 0 0 ${-size / 2 + x}px; border-radius: 50%; background: ${col}; border: ${Math.round(size * 0.11)}px dashed ${ring}; box-shadow: 0 4px 0 rgba(0,0,0,0.22), inset 0 3px 7px rgba(255,255,255,0.4);"></div>`;

function scene(kind, t, acc) {
  const sh = t.artShadow;
  if (kind === 'fan') {
    return card(78, 108, -18, -52, 6, 'heart', '#d02b3a', sh) + card(78, 108, -6, -18, -2, 'spade', '#1a1a1a', sh)
      + card(78, 108, 7, 18, -2, 'diamond', '#d02b3a', sh) + card(78, 108, 19, 52, 6, 'club', '#1a1a1a', sh);
  }
  if (kind === 'chips') {
    return chip(58, -46, 22, t.chipCols[0], '#fffdf8') + chip(58, -46, 6, t.chipCols[1], '#fffdf8')
      + chip(58, -46, -10, t.chipCols[2], '#fffdf8') + card(74, 102, 9, 40, -6, 'spade', '#1a1a1a', sh)
      + chip(44, 44, 40, t.chipCols[3], '#fffdf8');
  }
  if (kind === 'table') {
    return `<div style="position: absolute; left: 50%; bottom: -46px; width: 232px; height: 150px; margin-left: -116px; border-radius: 116px 116px 0 0; background: ${t.tableFelt}; border: 5px solid ${t.tableRim}; box-shadow: inset 0 8px 22px rgba(0,0,0,0.28);"></div>`
      + card(70, 96, -12, -34, -18, 'heart', '#d02b3a', sh) + card(70, 96, 11, 30, -18, 'heart', '#d02b3a', sh)
      + chip(40, -68, 44, t.chipCols[0], '#fffdf8') + chip(40, 66, 44, t.chipCols[1], '#fffdf8');
  }
  // box
  return `<div style="position: absolute; left: 50%; top: 50%; width: 168px; height: 126px; margin: -52px 0 0 -84px;">
      <div style="position: absolute; left: 14px; top: -16px; width: 140px; height: 26px; background: #fffdf8; border-radius: 4px; box-shadow: ${sh}; transform: rotate(-4deg);"></div>
      <div style="position: absolute; left: 20px; top: -6px; width: 128px; height: 24px; background: #f1e9d8; border-radius: 4px; box-shadow: ${sh}; transform: rotate(3deg);"></div>
      <div style="position: absolute; left: 0; top: 14px; width: 168px; height: 34px; background: ${acc}; border-radius: 7px; border: 3px solid ${t.boxLine};"></div>
      <div style="position: absolute; left: 10px; top: 48px; width: 148px; height: 74px; background: ${acc}; border-radius: 0 0 8px 8px; border: 3px solid ${t.boxLine}; border-top: none; display: flex; align-items: center; justify-content: center;">
        <div style="width: 52px; height: 8px; border-radius: 4px; background: ${t.boxLine}; opacity: 0.55;"></div>
      </div>
    </div>`;
}

/* ---------- plaque shapes ---------- */
function plaque(t) {
  const label = `<div style="font-family: ${t.display}; font-size: ${t.wordSize}; line-height: 1; color: ${t.plaqueInk};${t.wordExtra || ''}">NAME TBA</div>
        <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.28em; color: ${t.plaqueSub}; text-transform: uppercase; margin-top: 5px;">Placeholder wordmark</div>`;
  const inner = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">${label}</div>`;
  const v = t.plaqueVariant;

  if (v === 'trapezoid') {
    return `<div style="position: relative; width: 342px; height: 84px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; clip-path: polygon(0 0, 100% 0, 100% 64%, 88% 100%, 12% 100%, 0 64%); padding: 0 20px; box-sizing: border-box;">${inner}</div>`;
  }
  if (v === 'hexagon') {
    return `<div style="position: relative; width: 350px; height: 88px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%); padding: 0 30px; box-sizing: border-box; box-shadow: ${t.plaqueShadow};">${inner}</div>`;
  }
  if (v === 'neon') {
    return `<div style="position: relative; width: 344px; height: 84px; border: 2px solid ${t.accents[1]}; border-radius: 12px; background: rgba(255,255,255,0.05); box-shadow: 0 0 26px ${t.accents[1]}66, inset 0 0 24px ${t.accents[0]}33; padding: 0 24px; box-sizing: border-box;">${inner}</div>`;
  }
  if (v === 'marquee') {
    return `<div style="position: relative; width: 356px; height: 88px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; border-radius: 10px; box-shadow: ${t.plaqueShadow}; padding: 0 30px; box-sizing: border-box;">
        <div class="bulbs" style="top: 7px;">${'<span></span>'.repeat(13)}</div>
        <div class="bulbs" style="bottom: 7px;">${'<span></span>'.repeat(13)}</div>
        ${inner}</div>`;
  }
  if (v === 'arch') {
    return `<div style="position: relative; width: 336px; height: 92px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; border-radius: 168px 168px 10px 10px; box-shadow: ${t.plaqueShadow}; padding: 8px 24px 0; box-sizing: border-box;">${inner}</div>`;
  }
  return `<div style="position: relative; width: 338px; height: 82px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; border-radius: 999px; box-shadow: ${t.plaqueShadow}; padding: 0 30px; box-sizing: border-box;">${inner}</div>`;
}

/* ---------- FX ---------- */
const fxCss = (t) => `
    @keyframes dcPop { from { opacity: 0; transform: translateY(26px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes dcDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.4; } }
    @keyframes dcSweep { 0% { transform: translateX(-150%) skewX(-20deg); } 55%, 100% { transform: translateX(420%) skewX(-20deg); } }
    @keyframes dcBulb { 0%, 100% { opacity: 1; box-shadow: 0 0 9px ${t.bulbGlow}; } 50% { opacity: 0.2; box-shadow: 0 0 0 rgba(0,0,0,0); } }
    @keyframes dcJiggle { 0%, 100% { transform: rotate(0deg) scale(1); } 30% { transform: rotate(-2deg) scale(1.03); } 70% { transform: rotate(2deg) scale(1.03); } }
    @keyframes dcTwinkle { 0%, 100% { opacity: 0.3; transform: scale(0.75); } 50% { opacity: 1; transform: scale(1); } }

    .tile { animation: dcPop 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both; transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.24s ease, border-color 0.24s ease; }
    .tile:nth-of-type(1) { animation-delay: 0.06s; }
    .tile:nth-of-type(2) { animation-delay: 0.14s; }
    .tile:nth-of-type(3) { animation-delay: 0.22s; }
    .tile:nth-of-type(4) { animation-delay: 0.30s; }
    .tile:hover { transform: translateY(-9px); box-shadow: ${t.tileHoverShadow}; }
    .tile:hover .art { animation: dcJiggle 0.55s ease; }

    .resume { position: relative; overflow: hidden; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .resume:hover { transform: scale(1.06); }
    .resume::after { content: ""; position: absolute; top: 0; left: 0; width: 34%; height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.62), rgba(255,255,255,0)); animation: dcSweep 3.2s ease-in-out infinite; pointer-events: none; }

    .livedot { animation: dcDot 1.5s ease-in-out infinite; }
    .bulbs { position: absolute; left: 16px; right: 16px; display: flex; justify-content: space-between; pointer-events: none; }
    .bulbs span { width: 6px; height: 6px; border-radius: 50%; background: ${t.bulb}; animation: dcBulb 1.5s ease-in-out infinite; }
    .bulbs span:nth-child(2n) { animation-delay: 0.25s; }
    .bulbs span:nth-child(3n) { animation-delay: 0.55s; }
    .dot0 { animation: dcTwinkle 2.4s ease-in-out infinite; }
    .row { transition: background 0.18s ease, transform 0.18s ease; }
    .row:hover { background: ${t.rowHover}; transform: translateX(3px); }
    .strip { animation: dcPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.36s both; }

    @media (prefers-reduced-motion: reduce) { *, *::after { animation: none !important; transition: none !important; } }
`;

/* ---------- page ---------- */
function page(t) {
  const tiles = TILES.map((it, i) => {
    const acc = t.accents[i % t.accents.length];
    return `<div class="tile" style="height: 386px; box-sizing: border-box; display: flex; flex-direction: column; border: ${t.tileFrame(acc, it.archive)}; border-radius: ${t.tileRadius}; overflow: hidden; background: ${t.tileBg}; box-shadow: ${t.tileShadow};">
        <div class="art" style="position: relative; flex-grow: 1; overflow: hidden; background: ${t.artBg(acc, it.archive)};">
          ${scene(it.scene, t, acc)}
          ${it.live ? `<span style="position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; background: ${t.live}; color: #fff; padding: 5px 10px; border-radius: 999px;">LIVE</span>` : ''}
          <span style="position: absolute; top: 12px; left: 12px; font-size: 11px; font-weight: 700; color: ${t.artMeta}; background: ${t.artMetaBg}; padding: 4px 9px; border-radius: 999px;">${it.sub}</span>
        </div>
        <div style="height: 56px; flex-shrink: 0; background: ${t.bandBg(acc, it.archive)}; color: ${t.bandInk(acc, it.archive)}; display: flex; align-items: center; justify-content: center; font-family: ${t.display}; font-size: 20px; letter-spacing: ${t.bandTrack};">${it.name.toUpperCase()}</div>
      </div>`;
  }).join('\n      ');

  const board = BOARD.map(([n, p, w, r], i) => `<div class="row" style="display: flex; align-items: center; gap: 12px; padding: 7px 9px; border-radius: 8px;">
            <span style="width: 22px; height: 22px; border-radius: 50%; background: ${i === 0 ? t.accents[0] : t.rankBg}; color: ${i === 0 ? '#fff' : t.muted}; font-family: ${t.display}; font-size: 11px; display: flex; align-items: center; justify-content: center;">${i + 1}</span>
            <span style="flex-grow: 1; font-size: 14px; font-weight: 600; color: ${t.ink};">${n}</span>
            <span style="width: 36px; text-align: right; font-size: 13px; color: ${t.muted};">${p}</span>
            <span style="width: 32px; text-align: right; font-size: 13px; font-weight: 700; color: ${t.ink};">${w}</span>
            <span style="width: 50px; text-align: right; font-family: ${t.display}; font-size: 15px; color: ${i === 0 ? t.accents[0] : t.ink};">${r}</span>
          </div>`).join('\n          ');

  const recent = RECENT.map(([g, d, w, s]) => `<div class="row" style="display: flex; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 8px;">
            <span style="width: 84px; font-size: 14px; font-weight: 600; color: ${t.ink};">${g}</span>
            <span style="width: 56px; font-size: 12px; color: ${t.muted};">${d}</span>
            <span style="flex-grow: 1; font-size: 13px; font-weight: 700; color: ${t.accents[1]};">${w}</span>
            <span style="font-family: ${t.display}; font-size: 16px; color: ${t.ink};">${s}</span>
          </div>`).join('\n          ');

  const panel = (title, meta, body) => `<div style="background: ${t.panel}; border: ${t.panelBorderCss}; border-radius: ${t.panelRadius}; box-shadow: ${t.panelShadow}; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; overflow: hidden;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 9px 6px; border-bottom: 1px solid ${t.hair};">
            <div style="font-family: ${t.display}; font-size: 16px; color: ${t.ink};">${title}</div>
            <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: ${t.muted}; text-transform: uppercase;">${meta}</div>
          </div>
          ${body}
        </div>`;

  const standings = LIVE.standings.map(([n, s], i) => `<div style="display: flex; flex-direction: column; gap: 1px; padding: 0 14px; ${i ? `border-left: 1px solid ${t.stripHair};` : ''}">
            <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: ${i === 0 ? t.stripAccent : t.stripMuted}; text-transform: uppercase;">${n}</span>
            <span style="font-family: ${t.display}; font-size: 21px; line-height: 1.1; color: ${i === 0 ? t.stripAccent : t.stripInk};">${s}</span>
          </div>`).join('\n          ');

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

<div style="position: relative; width: 1280px; height: 1000px; box-sizing: border-box; padding: 30px; display: flex; flex-direction: column; gap: 16px; overflow: hidden; font-family: ${t.body}; color: ${t.ink}; background-color: ${t.bg};${t.bgImage ? ' background-image: ' + t.bgImage + ';' : ''}">

  <div style="position: relative; height: 92px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
    <div style="position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: ${t.rule};"></div>
    <div style="position: relative;">${plaque(t)}</div>
    <div style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 8px; color: ${t.markInk};">
      ${icon('club', 17)}
      <span style="font-family: ${t.display}; font-size: 14px; letter-spacing: 0.04em;">card night</span>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; flex-shrink: 0;">
      ${tiles}
  </div>

  <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 9px;">
    <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.26em; color: ${t.muted}; text-transform: uppercase;">Tap a game to start scoring</div>
    <div style="display: flex; gap: 7px;">
      <span class="dot0" style="width: 7px; height: 7px; border-radius: 50%; background: ${t.accents[0]};"></span>
      <span style="width: 7px; height: 7px; border-radius: 50%; background: ${t.dotIdle};"></span>
      <span style="width: 7px; height: 7px; border-radius: 50%; background: ${t.dotIdle};"></span>
    </div>
  </div>

  <div style="flex-grow: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
        ${panel('All-time standings', 'played / won / rate', board)}
        ${panel('Recent results', 'see all', recent)}
  </div>

  <div class="strip" style="height: 76px; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 16px; padding: 0 16px 0 18px; background: ${t.stripBg}; border: ${t.stripBorder}; border-radius: ${t.stripRadius}; box-shadow: ${t.stripShadow};">
    <div style="width: 42px; height: 42px; border-radius: 50%; background: ${t.stripIconBg}; display: flex; align-items: center; justify-content: center; color: ${t.stripAccent};">${icon('diamond', 20)}</div>
    <div style="display: flex; flex-direction: column; gap: 2px; min-width: 168px;">
      <div style="display: flex; align-items: center; gap: 7px;">
        <span class="livedot" style="width: 7px; height: 7px; border-radius: 50%; background: ${t.live};"></span>
        <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.18em; color: ${t.live}; text-transform: uppercase;">Live now</span>
      </div>
      <div style="font-family: ${t.display}; font-size: 18px; color: ${t.stripInk};">${LIVE.game} &middot; Round ${LIVE.round}</div>
    </div>
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: flex-end;">
          ${standings}
    </div>
    <div style="padding-left: 16px; margin-left: 4px; border-left: 1px solid ${t.stripHair}; display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
      <span style="font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: ${t.stripMuted}; text-transform: uppercase;">First to</span>
      <span style="font-family: ${t.display}; font-size: 18px; color: ${t.stripInk};">${LIVE.target}</span>
    </div>
    <div class="resume" style="height: 52px; padding: 0 24px; border-radius: ${t.stripRadius === '999px' ? '999px' : '10px'}; background: ${t.resumeBg}; color: ${t.resumeInk}; border: ${t.resumeBorder}; box-shadow: ${t.resumeShadow}; display: flex; align-items: center; gap: 9px; font-family: ${t.display}; font-size: 15px;">
      ${icon('play', 14)} RESUME
    </div>
  </div>

</div>
</x-dc>
</body>
</html>
`;
}

/* ---------- the six skins ---------- */
const themes = {
  'Main.dc.html': { // JACKPOT TERMINAL
    fontsQuery: 'Bungee&family=Rubik:wght@400;500;600;700',
    display: "'Bungee', 'Impact', sans-serif", body: "'Rubik', 'Helvetica Neue', sans-serif",
    bg: '#ffd23f', bgImage: 'radial-gradient(#1d150822 1.4px, transparent 1.5px)',
    ink: '#1d1508', muted: '#8a7434', hair: '#e7d5a0', rule: '#1d150833', markInk: '#1d1508',
    accents: ['#e63946', '#0ead9b', '#3d5afe', '#ff8c42'], live: '#e63946',
    bulb: '#fff6d6', bulbGlow: 'rgba(255,246,214,0.95)', rowHover: '#ffd23f44', rankBg: '#efe4c4', dotIdle: '#1d150833',
    plaqueVariant: 'hexagon', plaqueBg: '#1d1508', plaqueBorder: '3px solid #1d1508', plaqueInk: '#ffd23f', plaqueSub: '#a08f60', plaqueShadow: '5px 5px 0 rgba(29,21,8,0.25)',
    wordSize: '27px',
    tileFrame: (a, x) => `4px solid ${x ? '#1d1508' : a}`, tileRadius: '16px', tileBg: '#fffdf5', tileShadow: '5px 5px 0 #1d1508',
    tileHoverShadow: '9px 12px 0 #1d1508',
    artBg: (a, x) => x ? '#efe4c4' : `${a}22`, artMeta: '#1d1508', artMetaBg: 'rgba(255,253,245,0.82)', artShadow: '0 5px 12px rgba(29,21,8,0.28)',
    bandBg: (a, x) => x ? '#1d1508' : a, bandInk: () => '#fffdf5', bandTrack: '0.04em',
    chipCols: ['#e63946', '#0ead9b', '#3d5afe', '#ff8c42'], tableFelt: '#0ead9b', tableRim: '#1d1508', boxLine: '#1d1508',
    panel: '#fffdf5', panelBorderCss: '3px solid #1d1508', panelRadius: '14px', panelShadow: '4px 4px 0 #1d1508',
    stripBg: '#1d1508', stripBorder: '3px solid #1d1508', stripRadius: '14px', stripShadow: '4px 4px 0 rgba(29,21,8,0.25)',
    stripInk: '#fffdf5', stripMuted: '#a08f60', stripAccent: '#ffd23f', stripHair: 'rgba(255,253,245,0.2)', stripIconBg: 'rgba(255,210,63,0.16)',
    resumeBg: '#ffd23f', resumeInk: '#1d1508', resumeBorder: '3px solid #fffdf5', resumeShadow: 'none',
  },

  'TerminalClassic.dc.html': { // faithful translation of the reference
    fontsQuery: 'Oswald:wght@300;400;500;600&family=Barlow:wght@400;500;600;700',
    display: "'Oswald', 'Helvetica Neue', sans-serif", body: "'Barlow', 'Helvetica Neue', sans-serif",
    bg: '#2f3134', bgImage: 'linear-gradient(180deg, #3a3d41 0%, #2b2d30 58%, #232528 100%)',
    ink: '#eceef0', muted: '#9aa0a6', hair: 'rgba(255,255,255,0.13)', rule: 'rgba(255,255,255,0.16)', markInk: '#d8dbdf',
    accents: ['#c9a227', '#4a9d6b', '#8b1f28', '#3b6ea5'], live: '#e0563f',
    bulb: '#e7dcc0', bulbGlow: 'rgba(231,220,192,0.85)', rowHover: 'rgba(255,255,255,0.06)', rankBg: 'rgba(255,255,255,0.10)', dotIdle: 'rgba(255,255,255,0.22)',
    plaqueVariant: 'trapezoid', plaqueBg: 'linear-gradient(180deg, #43464a 0%, #303336 100%)', plaqueBorder: '1px solid rgba(255,255,255,0.16)', plaqueInk: '#f2f4f6', plaqueSub: '#8d9298', plaqueShadow: 'none',
    wordSize: '26px', wordExtra: ' letter-spacing: 0.24em; font-weight: 300;',
    tileFrame: (a) => `2px solid ${a}`, tileRadius: '5px', tileBg: '#26282b', tileShadow: '0 8px 20px rgba(0,0,0,0.42)',
    tileHoverShadow: '0 18px 34px rgba(0,0,0,0.6)',
    artBg: (a, x) => x ? 'linear-gradient(180deg, #3a3d41 0%, #2a2c2f 100%)' : `linear-gradient(180deg, ${a}2e 0%, ${a}14 60%, rgba(0,0,0,0.3) 100%)`,
    artMeta: '#e6e8ea', artMetaBg: 'rgba(0,0,0,0.42)', artShadow: '0 6px 16px rgba(0,0,0,0.55)',
    bandBg: () => 'linear-gradient(180deg, #3c3f43 0%, #2c2f32 100%)', bandInk: () => '#f2f4f6', bandTrack: '0.14em',
    chipCols: ['#c9a227', '#8b1f28', '#3b6ea5', '#4a9d6b'], tableFelt: '#256b47', tableRim: '#8a6d3b', boxLine: '#1c1e21',
    panel: 'rgba(255,255,255,0.045)', panelBorderCss: '1px solid rgba(255,255,255,0.12)', panelRadius: '6px', panelShadow: 'none',
    stripBg: 'linear-gradient(180deg, #34373b 0%, #26282b 100%)', stripBorder: '1px solid rgba(255,255,255,0.14)', stripRadius: '8px', stripShadow: '0 -4px 18px rgba(0,0,0,0.3)',
    stripInk: '#f2f4f6', stripMuted: '#9aa0a6', stripAccent: '#c9a227', stripHair: 'rgba(255,255,255,0.16)', stripIconBg: 'rgba(201,162,39,0.15)',
    resumeBg: 'linear-gradient(180deg, #d4ac2c 0%, #a8811c 100%)', resumeInk: '#221a05', resumeBorder: 'none', resumeShadow: '0 3px 10px rgba(0,0,0,0.4)',
  },

  'NeonTerminal.dc.html': {
    fontsQuery: 'Monoton&family=Outfit:wght@300;400;500;600;700',
    display: "'Outfit', 'Helvetica Neue', sans-serif", body: "'Outfit', 'Helvetica Neue', sans-serif",
    bg: '#241350', bgImage: 'radial-gradient(58% 40% at 16% 0%, rgba(255,42,163,0.34) 0%, transparent 68%), radial-gradient(52% 38% at 88% 4%, rgba(0,229,255,0.30) 0%, transparent 66%)',
    ink: '#f5f0ff', muted: '#a892d8', hair: 'rgba(255,255,255,0.14)', rule: 'rgba(255,255,255,0.18)', markInk: '#00e5ff',
    accents: ['#ff2aa3', '#00e5ff', '#b4ff39', '#ffcc00'], live: '#ff2aa3',
    bulb: '#00e5ff', bulbGlow: 'rgba(0,229,255,0.95)', rowHover: 'rgba(255,42,163,0.14)', rankBg: 'rgba(255,255,255,0.10)', dotIdle: 'rgba(255,255,255,0.22)',
    plaqueVariant: 'neon', plaqueBg: 'rgba(255,255,255,0.05)', plaqueBorder: 'none', plaqueInk: '#ffffff', plaqueSub: '#a892d8', plaqueShadow: 'none',
    wordSize: '25px', wordExtra: " font-family: 'Monoton', cursive; letter-spacing: 0.07em; text-shadow: 0 0 12px #00e5ff, 0 0 30px #ff2aa3;",
    tileFrame: (a) => `2px solid ${a}`, tileRadius: '14px', tileBg: 'rgba(255,255,255,0.05)', tileShadow: '0 0 22px rgba(255,42,163,0.22)',
    tileHoverShadow: '0 0 40px rgba(255,42,163,0.55)',
    artBg: (a, x) => x ? 'rgba(255,255,255,0.06)' : `radial-gradient(80% 70% at 50% 40%, ${a}33 0%, rgba(255,255,255,0.03) 70%)`,
    artMeta: '#f5f0ff', artMetaBg: 'rgba(36,19,80,0.7)', artShadow: '0 6px 18px rgba(0,0,0,0.5)',
    bandBg: (a, x) => x ? 'rgba(255,255,255,0.09)' : `${a}26`, bandInk: (a, x) => x ? '#ffffff' : a, bandTrack: '0.12em',
    chipCols: ['#ff2aa3', '#00e5ff', '#b4ff39', '#ffcc00'], tableFelt: '#2c1a63', tableRim: '#00e5ff', boxLine: '#1a0f3d',
    panel: 'rgba(255,255,255,0.055)', panelBorderCss: '1px solid rgba(255,255,255,0.16)', panelRadius: '14px', panelShadow: '0 0 24px rgba(0,229,255,0.10)',
    stripBg: 'rgba(255,255,255,0.06)', stripBorder: '2px solid #ff2aa3', stripRadius: '14px', stripShadow: '0 0 30px rgba(255,42,163,0.28)',
    stripInk: '#ffffff', stripMuted: '#a892d8', stripAccent: '#00e5ff', stripHair: 'rgba(255,255,255,0.18)', stripIconBg: 'rgba(0,229,255,0.14)',
    resumeBg: '#ff2aa3', resumeInk: '#1a0b33', resumeBorder: 'none', resumeShadow: '0 0 24px rgba(255,42,163,0.7)',
  },

  'CandyTerminal.dc.html': {
    fontsQuery: 'Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700',
    display: "'Baloo 2', 'Trebuchet MS', cursive", body: "'Nunito', 'Helvetica Neue', sans-serif",
    bg: '#fff4e6', bgImage: 'radial-gradient(circle at 10% 4%, #ffd9e8 0%, transparent 32%), radial-gradient(circle at 90% 3%, #d6f5ff 0%, transparent 30%)',
    ink: '#3a2a3f', muted: '#9b8aa3', hair: '#f2e6ee', rule: '#e8d8e4', markInk: '#ff5d8f',
    accents: ['#ff5d8f', '#22c1a4', '#7c4dff', '#ffb703'], live: '#ff5d8f',
    bulb: '#ff5d8f', bulbGlow: 'rgba(255,93,143,0.8)', rowHover: '#ff5d8f14', rankBg: '#f0e7f5', dotIdle: '#e3d5e9',
    plaqueVariant: 'pill', plaqueBg: '#ffffff', plaqueBorder: '3px solid #ffd9e8', plaqueInk: '#3a2a3f', plaqueSub: '#b3a3ba', plaqueShadow: '0 8px 20px rgba(58,42,63,0.12)',
    wordSize: '28px',
    tileFrame: (a, x) => `3px solid ${x ? '#3a2a3f' : a}`, tileRadius: '22px', tileBg: '#ffffff', tileShadow: '0 10px 24px rgba(58,42,63,0.12)',
    tileHoverShadow: '0 20px 38px rgba(58,42,63,0.22)',
    artBg: (a, x) => x ? '#f6eefa' : `${a}1f`, artMeta: '#3a2a3f', artMetaBg: 'rgba(255,255,255,0.86)', artShadow: '0 6px 14px rgba(58,42,63,0.2)',
    bandBg: (a, x) => x ? '#3a2a3f' : a, bandInk: () => '#ffffff', bandTrack: '0.03em',
    chipCols: ['#ff5d8f', '#22c1a4', '#7c4dff', '#ffb703'], tableFelt: '#22c1a4', tableRim: '#ffffff', boxLine: '#3a2a3f',
    panel: '#ffffff', panelBorderCss: '2px solid #f4e6ee', panelRadius: '18px', panelShadow: '0 8px 20px rgba(58,42,63,0.09)',
    stripBg: '#ffffff', stripBorder: '3px solid #ffd9e8', stripRadius: '999px', stripShadow: '0 10px 24px rgba(58,42,63,0.13)',
    stripInk: '#3a2a3f', stripMuted: '#9b8aa3', stripAccent: '#ff5d8f', stripHair: '#f2e6ee', stripIconBg: '#ffe8f0',
    resumeBg: '#22c1a4', resumeInk: '#ffffff', resumeBorder: 'none', resumeShadow: '0 6px 0 #16957e',
  },

  'RetroTerminal.dc.html': {
    fontsQuery: 'Alfa+Slab+One&family=DM+Sans:wght@400;500;700',
    display: "'Alfa Slab One', Georgia, serif", body: "'DM Sans', 'Helvetica Neue', sans-serif",
    bg: '#f6ecd9', bgImage: 'repeating-linear-gradient(135deg, rgba(214,109,43,0.07) 0px, rgba(214,109,43,0.07) 12px, transparent 12px, transparent 26px)',
    ink: '#2b1b12', muted: '#8a6f57', hair: '#e2d3b8', rule: '#2b1b1233', markInk: '#2b1b12',
    accents: ['#d64545', '#e08d1e', '#1b9aaa', '#6a4c93'], live: '#d64545',
    bulb: '#ffd88a', bulbGlow: 'rgba(255,216,138,0.95)', rowHover: '#d6454514', rankBg: '#e8dbc2', dotIdle: '#cdbb9a',
    plaqueVariant: 'marquee', plaqueBg: '#1b9aaa', plaqueBorder: '3px solid #2b1b12', plaqueInk: '#fffaf0', plaqueSub: '#bfe6ea', plaqueShadow: '5px 5px 0 #2b1b12',
    wordSize: '24px',
    tileFrame: (a, x) => `3px solid ${x ? '#2b1b12' : a}`, tileRadius: '96px 96px 12px 12px', tileBg: '#fffaf0', tileShadow: '4px 4px 0 #2b1b12',
    tileHoverShadow: '8px 11px 0 #2b1b12',
    artBg: (a, x) => x ? '#efe2c7' : `${a}22`, artMeta: '#2b1b12', artMetaBg: 'rgba(255,250,240,0.85)', artShadow: '0 5px 12px rgba(43,27,18,0.3)',
    bandBg: (a, x) => x ? '#2b1b12' : a, bandInk: () => '#fffaf0', bandTrack: '0.05em',
    chipCols: ['#d64545', '#e08d1e', '#1b9aaa', '#6a4c93'], tableFelt: '#1b9aaa', tableRim: '#2b1b12', boxLine: '#2b1b12',
    panel: '#fffaf0', panelBorderCss: '2px solid #2b1b12', panelRadius: '12px', panelShadow: '4px 4px 0 #2b1b12',
    stripBg: '#d64545', stripBorder: '3px solid #2b1b12', stripRadius: '12px', stripShadow: '4px 4px 0 #2b1b12',
    stripInk: '#fffaf0', stripMuted: '#f2c9c9', stripAccent: '#ffd88a', stripHair: 'rgba(255,250,240,0.3)', stripIconBg: 'rgba(255,250,240,0.18)',
    resumeBg: '#e08d1e', resumeInk: '#2b1b12', resumeBorder: '3px solid #2b1b12', resumeShadow: 'none',
  },

  'FeltTerminal.dc.html': {
    fontsQuery: 'Titan+One&family=Mulish:wght@400;600;700;800',
    display: "'Titan One', 'Arial Black', sans-serif", body: "'Mulish', 'Helvetica Neue', sans-serif",
    bg: '#1a9c62', bgImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 3px, transparent 3px, transparent 9px)',
    ink: '#0d3d26', muted: '#5c8a72', hair: '#d8e9df', rule: 'rgba(255,255,255,0.35)', markInk: '#fff3d0',
    accents: ['#e03e3e', '#f2b705', '#2b6cb0', '#8e44ad'], live: '#ff5a3c',
    bulb: '#ffe9a8', bulbGlow: 'rgba(255,233,168,0.95)', rowHover: '#1a9c6214', rankBg: '#e2efe8', dotIdle: 'rgba(255,255,255,0.4)',
    plaqueVariant: 'arch', plaqueBg: '#0d3d26', plaqueBorder: '4px solid #d9a441', plaqueInk: '#fff3d0', plaqueSub: '#a3bfae', plaqueShadow: '0 8px 0 rgba(13,61,38,0.3)',
    wordSize: '25px',
    tileFrame: (a, x) => `5px solid ${x ? '#d9a441' : '#0d3d26'}`, tileRadius: '12px', tileBg: '#fffdf6', tileShadow: '0 8px 0 rgba(13,61,38,0.35)',
    tileHoverShadow: '0 16px 0 rgba(13,61,38,0.4)',
    artBg: (a, x) => x ? '#efe6cf' : `linear-gradient(180deg, ${a}26 0%, #fffdf6 100%)`,
    artMeta: '#0d3d26', artMetaBg: 'rgba(255,253,246,0.88)', artShadow: '0 6px 14px rgba(13,61,38,0.28)',
    bandBg: (a, x) => x ? '#d9a441' : '#0d3d26', bandInk: (a, x) => x ? '#0d3d26' : '#fff3d0', bandTrack: '0.05em',
    chipCols: ['#e03e3e', '#f2b705', '#2b6cb0', '#8e44ad'], tableFelt: '#1a9c62', tableRim: '#d9a441', boxLine: '#0d3d26',
    panel: '#fffdf6', panelBorderCss: '4px solid #0d3d26', panelRadius: '12px', panelShadow: '0 6px 0 rgba(13,61,38,0.3)',
    stripBg: '#0d3d26', stripBorder: '4px solid #d9a441', stripRadius: '12px', stripShadow: '0 6px 0 rgba(13,61,38,0.35)',
    stripInk: '#fff3d0', stripMuted: '#a3bfae', stripAccent: '#f2b705', stripHair: 'rgba(255,243,208,0.25)', stripIconBg: 'rgba(242,183,5,0.16)',
    resumeBg: '#f2b705', resumeInk: '#0d3d26', resumeBorder: '3px solid #fff3d0', resumeShadow: 'none',
  },
};

for (const [file, t] of Object.entries(themes)) {
  if (!t.wordExtra) t.wordExtra = '';
  const html = page(t);
  writeFileSync(file, html);
  console.log(`${file}: ${html.length} bytes, tiles=${(html.match(/class="tile"/g) || []).length}`);
}
