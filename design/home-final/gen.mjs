import { writeFileSync } from 'node:fs';

/* ================= content ================= */
const LIVE = { game: '3 of Spade', round: 7, target: 500,
  standings: [['Abhi', 412], ['Priya', 388], ['Rahul', 355], ['Nikhil', 340]] };

const TILES = [
  { band: '3 OF SPADE', bandSize: '20px', sub: '2 days ago',   kind: 'spade3', live: true },
  { band: 'KACHUFULL',  bandSize: '20px', sub: '6 days ago',   kind: 'kachu',  live: false },
  { band: 'COMING SOON', bandSize: '16px', sub: 'slot open',   kind: 'soon',   live: false, ghost: true },
  { band: 'ARCHIVES',   bandSize: '19px', sub: '142 sessions', kind: 'box',    live: false, archive: true },
];

const BOARD = [['Abhi', 42, 15, '36%'], ['Priya', 40, 12, '30%'], ['Rahul', 38, 8, '21%'],
  ['Nikhil', 41, 5, '12%'], ['Sneha', 22, 2, '9%']];

const RECENT = [['3 of Spade', '28 Aug', 'Abhi', 503], ['KaChuFull', '24 Aug', 'Priya', 188],
  ['3 of Spade', '21 Aug', 'Rahul', 512], ['KaChuFull', '17 Aug', 'Priya', 176],
  ['3 of Spade', '12 Aug', 'Abhi', 498]];

const P = {
  spade: 'M12 2.5c3 4 8.5 6.6 8.5 11a4.6 4.6 0 0 1-7.3 3.7c.2 1.6.8 3 1.8 4.3H9c1-1.3 1.6-2.7 1.8-4.3A4.6 4.6 0 0 1 3.5 13.5c0-4.4 5.5-7 8.5-11z',
  heart: 'M12 21s-7.5-4.7-9.4-9.2C1 8.3 3 4.8 6.4 4.5 8.6 4.3 10.6 5.4 12 7.2c1.4-1.8 3.4-2.9 5.6-2.7C21 4.8 23 8.3 21.4 11.8 19.5 16.3 12 21 12 21z',
  diamond: 'M12 2l7 10-7 10-7-10z',
  club: 'M12 2.6a3.7 3.7 0 0 0-3.1 5.7 3.8 3.8 0 1 0-1.3 7.3c1.2 0 2.3-.6 3-1.5-.1 2-.8 3.8-2 5.3h6.8c-1.2-1.5-1.9-3.3-2-5.3.7.9 1.8 1.5 3 1.5a3.8 3.8 0 1 0-1.3-7.3A3.7 3.7 0 0 0 12 2.6z',
  play: 'M8 5l11 7-11 7z',
};
const ic = (k, s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c || 'currentColor'}" aria-hidden="true"><path d="${P[k]}"/></svg>`;

/* ================= game logos ================= */

// 1 — "3 of Spade": big numeral 3 beside a solid black spade, on three fanned spade cards
function logoSpade3(t) {
  const card = (rot, dx) => `<div style="position: absolute; left: 50%; top: 50%; width: 96px; height: 132px; margin: -76px 0 0 -48px; background: ${t.cardFace}; border-radius: 9px; box-shadow: ${t.artShadow}; transform: rotate(${rot}deg) translateX(${dx}px);"></div>`;
  return `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
      ${card(-16, -58)}${card(0, 0)}${card(16, 58)}
      <div style="position: relative; display: flex; align-items: center; gap: 2px; margin-top: 14px;">
        <span style="font-family: ${t.display}; font-size: 92px; line-height: 0.82; color: ${t.logoInk};${t.logo3Extra || ''}">3</span>
        <span style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; color: ${t.logoMuted}; text-transform: uppercase;">of</span>
          <span class="spademark" style="display: inline-flex; color: ${t.logoSpade}; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">${ic('spade', 54)}</span>
        </span>
      </div>
    </div>`;
}

