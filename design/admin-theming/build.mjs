import { writeFileSync } from 'node:fs';
import { THEMES, FONTS, tokenCss, structuralCss } from './tokens.mjs';

const LIVE = { game: '3 of Spade', round: 7, target: 500,
  standings: [['Abhi', 412], ['Priya', 388], ['Rahul', 355], ['Nikhil', 340]] };
const TILES = [
  { n: 1, band: '3 OF SPADE', size: '20px', sub: '2 days ago',   kind: 'spade3', live: true },
  { n: 2, band: 'KACHUFULL',  size: '20px', sub: '6 days ago',   kind: 'kachu' },
  { n: 3, band: 'COMING SOON', size: '16px', sub: 'slot open',   kind: 'soon' },
  { n: 4, band: 'ARCHIVES',   size: '19px', sub: '142 sessions', kind: 'box' },
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
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z',
};
const ic = (k, s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c || 'currentColor'}" aria-hidden="true"><path d="${P[k]}"/></svg>`;
const icL = (k, s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c || 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[k]}"/></svg>`;

/* ---- logos, all colours through tokens ---- */
const cardEl = (rot, dx) => `<div style="position: absolute; left: 50%; top: 50%; width: 96px; height: 132px; margin: -76px 0 0 -48px; background: var(--card-face); border-radius: 9px; box-shadow: var(--art-shadow); transform: rotate(${rot}deg) translateX(${dx}px);"></div>`;

const logoSpade3 = () => `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
      ${cardEl(-16, -58)}${cardEl(0, 0)}${cardEl(16, 58)}
      <div style="position: relative; display: flex; align-items: center; gap: 2px; margin-top: 14px;">
        <span style="font-family: var(--font-display); font-size: 92px; line-height: 0.82; color: var(--logo-ink);">3</span>
        <span style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; color: var(--logo-muted); text-transform: uppercase;">of</span>
          <span class="spademark" style="display: inline-flex; color: var(--logo-spade); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">${ic('spade', 54)}</span>
        </span>
      </div>
    </div>`;

const kcBar = (rot) => `<div style="position: absolute; left: 50%; top: 50%; width: 196px; height: 13px; margin: -6.5px 0 0 -98px; border-radius: 7px; background: var(--logo-bar); transform: rotate(${rot}deg);"></div>`;
const kcSuit = (k, x, y, col) => `<span class="kcsuit" style="position: absolute; left: 50%; top: 50%; margin: ${y - 17}px 0 0 ${x - 17}px; width: 34px; height: 34px; border-radius: 50%; background: var(--card-face); box-shadow: var(--art-shadow); display: flex; align-items: center; justify-content: center; color: var(${col});">${ic(k, 20)}</span>`;

const logoKachu = () => `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
      <div style="position: relative; width: 210px; height: 210px;">
        <div style="position: absolute; left: 50%; top: 50%; width: 172px; height: 172px; margin: -86px 0 0 -86px; border-radius: 50%; border: 2px dashed var(--logo-ring);"></div>
        ${kcBar(45)}${kcBar(-45)}
        ${kcSuit('spade', -68, -68, '--suit-dark')}${kcSuit('heart', 68, -68, '--suit-red')}
        ${kcSuit('club', -68, 68, '--suit-dark')}${kcSuit('diamond', 68, 68, '--suit-red')}
        <span style="position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 12px; background: var(--logo-hub); transform: rotate(45deg); box-shadow: var(--art-shadow);"></span>
        <span style="position: absolute; left: 50%; top: 50%; margin: -13px 0 0 -26px; width: 52px; text-align: center; font-family: var(--font-display); font-size: 22px; color: var(--logo-hub-ink);">KF</span>
      </div>
    </div>`;

const logoSoon = () => `<div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
      <div class="soonplus" style="position: relative; width: 84px; height: 84px; border-radius: 22px; border: 3px dashed var(--ghost-line); display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 34px; height: 4px; border-radius: 2px; background: var(--ghost-line);"></span>
        <span style="position: absolute; width: 4px; height: 34px; border-radius: 2px; background: var(--ghost-line);"></span>
      </div>
      <div style="display: flex; gap: 7px;">
        <span style="width: 9px; height: 9px; border-radius: 50%; background: var(--ghost-line);"></span>
        <span style="width: 9px; height: 9px; border-radius: 50%; background: var(--ghost-line); opacity: 0.6;"></span>
        <span style="width: 9px; height: 9px; border-radius: 50%; background: var(--ghost-line); opacity: 0.3;"></span>
      </div>
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.22em; color: var(--bink3); text-transform: uppercase;">Game 3 &middot; 4 &middot; 5</div>
    </div>`;

