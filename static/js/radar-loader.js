(function () {
  "use strict";

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function init(container) {
    var sheetUrl = container.dataset.sheet;
    var width = parseInt(container.dataset.width, 10) || 1450;
    var height = parseInt(container.dataset.height, 10) || 1000;
    var svg = container.querySelector("svg#radar");
    var detail = container.querySelector(".radar-detail");
    var rows = null;

    function showDetail(entry) {
      var ringName = RadarMapping.buildRingsConfig()[entry.ring].name;
      var quadrantName = RadarMapping.buildQuadrantsConfig()[entry.quadrant].name;
      detail.innerHTML =
        "<h3>" + entry.label + "</h3>" +
        "<p><strong>" + ringName + "</strong> &middot; " + quadrantName + "</p>" +
        entry.description;
      detail.hidden = false;
    }

    function render() {
      svg.innerHTML = "";

      var entries = [];
      rows.forEach(function (row) {
        var entry = RadarMapping.csvRowToEntry(row);
        if (entry) {
          entries.push(entry);
        } else {
          console.warn("Tech radar: skipping row with unmapped ring/quadrant", row);
        }
      });

      var theme = currentTheme();

      radar_visualization({
        svg: "radar",
        width: width,
        height: height,
        colors: RadarMapping.THEME_COLORS[theme],
        title: "Tech Radar",
        quadrants: RadarMapping.buildQuadrantsConfig(),
        rings: RadarMapping.buildRingsConfig(),
        print_layout: true,
        entries: entries
      });

      // Make the fixed-pixel SVG scale responsively: radar_visualization()
      // sets explicit width/height attrs but no viewBox. Add one and let CSS
      // (in the shortcode) handle the actual displayed size.
      d3.select(svg)
        .attr("viewBox", "0 0 " + width + " " + height)
        .attr("width", null)
        .attr("height", null);

      d3.select(svg).selectAll(".blip").on("click", function (event, d) {
        showDetail(d);
      });
    }

    d3.csv(sheetUrl).then(function (data) {
      rows = data;
      render();
    }).catch(function (err) {
      console.error("Tech radar: failed to load sheet CSV", err);
    });

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (rows) {
          // PaperMod's own toggle handler (footer.html) also fires on this
          // click and is what actually flips document.documentElement's
          // data-theme attribute. Defer to a macrotask so currentTheme()
          // reads the *new* value, not the one from before this click.
          setTimeout(render, 0);
        }
      });
    }
  }

  document.querySelectorAll(".radar-embed").forEach(init);
})();
