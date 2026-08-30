(function (root) {
  "use strict";

  var RING_ORDER = ["adopt", "trial", "assess", "caution"];
  var RING_DISPLAY = ["ADOPT", "TRIAL", "ASSESS", "CAUTION"];
  var RING_COLORS = ["#5ba300", "#009eb0", "#c7ba00", "#e09b96"];

  var QUADRANT_ORDER = ["techniques", "platforms", "tools", "languages-and-frameworks"];
  var QUADRANT_DISPLAY = ["Techniques", "Platforms", "Tools", "Languages & Frameworks"];

  var THEME_COLORS = {
    light: { background: "#ffffff", grid: "#eeeeee", inactive: "#d6d6d6" },
    dark: { background: "#1d1e20", grid: "#333333", inactive: "#414144" }
  };

  function mapRing(name) {
    if (typeof name !== "string") return -1;
    return RING_ORDER.indexOf(name.trim().toLowerCase());
  }

  function mapQuadrant(name) {
    if (typeof name !== "string") return -1;
    return QUADRANT_ORDER.indexOf(name.trim().toLowerCase());
  }

  function mapMoved(status, isNew) {
    if (typeof isNew === "string" && isNew.trim().toUpperCase() === "TRUE") return 2;
    var s = (typeof status === "string" ? status : "").trim().toLowerCase();
    if (s === "new") return 2;
    if (s === "move_in") return 1;
    if (s === "move_out") return -1;
    return 0;
  }

  function sanitizeHtml(html) {
    var out = String(html === null || html === undefined ? "" : html);
    out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
    out = out.replace(/<style[\s\S]*?<\/style\s*>/gi, "");
    // HTML allows "/" as an attribute separator (<img/src=x/onerror=...>), so
    // the separator class has to cover it or the handler slips through.
    out = out.replace(/[\s/]+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
    out = out.replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
    out = out.replace(/(href|src)\s*=\s*javascript:[^\s>]*/gi, '$1="#"');
    return out;
  }

  function csvRowToEntry(row) {
    var ring = mapRing(row.ring);
    var quadrant = mapQuadrant(row.quadrant);
    if (ring === -1 || quadrant === -1) return null;
    return {
      label: row.name,
      quadrant: quadrant,
      ring: ring,
      moved: mapMoved(row.status, row.isNew),
      active: true,
      description: sanitizeHtml(row.description || "")
    };
  }

  function buildQuadrantsConfig() {
    return QUADRANT_DISPLAY.map(function (name) { return { name: name }; });
  }

  function buildRingsConfig() {
    return RING_DISPLAY.map(function (name, i) { return { name: name, color: RING_COLORS[i] }; });
  }

  // Ring/quadrant geometry as fractions of a plot's own max radius, not fixed
  // pixels — this is what lets the custom renderer's plot size scale freely
  // without any position ever needing to be hand-tuned again. RING_BOUNDS[0]
  // starts slightly off zero so ring0 blips don't sit exactly on the center
  // point.
  var RING_BOUNDS = [
    { inner: 0.05, outer: 0.25 },
    { inner: 0.25, outer: 0.50 },
    { inner: 0.50, outer: 0.75 },
    { inner: 0.75, outer: 0.98 }
  ];

  // Quadrant index -> corner, matching the existing visual arrangement:
  // 0=Techniques (bottom-right), 1=Platforms (bottom-left), 2=Tools
  // (top-left), 3=Languages & Frameworks (top-right). Angles are degrees in
  // standard SVG orientation (0 = +x/east, increasing toward +y, which reads
  // as clockwise since SVG's y axis points down).
  var QUADRANT_ANGLE_BOUNDS = [
    { startDeg: 0, endDeg: 90 },
    { startDeg: 90, endDeg: 180 },
    { startDeg: 180, endDeg: 270 },
    { startDeg: 270, endDeg: 360 }
  ];

  function ringRadiusBounds(ringIndex, maxRadius) {
    var b = RING_BOUNDS[ringIndex];
    return { inner: b.inner * maxRadius, outer: b.outer * maxRadius };
  }

  function quadrantAngleBounds(quadrantIndex) {
    var b = QUADRANT_ANGLE_BOUNDS[quadrantIndex];
    return { startDeg: b.startDeg, endDeg: b.endDeg };
  }

  function polarToXY(angleDeg, radius) {
    var rad = (angleDeg * Math.PI) / 180;
    return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
  }

  var RadarMapping = {
    mapRing: mapRing,
    mapQuadrant: mapQuadrant,
    mapMoved: mapMoved,
    sanitizeHtml: sanitizeHtml,
    csvRowToEntry: csvRowToEntry,
    buildQuadrantsConfig: buildQuadrantsConfig,
    buildRingsConfig: buildRingsConfig,
    ringRadiusBounds: ringRadiusBounds,
    quadrantAngleBounds: quadrantAngleBounds,
    polarToXY: polarToXY,
    THEME_COLORS: THEME_COLORS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = RadarMapping;
  } else {
    root.RadarMapping = RadarMapping;
  }
})(typeof window !== "undefined" ? window : this);