const logoBox = () => `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
      <div style="position: relative; width: 186px; height: 150px;">
        <div style="position: absolute; left: 18px; top: 2px; width: 150px; height: 28px; background: var(--card-face); border-radius: 5px; box-shadow: var(--art-shadow); transform: rotate(-5deg);"></div>
        <div style="position: absolute; left: 24px; top: 14px; width: 138px; height: 26px; background: var(--card-face); border-radius: 5px; box-shadow: var(--art-shadow); transform: rotate(4deg); opacity: 0.85;"></div>
        <div style="position: absolute; left: 0; top: 38px; width: 186px; height: 36px; background: var(--acc4); border-radius: 8px; border: 3px solid var(--box-line);"></div>
        <div style="position: absolute; left: 12px; top: 74px; width: 162px; height: 76px; background: var(--acc4); border-radius: 0 0 9px 9px; border: 3px solid var(--box-line); border-top: none; display: flex; align-items: center; justify-content: center;">
          <div style="width: 56px; height: 9px; border-radius: 5px; background: var(--box-line); opacity: 0.5;"></div>
        </div>
      </div>
    </div>`;

const artFor = (k) => k === 'spade3' ? logoSpade3() : k === 'kachu' ? logoKachu() : k === 'soon' ? logoSoon() : logoBox();

