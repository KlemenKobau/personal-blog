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
