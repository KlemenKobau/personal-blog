const { test } = require("node:test");
const assert = require("node:assert/strict");
const RadarMapping = require("../static/js/radar-mapping.js");

test("mapRing maps known ring names case-insensitively", () => {
  assert.equal(RadarMapping.mapRing("Adopt"), 0);
  assert.equal(RadarMapping.mapRing("trial"), 1);
  assert.equal(RadarMapping.mapRing("Assess"), 2);
  assert.equal(RadarMapping.mapRing("CAUTION"), 3);
});

test("mapRing returns -1 for unknown ring names", () => {
  assert.equal(RadarMapping.mapRing("Hold"), -1);
  assert.equal(RadarMapping.mapRing(""), -1);
  assert.equal(RadarMapping.mapRing(undefined), -1);
});

test("mapQuadrant maps known quadrant names, case-insensitive and trimmed", () => {
  assert.equal(RadarMapping.mapQuadrant("Techniques"), 0);
  assert.equal(RadarMapping.mapQuadrant("Platforms"), 1);
  assert.equal(RadarMapping.mapQuadrant("  Tools  "), 2);
  assert.equal(RadarMapping.mapQuadrant("languages-and-frameworks"), 3);
  assert.equal(RadarMapping.mapQuadrant("Languages-And-Frameworks"), 3);
});

test("mapQuadrant returns -1 for unknown quadrant names", () => {
  assert.equal(RadarMapping.mapQuadrant("Unknown"), -1);
});

test("mapMoved: isNew=TRUE always wins regardless of status", () => {
  assert.equal(RadarMapping.mapMoved("move_in", "TRUE"), 2);
  assert.equal(RadarMapping.mapMoved("", "TRUE"), 2);
});

test("mapMoved: status values map to the documented codes", () => {
  assert.equal(RadarMapping.mapMoved("new", "FALSE"), 2);
  assert.equal(RadarMapping.mapMoved("move_in", "FALSE"), 1);
  assert.equal(RadarMapping.mapMoved("move_out", "FALSE"), -1);
  assert.equal(RadarMapping.mapMoved("refresh_writeup", "FALSE"), 0);
  assert.equal(RadarMapping.mapMoved("anything_else", "FALSE"), 0);
});

test("sanitizeHtml passes through plain formatting tags unchanged", () => {
  const input = '<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>';
  assert.equal(RadarMapping.sanitizeHtml(input), input);
});

test("sanitizeHtml strips script tags and their content", () => {
  const input = '<p>x</p><script>alert(1)</script>';
  assert.equal(RadarMapping.sanitizeHtml(input), '<p>x</p>');
});

test("sanitizeHtml strips inline event handler attributes", () => {
  const input = '<img src="x" onerror="alert(1)">';
  assert.equal(RadarMapping.sanitizeHtml(input), '<img src="x">');
});

test("sanitizeHtml neutralizes javascript: hrefs", () => {
  const input = '<a href="javascript:alert(1)">click</a>';
  assert.equal(RadarMapping.sanitizeHtml(input), '<a href="#">click</a>');
});

test("sanitizeHtml treats null/undefined as empty string", () => {
  assert.equal(RadarMapping.sanitizeHtml(null), '');
  assert.equal(RadarMapping.sanitizeHtml(undefined), '');
});

test("csvRowToEntry maps a valid row into a Zalando entry", () => {
  const row = {
    name: "Foo",
    ring: "Adopt",
    quadrant: "Tools",
    isNew: "FALSE",
    status: "move_in",
    description: "<p>hi</p>"
  };
  assert.deepEqual(RadarMapping.csvRowToEntry(row), {
    label: "Foo",
    quadrant: 2,
    ring: 0,
    moved: 1,
    active: true,
    description: "<p>hi</p>"
  });
});

test("csvRowToEntry returns null for an unmapped ring or quadrant", () => {
  assert.equal(RadarMapping.csvRowToEntry({ name: "Bad", ring: "Unknown", quadrant: "Tools", isNew: "FALSE", status: "", description: "" }), null);
  assert.equal(RadarMapping.csvRowToEntry({ name: "Bad", ring: "Adopt", quadrant: "Unknown", isNew: "FALSE", status: "", description: "" }), null);
});

test("buildQuadrantsConfig returns the fixed 4-quadrant config", () => {
  assert.deepEqual(RadarMapping.buildQuadrantsConfig(), [
    { name: "Techniques" },
    { name: "Platforms" },
    { name: "Tools" },
    { name: "Languages & Frameworks" }
  ]);
});

test("buildRingsConfig returns the fixed 4-ring config with colors", () => {
  assert.deepEqual(RadarMapping.buildRingsConfig(), [
    { name: "ADOPT", color: "#5ba300" },
    { name: "TRIAL", color: "#009eb0" },
    { name: "ASSESS", color: "#c7ba00" },
    { name: "CAUTION", color: "#e09b96" }
  ]);
});

test("THEME_COLORS has both light and dark palettes", () => {
  assert.deepEqual(Object.keys(RadarMapping.THEME_COLORS).sort(), ["dark", "light"]);
  assert.equal(RadarMapping.THEME_COLORS.light.background, "#ffffff");
  assert.equal(RadarMapping.THEME_COLORS.dark.background, "#1d1e20");
});

test("sanitizeHtml strips unquoted inline event handler attributes", () => {
  const input = '<img src="x" onerror=alert(1)>';
  assert.equal(RadarMapping.sanitizeHtml(input), '<img src="x">');
});

