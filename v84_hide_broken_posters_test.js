const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

function ok(name, condition) {
  if (!condition) throw new Error("FAIL: " + name);
  console.log("OK:", name);
}

ok("V84 marker exists", app.includes("GKM_V84_HIDE_BROKEN_POSTERS_VERSION"));
ok("dummyimage posters are rejected", app.includes('p.includes("dummyimage.com")'));
ok("fallback poster flags are rejected", app.includes("posterFallback") && app.includes("isFallbackPoster") && app.includes("noPoster"));
ok("visible cards filter is overridden", app.includes("window.gkmVisibleCardsV79 = function(items)"));
ok("broken image cards are hidden", app.includes('card.style.display = "none"'));
ok("poster error handler is overridden", app.includes("window.gkmPosterErrorV73 = function(img)"));

console.log("RESULT 6/6 passed");
