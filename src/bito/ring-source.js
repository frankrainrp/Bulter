/* Extracted from Bito master familyos/static/detroit-ui.js (Movement and PieChart). */
/* --- src/primitives/movement.js --- */
const MOVEMENT_DEFAULTS={
  returnMs:520,
  pressScale:1.22
};

function latestPointerEvent(event){
  const list=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():null;
  return list&&list.length?list[list.length-1]:event;
}

/**
 * Movement
 * Reusable pointer-depth controller.
 *
 * - pointer samples are coalesced to one requestAnimationFrame
 * - idle state has no RAF loop
 * - pointer leave uses frame-rate-independent exponential smoothing
 * - return is critically damped in feel: no snap, no overshoot
 */
function Movement(el,{onFrame,returnMs=MOVEMENT_DEFAULTS.returnMs,pressScale=MOVEMENT_DEFAULTS.pressScale}={}){
  if(!el||typeof onFrame!=='function')return null;

  if(el.__duiMovementController)el.__duiMovementController.destroy();

  let raf=0;
  let returnRaf=0;
  let lastTs=0;
  let x=.5;
  let y=.5;
  let pressed=false;
  let inside=false;
  let destroyed=false;

  const emit=(phase='move')=>{
    onFrame({
      x,
      y,
      nx:(x-.5)*2,
      ny:(y-.5)*2,
      pressed,
      pressure:pressed?pressScale:1,
      phase
    });
  };

  const cancelMoveFrame=()=>{
    if(raf){cancelAnimationFrame(raf);raf=0;}
  };

  const cancelReturn=()=>{
    if(returnRaf){cancelAnimationFrame(returnRaf);returnRaf=0;}
    lastTs=0;
  };

  const scheduleMove=(phase='move')=>{
    if(raf||destroyed)return;
    raf=requestAnimationFrame(()=>{
      raf=0;
      emit(phase);
    });
  };

  const startReturn=()=>{
    if(destroyed)return;
    cancelReturn();
    const tau=Math.max(40,Number(returnMs)||MOVEMENT_DEFAULTS.returnMs)/3;

    const tick=(ts)=>{
      if(destroyed)return;
      if(!lastTs)lastTs=ts;
      const dt=Math.min(64,Math.max(0,ts-lastTs));
      lastTs=ts;
      const alpha=1-Math.exp(-dt/tau);
      x+=(.5-x)*alpha;
      y+=(.5-y)*alpha;
      emit('return');

      if(Math.abs(x-.5)<.0008&&Math.abs(y-.5)<.0008){
        x=.5;y=.5;
        emit('settle');
        returnRaf=0;
        lastTs=0;
        return;
      }
      returnRaf=requestAnimationFrame(tick);
    };
    returnRaf=requestAnimationFrame(tick);
  };

  const sample=(event)=>{
    const p=latestPointerEvent(event);
    const r=el.getBoundingClientRect();
    if(!r.width||!r.height)return;
    x=Math.max(0,Math.min(1,(p.clientX-r.left)/r.width));
    y=Math.max(0,Math.min(1,(p.clientY-r.top)/r.height));
  };

  const onPointerEnter=()=>{
    inside=true;
    cancelReturn();
  };
  const onPointerMove=(event)=>{
    inside=true;
    cancelReturn();
    sample(event);
    scheduleMove('move');
  };
  const onPointerDown=(event)=>{
    inside=true;
    pressed=true;
    cancelReturn();
    sample(event);
    el.setPointerCapture?.(event.pointerId);
    scheduleMove('press');
  };
  const onPointerUp=()=>{
    pressed=false;
    scheduleMove('release');
    if(!inside)startReturn();
  };
  const onPointerCancel=()=>{
    pressed=false;
    inside=false;
    startReturn();
  };
  const onPointerLeave=()=>{
    inside=false;
    if(!pressed)startReturn();
  };

  el.addEventListener('pointerenter',onPointerEnter,{passive:true});
  el.addEventListener('pointermove',onPointerMove,{passive:true});
  el.addEventListener('pointerdown',onPointerDown);
  el.addEventListener('pointerup',onPointerUp);
  el.addEventListener('pointercancel',onPointerCancel);
  el.addEventListener('pointerleave',onPointerLeave,{passive:true});

  const controller={
    reset({immediate=false}={}){
      pressed=false;
      inside=false;
      if(immediate){
        cancelReturn();
        cancelMoveFrame();
        x=.5;y=.5;
        emit('settle');
      }else startReturn();
    },
    destroy(){
      if(destroyed)return;
      destroyed=true;
      cancelMoveFrame();
      cancelReturn();
      el.removeEventListener('pointerenter',onPointerEnter);
      el.removeEventListener('pointermove',onPointerMove);
      el.removeEventListener('pointerdown',onPointerDown);
      el.removeEventListener('pointerup',onPointerUp);
      el.removeEventListener('pointercancel',onPointerCancel);
      el.removeEventListener('pointerleave',onPointerLeave);
      if(el.__duiMovementController===controller)delete el.__duiMovementController;
    }
  };

  el.__duiMovementController=controller;
  emit('settle');
  return controller;
}

