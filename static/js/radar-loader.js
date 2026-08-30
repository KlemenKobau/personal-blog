(function () {
  "use strict";

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function init(container) {
    var sheetUrl = container.dataset.sheet;
    var size = parseInt(container.dataset.size, 10) || 800;
    var svg = container.querySelector("svg#radar");
    var legend = container.querySelector(".radar-legend");
    var detail = container.querySelector(".radar-detail");
    var entries = null;

    function showDetail(entry) {
      var ringName = RadarMapping.buildRingsConfig()[entry.ring].name;
      var quadrantName = RadarMapping.buildQuadrantsConfig()[entry.quadrant].name;
      detail.innerHTML = "";

      var heading = document.createElement("h3");
      heading.textContent = entry.id + ". " + entry.label;
      detail.appendChild(heading);

      var meta = document.createElement("p");
      var ringEl = document.createElement("strong");
      ringEl.textContent = ringName;
      meta.appendChild(ringEl);
      meta.appendChild(document.createTextNode(" · " + quadrantName));
      detail.appendChild(meta);

      // description is owner-authored rich text, already run through
      // RadarMapping.sanitizeHtml() in csvRowToEntry().
      var body = document.createElement("div");
      body.innerHTML = entry.description;
      detail.appendChild(body);

      detail.hidden = false;
    }

    // Blip shape by movement code, drawn as an SVG path/shape string centered
    // on the origin — same visual language as the classic tech radar (Zalando's
    // radar.js), just rendered by us instead of relying on its fixed-geometry
    // legend/watermark that this whole rewrite exists to get away from.
    function blipShape(sel, moved) {
      if (moved === 1) {
        return sel.append("path").attr("d", "M -7,4 7,4 0,-8 z"); // triangle up
      }
      if (moved === -1) {
        return sel.append("path").attr("d", "M -7,-4 7,-4 0,8 z"); // triangle down
      }
      if (moved === 2) {
        return sel.append("path").attr("d", d3.symbol().type(d3.symbolStar).size(140));
      }
      return sel.append("circle").attr("r", 6);
    }

    function renderPlot(entries, theme) {
      svg.innerHTML = "";
      var colors = RadarMapping.THEME_COLORS[theme];
      var rings = RadarMapping.buildRingsConfig();
      var maxRadius = size / 2 - 20;

      var svgSel = d3.select(svg).attr("viewBox", "0 0 " + size + " " + size);
      svgSel.append("rect")
        .attr("width", size)
        .attr("height", size)
        .attr("fill", colors.background);

      var g = svgSel.append("g").attr("transform", "translate(" + size / 2 + "," + size / 2 + ")");

      rings.forEach(function (ring, i) {
        g.append("circle")
          .attr("r", RadarMapping.ringRadiusBounds(i, maxRadius).outer)
          .attr("fill", "none")
          .attr("stroke", colors.grid);
      });
      g.append("line").attr("x1", -maxRadius).attr("x2", maxRadius).attr("y1", 0).attr("y2", 0).attr("stroke", colors.grid);
      g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -maxRadius).attr("y2", maxRadius).attr("stroke", colors.grid);

      // Seed each blip inside its own ring/quadrant wedge; the force
      // simulation below only nudges blips apart, it never needs to move
      // them between wedges, so a plain random seed (not Zalando's
      // reproducible PRNG) is fine here.
      entries.forEach(function (entry) {
        var angleBounds = RadarMapping.quadrantAngleBounds(entry.quadrant);
        var radiusBounds = RadarMapping.ringRadiusBounds(entry.ring, maxRadius);
        var angle = angleBounds.startDeg + Math.random() * (angleBounds.endDeg - angleBounds.startDeg);
        var radius = radiusBounds.inner + Math.random() * (radiusBounds.outer - radiusBounds.inner);
        var p = RadarMapping.polarToXY(angle, radius);
        entry.x = p.x;
        entry.y = p.y;
      });

      var blips = g.selectAll(".blip")
        .data(entries)
        .enter()
        .append("g")
        .attr("class", "blip")
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          showDetail(d);
        });

      blips.each(function (d) {
        var b = d3.select(this);
        blipShape(b, d.moved).attr("fill", rings[d.ring].color);
        b.append("text")
          .text(d.id)
          .attr("y", 3)
          .attr("text-anchor", "middle")
          .attr("fill", "#fff")
          .style("font-size", "8px")
          .style("pointer-events", "none");
      });

      // Keep each blip inside its own ring/quadrant wedge while the collision
      // force spreads out ones that started too close together — the same
      // clip-after-tick technique Zalando's radar.js uses, just generalized
      // to proportional bounds instead of its fixed pixel ones.
      function ticked() {
        blips.attr("transform", function (d) {
          var angleBounds = RadarMapping.quadrantAngleBounds(d.quadrant);
          var radiusBounds = RadarMapping.ringRadiusBounds(d.ring, maxRadius);
          var r = Math.sqrt(d.x * d.x + d.y * d.y);
          var angleDeg = (Math.atan2(d.y, d.x) * 180) / Math.PI;
          if (angleDeg < 0) angleDeg += 360;
          var margin = 3;
          var clampedAngle = Math.min(Math.max(angleDeg, angleBounds.startDeg + margin), angleBounds.endDeg - margin);
          var clampedR = Math.min(Math.max(r, radiusBounds.inner), radiusBounds.outer);
          var clamped = RadarMapping.polarToXY(clampedAngle, clampedR);
          d.x = clamped.x;
          d.y = clamped.y;
          return "translate(" + d.x + "," + d.y + ")";
        });
      }

      d3.forceSimulation(entries)
        .velocityDecay(0.3)
        .force("collide", d3.forceCollide(9))
        .on("tick", ticked);
    }

    function renderLegend(entries) {
      legend.innerHTML = "";
      var quadrants = RadarMapping.buildQuadrantsConfig();
      var rings = RadarMapping.buildRingsConfig();
      var byQuadrant = [[], [], [], []];
      entries.forEach(function (e) {
        byQuadrant[e.quadrant].push(e);
      });

      quadrants.forEach(function (quadrant, qi) {
        var qDiv = document.createElement("div");
        qDiv.className = "radar-legend-quadrant";

        var qTitle = document.createElement("h3");
        qTitle.textContent = quadrant.name;
        qDiv.appendChild(qTitle);

        var byRing = [[], [], [], []];
        byQuadrant[qi].forEach(function (e) {
          byRing[e.ring].push(e);
        });

        rings.forEach(function (ring, ri) {
          var items = byRing[ri];
          if (items.length === 0) return;

          var rTitle = document.createElement("h4");
          rTitle.textContent = ring.name;
          rTitle.style.color = ring.color;
          qDiv.appendChild(rTitle);

          var list = document.createElement("ul");
          items.slice().sort(function (a, b) {
            return a.label.localeCompare(b.label);
          }).forEach(function (entry) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = "#";
            a.textContent = entry.id + ". " + entry.label;
            a.addEventListener("click", function (event) {
              event.preventDefault();
              showDetail(entry);
            });
            li.appendChild(a);
            list.appendChild(li);
          });
          qDiv.appendChild(list);
        });

        legend.appendChild(qDiv);
      });
    }

    function mapRows(rows) {
      var mapped = [];
      rows.forEach(function (row) {
        var entry = RadarMapping.csvRowToEntry(row);
        if (entry) {
          mapped.push(entry);
        } else {
          console.warn("Tech radar: skipping row with unmapped ring/quadrant", row);
        }
      });
      mapped.forEach(function (entry, i) {
        entry.id = i + 1;
      });
      return mapped;
    }

    d3.csv(sheetUrl).then(function (rows) {
      entries = mapRows(rows);
      renderPlot(entries, currentTheme());
      renderLegend(entries);
    }).catch(function (err) {
      console.error("Tech radar: failed to load sheet CSV", err);
      // Without this the page is just an empty box with no hint that anything
      // is wrong. Static string, so textContent is both safe and sufficient.
      detail.textContent = "Couldn't load the tech radar data.";
      detail.hidden = false;
    });

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (entries) {
          // PaperMod's own toggle handler (footer.html) also fires on this
          // click and is what actually flips document.documentElement's
          // data-theme attribute. Defer to a macrotask so currentTheme()
          // reads the *new* value, not the one from before this click. Only
          // the plot needs re-rendering for a theme change — the legend is
          // plain HTML that already inherits the site's CSS variables.
          setTimeout(function () {
            renderPlot(entries, currentTheme());
          }, 0);
        }
      });
    }
  }

  document.querySelectorAll(".radar-embed").forEach(init);
})();
