// Extracted from Bito b0cc94418bc91dc84bf379e06a148a6f89b1bc80, familyos/static/detroit-ui.js.
// Butler supplies a stable per-instance clip and gradient ID.
const PROGRESS_COLORS={blue:'var(--dui-color-source-blue)',attention:'var(--dui-color-attention)',special:'var(--dui-color-accent-special)'};
const PROGRESS_TIMERS=new WeakMap();

function resolveProgressColor(value){if(!value)return '';const key=value.trim().toLowerCase();return PROGRESS_COLORS[key]||value.trim()}
function clamp01(n){return Math.max(0,Math.min(1,n))}
function pctFromValue(value,max){const resolvedMax=Number(max)||100;return Math.max(0,Math.min(100,(Number(value)||0)/resolvedMax*100))}

function updateProgressVisual(el,value,max=100){
  const pct=pctFromValue(value,max);
  el.setAttribute('role','progressbar');
  el.setAttribute('aria-valuemin','0');
  el.setAttribute('aria-valuemax',String(max));
  el.setAttribute('aria-valuenow',String(value));
  el.style.setProperty('--dui-progress-value',`${pct}%`);
  const fill=el.querySelector('.dui-progress__fill');
  const clip=el.querySelector('.dui-progress__clip rect');
  const marker=el.querySelector('.dui-progress__marker-group');
  if(fill)fill.setAttribute('width',String(pct));
  if(clip)clip.setAttribute('width',String(pct));
  if(marker)marker.setAttribute('transform',`translate(${pct} 0)`);
  el.dispatchEvent(new CustomEvent('detroitprogress',{bubbles:false,detail:{value:Number(value),max:Number(max),percent:pct}}));
}

function stopDetroitProgressTimer(el){const state=PROGRESS_TIMERS.get(el);if(!state)return;state.cancelled=true;if(state.raf)cancelAnimationFrame(state.raf);if(state.restartTimer)clearTimeout(state.restartTimer);PROGRESS_TIMERS.delete(el)}

function setDetroitProgress(el,value,{max,animate=true}={}){
  stopDetroitProgressTimer(el);
  const resolvedMax=Number(max ?? el.getAttribute('aria-valuemax') ?? 100)||100;
  const now=Number(value)||0;
  el.dataset.motion=animate?'auto':'none';
  updateProgressVisual(el,now,resolvedMax);
}

function startDetroitProgressTimer(el,{duration=5000,from=0,to=100,max=100,loop=false,loopDelay=650,resetOnLoop=true}={}){
  stopDetroitProgressTimer(el);
  const ms=Math.max(1,Number(duration)||5000),startValue=Number(from)||0,endValue=Number(to)||0,resolvedMax=Math.max(1,Number(max)||100);
  el.dataset.motion='timer';
  const state={cancelled:false,raf:0,restartTimer:0,startTime:0};PROGRESS_TIMERS.set(el,state);
  const run=()=>{if(state.cancelled)return;state.startTime=performance.now();updateProgressVisual(el,startValue,resolvedMax);
    const frame=(now)=>{if(state.cancelled)return;const ratio=clamp01((now-state.startTime)/ms);const value=startValue+(endValue-startValue)*ratio;updateProgressVisual(el,value,resolvedMax);
      if(ratio<1){state.raf=requestAnimationFrame(frame);return}
      el.dispatchEvent(new CustomEvent('detroitprogresscomplete',{bubbles:false,detail:{value:endValue,max:resolvedMax,percent:pctFromValue(endValue,resolvedMax)}}));
      if(loop&&!state.cancelled){state.restartTimer=setTimeout(()=>{if(state.cancelled)return;if(resetOnLoop)updateProgressVisual(el,startValue,resolvedMax);run()},Math.max(0,Number(loopDelay)||0))}else PROGRESS_TIMERS.delete(el)};
    state.raf=requestAnimationFrame(frame)};
  run();
  return{stop:()=>stopDetroitProgressTimer(el),restart:()=>{stopDetroitProgressTimer(el);return startDetroitProgressTimer(el,{duration:ms,from:startValue,to:endValue,max:resolvedMax,loop,loopDelay,resetOnLoop})}};
}

function mountDetroitProgressBar(el){
  if(el.dataset.duiMounted==='progress')return;
  el.dataset.duiMounted='progress';el.classList.add('dui-progress');
  const color=resolveProgressColor(el.getAttribute('data-color')||'');if(color)el.style.setProperty('--dui-progress-color',color);
  const marker=(el.getAttribute('data-marker')||'').toLowerCase();if(['true','1','yes'].includes(marker))el.classList.add('has-marker');
  const now=Number(el.getAttribute('aria-valuenow')||el.getAttribute('data-value')||0),max=Number(el.getAttribute('aria-valuemax')||el.getAttribute('data-max')||100)||100;
  el.setAttribute('role','progressbar');el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(max));el.setAttribute('aria-valuenow',String(now));
  const uid=el.dataset.progressId||'p'+Math.random().toString(36).slice(2,9);
  el.innerHTML=`<span class="dui-progress__head" aria-hidden="true"><i></i><i></i><i></i></span><span class="dui-progress__track"><svg class="dui-progress__svg" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${uid}-scan-gradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="white" stop-opacity=".30"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><clipPath id="${uid}"><g class="dui-progress__clip"><rect x="0" y="0" width="0" height="14"/></g></clipPath></defs><rect class="dui-progress__fill" x="0" y="0" width="0" height="14"/><g clip-path="url(#${uid})"><rect class="dui-progress__scan" style="fill:url(#${uid}-scan-gradient)" x="0" y="0" width="30" height="14"/></g><g class="dui-progress__marker-group" transform="translate(0 0)"><rect class="dui-progress__marker-square" x="-1.2" y="-8" width="2.4" height="4"/><rect class="dui-progress__marker-stem" x="-.55" y="-3" width="1.1" height="17"/></g></svg></span>`;
  updateProgressVisual(el,now,max);
  const autoplay=(el.getAttribute('data-autoplay')||'').toLowerCase(),duration=Number(el.getAttribute('data-duration')||0),loop=(el.getAttribute('data-loop')||'').toLowerCase(),shouldLoop=['true','1','yes'].includes(loop);
  if(['true','1','yes'].includes(autoplay)&&duration>0){requestAnimationFrame(()=>startDetroitProgressTimer(el,{duration,from:Number(el.getAttribute('data-from')||0),to:Number(el.getAttribute('data-to')||max),max,loop:shouldLoop,loopDelay:Number(el.getAttribute('data-loop-delay')||650)}))}
}

export { mountDetroitProgressBar, setDetroitProgress, stopDetroitProgressTimer };
