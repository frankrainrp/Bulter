import assert from 'node:assert/strict';
import test from 'node:test';
import xml from '@xmldom/xmldom';
import { inspectPassiveSvg, passiveSvg } from '../src/chat/passiveSvg.js';

// Supply the browser's XML parsing and serialization interfaces in Node tests.
globalThis.DOMParser = xml.DOMParser;
globalThis.XMLSerializer = xml.XMLSerializer;
globalThis.document = { implementation: new xml.DOMImplementation() };
globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8 };
const wrap = body => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">'+body+'</svg>';

test('a passive SVG preserves its title, geometry and local paint server', () => {
  const result = passiveSvg(wrap('<title>Field chart</title><defs><linearGradient id="g"><stop offset="100%" stop-color="#fff"/></linearGradient></defs><rect width="100" height="50" fill="url(#g)"/><text style="fill:navy;font-weight:bold" fill="red" y="20">图</text>'));
  assert.equal(result.label,'Field chart');
  assert.ok(result.uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  const clean = decodeURIComponent(result.uri.slice(result.uri.indexOf(',')+1));
  assert.match(clean,/fill="url\(#g\)"/);
  assert.match(clean,/fill="navy"/);
  assert.match(clean,/font-weight="bold"/);
  assert.doesNotMatch(clean,/style=|fill="red"/);
});

test('unsupported markup and unresolved or external resources stay source-only', () => {
  for (const body of ['<foreignObject/>','<script/>','<image/>','<circle onclick="unused"/>',
    '<rect style="background-image: none"/>','<path fill="url(https://example.invalid/paint)"/>',
    '<rect fill="url(#absent)"/>','<use href="#example"/>','<style>.dot{fill:url(https://example.invalid/paint)}</style>']) {
    assert.equal(inspectPassiveSvg(wrap(body)).status, 'unsupported');
  }
  assert.equal(inspectPassiveSvg('<!DOCTYPE svg>'+wrap('')).status, 'unsupported');
});

const decoded = result => {
  assert.equal(result.status, 'ready');
  return new DOMParser().parseFromString(decodeURIComponent(result.uri.slice(result.uri.indexOf(',') + 1)), 'image/svg+xml');
};

test('declarations, responsive sizing, and class rules render as passive vector content', () => {
  const result = inspectPassiveSvg(`<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="100%" style="height:auto;max-width:100%"
         version="1.1" aria-label="Scale drawing">
      <style type="text/css"><![CDATA[
        #dot { fill: navy }
        .mark, .other { fill: red; stroke: green }
        circle.mark { stroke: black }
        .axis { font: bold 12px sans-serif }
      ]]></style>
      <circle class="mark" id="dot" cx=".5" cy=".5" r=".4" fill="tan"/>
      <text class="axis" y=".6" style="font-size:14px" xml:space="preserve">Sample</text>
    </svg>`);
  const doc = decoded(result);
  const circle = doc.getElementsByTagName('circle')[0], text = doc.getElementsByTagName('text')[0];
  assert.equal(result.label, 'Scale drawing');
  assert.equal(doc.documentElement.getAttribute('width'), '300');
  assert.equal(doc.documentElement.getAttribute('height'), '300');
  assert.equal(doc.getElementsByTagName('style').length, 0);
  assert.equal(circle.getAttribute('fill'), 'navy');
  assert.equal(circle.getAttribute('stroke'), 'black');
  assert.equal(text.getAttribute('font-size'), '14px');
  assert.equal(text.getAttribute('font-weight'), 'bold');
});

test('detailed diagrams above the old source and element limits retain their geometry at bounded dimensions', () => {
  const dot = '<circle class="sample" data-series="First series" cx="10000" cy="5000" r="20" fill="navy"/>';
  const source = '<svg width="64000" height="32000" viewBox="0 0 64000 32000">'+dot.repeat(1200)+'</svg>';
  assert.ok(source.length > 96_000);
  const doc = decoded(inspectPassiveSvg(source));
  assert.equal(doc.documentElement.getAttribute('viewBox'), '0 0 64000 32000');
  assert.equal(doc.documentElement.getAttribute('width'), '1000');
  assert.equal(doc.documentElement.getAttribute('height'), '500');
  assert.equal(doc.getElementsByTagName('circle').length, 1200);
});

test('source bytes, complexity and coordinate budgets report the size failure explicitly', () => {
  for (const source of [wrap('<g>'.repeat(33) + '</g>'.repeat(33)), wrap('<circle r="1"/>'.repeat(2048)),
    wrap('<path d="M 0 0 L 9e99 1"/>'), '<svg viewBox="0 0 1 16000"/>', '<svg width="500000" height="100"/>',
    wrap('<text>' + '图'.repeat(90_000) + '</text>')]) {
    assert.equal(inspectPassiveSvg(source).status, 'too-large');
  }
});

test('empty drawings, invalid documents, and legitimate text-only drawings are distinct', () => {
  for (const body of ['', '<title>Chart</title>', '<defs><circle r="3"/></defs>', '<rect/>']) {
    assert.equal(inspectPassiveSvg(wrap(body)).status, 'empty');
  }
  assert.equal(inspectPassiveSvg('<chart/>').status, 'invalid');
  const result = inspectPassiveSvg(wrap('<text y="20">Source image</text>'));
  assert.equal(decoded(result).getElementsByTagName('text')[0].textContent, 'Source image');
});
