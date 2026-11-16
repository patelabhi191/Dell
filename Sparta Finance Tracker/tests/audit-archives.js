/* Archives design audit — a diagnostic, NOT a test. Not in run-all.sh.

   The companion to audit-design.js. That one checks the app's roles against each
   other; this one seeds a year, opens a card and checks ONE tab against the scale
   in :root — every font size, text colour, radius and flex/grid gap inside
   #archiveView, naming the element behind each stray.

   A tab drifts inside itself even once the global scale is in: Archives held 22
   off-scale sizes, 24 text colours, 6 radii and 8 gap values, having re-invented
   five greys and two whites that were all approximations of --text / --text-dim /
   --text-faint. After the pass: zero off-scale sizes, neutral text on the three
   tokens, three radii, gaps on a 4px rhythm.

   Two stated exceptions it will always report, both deliberate:
     .ay-s gap:2px  — a micro label and its figure are one unit
     pure #FFF amounts — emphasis, one step brighter than --text

   Run:  cd tests && ln -sfn /opt/node22/lib/node_modules node_modules
         node audit-archives.js
   "OFF the scale" should print nothing. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');
(async()=>{
  const srv=await serve(process.env.APP||APP); const url='http://127.0.0.1:'+srv.address().port+'/';
  const b=await launch(); const Y=new Date().getFullYear(); const P=m=>String(m).padStart(2,'0');
  const txns=[];
  const ME=[['Groceries',400,6],['Dining Out',150,4],['Transit',120,0],['Shopping',210,9]];
  for(let m=1;m<=9;m++){
    txns.push({id:'i'+m,date:`${Y}-${P(m)}-12`,type:'income',cat:'Paycheck',desc:'DVS Pay',amt:6200+m*40,who:'ABI',tab:'yf'});
    txns.push({id:'r'+m,date:`${Y}-${P(m)}-12`,type:'expense',cat:'Rent',desc:'Rent',amt:2100,who:'ABI',tab:'yf'});
    txns.push({id:'v'+m,date:`${Y}-${P(m)}-12`,type:'expense',cat:'Investment',desc:'WS',amt:700,who:'ABI',tab:'yf'});
    ME.forEach(([c,base,st],k)=>txns.push({id:c+m,date:`${Y}-${P(m)}-0${k+1}`,type:'expense',cat:c,desc:c,amt:base+m*st,who:'ABI',tab:'me'}));
  }
  const seed=Object.assign({},SEED,{'sparta.yf.data':JSON.stringify({txns,start:{[Y]:13554},planned:{}})});
  const {page,errs}=await open(b,url,seed);
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:1280,height:1000});
  await page.click('#viewSeg button[data-view="archive"]');
  await page.click('#arcAddYear'); await page.waitForSelector('.ay');
  await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));
  await page.click('.ay-head'); await page.waitForSelector('.ay-body');
  await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{
    const root=getComputedStyle(document.documentElement);
    const tok=n=>root.getPropertyValue(n).trim();
    const scaleFS=new Set(['--fs-micro','--fs-label','--fs-lede','--fs-title','--fs-eyebrow',
      '--fs-fine','--fs-dense','--fs-body','--fs-input',
      '--fs-figure','--fs-display','--fs-year'].map(n=>parseFloat(tok(n))));
    const scaleLS=['--ls-label','--ls-lede'];
    const view=document.getElementById('archiveView');
    const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
    const id=e=>e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
    const off=[], sizes={}, colors={}, radii={}, gaps={};
    view.querySelectorAll('*').forEach(e=>{
      if(!vis(e)||!e.textContent.trim()||e.children.length) return;
      const c=getComputedStyle(e), fs=parseFloat(c.fontSize);
      sizes[fs]=(sizes[fs]||0)+1;
      colors[c.color]=(colors[c.color]||0)+1;
      if(!scaleFS.has(fs)) off.push(`${fs}px  ${id(e)}  "${e.textContent.trim().slice(0,26)}"`);
    });
    view.querySelectorAll('*').forEach(e=>{
      if(!vis(e))return; const c=getComputedStyle(e);
      if(c.borderRadius!=='0px') radii[c.borderRadius]=(radii[c.borderRadius]||0)+1;
      if(c.display.includes('flex')||c.display.includes('grid')){
        if(c.gap&&c.gap!=='normal') gaps[c.gap+'  '+id(e)]=(gaps[c.gap+'  '+id(e)]||0)+1;
      }
    });
    // left edges of the body's blocks — should all share one
    const lefts=[...document.querySelectorAll('.ay-body > .ay-sec > .ay-bh, .ay-body > .ay-sec > .ay-bhrow > .ay-bh')]
      .map(e=>Math.round(e.getBoundingClientRect().left));
    return {off:[...new Set(off)], sizes, colors, radii, gaps, lefts,
      scale:[...scaleFS].sort((a,b)=>a-b)};
  });
  console.log('scale sizes:',r.scale.join(' '));
  console.log('\n═══ OFF the scale ═══'); r.off.forEach(x=>console.log('  '+x));
  console.log('\n═══ sizes in use ═══'); Object.entries(r.sizes).sort((a,b)=>a[0]-b[0]).forEach(([k,v])=>console.log(String(v).padStart(4),k+'px'));
  console.log('\n═══ text colours ═══'); Object.entries(r.colors).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k));
  console.log('\n═══ radii ═══'); Object.entries(r.radii).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k));
  console.log('\n═══ flex/grid gaps ═══'); Object.entries(r.gaps).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k));
  console.log('\nsection heading left edges:',r.lefts.join(', '));
  console.log('errs',errs);
  await b.close(); srv.close();
})();