/* ---- motion ---- */
const FX = `
    @keyframes dcPlaque { from { opacity: 0; transform: translateY(-22px) scale(0.96); } to { opacity: 1; transform: none; } }
    @keyframes dcRule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes dcBar { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: none; } }
    @keyframes dcPop { from { opacity: 0; transform: translateY(30px) scale(0.94); } to { opacity: 1; transform: none; } }
    @keyframes dcFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @keyframes dcRowIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
    @keyframes dcDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.55); opacity: 0.35; } }
    @keyframes dcSweep { 0% { transform: translateX(-150%) skewX(-20deg); } 55%, 100% { transform: translateX(430%) skewX(-20deg); } }
    @keyframes dcSheen { from { transform: translateX(-130%); } to { transform: translateX(130%); } }
    @keyframes dcBulb { 0%, 100% { opacity: 1; box-shadow: 0 0 9px var(--bulb-glow); } 50% { opacity: 0.18; box-shadow: 0 0 0 rgba(0,0,0,0); } }
    @keyframes dcReel { 0%, 84%, 100% { transform: translateY(0); } 88% { transform: translateY(-9px); } 94% { transform: translateY(5px); } }
    @keyframes dcPulse { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.16) rotate(-4deg); } }
    @keyframes dcSuitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes dcSoon { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
    @keyframes dcTwinkle { 0%, 100% { opacity: 0.3; transform: scale(0.72); } 50% { opacity: 1; transform: scale(1); } }
    @keyframes dcFlicker { 0%, 15%, 19%, 47%, 51%, 100% { opacity: 1; } 17%, 49% { opacity: 0.45; } }
    @keyframes dcConf { 0% { transform: translateY(-30px) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(1040px) rotate(500deg); opacity: 0; } }
    @keyframes dcShimmer { 0%, 100% { opacity: 0.28; transform: translateX(-4%); } 50% { opacity: 0.55; transform: translateX(4%); } }

    .page { transition: background-color 0.24s ease, color 0.24s ease; }
    .skin { transition: background 0.24s ease, border-color 0.24s ease, color 0.24s ease, box-shadow 0.24s ease, border-radius 0.24s ease; }

    .plaque { animation: dcPlaque 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .rule { animation: dcRule 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
    .bar { animation: dcBar 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s both; }
    .tile { animation: dcPop 0.66s cubic-bezier(0.34, 1.56, 0.64, 1) both; transition: transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.26s ease, background 0.24s ease, border-color 0.24s ease, border-radius 0.24s ease; }
    .tile:nth-of-type(1) { animation-delay: 0.30s; }
    .tile:nth-of-type(2) { animation-delay: 0.38s; }
    .tile:nth-of-type(3) { animation-delay: 0.46s; }
    .tile:nth-of-type(4) { animation-delay: 0.54s; }
    .tile:hover { transform: translateY(-10px); box-shadow: var(--tile-hover); }
    .prompt { animation: dcFade 0.5s ease 0.62s both; }
    .panel { animation: dcFade 0.55s ease 0.68s both; }
    .row { animation: dcRowIn 0.42s ease both; transition: background 0.18s ease, transform 0.18s ease; }
    .row:nth-of-type(1) { animation-delay: 0.74s; }
    .row:nth-of-type(2) { animation-delay: 0.80s; }
    .row:nth-of-type(3) { animation-delay: 0.86s; }
    .row:nth-of-type(4) { animation-delay: 0.92s; }
    .row:nth-of-type(5) { animation-delay: 0.98s; }
    .row:hover { background: var(--row-hover); transform: translateX(4px); }

    .art { position: relative; overflow: hidden; }
    .artin { position: absolute; inset: 0; transition: transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .tile:hover .artin { transform: scale(1.07); }
    .art::after { content: ""; position: absolute; inset: -20%; pointer-events: none; transform: translateX(-130%); background: linear-gradient(112deg, transparent 34%, rgba(255,255,255,0.34) 50%, transparent 66%); }
    .tile:hover .art::after { animation: dcSheen 0.85s ease; }
    .tile:hover .spademark { animation: dcPulse 0.62s ease; }
    .tile:hover .kcsuit { animation: dcSuitSpin 0.8s ease; }
    .band { transition: filter 0.24s ease, letter-spacing 0.24s ease, background 0.24s ease, color 0.24s ease; }
    .tile:hover .band { filter: brightness(1.12); letter-spacing: 0.1em; }
    .soonplus { animation: dcSoon 2.6s ease-in-out infinite; }

    .livedot { animation: dcDot 1.5s ease-in-out infinite; }
    .reelnum { display: inline-block; animation: dcReel 5s ease-in-out infinite; }
    .resume { position: relative; overflow: hidden; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.24s ease, box-shadow 0.24s ease, border-radius 0.24s ease; }
    .resume:hover { transform: scale(1.06); }
    .resume::after { content: ""; position: absolute; top: 0; left: 0; width: 32%; height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.66), rgba(255,255,255,0)); animation: dcSweep 3.1s ease-in-out infinite; pointer-events: none; }
    .bulbs { position: absolute; left: 16px; right: 16px; justify-content: space-between; pointer-events: none; }
    .bulbs span { width: 6px; height: 6px; border-radius: 50%; background: var(--bulb); animation: dcBulb 1.5s ease-in-out infinite; }
    .bulbs span:nth-child(2n) { animation-delay: 0.25s; }
    .bulbs span:nth-child(3n) { animation-delay: 0.55s; }
    .dot0 { animation: dcTwinkle 2.4s ease-in-out infinite; }
    .conf span { position: absolute; top: -30px; width: 9px; height: 14px; border-radius: 2px; animation: dcConf 6.4s linear infinite; }
    .felt { animation: dcShimmer 9s ease-in-out infinite; }
    .chip { cursor: pointer; transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease, border-color 0.18s ease; }
    .chip:hover { transform: translateY(-2px); }

    @media (prefers-reduced-motion: reduce) { *, *::after { animation: none !important; transition: none !important; } }
`;

const confLayer = () => {
  let s = '';
  const cols = ['#ffe066', '#2440a8', '#00a878', '#ffffff'];
  for (let i = 0; i < 18; i++) s += `<span style="left: ${2 + i * 5.5}%; background: ${cols[i % 4]}; animation-delay: ${(i * 0.31).toFixed(2)}s; transform: rotate(${(i * 27) % 70}deg);"></span>`;
  return `<div class="conf" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;">${s}</div>`;
};

