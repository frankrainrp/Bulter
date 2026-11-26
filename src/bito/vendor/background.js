const BG_NS='http://www.w3.org/2000/svg';

export const BG_FACETS=[
  ['0,0 520,0 260,450',.05],['260,450 520,0 780,450',.11],['520,0 1040,0 780,450',.075],['780,450 1040,0 1300,450',.13],['1040,0 1560,0 1300,450',.055],['1300,450 1560,0 1820,450',.095],
  ['-180,150 420,150 120,670',.12],['120,670 420,150 720,670',.07],['420,150 1020,150 720,670',.105],['720,670 1020,150 1320,670',.045],['1020,150 1620,150 1320,670',.095],['1320,670 1620,150 1920,670',.06],
  ['20,520 520,520 270,953',.07],['270,953 520,520 770,953',.11],['520,520 1020,520 770,953',.05],['770,953 1020,520 1270,953',.105],['1020,520 1520,520 1270,953',.065],['1270,953 1520,520 1770,953',.09]
];

export function mountDetroitBackground(el){
  if(!el)return null;
  if(el.dataset.duiMounted==='background')return el;
  el.dataset.duiMounted='background';
  el.classList.add('dui-background');
  el.setAttribute('aria-hidden','true');

  const doc=el.ownerDocument;
  const svg=doc.createElementNS(BG_NS,'svg');
  svg.setAttribute('class','dui-background__svg');
  svg.setAttribute('viewBox','0 0 1600 900');
  svg.setAttribute('preserveAspectRatio','xMidYMid slice');
  svg.setAttribute('aria-hidden','true');

  const band=doc.createElementNS(BG_NS,'rect');
  band.setAttribute('class','dui-background__band');
  band.setAttribute('x','0');band.setAttribute('y','135');band.setAttribute('width','1600');band.setAttribute('height','120');
  svg.appendChild(band);

  const layerA=doc.createElementNS(BG_NS,'g');
  layerA.setAttribute('class','dui-background__layer dui-background__layer--a');
  const layerB=doc.createElementNS(BG_NS,'g');
  layerB.setAttribute('class','dui-background__layer dui-background__layer--b');

  const phasesA=[1,2,3].map(n=>{const g=doc.createElementNS(BG_NS,'g');g.setAttribute('class',`dui-background__phase dui-background__phase--${n}`);layerA.appendChild(g);return g});
  const phasesB=[1,2,3].map(n=>{const g=doc.createElementNS(BG_NS,'g');g.setAttribute('class',`dui-background__phase dui-background__phase--${n}`);layerB.appendChild(g);return g});

  BG_FACETS.forEach(([points,alpha],i)=>{
    const p=doc.createElementNS(BG_NS,'polygon');
    p.setAttribute('points',points);
    p.setAttribute('class','dui-background__facet');
    p.setAttribute('fill-opacity',String(alpha));
    const set=(i%3===0||i%3===1)?phasesA:phasesB;
    set[i%3].appendChild(p);
  });

  svg.append(layerA,layerB);
  el.replaceChildren(svg);
  return el;
}

export function mountDetroitPageBackground(root){
  root.classList.add('dui-background-root');
  let layer=root.querySelector(':scope > .dui-background');
  if(!layer){
    layer=root.ownerDocument.createElement('div');
    root.prepend(layer);
  }
  return mountDetroitBackground(layer);
}
