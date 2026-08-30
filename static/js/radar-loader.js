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
      detail.innerHTML = "";

      // label is a short plain name with no legitimate need for markup, so it
      // goes in as text rather than through the HTML string path.
      var heading = document.createElement("h3");
      heading.textContent = entry.label;
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

      // The numbered legend list (readable names, not the tiny plotted
      // blips) is what most people try to click first. radar.js wraps each
      // legend entry in <a href="#"> (no entries in our data set a `link`,
      // so this never collides with a real blip link); without
      // preventDefault() a click just jumps to the top of the page.
      d3.select(svg).selectAll("a").on("click", function (event, d) {
        event.preventDefault();
        showDetail(d);
      });
    }

    d3.csv(sheetUrl).then(function (data) {
      rows = data;
      render();
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