// 2 — "KaChuFull": a diagonal saltire cross with the four suits along its arms
function logoKachu(t) {
  const bar = (rot) => `<div style="position: absolute; left: 50%; top: 50%; width: 196px; height: 13px; margin: -6.5px 0 0 -98px; border-radius: 7px; background: ${t.logoBar}; transform: rotate(${rot}deg);"></div>`;
  const suit = (k, x, y, col) => `<span class="kcsuit" style="position: absolute; left: 50%; top: 50%; margin: ${y - 17}px 0 0 ${x - 17}px; width: 34px; height: 34px; border-radius: 50%; background: ${t.cardFace}; box-shadow: ${t.artShadow}; display: flex; align-items: center; justify-content: center; color: ${col};">${ic(k, 20)}</span>`;
  return `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
      <div style="position: relative; width: 210px; height: 210px;">
        <div style="position: absolute; left: 50%; top: 50%; width: 172px; height: 172px; margin: -86px 0 0 -86px; border-radius: 50%; border: 2px dashed ${t.logoRing};"></div>
        ${bar(45)}${bar(-45)}
        ${suit('spade', -68, -68, t.suitDark)}
        ${suit('heart', 68, -68, t.suitRed)}
        ${suit('club', -68, 68, t.suitDark)}
        ${suit('diamond', 68, 68, t.suitRed)}
        <span style="position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 12px; background: ${t.logoHub}; transform: rotate(45deg); box-shadow: ${t.artShadow};"></span>
        <span style="position: absolute; left: 50%; top: 50%; margin: -13px 0 0 -26px; width: 52px; text-align: center; font-family: ${t.display}; font-size: 22px; color: ${t.logoHubInk};">KF</span>
      </div>
    </div>`;
}

function logoSoon(t) {
  return `<div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
      <div class="soonplus" style="position: relative; width: 84px; height: 84px; border-radius: 22px; border: 3px dashed ${t.ghostLine}; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 34px; height: 4px; border-radius: 2px; background: ${t.ghostLine};"></span>
        <span style="position: absolute; width: 4px; height: 34px; border-radius: 2px; background: ${t.ghostLine};"></span>
      </div>
      <div style="display: flex; gap: 7px;">
        <span style="width: 9px; height: 9px; border-radius: 50%; background: ${t.ghostLine};"></span>
        <span style="width: 9px; height: 9px; border-radius: 50%; background: ${t.ghostLine}; opacity: 0.6;"></span>
        <span style="width: 9px; height: 9px; border-radius: 50%; background: ${t.ghostLine}; opacity: 0.3;"></span>
      </div>
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.22em; color: ${t.ghostInk}; text-transform: uppercase;">Game 3 &middot; 4 &middot; 5</div>
    </div>`;
}

function logoBox(t, acc) {
  return `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
      <div style="position: relative; width: 186px; height: 150px;">
        <div style="position: absolute; left: 18px; top: 2px; width: 150px; height: 28px; background: ${t.cardFace}; border-radius: 5px; box-shadow: ${t.artShadow}; transform: rotate(-5deg);"></div>
        <div style="position: absolute; left: 24px; top: 14px; width: 138px; height: 26px; background: ${t.cardFace}; border-radius: 5px; box-shadow: ${t.artShadow}; transform: rotate(4deg); opacity: 0.85;"></div>
        <div style="position: absolute; left: 0; top: 38px; width: 186px; height: 36px; background: ${acc}; border-radius: 8px; border: 3px solid ${t.boxLine};"></div>
        <div style="position: absolute; left: 12px; top: 74px; width: 162px; height: 76px; background: ${acc}; border-radius: 0 0 9px 9px; border: 3px solid ${t.boxLine}; border-top: none; display: flex; align-items: center; justify-content: center;">
          <div style="width: 56px; height: 9px; border-radius: 5px; background: ${t.boxLine}; opacity: 0.5;"></div>
        </div>
      </div>
    </div>`;
}

const art = (t, it, acc) => it.kind === 'spade3' ? logoSpade3(t)
  : it.kind === 'kachu' ? logoKachu(t)
  : it.kind === 'soon' ? logoSoon(t)
  : logoBox(t, acc);

