/* Design-system audit — a diagnostic, NOT a test. It is not in run-all.sh.

   Walks all six tabs and reports how many DISTINCT specs are in use for each
   role: heading, label, panel padding, corner radius, body size, body colour.
   The point is the count. One role should have one spec; when a number here
   climbs, something was styled beside the scale in :root rather than on it.

   Run it after any visual change:
     cd tests && ln -sfn /opt/node22/lib/node_modules node_modules
     node audit-design.js

   The pass on 2026-10-01 took headings 5 -> 3 roles, labels 8 -> 3 plus one
   stated opt-out, radii 5 -> 2, panel padding 5 -> 1 (plus two intentional
   one-offs), and folded a near-duplicate body colour. Those are the numbers to
   hold. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');
(async()=>{
  const srv=await serve(APP); const url='http://127.0.0.1:'+srv.address().port+'/';
  const b=await launch();
  const {page,errs}=await open(b,url);
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:1280,height:1000});
  const views=['dash','contrib','yearly','monthly','archive','plan'];
  const all={};
  for(const v of views){
    await page.click(`#viewSeg button[data-view="${v}"]`);
    await page.waitForTimeout(400);
    if(v==='archive'){ await page.click('#arcAddYear');
      await page.waitForTimeout(400);
      const h=await page.$('.ay-head'); if(h) await h.click();
      await page.waitForTimeout(400); }
    all[v]=await page.evaluate(()=>{
      const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
      const out={h3:{},label:{},body:{},panelPad:{},radius:{},colors:{}};
      const bump=(o,k)=>o[k]=(o[k]||0)+1;
      document.querySelectorAll('h3,.skeu-h,.ay-bh,.sec-head h3').forEach(e=>{
        if(!vis(e))return; const c=getComputedStyle(e);
        bump(out.h3, `${parseFloat(c.fontSize)}/${c.fontWeight}/${c.letterSpacing}/${c.textTransform}`);
      });
      document.querySelectorAll('label,.label,.skeu-label,.ay-s span,.yf-lbl').forEach(e=>{
        if(!vis(e))return; const c=getComputedStyle(e);
        bump(out.label, `${parseFloat(c.fontSize)}/${c.fontWeight}/${c.letterSpacing}`);
      });
      document.querySelectorAll('td,p,.note').forEach(e=>{
        if(!vis(e))return; const c=getComputedStyle(e);
        bump(out.body, `${parseFloat(c.fontSize)}/${c.color}`);
      });
      document.querySelectorAll('.panel,.skeu-panel,.set-card,.pl-card,.ay').forEach(e=>{
        if(!vis(e))return; const c=getComputedStyle(e);
        bump(out.panelPad, c.padding); bump(out.radius, c.borderRadius);
      });
      return out;
    });
  }
  const merge=k=>{const m={}; for(const v of views) for(const [kk,n] of Object.entries(all[v][k]||{})) m[kk]=(m[kk]||0)+n; return m};
  for(const k of ['h3','label','panelPad','radius']){
    console.log(`\n═══ ${k} ═══`);
    Object.entries(merge(k)).sort((a,b)=>b[1]-a[1]).forEach(([v,n])=>console.log(String(n).padStart(4),v));
  }
  console.log('\n═══ body text sizes (count by size) ═══');
  const bm={}; for(const [k,n] of Object.entries(merge('body'))){const s=k.split('/')[0]; bm[s]=(bm[s]||0)+n}
  Object.entries(bm).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).forEach(([s,n])=>console.log(String(n).padStart(4),s+'px'));
  console.log('\n═══ body text COLOURS ═══');
  const cm={}; for(const [k,n] of Object.entries(merge('body'))){const c=k.split('/').slice(1).join('/'); cm[c]=(cm[c]||0)+n}
  Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,14).forEach(([c,n])=>console.log(String(n).padStart(4),c));
  console.log('\nerrs',errs);
  await b.close(); srv.close();
})();
