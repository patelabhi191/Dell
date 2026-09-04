/* Builds the skin gallery from the one token table, so the preview cannot
   drift from the app. Run:  node design/theme-preview/build.mjs           */
import { writeFileSync } from 'node:fs';
import { THEMES, FONTS } from '../admin-theming/tokens.mjs';

const vars = (t) => Object.entries(t.tok).map(([k, v]) => `--${k}: ${v}`).join('; ');
const GLASS = ['glassdark', 'glasslight'];

const suits = [['♠','Spades',0],['♥','Hearts',1],['♦','Diamonds',1],['♣','Clubs',0]];

const section = (t) => `
<section class="skin${GLASS.includes(t.id) ? ' glass' : ''}" style="${vars(t)}">
  <div class="wall"></div>
  <div class="inner">
    <header class="meta">
      <span class="dot"></span>
      <b>${t.label}</b><code>${t.id}</code><span class="note">${t.note}</span>
    </header>

    <div class="head">
      <i class="rule"></i>
      <div class="plaque"><div class="word">AP CARD GAMES</div><div class="sub">Night</div></div>
    </div>

    <div class="bar">
      <span class="baricon">&#9824;</span>
      <span class="barid"><em>&#9679; LIVE NOW &middot; 2 ROUNDS</em><b>3 of Spade</b></span>
      <span class="scores">
        <span class="sc lead"><em>PRIYA</em><b>345</b></span>
        <span class="sc"><em>ABHI</em><b>180</b></span>
        <span class="sc"><em>NIKHIL</em><b>165</b></span>
      </span>
      <span class="resume">&#9654; RESUME</span>
    </div>

    <div class="tiles">
      ${[1,2,3,4].map(n => `<div class="tile t${n}"><div class="art a${n}"></div>
        <div class="band b${n}">${['3 of Spade','KaChuFull','Coming Soon','Archives'][n-1]}</div></div>`).join('')}
    </div>

    <div class="two">
      <div class="pod-wrap">
        <div class="ph">Standing</div>
        ${[['1','Priya','345',1],['2','Abhi','180',0],['3','Nikhil','165',0]].map(([r,n,s,f]) =>
          `<div class="pod${f ? ' first' : ''}"><span class="rk">${r}</span><span class="nm">${n}</span><span class="sc2">${s}</span></div>`).join('')}
      </div>
      <div class="console">
        <div class="ch">New round <em>before the cards are played</em></div>
        <div class="step"><span class="lab"><i class="no">1</i>WHO WON</span>
          <span class="body">${['Abhi','Priya','Rahul'].map((p,i) =>
            `<span class="pick${i===2?' on':''}">${p}</span>`).join('')}</span></div>
        <div class="step"><span class="lab"><i class="no ok">3</i>SIR</span>
          <span class="body">${suits.map(([g,n,red],i) =>
            `<span class="pick suit${red?' red':''}${i===0?' on':''}"><b>${g}</b>${n}</span>`).join('')}</span></div>
        <div class="step"><span class="lab"><i class="no ok">4</i>CARD 1</span>
          <span class="body">${['A','K','Q','J','10'].map((r,i) =>
            `<span class="pick sq${i===0?' on':''}">${r}</span>`).join('')}
            <span class="face">A&#9824;</span></span></div>
      </div>
    </div>
  </div>
</section>`;