/* ---- the home page, entirely token-driven ---- */
function homePage() {
  const tiles = TILES.map((it) => `<div class="tile skin" style="height: 356px; box-sizing: border-box; display: flex; flex-direction: column; border: var(--frame${it.n}); border-radius: var(--tile-radius); overflow: hidden; background: var(--tile-bg); box-shadow: var(--tile-shadow);">
          <div class="art" style="flex-grow: 1; background: var(--art${it.n});">
            <div class="artin">${artFor(it.kind)}</div>
            ${it.live ? `<span style="position: absolute; top: 12px; right: 12px; z-index: 2; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; background: var(--live); color: #fff; padding: 5px 10px; border-radius: 999px;">LIVE</span>` : ''}
            <span style="position: absolute; top: 12px; left: 12px; z-index: 2; font-size: 11px; font-weight: 700; color: var(--art-meta); background: var(--art-meta-bg); padding: 4px 9px; border-radius: 999px;">${it.sub}</span>
          </div>
          <div class="band" style="height: 52px; flex-shrink: 0; background: var(--band${it.n}); color: var(--bink${it.n}); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: ${it.size}; letter-spacing: var(--band-track);">${it.band}</div>
        </div>`).join('\n        ');

  const board = BOARD.map(([n, p, w, r], i) => `<div class="row" style="display: flex; align-items: center; gap: 12px; padding: 7px 9px; border-radius: 8px;">
              <span style="width: 22px; height: 22px; border-radius: 50%; background: ${i === 0 ? 'var(--acc1)' : 'var(--rank-bg)'}; color: ${i === 0 ? '#fff' : 'var(--muted)'}; font-family: var(--font-display); font-size: 11px; display: flex; align-items: center; justify-content: center;">${i + 1}</span>
              <span style="flex-grow: 1; font-size: 14px; font-weight: 600; color: var(--ink);">${n}</span>
              <span style="width: 36px; text-align: right; font-size: 13px; color: var(--muted);">${p}</span>
              <span style="width: 32px; text-align: right; font-size: 13px; font-weight: 700; color: var(--ink);">${w}</span>
              <span style="width: 50px; text-align: right; font-family: var(--font-display); font-size: 15px; color: ${i === 0 ? 'var(--acc1)' : 'var(--ink)'};">${r}</span>
            </div>`).join('\n            ');

  const recent = RECENT.map(([g, d, w, s]) => `<div class="row" style="display: flex; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 8px;">
              <span style="width: 96px; font-size: 14px; font-weight: 600; color: var(--ink);">${g}</span>
              <span style="width: 54px; font-size: 12px; color: var(--muted);">${d}</span>
              <span style="flex-grow: 1; font-size: 13px; font-weight: 700; color: var(--acc2);">${w}</span>
              <span style="font-family: var(--font-display); font-size: 16px; color: var(--ink);">${s}</span>
            </div>`).join('\n            ');

  const panel = (title, meta, body) => `<div class="panel skin" style="background: var(--panel); border: var(--panel-border); border-radius: var(--panel-radius); box-shadow: var(--panel-shadow); padding: 13px 15px; display: flex; flex-direction: column; gap: 5px; overflow: hidden;">
            <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 9px 6px; border-bottom: 1px solid var(--hair);">
              <div style="font-family: var(--font-display); font-size: 16px; color: var(--ink);">${title}</div>
              <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: var(--muted); text-transform: uppercase;">${meta}</div>
            </div>
            ${body}
          </div>`;

  const standings = LIVE.standings.map(([n, s], i) => `<div style="display: flex; flex-direction: column; gap: 1px; padding: 0 15px; ${i ? 'border-left: 1px solid var(--strip-hair);' : ''}">
            <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: ${i === 0 ? 'var(--strip-accent)' : 'var(--strip-muted)'}; text-transform: uppercase;">${n}</span>
            <span class="${i === 0 ? 'reelnum' : ''}" style="font-family: var(--font-display); font-size: 23px; line-height: 1.1; color: ${i === 0 ? 'var(--strip-accent)' : 'var(--strip-ink)'};">${s}</span>
          </div>`).join('\n          ');

  return `<div class="page" data-theme="{{theme}}" style="position: relative; width: 1280px; height: 1000px; box-sizing: border-box; padding: 30px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; font-family: var(--font-body); color: var(--ink); background-color: var(--bg); background-image: var(--bg-image);">
      ${confLayer()}
      <div class="felt" style="position: absolute; inset: -10%; pointer-events: none; z-index: 0; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 3px, transparent 3px, transparent 11px);"></div>

      <div style="position: relative; height: 88px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
        <div class="rule" style="position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--rule);"></div>
        <div class="plaque" style="position: relative;">
          <div class="pshape skin" style="position: relative; width: 348px; height: 88px; background: var(--plaque-bg); border: var(--plaque-border); box-shadow: var(--plaque-shadow); padding: 0 26px; box-sizing: border-box;">
            <div class="bulbs" style="top: 7px;">${'<span></span>'.repeat(13)}</div>
            <div class="bulbs" style="bottom: 7px;">${'<span></span>'.repeat(13)}</div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
              <div class="wordmark" style="font-family: var(--word-family); font-size: var(--word-size); letter-spacing: var(--word-track); font-weight: var(--word-weight); text-shadow: var(--word-shadow); line-height: 1; color: var(--plaque-ink);">NAME TBA</div>
              <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.28em; color: var(--plaque-sub); text-transform: uppercase; margin-top: 5px;">Placeholder wordmark</div>
            </div>
          </div>
        </div>
        <div class="plaque" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 8px; color: var(--mark-ink);">
          ${ic('club', 17)}<span style="font-family: var(--font-display); font-size: 14px; letter-spacing: 0.04em;">card night</span>
        </div>
      </div>

      <div class="bar skin" style="height: 86px; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 16px; padding: 0 16px 0 20px; background: var(--strip-bg); border: var(--strip-border); border-radius: var(--strip-radius); box-shadow: var(--strip-shadow);">
        <div style="width: 46px; height: 46px; border-radius: 50%; background: var(--strip-icon-bg); display: flex; align-items: center; justify-content: center; color: var(--strip-accent);">${ic('spade', 22)}</div>
        <div style="display: flex; flex-direction: column; gap: 3px; min-width: 190px;">
          <div style="display: flex; align-items: center; gap: 7px;">
            <span class="livedot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--live);"></span>
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: var(--live); text-transform: uppercase;">Live now &middot; Round ${LIVE.round}</span>
          </div>
          <div style="font-family: var(--font-display); font-size: 22px; color: var(--strip-ink);">${LIVE.game}</div>
        </div>
        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: flex-end;">
          ${standings}
        </div>
        <div style="padding-left: 16px; margin-left: 2px; border-left: 1px solid var(--strip-hair); display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
          <span style="font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: var(--strip-muted); text-transform: uppercase;">First to</span>
          <span style="font-family: var(--font-display); font-size: 19px; color: var(--strip-ink);">${LIVE.target}</span>
        </div>
        <div class="resume" style="height: 56px; padding: 0 26px; border-radius: var(--resume-radius); background: var(--resume-bg); color: var(--resume-ink); border: var(--resume-border); box-shadow: var(--resume-shadow); display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-size: 16px;">
          ${ic('play', 15)} RESUME
        </div>
      </div>

      <div style="position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; flex-shrink: 0;">
        ${tiles}
      </div>

      <div class="prompt" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.26em; color: var(--muted); text-transform: uppercase;">Tap a game to start scoring</div>
        <div style="display: flex; gap: 7px;">
          <span class="dot0" style="width: 7px; height: 7px; border-radius: 50%; background: var(--acc1);"></span>
          <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--dot-idle);"></span>
          <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--dot-idle);"></span>
        </div>
      </div>

      <div style="position: relative; flex-grow: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
          ${panel('All-time standings', 'played / won / rate', board)}
          ${panel('Recent results', 'see all', recent)}
      </div>
    </div>`;
}

