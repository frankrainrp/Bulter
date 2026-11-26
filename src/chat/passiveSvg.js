const ns = 'http://www.w3.org/2000/svg';

class SvgFailure extends Error {
  status;
  constructor(status) {
    super(status);
    this.status = status;
  }
}
function fail(status) {
  throw new SvgFailure(status);
}

const maxSourceBytes = 256 * 1024;
const maxGeometry = 65_536;
const elements = new Set(
  'svg g defs title desc path circle ellipse rect line polyline polygon text tspan linearGradient radialGradient stop clipPath marker'.split(
    ' '
  )
);
const definitions = new Set(['defs', 'clipPath', 'marker', 'linearGradient', 'radialGradient']);
const paints = new Set(['fill', 'stroke', 'color', 'stop-color']);
const coordinates = new Set(
  'x y x1 y1 x2 y2 cx cy r rx ry fx fy fr dx dy width height refX refY offset stroke-width stroke-dashoffset stroke-miterlimit font-size letter-spacing textLength markerWidth markerHeight'.split(
    ' '
  )
);
const opacity = new Set(['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity']);
const choices = {
  'fill-rule': ['nonzero', 'evenodd'],
  'clip-rule': ['nonzero', 'evenodd'],
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'text-anchor': ['start', 'middle', 'end'],
  'dominant-baseline': [
    'auto',
    'middle',
    'central',
    'hanging',
    'alphabetic',
    'text-before-edge',
    'text-after-edge',
  ],
  'font-style': ['normal', 'italic', 'oblique'],
  'font-weight': [
    'normal',
    'bold',
    'lighter',
    'bolder',
    '100',
    '200',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900',
  ],
  'vector-effect': ['none', 'non-scaling-stroke'],
  gradientUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  clipPathUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  markerUnits: ['userSpaceOnUse', 'strokeWidth'],
  orient: ['auto', 'auto-start-reverse'],
  spreadMethod: ['pad', 'reflect', 'repeat'],
  display: ['none', 'inline', 'block'],
  visibility: ['visible', 'hidden', 'collapse'],
};
const numberPattern = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const scalar = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(%|px)?$/i;
const localReference = /^url\(\s*(["']?)#([A-Za-z_][\w.-]{0,80})\1\s*\)$/;
const referenceAttributes = new Set(['fill', 'stroke', 'clip-path', 'marker-start', 'marker-end']);
const presentation = new Set([
  ...paints,
  ...opacity,
  'fill-rule',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'text-anchor',
  'dominant-baseline',
  'font-weight',
  'font-family',
  'font-size',
  'font-style',
  'letter-spacing',
  'display',
  'visibility',
  'vector-effect',
  'clip-rule',
  ...referenceAttributes,
  'background',
  'background-color',
  'width',
  'height',
  'max-width',
  'max-height',
]);

function numbers(value, max = maxGeometry) {
  const tokens = value.match(numberPattern);
  if (!tokens) return;
  if (tokens.length > 16_384) fail('too-large');
  const list = tokens.map(Number);
  if (list.some((n) => !Number.isFinite(n) || Math.abs(n) > max)) fail('too-large');
  return list;
}

function validAttribute(name, value) {
  if ((name === 'width' || name === 'height') && value === 'auto') return true;
  if (name === 'max-width' || name === 'max-height') return value === 'none' || validAttribute('width', value);
  if (paints.has(name) || name === 'background' || name === 'background-color')
    return /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]{1,24}|(?:rgba?|hsla?)\([\d.,%+\-/\s]+\))$/i.test(
      value
    );
  if (referenceAttributes.has(name) && value === 'none') return true;
  if (coordinates.has(name) || opacity.has(name)) {
    const match = scalar.exec(value);
    if (!match) return false;
    const n = Number(match[1]);
    if (opacity.has(name)) return n >= 0 && n <= (match[2] === '%' ? 100 : 1) && match[2] !== 'px';
    const limit = /^(?:font-size|markerWidth|markerHeight|stroke-width|stroke-miterlimit)$/.test(name)
      ? 256
      : maxGeometry;
    if (Math.abs(n) > (match[2] === '%' ? 1000 : limit)) fail('too-large');
    return true;
  }
  if (name === 'id') return /^[A-Za-z_][\w.-]{0,80}$/.test(value);
  if (name === 'viewBox') {
    const list = numbers(value);
    return /^[\d.,e+\-\s]+$/i.test(value) && list?.length === 4 && list[2] > 0 && list[3] > 0;
  }
  if (name === 'd') return /^[MmZzLlHhVvCcSsQqTtAa\d.,e+\-\s]+$/i.test(value) && !!numbers(value);
  if (name === 'points') return /^[\d.,e+\-\s]+$/i.test(value) && !!numbers(value);
  if (name === 'stroke-dasharray')
    return (
      value === 'none' ||
      (/^[\d.,\s]+$/.test(value) &&
        !!numbers(value)?.every((n) => n === 0 || n >= 0.25) &&
        (value.match(numberPattern)?.length ?? 0) <= 24)
    );
  if (name === 'font-family') return /^[\p{L}\p{N}_\s,'"-]{1,160}$/u.test(value);
  if (name === 'preserveAspectRatio')
    return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value);
  if (name === 'transform' || name === 'gradientTransform') {
    const functions = value.match(/(?:translate|rotate|scale|matrix|skew[XY])\([\d.,e+\-\s]+\)/g);
    if (!functions || functions.length > 6 || functions.join('').replace(/\s/g, '') !== value.replace(/\s/g, ''))
      return false;
    return functions.every(
      (fn) => !!numbers(fn.slice(fn.indexOf('(') + 1), /^(?:scale|skew)/.test(fn) ? 32 : 16384)
    );
  }
  if (name === 'orient' && scalar.test(value)) return Math.abs(parseFloat(value)) <= 360;
  return Object.hasOwn(choices, name) && choices[name].includes(value);
}

function declarations(style) {
  const result = [];
  for (const part of style.split(';')) {
    if (!part.trim()) continue;
    const at = part.indexOf(':');
    const name = part.slice(0, at).trim().toLowerCase(),
      value = part.slice(at + 1).trim();
    if (name === 'font') {
      const font = /^(?:(normal|italic|oblique)\s+)?(?:(bold|[1-9]00)\s+)?(\d+(?:\.\d+)?px)\s+(.+)$/i.exec(value);
      if (!font || !validAttribute('font-size', font[3]) || !validAttribute('font-family', font[4]))
        fail('unsupported');
      result.push(
        ['font-style', font[1] || 'normal'],
        ['font-weight', font[2] || 'normal'],
        ['font-size', font[3]],
        ['font-family', font[4]]
      );
      continue;
    }
    if (at < 1 || !presentation.has(name)) fail('unsupported');
    if (!(referenceAttributes.has(name) && localReference.test(value)) && !validAttribute(name, value))
      fail('unsupported');
    result.push([name, value]);
  }
  if (result.length > 40) fail('too-large');
  return result;
}

// Flatten a bounded set of tag, ID and class rules into presentation attributes.
// No input stylesheet or browser CSS selector is executed in either document.
function styleRules(root) {
  const rules = [];
  const styles = root.getElementsByTagName('style');
  if (styles.length > 64) fail('too-large');
  for (const style of Array.from(styles)) {
    if (
      style.prefix ||
      (style.namespaceURI && style.namespaceURI !== ns) ||
      Array.from(style.attributes).some((a) => a.name !== 'type' || a.value !== 'text/css') ||
      Array.from(style.childNodes).some((n) => ![3, 4, 8].includes(n.nodeType))
    )
      fail('unsupported');
    const css = (style.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const rule = /\s*([^{}]+)\{([^{}]*)\}\s*/gy;
    while (rule.lastIndex < css.length) {
      const match = rule.exec(css);
      if (!match) fail('unsupported');
      const properties = declarations(match[2]);
      for (const raw of match[1].split(',')) {
        const selector = raw.trim();
        const groups = /^([A-Za-z][\w-]*|\*)?((?:[.#][A-Za-z_][\w-]*)*)$/.exec(selector);
        if (!selector || !groups) fail('unsupported');
        const classes = [];
        let id = '';
        for (const token of groups[2].match(/[.#][\w-]+/g) ?? []) {
          if (token.startsWith('.')) classes.push(token.slice(1));
          else if (id) fail('unsupported');
          else id = token.slice(1);
        }
        if (classes.length > 8 || rules.length >= 128) fail('too-large');
        const tag = groups[1] === '*' ? '' : groups[1] || '';
        rules.push({
          tag,
          id,
          classes,
          declarations: properties,
          specificity: (id ? 100 : 0) + classes.length * 10 + (tag ? 1 : 0),
        });
      }
    }
  }
  return rules.sort((a, b) => a.specificity - b.specificity);
}

// Recognize definitely empty documents without guessing text visibility from its language or label.
function hasGeometry(node) {
  const positive = (name) => parseFloat(node.getAttribute(name) ?? '') > 0;
  switch (node.localName) {
    case 'rect':
      return positive('width') && positive('height');
    case 'circle':
      return positive('r');
    case 'ellipse':
      return positive('rx') && positive('ry');
    case 'line':
      return (
        (node.getAttribute('x1') || '0') !== (node.getAttribute('x2') || '0') ||
        (node.getAttribute('y1') || '0') !== (node.getAttribute('y2') || '0')
      );
    case 'path':
      return !!node.getAttribute('d')?.trim();
    case 'polygon':
    case 'polyline':
      return !!node.getAttribute('points')?.trim();
    case 'text':
      return !!node.textContent?.trim();
    default:
      return false;
  }
}

function sanitize(source) {
  if (source.length > maxSourceBytes || new TextEncoder().encode(source).length > maxSourceBytes)
    fail('too-large');
  const markup = source.trim();
  if (!markup) fail('empty');
  // Hand an ordinary declaration to the XML parser, but never a DTD or secondary processing instruction.
  const body = markup.replace(/^<\?xml\s+[^?<>]*\?>/, '');
  if (/<!\s*(?!--|\[CDATA\[)|<\?/i.test(body)) fail('unsupported');
  const input = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = input.documentElement;
  if (root?.localName !== 'svg' || input.getElementsByTagName('parsererror').length) fail('invalid');
  const rules = styleRules(root);
  const output = document.implementation.createDocument(ns, 'svg', null);
  const ids = new Map();
  const references = [];
  let count = 0,
    attributeCharacters = 0,
    drawable = false;

  function set(target, name, value, insideDefinition) {
    const reference = localReference.exec(value);
    if (reference) {
      if (insideDefinition || !referenceAttributes.has(name)) fail('unsupported');
      references.push({ id: reference[2], attribute: name });
      value = 'url(#' + reference[2] + ')';
    } else if (!validAttribute(name, value)) fail('unsupported');
    if (name === 'id') {
      if (ids.has(value)) fail('unsupported');
      ids.set(value, target.localName);
    }
    attributeCharacters += name.length + value.length;
    if (attributeCharacters > 512 * 1024) fail('too-large');
    if (name === 'background' || name === 'background-color') {
      if (target === output.documentElement) target.setAttribute('style', 'background-color:' + value);
    } else if (name !== 'max-width' && name !== 'max-height') target.setAttribute(name, value);
  }
  function copy(element, target, depth, insideDefinition) {
    if (++count > 2048 || depth > 32 || element.attributes.length > 48) fail('too-large');
    if (
      !elements.has(element.localName) ||
      (element.namespaceURI != null && element.namespaceURI !== ns) ||
      element.prefix ||
      (element.localName === 'svg' && depth > 0)
    )
      fail('unsupported');
    const definition = insideDefinition || definitions.has(element.localName);
    const attributes = new Map();
    for (const attribute of Array.from(element.attributes)) {
      const { name } = attribute,
        value = attribute.value.trim();
      if (name === 'xmlns' && value === ns) continue;
      if (name === 'xmlns:xlink' && value === 'http://www.w3.org/1999/xlink') continue;
      if (name === 'xml:space' && (value === 'default' || value === 'preserve')) {
        target.setAttributeNS('http://www.w3.org/XML/1998/namespace', name, value);
        continue;
      }
      if (attribute.namespaceURI != null) fail('unsupported');
      if (
        ['style', 'class', 'role', 'focusable'].includes(name) ||
        /^(?:aria|data)-/.test(name) ||
        (depth === 0 && ['version', 'baseProfile'].includes(name))
      )
        continue;
      attributes.set(name, value);
    }
    const classes = new Set((element.getAttribute('class') ?? '').split(/\s+/));
    for (const rule of rules) {
      if (
        (rule.tag && element.localName !== rule.tag) ||
        (rule.id && attributes.get('id') !== rule.id) ||
        !rule.classes.every((token) => classes.has(token))
      )
        continue;
      for (const [name, value] of rule.declarations) attributes.set(name, value);
    }
    for (const [name, value] of declarations(element.getAttribute('style') ?? '')) attributes.set(name, value);
    for (const [name, value] of attributes) set(target, name, value, definition);
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) continue;
      if (child.nodeType === Node.TEXT_NODE || child.nodeType === 4) {
        if (['text', 'tspan', 'title', 'desc'].includes(element.localName))
          target.appendChild(output.createTextNode(child.textContent ?? ''));
        else if (child.textContent?.trim()) fail('invalid');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'style') continue;
        const next = output.createElementNS(ns, child.localName);
        copy(child, next, depth + 1, definition);
        target.appendChild(next);
      } else fail('unsupported');
    }
    if (!definition && hasGeometry(target)) drawable = true;
  }
  const clean = output.documentElement;
  copy(root, clean, 0, false);
  for (const ref of references) {
    const type = ids.get(ref.id);
    if (
      paints.has(ref.attribute)
        ? type !== 'linearGradient' && type !== 'radialGradient'
        : type !== (ref.attribute === 'clip-path' ? 'clipPath' : 'marker')
    )
      fail('unsupported');
  }
  const dimension = (name) => {
    const value = clean.getAttribute(name);
    return value && !value.endsWith('%') && value !== 'auto' ? parseFloat(value) : undefined;
  };
  const viewBox = clean.getAttribute('viewBox');
  const width = dimension('width'),
    height = dimension('height');
  const box = viewBox ? numbers(viewBox) : [0, 0, width ?? 300, height ?? 150];
  if (box[2] <= 0 || box[3] <= 0) fail('invalid');
  const aspect = box[2] / box[3];
  const viewportWidth = width ?? (height !== undefined ? height * aspect : Math.max(300, box[2]));
  const viewportHeight = height ?? viewportWidth / aspect;
  if (viewportWidth <= 0 || viewportHeight <= 0) fail('empty');
  const viewportAspect = viewportWidth / viewportHeight;
  if (aspect > 256 || aspect < 1 / 256 || viewportAspect > 256 || viewportAspect < 1 / 256) fail('too-large');
  if (!drawable && !clean.getAttribute('style')) fail('empty');
  clean.setAttribute('viewBox', box.join(' '));
  const ratio = Math.min(1, 1000 / viewportWidth, 640 / viewportHeight);
  clean.setAttribute('width', String(viewportWidth * ratio));
  clean.setAttribute('height', String(viewportHeight * ratio));
  const label =
    (
      clean.getElementsByTagName('title')[0]?.textContent?.trim() || root.getAttribute('aria-label')?.trim()
    )?.slice(0, 200) || 'SVG diagram';
  return {
    uri: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clean)),
    label,
  };
}

export function inspectPassiveSvg(source) {
  try {
    return { status: 'ready', ...sanitize(source) };
  } catch (error) {
    return { status: error instanceof SvgFailure ? error.status : 'invalid' };
  }
}

export function passiveSvg(source) {
  const result = inspectPassiveSvg(source);
  if (result.status === 'ready') return { uri: result.uri, label: result.label };
}