/* ================= plaque ================= */
function plaque(t) {
  const inner = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <div style="font-family: ${t.display}; font-size: ${t.wordSize}; line-height: 1; color: ${t.plaqueInk};${t.wordExtra || ''}">NAME TBA</div>
        <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.28em; color: ${t.plaqueSub}; text-transform: uppercase; margin-top: 5px;">Placeholder wordmark</div>
      </div>`;
  const v = t.plaqueVariant;
  if (v === 'trapezoid') return `<div style="position: relative; width: 344px; height: 84px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; clip-path: polygon(0 0, 100% 0, 100% 64%, 88% 100%, 12% 100%, 0 64%); padding: 0 20px; box-sizing: border-box;">${inner}</div>`;
  if (v === 'neon') return `<div style="position: relative; width: 346px; height: 84px; border: 2px solid ${t.accents[1]}; border-radius: 12px; background: rgba(255,255,255,0.05); box-shadow: 0 0 26px ${t.accents[1]}66, inset 0 0 24px ${t.accents[0]}33; padding: 0 24px; box-sizing: border-box;">${inner}</div>`;
  if (v === 'marquee') return `<div style="position: relative; width: 356px; height: 86px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; border-radius: 10px; box-shadow: ${t.plaqueShadow}; padding: 0 30px; box-sizing: border-box;">
        <div class="bulbs" style="top: 7px;">${'<span></span>'.repeat(13)}</div>
        <div class="bulbs" style="bottom: 7px;">${'<span></span>'.repeat(13)}</div>${inner}</div>`;
  return `<div style="position: relative; width: 344px; height: 88px; background: ${t.plaqueBg}; border: ${t.plaqueBorder}; border-radius: 22px 22px 12px 12px; box-shadow: ${t.plaqueShadow}; padding: 0 26px; box-sizing: border-box;">${inner}</div>`;
}

/* ================= motion ================= */
const fx = (t) => `
    @keyframes dcPlaque { from { opacity: 0; transform: translateY(-22px) scale(0.96); } to { opacity: 1; transform: none; } }
    @keyframes dcRule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes dcBar { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: none; } }
    @keyframes dcPop { from { opacity: 0; transform: translateY(30px) scale(0.94); } to { opacity: 1; transform: none; } }
    @keyframes dcFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @keyframes dcRowIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
    @keyframes dcDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.55); opacity: 0.35; } }
    @keyframes dcSweep { 0% { transform: translateX(-150%) skewX(-20deg); } 55%, 100% { transform: translateX(430%) skewX(-20deg); } }
    @keyframes dcSheen { from { transform: translateX(-130%); } to { transform: translateX(130%); } }
    @keyframes dcBulb { 0%, 100% { opacity: 1; box-shadow: 0 0 9px ${t.bulbGlow}; } 50% { opacity: 0.18; box-shadow: 0 0 0 rgba(0,0,0,0); } }
    @keyframes dcReel { 0%, 84%, 100% { transform: translateY(0); } 88% { transform: translateY(-9px); } 94% { transform: translateY(5px); } }
    @keyframes dcPulse { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.16) rotate(-4deg); } }
    @keyframes dcSuitSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes dcSoon { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
    @keyframes dcTwinkle { 0%, 100% { opacity: 0.3; transform: scale(0.72); } 50% { opacity: 1; transform: scale(1); } }
${t.ambientKeyframes || ''}
    /* staged reveal */
    .plaque { animation: dcPlaque 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .rule { animation: dcRule 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
    .bar { animation: dcBar 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s both; }
    .tile { animation: dcPop 0.66s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .tile:nth-of-type(1) { animation-delay: 0.30s; }
    .tile:nth-of-type(2) { animation-delay: 0.38s; }
    .tile:nth-of-type(3) { animation-delay: 0.46s; }
    .tile:nth-of-type(4) { animation-delay: 0.54s; }
    .prompt { animation: dcFade 0.5s ease 0.62s both; }
    .panel { animation: dcFade 0.55s ease 0.68s both; }
    .row { animation: dcRowIn 0.42s ease both; transition: background 0.18s ease, transform 0.18s ease; }
    .row:nth-of-type(1) { animation-delay: 0.74s; }
    .row:nth-of-type(2) { animation-delay: 0.80s; }
    .row:nth-of-type(3) { animation-delay: 0.86s; }
    .row:nth-of-type(4) { animation-delay: 0.92s; }
    .row:nth-of-type(5) { animation-delay: 0.98s; }
    .row:hover { background: ${t.rowHover}; transform: translateX(4px); }

    /* tiles */
    .tile { transition: transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.26s ease; }
    .tile:hover { transform: translateY(-10px); box-shadow: ${t.tileHoverShadow}; }
    .art { position: relative; overflow: hidden; }
    .artin { position: absolute; inset: 0; transition: transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .tile:hover .artin { transform: scale(1.07); }
    .art::after { content: ""; position: absolute; inset: -20%; pointer-events: none; transform: translateX(-130%); background: linear-gradient(112deg, transparent 34%, rgba(255,255,255,0.34) 50%, transparent 66%); }
    .tile:hover .art::after { animation: dcSheen 0.85s ease; }
    .tile:hover .spademark { animation: dcPulse 0.62s ease; }
    .tile:hover .kcsuit { animation: dcSuitSpin 0.8s ease; }
    .band { transition: filter 0.24s ease, letter-spacing 0.24s ease; }
    .tile:hover .band { filter: brightness(1.12); letter-spacing: 0.1em; }
    .soonplus { animation: dcSoon 2.6s ease-in-out infinite; }

    /* live bar */
    .livedot { animation: dcDot 1.5s ease-in-out infinite; }
    .reelnum { display: inline-block; animation: dcReel 5s ease-in-out infinite; }
    .resume { position: relative; overflow: hidden; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease; }
    .resume:hover { transform: scale(1.06); }
    .resume::after { content: ""; position: absolute; top: 0; left: 0; width: 32%; height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.66), rgba(255,255,255,0)); animation: dcSweep 3.1s ease-in-out infinite; pointer-events: none; }
    .bulbs { position: absolute; left: 16px; right: 16px; display: flex; justify-content: space-between; pointer-events: none; }
    .bulbs span { width: 6px; height: 6px; border-radius: 50%; background: ${t.bulb}; animation: dcBulb 1.5s ease-in-out infinite; }
    .bulbs span:nth-child(2n) { animation-delay: 0.25s; }
    .bulbs span:nth-child(3n) { animation-delay: 0.55s; }
    .dot0 { animation: dcTwinkle 2.4s ease-in-out infinite; }
${t.ambientRules || ''}
    @media (prefers-reduced-motion: reduce) { *, *::after { animation: none !important; transition: none !important; } }
`;

/* ================= page ================= */
function page(t) {
  const tiles = TILES.map((it, i) => {
    const acc = t.accents[i % t.accents.length];
    const frame = it.ghost ? t.ghostFrame : t.tileFrame(acc, it.archive);
    const bandBg = it.ghost ? t.ghostBand : t.bandBg(acc, it.archive);
    const bandInk = it.ghost ? t.ghostInk : t.bandInk(acc, it.archive);
    return `<div class="tile" style="height: 356px; box-sizing: border-box; display: flex; flex-direction: column; border: ${frame}; border-radius: ${t.tileRadius}; overflow: hidden; background: ${t.tileBg}; box-shadow: ${it.ghost ? 'none' : t.tileShadow};">
        <div class="art" style="flex-grow: 1; background: ${it.ghost ? t.ghostArt : t.artBg(acc, it.archive)};">
          <div class="artin">${art(t, it, acc)}</div>
          ${it.live ? `<span style="position: absolute; top: 12px; right: 12px; z-index: 2; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; background: ${t.live}; color: #fff; padding: 5px 10px; border-radius: 999px;">LIVE</span>` : ''}
          <span style="position: absolute; top: 12px; left: 12px; z-index: 2; font-size: 11px; font-weight: 700; color: ${t.artMeta}; background: ${t.artMetaBg}; padding: 4px 9px; border-radius: 999px;">${it.sub}</span>
        </div>
        <div class="band" style="height: 52px; flex-shrink: 0; background: ${bandBg}; color: ${bandInk}; display: flex; align-items: center; justify-content: center; font-family: ${t.display}; font-size: ${it.bandSize}; letter-spacing: ${t.bandTrack};">${it.band}</div>
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
            <span style="width: 96px; font-size: 14px; font-weight: 600; color: ${t.ink};">${g}</span>
            <span style="width: 54px; font-size: 12px; color: ${t.muted};">${d}</span>
            <span style="flex-grow: 1; font-size: 13px; font-weight: 700; color: ${t.accents[1]};">${w}</span>
            <span style="font-family: ${t.display}; font-size: 16px; color: ${t.ink};">${s}</span>
          </div>`).join('\n          ');

  const panel = (title, meta, body) => `<div class="panel" style="background: ${t.panel}; border: ${t.panelBorderCss}; border-radius: ${t.panelRadius}; box-shadow: ${t.panelShadow}; padding: 13px 15px; display: flex; flex-direction: column; gap: 5px; overflow: hidden;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 9px 6px; border-bottom: 1px solid ${t.hair};">
            <div style="font-family: ${t.display}; font-size: 16px; color: ${t.ink};">${title}</div>
            <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: ${t.muted}; text-transform: uppercase;">${meta}</div>
          </div>
          ${body}
        </div>`;

  const standings = LIVE.standings.map(([n, s], i) => `<div style="display: flex; flex-direction: column; gap: 1px; padding: 0 15px; ${i ? `border-left: 1px solid ${t.stripHair};` : ''}">
          <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: ${i === 0 ? t.stripAccent : t.stripMuted}; text-transform: uppercase;">${n}</span>
          <span class="${i === 0 ? 'reelnum' : ''}" style="font-family: ${t.display}; font-size: 23px; line-height: 1.1; color: ${i === 0 ? t.stripAccent : t.stripInk};">${s}</span>
        </div>`).join('\n        ');

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
${fx(t)}  </style>
</helmet>

<div style="position: relative; width: 1280px; height: 1000px; box-sizing: border-box; padding: 30px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; font-family: ${t.body}; color: ${t.ink}; background-color: ${t.bg};${t.bgImage ? ' background-image: ' + t.bgImage + ';' : ''}">
  ${t.ambientLayer || ''}

  <div style="position: relative; height: 88px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
    <div class="rule" style="position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: ${t.rule};"></div>
    <div class="plaque" style="position: relative;">${plaque(t)}</div>
    <div class="plaque" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 8px; color: ${t.markInk};">
      ${ic('club', 17)}<span style="font-family: ${t.display}; font-size: 14px; letter-spacing: 0.04em;">card night</span>
    </div>
  </div>

  <div class="bar" style="height: 86px; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 16px; padding: 0 16px 0 20px; background: ${t.stripBg}; border: ${t.stripBorder}; border-radius: ${t.stripRadius}; box-shadow: ${t.stripShadow};">
    <div style="width: 46px; height: 46px; border-radius: 50%; background: ${t.stripIconBg}; display: flex; align-items: center; justify-content: center; color: ${t.stripAccent};">${ic('spade', 22)}</div>
    <div style="display: flex; flex-direction: column; gap: 3px; min-width: 190px;">
      <div style="display: flex; align-items: center; gap: 7px;">
        <span class="livedot" style="width: 8px; height: 8px; border-radius: 50%; background: ${t.live};"></span>
        <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${t.live}; text-transform: uppercase;">Live now &middot; Round ${LIVE.round}</span>
      </div>
      <div style="font-family: ${t.display}; font-size: 22px; color: ${t.stripInk};">${LIVE.game}</div>
    </div>
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: flex-end;">
        ${standings}
    </div>
    <div style="padding-left: 16px; margin-left: 2px; border-left: 1px solid ${t.stripHair}; display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
      <span style="font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: ${t.stripMuted}; text-transform: uppercase;">First to</span>
      <span style="font-family: ${t.display}; font-size: 19px; color: ${t.stripInk};">${LIVE.target}</span>
    </div>
    <div class="resume" style="height: 56px; padding: 0 26px; border-radius: ${t.stripRadius === '999px' ? '999px' : '10px'}; background: ${t.resumeBg}; color: ${t.resumeInk}; border: ${t.resumeBorder}; box-shadow: ${t.resumeShadow}; display: flex; align-items: center; gap: 9px; font-family: ${t.display}; font-size: 16px;">
      ${ic('play', 15)} RESUME
    </div>
  </div>

  <div style="position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; flex-shrink: 0;">
      ${tiles}
  </div>

  <div class="prompt" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;">
    <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.26em; color: ${t.muted}; text-transform: uppercase;">Tap a game to start scoring</div>
    <div style="display: flex; gap: 7px;">
      <span class="dot0" style="width: 7px; height: 7px; border-radius: 50%; background: ${t.accents[0]};"></span>
      <span style="width: 7px; height: 7px; border-radius: 50%; background: ${t.dotIdle};"></span>
      <span style="width: 7px; height: 7px; border-radius: 50%; background: ${t.dotIdle};"></span>
    </div>
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

/* ================= the four skins ================= */
const confettiLayer = (cols) => {
  let s = '';
  for (let i = 0; i < 18; i++) s += `<span style="left: ${2 + i * 5.5}%; background: ${cols[i % cols.length]}; animation-delay: ${(i * 0.31).toFixed(2)}s; transform: rotate(${(i * 27) % 70}deg);"></span>`;
  return `<div class="conf" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;">${s}</div>`;
};

const themes = {
  'Main.dc.html': { // TERMINAL CLASSIC
    fontsQuery: 'Oswald:wght@300;400;500;600&family=Barlow:wght@400;500;600;700',
    display: "'Oswald', 'Helvetica Neue', sans-serif", body: "'Barlow', 'Helvetica Neue', sans-serif",
    bg: '#2f3134', bgImage: 'linear-gradient(180deg, #3a3d41 0%, #2b2d30 58%, #232528 100%)',
    ink: '#eceef0', muted: '#9aa0a6', hair: 'rgba(255,255,255,0.13)', rule: 'rgba(255,255,255,0.16)', markInk: '#d8dbdf',
    accents: ['#c9a227', '#4a9d6b', '#8b1f28', '#3b6ea5'], live: '#e0563f',
    bulb: '#e7dcc0', bulbGlow: 'rgba(231,220,192,0.85)', rowHover: 'rgba(255,255,255,0.06)', rankBg: 'rgba(255,255,255,0.10)', dotIdle: 'rgba(255,255,255,0.22)',
    plaqueVariant: 'trapezoid', plaqueBg: 'linear-gradient(180deg, #43464a 0%, #303336 100%)', plaqueBorder: '1px solid rgba(255,255,255,0.16)',
    plaqueInk: '#f2f4f6', plaqueSub: '#8d9298', plaqueShadow: 'none', wordSize: '26px', wordExtra: ' letter-spacing: 0.24em; font-weight: 300;',
    tileFrame: (a) => `2px solid ${a}`, tileRadius: '5px', tileBg: '#26282b', tileShadow: '0 8px 20px rgba(0,0,0,0.42)', tileHoverShadow: '0 20px 38px rgba(0,0,0,0.62)',
    artBg: (a, x) => x ? 'linear-gradient(180deg, #3a3d41 0%, #2a2c2f 100%)' : `linear-gradient(180deg, ${a}2e 0%, ${a}12 60%, rgba(0,0,0,0.32) 100%)`,
    artMeta: '#e6e8ea', artMetaBg: 'rgba(0,0,0,0.45)', artShadow: '0 6px 16px rgba(0,0,0,0.55)',
    bandBg: () => 'linear-gradient(180deg, #3c3f43 0%, #2c2f32 100%)', bandInk: () => '#f2f4f6', bandTrack: '0.14em',
    ghostFrame: '2px dashed rgba(255,255,255,0.22)', ghostArt: 'rgba(255,255,255,0.03)', ghostBand: 'rgba(255,255,255,0.06)', ghostInk: '#9aa0a6', ghostLine: 'rgba(255,255,255,0.3)',
    cardFace: '#f4f1e8', logoInk: '#f2f4f6', logoMuted: '#9aa0a6', logoSpade: '#14161a', logoBar: '#c9a227', logoRing: 'rgba(255,255,255,0.2)', logoHub: '#c9a227', logoHubInk: '#221a05',
    suitDark: '#14161a', suitRed: '#a8242f', boxLine: '#1c1e21',
    panel: 'rgba(255,255,255,0.045)', panelBorderCss: '1px solid rgba(255,255,255,0.12)', panelRadius: '6px', panelShadow: 'none',
    stripBg: 'linear-gradient(180deg, #34373b 0%, #26282b 100%)', stripBorder: '1px solid rgba(255,255,255,0.14)', stripRadius: '8px', stripShadow: '0 6px 18px rgba(0,0,0,0.3)',
    stripInk: '#f2f4f6', stripMuted: '#9aa0a6', stripAccent: '#c9a227', stripHair: 'rgba(255,255,255,0.16)', stripIconBg: 'rgba(201,162,39,0.15)',
    resumeBg: 'linear-gradient(180deg, #d4ac2c 0%, #a8811c 100%)', resumeInk: '#221a05', resumeBorder: 'none', resumeShadow: '0 3px 10px rgba(0,0,0,0.4)',
  },

  'SlotTerminal.dc.html': { // SLOT MACHINE
    fontsQuery: 'Titan+One&family=Mulish:wght@400;600;700;800',
    display: "'Titan One', 'Arial Black', sans-serif", body: "'Mulish', 'Helvetica Neue', sans-serif",
    bg: '#e8342c', bgImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 46px, transparent 46px, transparent 92px)',
    ink: '#17244d', muted: '#6d7699', hair: '#dfe3f0', rule: 'rgba(255,255,255,0.4)', markInk: '#ffe066',
    accents: ['#2440a8', '#f7b500', '#00a878', '#e8342c'], live: '#e8342c',
    bulb: '#ffe066', bulbGlow: 'rgba(255,224,102,0.95)', rowHover: '#2440a814', rankBg: '#e4e8f6', dotIdle: 'rgba(255,255,255,0.5)',
    plaqueVariant: 'marquee', plaqueBg: '#17244d', plaqueBorder: '3px solid #ffffff', plaqueInk: '#ffe066', plaqueSub: '#9aa6cf', plaqueShadow: '5px 5px 0 rgba(23,36,77,0.4)', wordSize: '25px',
    tileFrame: (a, x) => `3px solid ${x ? '#17244d' : '#17244d'}`, tileRadius: '14px', tileBg: '#ffffff', tileShadow: '5px 5px 0 #17244d', tileHoverShadow: '10px 13px 0 #17244d',
    artBg: (a, x) => x ? '#eef1fa' : `linear-gradient(180deg, ${a}22 0%, #ffffff 100%)`,
    artMeta: '#17244d', artMetaBg: 'rgba(255,255,255,0.9)', artShadow: '0 6px 14px rgba(23,36,77,0.28)',
    bandBg: (a, x) => x ? '#17244d' : a, bandInk: () => '#ffffff', bandTrack: '0.05em',
    ghostFrame: '3px dashed #b9c2dd', ghostArt: '#f4f6fc', ghostBand: '#dde3f2', ghostInk: '#6d7699', ghostLine: '#b9c2dd',
    cardFace: '#ffffff', logoInk: '#17244d', logoMuted: '#6d7699', logoSpade: '#17244d', logoBar: '#f7b500', logoRing: 'rgba(23,36,77,0.25)', logoHub: '#e8342c', logoHubInk: '#ffffff',
    suitDark: '#17244d', suitRed: '#e8342c', boxLine: '#17244d',
    panel: '#ffffff', panelBorderCss: '3px solid #17244d', panelRadius: '12px', panelShadow: '5px 5px 0 #17244d',
    stripBg: '#ffffff', stripBorder: '3px solid #17244d', stripRadius: '12px', stripShadow: '5px 5px 0 #17244d',
    stripInk: '#17244d', stripMuted: '#6d7699', stripAccent: '#e8342c', stripHair: '#dfe3f0', stripIconBg: '#ffe9a8',
    resumeBg: '#2440a8', resumeInk: '#ffffff', resumeBorder: '3px solid #17244d', resumeShadow: 'none',
    ambientKeyframes: `    @keyframes dcConf { 0% { transform: translateY(-30px) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(1040px) rotate(500deg); opacity: 0; } }\n`,
    ambientRules: `    .conf span { position: absolute; top: -30px; width: 9px; height: 14px; border-radius: 2px; animation: dcConf 6.4s linear infinite; }\n`,
    ambientLayer: confettiLayer(['#ffe066', '#2440a8', '#00a878', '#ffffff']),
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
    tileFrame: (a) => `2px solid ${a}`, tileRadius: '14px', tileBg: 'rgba(255,255,255,0.05)', tileShadow: '0 0 22px rgba(255,42,163,0.22)', tileHoverShadow: '0 0 46px rgba(255,42,163,0.6)',
    artBg: (a, x) => x ? 'rgba(255,255,255,0.06)' : `radial-gradient(80% 70% at 50% 42%, ${a}33 0%, rgba(255,255,255,0.03) 72%)`,
    artMeta: '#f5f0ff', artMetaBg: 'rgba(36,19,80,0.72)', artShadow: '0 6px 18px rgba(0,0,0,0.5)',
    bandBg: (a, x) => x ? 'rgba(255,255,255,0.09)' : `${a}26`, bandInk: (a, x) => x ? '#ffffff' : a, bandTrack: '0.12em',
    ghostFrame: '2px dashed rgba(255,255,255,0.28)', ghostArt: 'rgba(255,255,255,0.03)', ghostBand: 'rgba(255,255,255,0.07)', ghostInk: '#a892d8', ghostLine: 'rgba(180,255,57,0.6)',
    cardFace: '#f7f2ff', logoInk: '#ffffff', logoMuted: '#a892d8', logoSpade: '#241350', logoBar: '#00e5ff', logoRing: 'rgba(255,255,255,0.25)', logoHub: '#ff2aa3', logoHubInk: '#1a0b33',
    suitDark: '#241350', suitRed: '#ff2aa3', boxLine: '#1a0f3d',
    panel: 'rgba(255,255,255,0.055)', panelBorderCss: '1px solid rgba(255,255,255,0.16)', panelRadius: '14px', panelShadow: '0 0 24px rgba(0,229,255,0.10)',
    stripBg: 'rgba(255,255,255,0.06)', stripBorder: '2px solid #ff2aa3', stripRadius: '14px', stripShadow: '0 0 30px rgba(255,42,163,0.3)',
    stripInk: '#ffffff', stripMuted: '#a892d8', stripAccent: '#00e5ff', stripHair: 'rgba(255,255,255,0.18)', stripIconBg: 'rgba(0,229,255,0.14)',
    resumeBg: '#ff2aa3', resumeInk: '#1a0b33', resumeBorder: 'none', resumeShadow: '0 0 24px rgba(255,42,163,0.7)',
    ambientKeyframes: `    @keyframes dcFlicker { 0%, 15%, 19%, 47%, 51%, 100% { opacity: 1; } 17%, 49% { opacity: 0.45; } }\n`,
    ambientRules: `    .plaque > div { animation: dcFlicker 7s steps(1, end) infinite; }\n`,
  },

  'TropicalTerminal.dc.html': {
    fontsQuery: 'Fredoka:wght@500;600;700&family=Quicksand:wght@400;500;600;700',
    display: "'Fredoka', 'Trebuchet MS', sans-serif", body: "'Quicksand', 'Helvetica Neue', sans-serif",
    bg: '#12b0a0', bgImage: 'radial-gradient(circle at 88% 4%, rgba(255,183,3,0.35) 0%, transparent 34%), radial-gradient(circle at 6% 96%, rgba(255,111,89,0.28) 0%, transparent 36%)',
    ink: '#0f3d38', muted: '#5c8c85', hair: '#d6f2ec', rule: 'rgba(255,255,255,0.45)', markInk: '#fff3d0',
    accents: ['#ff6f59', '#0f8c80', '#ffb703', '#4d96ff'], live: '#ff6f59',
    bulb: '#ffe9a8', bulbGlow: 'rgba(255,233,168,0.95)', rowHover: '#12b0a018', rankBg: '#d4f0ea', dotIdle: 'rgba(255,255,255,0.55)',
    plaqueVariant: 'arch', plaqueBg: '#ffffff', plaqueBorder: '4px solid #0f3d38', plaqueInk: '#0f3d38', plaqueSub: '#7fa79f', plaqueShadow: '0 8px 0 rgba(15,61,56,0.28)', wordSize: '27px',
    tileFrame: (a, x) => `4px solid ${x ? '#0f3d38' : '#ffffff'}`, tileRadius: '26px', tileBg: '#ffffff', tileShadow: '0 10px 0 rgba(15,61,56,0.28)', tileHoverShadow: '0 20px 0 rgba(15,61,56,0.32)',
    artBg: (a, x) => x ? '#e2efe8' : `linear-gradient(180deg, ${a}26 0%, #ffffff 100%)`,
    artMeta: '#0f3d38', artMetaBg: 'rgba(255,255,255,0.9)', artShadow: '0 7px 16px rgba(15,61,56,0.24)',
    bandBg: (a, x) => x ? '#0f3d38' : a, bandInk: () => '#ffffff', bandTrack: '0.04em',
    ghostFrame: '4px dashed rgba(255,255,255,0.85)', ghostArt: 'rgba(255,255,255,0.55)', ghostBand: '#d4f0ea', ghostInk: '#5c8c85', ghostLine: '#8fc9c0',
    cardFace: '#ffffff', logoInk: '#0f3d38', logoMuted: '#5c8c85', logoSpade: '#0f3d38', logoBar: '#ffb703', logoRing: 'rgba(15,61,56,0.22)', logoHub: '#ff6f59', logoHubInk: '#ffffff',
    suitDark: '#0f3d38', suitRed: '#ff6f59', boxLine: '#0f3d38',
    panel: '#ffffff', panelBorderCss: '3px solid #ffffff', panelRadius: '20px', panelShadow: '0 8px 0 rgba(15,61,56,0.2)',
    stripBg: '#ffffff', stripBorder: '4px solid #0f3d38', stripRadius: '999px', stripShadow: '0 8px 0 rgba(15,61,56,0.28)',
    stripInk: '#0f3d38', stripMuted: '#5c8c85', stripAccent: '#ff6f59', stripHair: '#d6f2ec', stripIconBg: '#ffe6d9',
    resumeBg: '#ff6f59', resumeInk: '#ffffff', resumeBorder: 'none', resumeShadow: '0 6px 0 #c9503e',
    ambientKeyframes: `    @keyframes dcShimmer { 0%, 100% { opacity: 0.28; transform: translateX(-4%); } 50% { opacity: 0.55; transform: translateX(4%); } }\n`,
    ambientRules: `    .felt { animation: dcShimmer 9s ease-in-out infinite; }\n`,
    ambientLayer: `<div class="felt" style="position: absolute; inset: -10%; pointer-events: none; z-index: 0; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 3px, transparent 3px, transparent 11px);"></div>`,
  },
};

for (const [file, t] of Object.entries(themes)) {
  const html = page(t);
  writeFileSync(file, html);
  console.log(`${file}: ${html.length} bytes tiles=${(html.match(/class="tile"/g) || []).length}`);
}