const head = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONTS}&display=swap">
  <style>
    body { margin: 0; }
    a { color: var(--acc1); } a:hover { color: var(--acc2); }
${tokenCss()}
${structuralCss()}
${FX}  </style>
</helmet>
`;

/* ================= artboard 1: home screen, live switch ================= */
const themeDefs = THEMES.map((t) => `{ id: '${t.id}', label: '${t.label}' }`).join(', ');

writeFileSync('Main.dc.html', `${head}
<div style="width: 1280px; height: 1064px; display: flex; flex-direction: column; background: #101114;">

  <div style="height: 64px; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 14px; padding: 0 20px; background: #16181d; border-bottom: 1px solid #2a2e36;">
    <span style="font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 10px; letter-spacing: 0.16em; color: #6f7783; text-transform: uppercase;">Preview &middot; theme is set from Admin</span>
    <sc-for list="{{chips}}" as="c" hint-placeholder-count="4">
      <div class="chip" onClick="{{ c.pick }}" style="{{ c.style }}">{{ c.label }}</div>
    </sc-for>
  </div>

  ${homePage()}

</div>
</x-dc>
<script data-dc-script>
class Component extends DCLogic {
  renderVals() {
    const theme = (this.state && this.state.theme) || 'terminal';
    const defs = [${themeDefs}];
    const base = 'display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 15px; border-radius: 999px; font-size: 12px; font-weight: 600; font-family: system-ui, sans-serif; ';
    const chips = defs.map((d) => ({
      id: d.id,
      label: d.label,
      pick: () => this.setState({ theme: d.id }),
      style: base + (d.id === theme
        ? 'background: #f2f4f6; color: #16181d; border: 1px solid #f2f4f6;'
        : 'background: transparent; color: #98a1ad; border: 1px solid #333941;')
    }));
    return { theme: theme, chips: chips };
  }
}
</script>
</body>
</html>
`);

/* ================= artboard 2: Admin -> Appearance ================= */
const miniTile = (n) => `<div style="flex-grow: 1; border-radius: 3px; background: var(--band${n});"></div>`;
const mini = (id) => `<div data-theme="${id}" style="height: 118px; border-radius: 10px; overflow: hidden; padding: 9px; display: flex; flex-direction: column; gap: 6px; background-color: var(--bg); background-image: var(--bg-image);">
            <div class="pshape" style="height: 22px; margin: 0 auto; width: 116px; background: var(--plaque-bg); border: var(--plaque-border); box-sizing: border-box;"></div>
            <div style="height: 18px; border-radius: 4px; background: var(--strip-bg); border: var(--strip-border); box-sizing: border-box;"></div>
            <div style="flex-grow: 1; display: flex; gap: 5px;">${[1, 2, 3, 4].map(miniTile).join('')}</div>
          </div>`;

const cards = THEMES.map((t, i) => `<div class="chip" onClick="{{ p${i}.pick }}" style="{{ p${i}.style }}">
          ${mini(t.id)}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 11px;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-family: var(--font-display); font-size: 15px; color: var(--ink);">${t.label}</span>
              <span style="font-size: 11px; color: var(--muted);">${t.note}</span>
            </div>
            <span style="{{ p${i}.badge }}">{{ p${i}.badgeText }}</span>
          </div>
        </div>`).join('\n        ');

writeFileSync('AdminTheme.dc.html', `${head}
<div class="page" data-theme="{{applied}}" style="position: relative; width: 1100px; height: 900px; box-sizing: border-box; padding: 30px; overflow: hidden; font-family: var(--font-body); color: var(--ink); background-color: var(--bg); background-image: var(--bg-image);">
  ${confLayer()}
  <div class="felt" style="position: absolute; inset: -10%; pointer-events: none; z-index: 0; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 3px, transparent 3px, transparent 11px);"></div>

  <div style="position: relative; height: 74px; display: flex; align-items: center; justify-content: center;">
    <div class="rule" style="position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--rule);"></div>
    <div class="plaque pshape skin" style="position: relative; width: 300px; height: 66px; background: var(--plaque-bg); border: var(--plaque-border); box-shadow: var(--plaque-shadow); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="font-family: var(--word-family); font-size: 19px; letter-spacing: var(--word-track); font-weight: var(--word-weight); color: var(--plaque-ink);">ADMIN</div>
      <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.28em; color: var(--plaque-sub); text-transform: uppercase; margin-top: 4px;">Appearance</div>
    </div>
  </div>

  <sc-if value="{{ locked }}" hint-placeholder-val="{{ false }}">
    <div class="panel skin" style="position: relative; margin: 74px auto 0; width: 380px; background: var(--panel); border: var(--panel-border); border-radius: var(--panel-radius); box-shadow: var(--panel-shadow); padding: 30px 28px; display: flex; flex-direction: column; align-items: center; gap: 18px;">
      <div style="width: 54px; height: 54px; border-radius: 50%; background: var(--strip-icon-bg); display: flex; align-items: center; justify-content: center; color: var(--strip-accent);">${icL('lock', 24)}</div>
      <div style="text-align: center; display: flex; flex-direction: column; gap: 5px;">
        <div style="font-family: var(--font-display); font-size: 20px; color: var(--ink);">Enter admin PIN</div>
        <div style="font-size: 12px; color: var(--muted);">{{ pinHint }}</div>
      </div>
      <div style="display: flex; gap: 12px;">
        <sc-for list="{{ dots }}" as="d" hint-placeholder-count="4">
          <span style="{{ d.style }}"></span>
        </sc-for>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 72px); gap: 10px;">
        <sc-for list="{{ keys }}" as="k" hint-placeholder-count="12">
          <div class="chip" onClick="{{ k.press }}" style="{{ k.style }}">{{ k.label }}</div>
        </sc-for>
      </div>
    </div>
  </sc-if>

  <sc-if value="{{ unlocked }}" hint-placeholder-val="{{ true }}">
    <div style="position: relative; margin-top: 18px;">
      <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 14px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-family: var(--font-display); font-size: 22px; color: var(--ink);">Site theme</div>
          <div style="font-size: 12px; color: var(--muted);">Applies to everyone &middot; every phone updates immediately</div>
        </div>
        <div class="resume" onClick="{{ apply }}" style="height: 48px; padding: 0 24px; border-radius: var(--resume-radius); background: var(--resume-bg); color: var(--resume-ink); border: var(--resume-border); box-shadow: var(--resume-shadow); display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-size: 15px; cursor: pointer;">
          {{ applyLabel }}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
        ${cards}
      </div>

      <div class="panel skin" style="margin-top: 16px; background: var(--panel); border: var(--panel-border); border-radius: var(--panel-radius); box-shadow: var(--panel-shadow); padding: 14px 18px; display: flex; align-items: center; gap: 12px;">
        <span class="livedot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--live); flex-shrink: 0;"></span>
        <span style="font-size: 13px; color: var(--ink);">{{ statusLine }}</span>
      </div>
    </div>
  </sc-if>