const PIE_NS='http://www.w3.org/2000/svg';
const COLORS=['var(--dui-color-navy-deep)','var(--dui-color-navy)','var(--dui-color-blue-deep)','var(--dui-color-blue)','var(--dui-color-blue-bright)','var(--dui-color-blue-soft)','var(--dui-color-blue-gray)'];
let PIE_UID=0;

function parseValues(value){
  if(Array.isArray(value))return value.map(Number).filter(v=>Number.isFinite(v)&&v>0);
  return String(value||'').split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0);
}

function createSegment({r,c,offset,len,color}){
  const circle=document.createElementNS(PIE_NS,'circle');
  circle.setAttribute('class','dui-pie__segment');
  circle.setAttribute('cx','60');
  circle.setAttribute('cy','60');
  circle.setAttribute('r',String(r));
  circle.setAttribute('transform','rotate(-90 60 60)');
  circle.style.stroke=color;
  circle.style.strokeDasharray=`${len} ${Math.max(0,c-len)}`;
  circle.style.strokeDashoffset=String(-offset);
  return circle;
}

function attachBackSpin(group){
  const anim=document.createElementNS(PIE_NS,'animateTransform');
  anim.setAttribute('attributeName','transform');
  anim.setAttribute('type','rotate');
  anim.setAttribute('from','0 60 60');
  anim.setAttribute('to','360 60 60');
  anim.setAttribute('dur','16s');
  anim.setAttribute('repeatCount','indefinite');
  group.appendChild(anim);
}

function bindAnimationPause(svg,host){
  let visible=true;
  let manuallyDestroyed=false;

  const apply=()=>{
    if(manuallyDestroyed)return;
    const shouldPause=!visible||document.hidden;
    try{
      if(shouldPause&&!svg.animationsPaused())svg.pauseAnimations();
      if(!shouldPause&&svg.animationsPaused())svg.unpauseAnimations();
    }catch{}
  };

  const io='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    visible=entries[0]?.isIntersecting??true;
    apply();
  },{threshold:.01}):null;
  io?.observe(host);
  document.addEventListener('visibilitychange',apply);

  return()=>{
    manuallyDestroyed=true;
    io?.disconnect();
    document.removeEventListener('visibilitychange',apply);
  };
}

function bindMovement(el,depth,{returnMs=520}={}){
  return Movement(el,{
    returnMs,
    pressScale:1.22,
    onFrame({nx,ny,pressure}){
      const scaleX=1-Math.abs(ny)*.006*pressure;
      const scaleY=1-Math.abs(nx)*.006*pressure;
      const skewX=nx*.018*pressure;
      const skewY=ny*.018*pressure;
      const tx=nx*1.55*pressure;
      const ty=ny*1.55*pressure;
      depth.setAttribute('transform',
        `translate(60 60) matrix(${scaleX.toFixed(5)} ${skewY.toFixed(5)} ${skewX.toFixed(5)} ${scaleY.toFixed(5)} ${tx.toFixed(3)} ${ty.toFixed(3)}) translate(-60 -60)`
      );
    }
  });
}

