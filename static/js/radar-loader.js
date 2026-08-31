(function () {
  "use strict";

  var ZOOM_MARGIN = 20;

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  // Path for a filled pie-slice from `origin` out to `radius`, spanning
  // startDeg..endDeg — used as an invisible click target so the whole
  // overview wedge (not just its blips) is clickable.
  function sectorHitPath(origin, startDeg, endDeg, radius) {
    var p1 = RadarMapping.polarToXY(startDeg, radius);
    var p2 = RadarMapping.polarToXY(endDeg, radius);
    return "M " + origin.x + "," + origin.y +
      " L " + (origin.x + p1.x) + "," + (origin.y + p1.y) +
      " A " + radius + "," + radius + " 0 0,1 " + (origin.x + p2.x) + "," + (origin.y + p2.y) +
      " Z";
  }

  // Path for just the outer arc of a ring band, spanning startDeg..endDeg —
  // used to draw a single quadrant's rings as quarter-arcs in the zoomed
  // view (the overview draws full circles instead, since it shows all 4
  // quadrants at once).
  function ringArcPath(origin, startDeg, endDeg, radius) {
    var p1 = RadarMapping.polarToXY(startDeg, radius);
    var p2 = RadarMapping.polarToXY(endDeg, radius);
    return "M " + (origin.x + p1.x) + "," + (origin.y + p1.y) +
      " A " + radius + "," + radius + " 0 0,1 " + (origin.x + p2.x) + "," + (origin.y + p2.y);
  }

  function init(container) {
    var sheetUrl = container.dataset.sheet;
    var size = parseInt(container.dataset.size, 10) || 800;
    var svg = container.querySelector("svg#radar");
    var list = container.querySelector(".radar-list");
    var nav = container.querySelector(".radar-nav");
    var backLink = container.querySelector(".radar-back");
    var quadrantHeading = container.querySelector(".radar-quadrant-heading");
    var tooltip = container.querySelector(".radar-tooltip");
    var entries = null;
    var detailsById = {};
    var simulation = null;

    function currentMode() {
      return RadarMapping.parseHash(location.hash);
    }

    function navigate(quadrantIndex, openId) {
      var slug = RadarMapping.QUADRANT_ORDER[quadrantIndex];
      var hash = "quadrant=" + slug;
      if (openId) {
        hash += "&open=" + openId;
      }
      location.hash = hash;
    }

    function goToOverview() {
      location.hash = "";
    }

    function openListItem(id, scroll) {
      var details = detailsById[id];
      if (!details) return;
      details.open = true;
      if (scroll) {
        details.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    function showTooltip(event, label) {
      tooltip.textContent = label;
      tooltip.hidden = false;
      positionTooltip(event);
    }

    function positionTooltip(event) {
      var rect = container.getBoundingClientRect();
      tooltip.style.left = (event.clientX - rect.left) + "px";
      tooltip.style.top = (event.clientY - rect.top) + "px";
    }

    function hideTooltip() {
      tooltip.hidden = true;
    }

    function geometryForMode(mode) {
      if (mode.mode === "quadrant") {
        return {
          origin: RadarMapping.quadrantZoomOrigin(mode.quadrant, size, ZOOM_MARGIN),
          maxRadius: size - 2 * ZOOM_MARGIN
        };
      }
      return {
        origin: { x: size / 2, y: size / 2 },
        maxRadius: size / 2 - 20
      };
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

    function renderPlot(plotEntries, theme, mode) {
      svg.innerHTML = "";
      var colors = RadarMapping.THEME_COLORS[theme];
      var rings = RadarMapping.buildRingsConfig();
      var quadrants = RadarMapping.buildQuadrantsConfig();
      var geometry = geometryForMode(mode);
      var origin = geometry.origin;
      var maxRadius = geometry.maxRadius;

      var svgSel = d3.select(svg).attr("viewBox", "0 0 " + size + " " + size);
      svgSel.append("rect")
        .attr("width", size)
        .attr("height", size)
        .attr("fill", colors.background);

      var g = svgSel.append("g");

      if (mode.mode === "overview") {
        // One invisible clickable wedge per quadrant, drawn first so rings/
        // blips render on top of it without blocking its own clicks.
        quadrants.forEach(function (quadrant, qi) {
          var bounds = RadarMapping.quadrantAngleBounds(qi);
          g.append("path")
            .attr("d", sectorHitPath(origin, bounds.startDeg, bounds.endDeg, maxRadius))
            .attr("fill", "transparent")
            .style("cursor", "pointer")
            .on("click", function () {
              navigate(qi, null);
            });
        });

        rings.forEach(function (ring, i) {
          g.append("circle")
            .attr("cx", origin.x).attr("cy", origin.y)
            .attr("r", RadarMapping.ringRadiusBounds(i, maxRadius).outer)
            .attr("fill", "none")
            .attr("stroke", colors.grid);
        });
        g.append("line")
          .attr("x1", origin.x - maxRadius).attr("x2", origin.x + maxRadius)
          .attr("y1", origin.y).attr("y2", origin.y)
          .attr("stroke", colors.grid);
        g.append("line")
          .attr("x1", origin.x).attr("x2", origin.x)
          .attr("y1", origin.y - maxRadius).attr("y2", origin.y + maxRadius)
          .attr("stroke", colors.grid);

        quadrants.forEach(function (quadrant, qi) {
          var bounds = RadarMapping.quadrantAngleBounds(qi);
          var mid = (bounds.startDeg + bounds.endDeg) / 2;
          var labelPos = RadarMapping.polarToXY(mid, maxRadius + 14);
          g.append("text")
            .attr("x", origin.x + labelPos.x)
            .attr("y", origin.y + labelPos.y)
            .attr("text-anchor", "middle")
            .attr("fill", colors.text)
            .style("font-size", "14px")
            .style("font-weight", "600")
            .style("pointer-events", "none")
            .text(quadrant.name);
        });
      } else {
        var bounds = RadarMapping.quadrantAngleBounds(mode.quadrant);
        rings.forEach(function (ring, i) {
          g.append("path")
            .attr("d", ringArcPath(origin, bounds.startDeg, bounds.endDeg, RadarMapping.ringRadiusBounds(i, maxRadius).outer))
            .attr("fill", "none")
            .attr("stroke", colors.grid);
        });
        [bounds.startDeg, bounds.endDeg].forEach(function (deg) {
          var p = RadarMapping.polarToXY(deg, maxRadius);
          g.append("line")
            .attr("x1", origin.x).attr("y1", origin.y)
            .attr("x2", origin.x + p.x).attr("y2", origin.y + p.y)
            .attr("stroke", colors.grid);
        });
      }

      // Seed each blip inside its own ring/quadrant wedge; the force
      // simulation below only nudges blips apart, it never needs to move
      // them between wedges, so a plain random seed (not Zalando's
      // reproducible PRNG) is fine here.
      plotEntries.forEach(function (entry) {
        var angleBounds = RadarMapping.quadrantAngleBounds(entry.quadrant);
        var radiusBounds = RadarMapping.ringRadiusBounds(entry.ring, maxRadius);
        var angle = angleBounds.startDeg + Math.random() * (angleBounds.endDeg - angleBounds.startDeg);
        var radius = radiusBounds.inner + Math.random() * (radiusBounds.outer - radiusBounds.inner);
        var p = RadarMapping.polarToXY(angle, radius);
        entry.x = p.x;
        entry.y = p.y;
      });

      var blips = g.selectAll(".blip")
        .data(plotEntries)
        .enter()
        .append("g")
        .attr("class", "blip")
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          if (mode.mode === "overview") {
            navigate(d.quadrant, d.id);
          } else {
            openListItem(d.id, true);
          }
        })
        .on("mouseenter", function (event, d) {
          showTooltip(event, d.label);
        })
        .on("mousemove", function (event) {
          positionTooltip(event);
        })
        .on("mouseleave", function () {
          hideTooltip();
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
          return "translate(" + (origin.x + d.x) + "," + (origin.y + d.y) + ")";
        });
      }

      if (simulation) {
        simulation.stop();
      }
      simulation = d3.forceSimulation(plotEntries)
        .velocityDecay(0.3)
        .force("collide", d3.forceCollide(9))
        .on("tick", ticked);
    }

    function renderList(listEntries, mode) {
      list.innerHTML = "";
      detailsById = {};
      if (mode.mode !== "quadrant") {
        return;
      }
      var rings = RadarMapping.buildRingsConfig();
      var byRing = [[], [], [], []];
      listEntries.forEach(function (e) {
        byRing[e.ring].push(e);
      });

      rings.forEach(function (ring, ri) {
        var items = byRing[ri];
        if (items.length === 0) return;

        var group = document.createElement("div");
        group.className = "radar-ring-group";

        var heading = document.createElement("h3");
        heading.textContent = ring.name;
        heading.style.color = ring.color;
        group.appendChild(heading);

        items.slice().sort(function (a, b) {
          return a.label.localeCompare(b.label);
        }).forEach(function (entry) {
          var details = document.createElement("details");
          details.className = "radar-item";
          details.name = "radar-accordion";

          var summary = document.createElement("summary");
          summary.textContent = entry.id + ". " + entry.label;
          details.appendChild(summary);

          // description is owner-authored rich text, already run through
          // RadarMapping.sanitizeHtml() in csvRowToEntry().
          var body = document.createElement("div");
          body.innerHTML = entry.description;
          details.appendChild(body);

          detailsById[entry.id] = details;
          group.appendChild(details);
        });

        list.appendChild(group);
      });
    }

    function render(mode) {
      var modeEntries = mode.mode === "quadrant"
        ? entries.filter(function (e) { return e.quadrant === mode.quadrant; })
        : entries;

      nav.hidden = mode.mode !== "quadrant";
      if (mode.mode === "quadrant") {
        quadrantHeading.textContent = RadarMapping.buildQuadrantsConfig()[mode.quadrant].name;
      }

      renderPlot(modeEntries, currentTheme(), mode);
      renderList(modeEntries, mode);

      if (mode.mode === "quadrant" && mode.open) {
        openListItem(mode.open, true);
      }
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
      render(currentMode());
    }).catch(function (err) {
      console.error("Tech radar: failed to load sheet CSV", err);
      // Without this the page is just an empty box with no hint that anything
      // is wrong. Static string, so textContent is both safe and sufficient.
      list.textContent = "Couldn't load the tech radar data.";
    });

    window.addEventListener("hashchange", function () {
      var raw = location.hash.replace(/^#/, "");
      if (raw && raw.indexOf("quadrant=") !== 0) {
        return; // not ours — e.g. PaperMod's #top back-to-top link
      }
      if (entries) {
        render(currentMode());
      }
    });

    backLink.addEventListener("click", function (event) {
      event.preventDefault();
      goToOverview();
    });

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (entries) {
          // PaperMod's own toggle handler (footer.html) also fires on this
          // click and is what actually flips document.documentElement's
          // data-theme attribute. Defer to a macrotask so currentTheme()
          // reads the *new* value, not the one from before this click. Only
          // the plot needs re-rendering for a theme change — the list is
          // plain HTML that already inherits the site's CSS variables.
          setTimeout(function () {
            var mode = currentMode();
            var modeEntries = mode.mode === "quadrant"
              ? entries.filter(function (e) { return e.quadrant === mode.quadrant; })
              : entries;
            renderPlot(modeEntries, currentTheme(), mode);
          }, 0);
        }
      });
    }
  }

  document.querySelectorAll(".radar-embed").forEach(init);
})();