test("sanitizeHtml neutralizes unquoted javascript: hrefs", () => {
  const input = '<a href=javascript:alert(1)>click</a>';
  assert.equal(RadarMapping.sanitizeHtml(input), '<a href="#">click</a>');
});

test("sanitizeHtml strips event handlers separated by / instead of whitespace", () => {
  // HTML permits "/" between attributes, and unlike <script> this DOES run
  // when assigned via innerHTML.
  assert.equal(RadarMapping.sanitizeHtml('<img src=x/onerror=alert(1)>'), '<img src=x>');
  assert.equal(RadarMapping.sanitizeHtml('<img/src="x"/onerror="alert(1)">'), '<img/src="x">');
  assert.ok(!/onerror/i.test(RadarMapping.sanitizeHtml('<img/src=x/onerror=alert(1)>')));
});

test("sanitizeHtml neutralizes javascript: URLs after a / attribute separator", () => {
  assert.equal(RadarMapping.sanitizeHtml('<img/src=javascript:alert(1)>'), '<img/src="#">');
  assert.equal(RadarMapping.sanitizeHtml('<a/href="javascript:alert(1)">x</a>'), '<a/href="#">x</a>');
});

test("ringRadiusBounds scales proportionally to the given max radius", () => {
  assert.deepEqual(RadarMapping.ringRadiusBounds(0, 400), { inner: 20, outer: 100 });
  assert.deepEqual(RadarMapping.ringRadiusBounds(3, 400), { inner: 300, outer: 392 });
  // same ring, different plot size -> proportional, not a fixed pixel band
  assert.deepEqual(RadarMapping.ringRadiusBounds(0, 800), { inner: 40, outer: 200 });
});

test("ringRadiusBounds covers all 4 rings without gaps or overlaps", () => {
  for (let i = 0; i < 3; i++) {
    const outer = RadarMapping.ringRadiusBounds(i, 1000).outer;
    const nextInner = RadarMapping.ringRadiusBounds(i + 1, 1000).inner;
    assert.equal(outer, nextInner);
  }
});

test("quadrantAngleBounds gives each of the 4 quadrants a distinct 90-degree wedge", () => {
  assert.deepEqual(RadarMapping.quadrantAngleBounds(0), { startDeg: 0, endDeg: 90 });
  assert.deepEqual(RadarMapping.quadrantAngleBounds(1), { startDeg: 90, endDeg: 180 });
  assert.deepEqual(RadarMapping.quadrantAngleBounds(2), { startDeg: 180, endDeg: 270 });
  assert.deepEqual(RadarMapping.quadrantAngleBounds(3), { startDeg: 270, endDeg: 360 });
});

test("polarToXY converts angle/radius to cartesian coordinates", () => {
  const east = RadarMapping.polarToXY(0, 100);
  assert.ok(Math.abs(east.x - 100) < 1e-9);
  assert.ok(Math.abs(east.y - 0) < 1e-9);

  const south = RadarMapping.polarToXY(90, 100);
  assert.ok(Math.abs(south.x - 0) < 1e-9);
  assert.ok(Math.abs(south.y - 100) < 1e-9);
});

test("parseHash: empty or bare-hash input is overview mode", () => {
  assert.deepEqual(RadarMapping.parseHash(""), { mode: "overview" });
  assert.deepEqual(RadarMapping.parseHash("#"), { mode: "overview" });
  assert.deepEqual(RadarMapping.parseHash(undefined), { mode: "overview" });
});

test("parseHash: valid quadrant slug is quadrant mode with no open id", () => {
  assert.deepEqual(RadarMapping.parseHash("#quadrant=tools"), { mode: "quadrant", quadrant: 2, open: null });
});

test("parseHash: valid quadrant slug with an open id", () => {
  assert.deepEqual(
    RadarMapping.parseHash("#quadrant=languages-and-frameworks&open=7"),
    { mode: "quadrant", quadrant: 3, open: 7 }
  );
});

test("parseHash: unknown quadrant slug falls back to overview", () => {
  assert.deepEqual(RadarMapping.parseHash("#quadrant=nonsense"), { mode: "overview" });
});

test("parseHash: non-numeric open id is ignored", () => {
  assert.deepEqual(RadarMapping.parseHash("#quadrant=tools&open=abc"), { mode: "quadrant", quadrant: 2, open: null });
});

test("quadrantZoomOrigin places each quadrant's vertex at its canvas corner, inset by margin", () => {
  assert.deepEqual(RadarMapping.quadrantZoomOrigin(0, 800, 20), { x: 20, y: 20 });
  assert.deepEqual(RadarMapping.quadrantZoomOrigin(1, 800, 20), { x: 780, y: 20 });
  assert.deepEqual(RadarMapping.quadrantZoomOrigin(2, 800, 20), { x: 780, y: 780 });
  assert.deepEqual(RadarMapping.quadrantZoomOrigin(3, 800, 20), { x: 20, y: 780 });
});

test("quadrantZoomOrigin scales with a different canvas size", () => {
  assert.deepEqual(RadarMapping.quadrantZoomOrigin(2, 400, 10), { x: 390, y: 390 });
});

test("QUADRANT_ORDER exposes the 4 quadrant slugs in index order", () => {
  assert.deepEqual(RadarMapping.QUADRANT_ORDER, ["techniques", "platforms", "tools", "languages-and-frameworks"]);
});

test("THEME_COLORS includes a text color per theme", () => {
  assert.equal(RadarMapping.THEME_COLORS.light.text, "#1a1a1a");
  assert.equal(RadarMapping.THEME_COLORS.dark.text, "#eaeaea");
});