</div>
</x-dc>
<script data-dc-script>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const pin = s.pin || '';
    const unlocked = !!s.unlocked;
    const applied = s.applied || 'terminal';
    const selected = s.selected || applied;
    const err = !!s.err;

    const press = (k) => () => {
      if (k === 'C') return this.setState({ pin: '', err: false });
      if (k === 'OK') {
        if (pin === '2468') return this.setState({ unlocked: true, pin: '', err: false });
        return this.setState({ pin: '', err: true });
      }
      if (pin.length >= 4) return;
      this.setState({ pin: pin + k, err: false });
    };

    const keyBase = 'display: flex; align-items: center; justify-content: center; height: 54px; border-radius: 12px; font-family: var(--font-display); font-size: 19px; cursor: pointer; ';
    const keys = ['1','2','3','4','5','6','7','8','9','C','0','OK'].map((k) => ({
      label: k,
      press: press(k),
      style: keyBase + (k === 'OK'
        ? 'background: var(--resume-bg); color: var(--resume-ink); font-size: 15px;'
        : k === 'C'
          ? 'background: transparent; border: 1px solid var(--hair); color: var(--muted); font-size: 15px;'
          : 'background: var(--rank-bg); color: var(--ink);')
    }));

    const dots = [0,1,2,3].map((i) => ({
      style: 'width: 13px; height: 13px; border-radius: 50%; ' +
        (i < pin.length ? 'background: var(--acc1);' : 'background: transparent; border: 2px solid var(--hair);')
    }));

    const cardBase = 'cursor: pointer; padding: 12px; border-radius: var(--panel-radius); background: var(--panel); box-shadow: var(--panel-shadow); ';
    const badgeBase = 'font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; ';
    const defs = [${themeDefs}];
    const picks = {};
    defs.forEach((d, i) => {
      picks['p' + i] = {
        pick: () => this.setState({ selected: d.id }),
        style: cardBase + (d.id === selected
          ? 'border: 2px solid var(--acc1);'
          : 'border: 2px solid transparent;'),
        badge: badgeBase + (d.id === applied
          ? 'background: var(--acc1); color: #fff;'
          : d.id === selected
            ? 'background: var(--rank-bg); color: var(--ink);'
            : 'background: transparent; color: var(--muted);'),
        badgeText: d.id === applied ? 'Active' : (d.id === selected ? 'Selected' : '')
      };
    });

    const appliedLabel = (defs.find((d) => d.id === applied) || defs[0]).label;

    return Object.assign({
      locked: !unlocked,
      unlocked: unlocked,
      applied: applied,
      pinHint: err ? 'That PIN was not recognised — try again' : 'Four digits',
      keys: keys,
      dots: dots,
      apply: () => this.setState({ applied: selected }),
      applyLabel: selected === applied ? 'APPLIED' : 'APPLY TO EVERYONE',
      statusLine: selected === applied
        ? ('Live theme: ' + appliedLabel + ' — every device is showing this now.')
        : ('Pending change — press Apply to switch everyone to ' + (defs.find((d) => d.id === selected) || defs[0]).label + '.')
    }, picks);
  }
}
</script>
</body>
</html>
`);

console.log('Main.dc.html and AdminTheme.dc.html written');
