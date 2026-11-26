import assert from 'node:assert/strict';
import test from 'node:test';
import { facetPath, sourceButtonChromeGeometry, sourceButtonGeometry } from '../src/bito/sourceButtonGeometry.js';
import { ringSegments } from '../src/bito/ring-model.js';

test('Bito button facets fit a phone tab as well as the original wider control', () => {
  for (const [width, height, inset, expectedHeight] of [[64, 60, 4, 8], [228, 56, 15, 26]]) {
    const { facets, bodyWidth, bodyHeight } = sourceButtonGeometry(width, height, inset);
    assert.equal(bodyHeight, expectedHeight);
    assert.equal(facets.length, 10);
    assert.equal(facets.at(-1).left + facets.at(-1).width, bodyWidth);
    for (const facet of facets) {
      assert.ok(facet.left >= 0 && facet.width >= 0 && facet.left + facet.width <= bodyWidth);
      assert.doesNotMatch(facetPath(facet.kind, facet.left, facet.width, bodyHeight), /NaN|Infinity/);
    }
  }
});

test('navigation facets retain their slope and crop symmetrically on narrow phones', () => {
  for (const width of [52, 76, 104, 300]) {
    const inset = Math.min(7, Math.max(2, width * .04));
    const { facets, bodyWidth, bodyHeight } = sourceButtonGeometry(width, 64, inset, true);
    assert.equal(bodyHeight, 34);
    for (const facet of facets.filter(({ kind }) => kind === 'tri-up' || kind === 'tri-down')) {
      assert.equal(facet.width, 68);
    }
    assert.ok(Math.abs(facets[0].left - (bodyWidth - facets.at(-1).left - facets.at(-1).width)) < 1e-9);
    assert.ok(facets[0].left <= 0);
  }
});

test('button halos and capture corners scale to the measured control', () => {
  const full = sourceButtonChromeGeometry(268, 64, 15, 26, false);
  assert.equal(full.glowHeight, 45);
  assert.equal(full.cornerLength, 8);
  assert.equal(full.cornerStroke, 1);
  assert.equal(full.faceTop, 15);

  const narrow = sourceButtonChromeGeometry(62, 64, 3, 34, true);
  const wide = sourceButtonChromeGeometry(158, 64, 6, 34, true);
  assert.equal(narrow.faceHeight, wide.faceHeight);
  assert.ok(narrow.glowHeight < wide.glowHeight && wide.glowHeight <= wide.faceTop);
  assert.ok(narrow.cornerLength < wide.cornerLength && wide.cornerLength < full.cornerLength);
  assert.ok(narrow.pressTravel < wide.pressTravel && narrow.cornerTravel < wide.cornerTravel);
  assert.equal(sourceButtonChromeGeometry(0, 0, 15, 26, false).glowHeight, 0);
});

test('a sole completed task keeps its segment color across the empty and mixed states', () => {
  const mixed = ringSegments(1, 2);
  assert.deepEqual(ringSegments(1, 0), [mixed[0]]);
  assert.deepEqual(ringSegments(0, 2), [mixed[1]]);
  assert.deepEqual(ringSegments(0, 0), [{ value: 1, color: mixed[1].color }]);
});