function PieChart(el,{values,size,width,gap,colors,back=true,movement=true,returnMs,motion='auto'}={}){
  if(!el)return null;

  el.__duiPieMovement?.destroy?.();
  el.__duiPiePauseCleanup?.();

  el.dataset.duiMounted='pie';
  el.classList.add('dui-pie');
  const vals=parseValues(values||el.dataset.values||[42,28,18,12]);
  const total=vals.reduce((a,b)=>a+b,0)||1;
  const resolvedSize=Number(size||el.dataset.size||120);
  const resolvedWidth=Number(width||el.dataset.width||14);
  const resolvedGap=Number(gap||el.dataset.gap||2.4);
  const resolvedReturnMs=Number(returnMs||el.dataset.returnMs||520);
  const palette=(colors&&colors.length?colors:COLORS);
  const showBack=String(back ?? el.dataset.back ?? 'true')!=='false';
  const animate=motion==='on'||(motion!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
  const useMovement=animate&&String(movement ?? el.dataset.movement ?? 'true')!=='false';
  el.style.setProperty('--dui-pie-size',`${resolvedSize}px`);
  el.style.setProperty('--dui-pie-width',`${resolvedWidth}px`);
  el.replaceChildren();

  const svg=document.createElementNS(PIE_NS,'svg');
  svg.setAttribute('viewBox','0 0 120 120');
  svg.setAttribute('aria-hidden','true');

  const defs=document.createElementNS(PIE_NS,'defs');
  const geometry=document.createElementNS(PIE_NS,'g');
  const geometryId=`dui-pie-geometry-${++PIE_UID}`;
  geometry.setAttribute('id',geometryId);

  const r=50,c=2*Math.PI*r;
  let offset=0;
  vals.forEach((v,i)=>{
    const part=v/total*c;
    const gapLen=Math.min(part*.35,resolvedGap);
    const len=Math.max(0,part-gapLen);
    const color=palette[i%palette.length];
    geometry.appendChild(createSegment({r,c,offset,len,color}));
    offset+=part;
  });
  defs.appendChild(geometry);
  svg.appendChild(defs);

  const depth=document.createElementNS(PIE_NS,'g');
  depth.setAttribute('class','dui-pie__depth');

  if(showBack){
    const backOffset=document.createElementNS(PIE_NS,'g');
    backOffset.setAttribute('class','dui-pie__back');
    backOffset.setAttribute('transform','translate(8 -1)');
    const backSpin=document.createElementNS(PIE_NS,'g');
    backSpin.setAttribute('class','dui-pie__back-spin');
    const backUse=document.createElementNS(PIE_NS,'use');
    backUse.setAttribute('href',`#${geometryId}`);
    backSpin.appendChild(backUse);
    if(animate)attachBackSpin(backSpin);
    backOffset.appendChild(backSpin);
    depth.appendChild(backOffset);
  }

  const mainUse=document.createElementNS(PIE_NS,'use');
  mainUse.setAttribute('class','dui-pie__main');
  mainUse.setAttribute('href',`#${geometryId}`);
  depth.appendChild(mainUse);
  svg.appendChild(depth);

  el.appendChild(svg);
  if(useMovement)el.__duiPieMovement=bindMovement(el,depth,{returnMs:resolvedReturnMs});
  if(showBack)el.__duiPiePauseCleanup=bindAnimationPause(svg,el);

  el.setAttribute('role','img');
  if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',`Pie chart: ${vals.join(', ')}`);
  return el;
}

export { PieChart };

export function destroyPieChart(el) {
  el.__duiPieMovement?.destroy?.();
  el.__duiPiePauseCleanup?.();
  el.replaceChildren();
}