const css = `
*{box-sizing:border-box}
body{margin:0;background:#101014;color:#e8e8ee;
  font:15px/1.5 'Outfit',system-ui,sans-serif;padding:26px}
h1{font:700 30px 'Space Grotesk',system-ui,sans-serif;margin:0 0 4px;letter-spacing:-.02em}
.lede{margin:0 0 26px;color:#9a9aa8;max-width:70ch}
.grid{display:flex;flex-direction:column;gap:22px}

.skin{position:relative;border-radius:16px;overflow:hidden;isolation:isolate;
  background-color:var(--bg);background-image:var(--bg-image);
  font-family:var(--font-body);color:var(--ink)}
.wall{position:absolute;inset:0;z-index:-1}
.inner{padding:18px 20px 22px}
.meta{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:12px;color:var(--ground-muted)}
.meta b{font-family:var(--font-display);font-size:16px;color:var(--ground-ink)}
.meta code{font:600 11px ui-monospace,monospace;padding:3px 8px;border-radius:999px;
  background:var(--ground-plate);color:var(--ground-ink)}
.meta .dot{width:10px;height:10px;border-radius:50%;background:var(--acc1)}
.meta .note{margin-left:auto}

.head{position:relative;display:flex;justify-content:center;height:62px;align-items:center;margin-bottom:12px}
.rule{position:absolute;left:0;right:0;top:50%;height:1px;background:var(--rule)}
.plaque{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:280px;height:58px;background:var(--plaque-bg);border:var(--plaque-border);
  box-shadow:var(--plaque-shadow);border-radius:var(--panel-radius)}
.word{font-family:var(--word-family);font-size:calc(var(--word-size) * .68);letter-spacing:var(--word-track);
  font-weight:var(--word-weight);color:var(--plaque-ink);text-shadow:var(--word-shadow);white-space:nowrap}
.sub{font-size:8px;font-weight:700;letter-spacing:.28em;color:var(--plaque-sub);text-transform:uppercase;margin-top:3px}

.bar{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:12px;
  background:var(--strip-bg);border:var(--strip-border);border-radius:var(--strip-radius);
  box-shadow:var(--strip-shadow);color:var(--strip-ink)}
.baricon{width:34px;height:34px;border-radius:50%;background:var(--strip-icon-bg);color:var(--strip-accent);
  display:flex;align-items:center;justify-content:center;font-size:16px}
.barid{display:flex;flex-direction:column;gap:2px}
.barid em{font-style:normal;font-size:9px;font-weight:800;letter-spacing:.16em;color:var(--live)}
.barid b{font-family:var(--font-display);font-size:16px;color:var(--strip-ink)}
.scores{margin-left:auto;display:flex}
.sc{display:flex;flex-direction:column;padding:0 11px;border-left:1px solid var(--strip-hair)}
.sc em{font-style:normal;font-size:8px;font-weight:700;letter-spacing:.1em;color:var(--strip-muted)}
.sc b{font-family:var(--font-display);font-size:17px;font-weight:400}
.sc.lead em,.sc.lead b{color:var(--strip-accent)}
.resume{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 18px;font-size:12px;
  background:var(--resume-bg);color:var(--resume-ink);border:var(--resume-border);
  box-shadow:var(--resume-shadow);border-radius:var(--resume-radius);font-family:var(--font-display)}

.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.tile{border-radius:var(--tile-radius);overflow:hidden;background:var(--tile-bg);box-shadow:var(--tile-shadow)}
.t1{border:var(--frame1)}.t2{border:var(--frame2)}.t3{border:var(--frame3)}.t4{border:var(--frame4)}
.art{height:76px}
.a1{background:var(--art1)}.a2{background:var(--art2)}.a3{background:var(--art3)}.a4{background:var(--art4)}
.band{min-height:34px;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);
  font-size:13px;letter-spacing:var(--band-track)}
.b1{background:var(--band1);color:var(--bink1)}.b2{background:var(--band2);color:var(--bink2)}
.b3{background:var(--band3);color:var(--bink3)}.b4{background:var(--band4);color:var(--bink4)}

.two{display:grid;grid-template-columns:230px 1fr;gap:10px;align-items:start}
.pod-wrap,.console{background:var(--panel);border:var(--panel-border);border-radius:var(--panel-radius);
  box-shadow:var(--panel-shadow);overflow:hidden}
.pod-wrap{padding:10px}
.ph{font-family:var(--font-display);font-size:14px;padding:0 4px 8px;border-bottom:1px solid var(--hair);margin-bottom:8px}
.pod{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:9px;padding:8px 10px;
  border-radius:11px;background:var(--rank-bg);border:2px solid transparent;margin-bottom:6px}
.pod.first{background:var(--row-hover);border-color:var(--acc1)}
.rk{width:22px;height:22px;border-radius:50%;background:var(--panel);color:var(--muted);
  display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:11px}
.pod.first .rk{background:var(--acc1);color:var(--on-acc1)}
.nm{font-weight:600;font-size:14px}
.sc2{font-family:var(--font-display);font-size:21px}
.pod.first .sc2{color:var(--acc1-text);font-size:24px}

.ch{display:flex;align-items:baseline;gap:9px;padding:10px 13px;background:var(--rank-bg);
  border-bottom:1px solid var(--hair);font-family:var(--font-display);font-size:14px}
.ch em{font-style:normal;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.step{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center;padding:9px 13px;
  border-bottom:1px solid var(--hair)}
.step:last-child{border-bottom:none}
.lab{display:flex;align-items:center;gap:7px;font-size:9px;font-weight:700;letter-spacing:.12em;color:var(--muted)}
.no{width:19px;height:19px;border-radius:50%;background:var(--rank-bg);color:var(--muted);
  display:flex;align-items:center;justify-content:center;font-style:normal;font-size:10px;font-family:var(--font-display)}
.no.ok{background:var(--acc2);color:#fff}
.body{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pick{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:0 12px;
  border-radius:999px;border:2px solid var(--hair);font-size:12.5px;font-weight:600}
.pick.on{background:var(--acc1);border-color:var(--acc1);color:var(--on-acc1)}
.pick.sq{min-width:34px;padding:0 8px;border-radius:9px;font-family:var(--font-display)}
.pick.suit{border-color:var(--suit-edge)}
.pick.suit b{font-size:17px;font-weight:400}
.pick.suit.red{color:var(--suit-red)}
.pick.suit.red.on{background:var(--live);border-color:var(--live);color:var(--on-live)}
.face{display:inline-flex;align-items:center;justify-content:center;width:42px;height:54px;margin-left:6px;
  border-radius:8px;background:var(--card-face);color:var(--suit-dark);border:1px solid var(--hair);
  font-family:var(--font-display);font-size:16px}

/* the frosted skins blur their chrome, exactly as the app does */
.glass .plaque,.glass .bar,.glass .pod-wrap,.glass .console{
  -webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%)}
@media (max-width:900px){.two{grid-template-columns:1fr}.tiles{grid-template-columns:repeat(2,1fr)}}
`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AP Card Games Night — skins</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONTS}&display=swap">
<style>${css}</style></head>
<body>
<h1>AP Card Games Night &mdash; ${THEMES.length} skins</h1>
<p class="lede">Every skin, drawn from the same token table the app reads
(<code>design/admin-theming/tokens.mjs</code>), so this page cannot drift from
what Admin actually applies. Each block shows that skin's plaque, live bar,
game tiles, podium and round console.</p>
<div class="grid">
${THEMES.map(section).join('\n')}
</div>
</body></html>`;

writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`wrote index.html — ${THEMES.length} skins`);
