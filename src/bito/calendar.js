// Extracted from frankrainrp/Bito b0cc94418bc91dc84bf379e06a148a6f89b1bc80, familyos/static/detroit-ui.js.
// C346 supplies its civil date keys and month callbacks for the React workspace.

/* --- src/core/state.js --- */
const STATES=Object.freeze(['idle','focus','selected','active','disabled']);

function normalizeState(value='idle'){
  const state=String(value||'idle').trim().toLowerCase();
  return STATES.includes(state)?state:'idle';
}

function setState(el,state,{emit=true}={}){
  if(!el)return 'idle';
  const next=normalizeState(state);
  for(const name of STATES)el.classList.toggle(`is-${name}`,name===next);
  el.dataset.state=next;
  if('disabled' in el)el.disabled=next==='disabled';
  if(emit){
    el.dispatchEvent(new CustomEvent('duistatechange',{detail:{state:next},bubbles:false}));
  }
  return next;
}

function getState(el){
  return normalizeState(el?.dataset?.state||'idle');
}

/* --- src/components/nav.js --- */

function Nav(el,{direction,state}={}){
  if(!el)return null;
  if(el.dataset.duiMounted==='nav'){
    if(direction)el.dataset.direction=direction;
    if(state)setState(el,state);
    return el;
  }
  el.dataset.duiMounted='nav';
  el.classList.add('dui-nav');
  const label=el.textContent.trim();
  if(label)el.classList.add('dui-nav--labeled');
  const dir=String(direction||el.dataset.direction||'next').toLowerCase()==='prev'?'prev':'next';
  el.dataset.direction=dir;
  if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',label||(dir==='prev'?'Previous':'Next'));
  setState(el,state||el.dataset.state||'idle');
  return el;
}

/* --- src/components/calendar.js --- */

const WEEK=['MON','TUE','WED','THU','FRI','SAT','SUN'];

function parseEvents(value){
  return new Set(String(value||'').split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0));
}

function buildMonth(el,year,month,events,dates){
  const grid=el.querySelector('.dui-calendar__grid');
  grid.replaceChildren();
  const first=new Date(year,month-1,1);
  const days=new Date(year,month,0).getDate();
  const prevDays=new Date(year,month-1,0).getDate();
  const start=(first.getDay()+6)%7;

  for(let i=0;i<42;i++){
    let day=i-start+1;
    let outside=false;
    let display=day;
    if(day<1){display=prevDays+day;outside=true}
    else if(day>days){display=day-days;outside=true}
    // Butler's civil keys handle the supported years 0001–9999.
    if(dates){
      display=Number(dates[i].split('-')[2]);
      outside=dates[i].slice(0,7)!==`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}`;
    }

    const cell=document.createElement('button');
    cell.type='button';
    cell.className='dui-calendar__day';
    const label=document.createElement('span');
    label.className='dui-calendar__day-label';
    label.dataset.label=String(display);
    const main=document.createElement('span');
    main.className='dui-calendar__day-label__main';
    main.textContent=String(display);
    label.appendChild(main);
    cell.appendChild(label);

    if(outside)cell.classList.add('is-outside');
    if(!outside && events.has(display)){
      setState(cell,'active');
      const mark=document.createElement('i');
      mark.className='dui-calendar__marker';
      cell.appendChild(mark);
    }else setState(cell,'idle');

    cell.addEventListener('mouseenter',()=>{if(getState(cell)==='idle')setState(cell,'focus')});
    cell.addEventListener('mouseleave',()=>{if(getState(cell)==='focus')setState(cell,'idle')});
    grid.appendChild(cell);
  }
}

function Calendar(el,{year,month,events,dates,onMove}={}){
  if(!el)return null;
  if(el.dataset.duiMounted==='calendar')return el;
  el.dataset.duiMounted='calendar';
  el.classList.add('dui-calendar');

  let y=Number(year||el.dataset.year||new Date().getFullYear());
  let m=Number(month||el.dataset.month||new Date().getMonth()+1);
  const eventSet=parseEvents(events||el.dataset.events||'');

  el.replaceChildren();
  const head=document.createElement('div');head.className='dui-calendar__head';
  const meta=document.createElement('div');meta.className='dui-calendar__meta';
  const title=document.createElement('div');title.className='dui-calendar__title';
  const sub=document.createElement('div');sub.className='dui-calendar__sub';sub.textContent=`${eventSet.size} ACTIVE DAYS`;
  meta.append(title,sub);
  const nav=document.createElement('div');nav.className='dui-calendar__nav';
  const prev=document.createElement('button');prev.type='button';prev.dataset.direction='prev';
  const next=document.createElement('button');next.type='button';next.dataset.direction='next';
  Nav(prev);Nav(next);nav.append(prev,next);
  head.append(meta,nav);

  const weekdays=document.createElement('div');weekdays.className='dui-calendar__weekdays';
  WEEK.forEach(w=>{const n=document.createElement('div');n.className='dui-calendar__weekday';n.textContent=w;weekdays.appendChild(n)});
  const grid=document.createElement('div');grid.className='dui-calendar__grid';
  el.append(head,weekdays,grid);

  const render=()=>{
    title.textContent=`${String(y).padStart(4,'0')} / ${String(m).padStart(2,'0')}`;
    buildMonth(el,y,m,eventSet,dates);
  };
  prev.addEventListener('click',()=>{if(onMove){onMove(-1);return}m--;if(m<1){m=12;y--}render()});
  next.addEventListener('click',()=>{if(onMove){onMove(1);return}m++;if(m>12){m=1;y++}render()});
  render();
  return el;
}

export { Calendar };
