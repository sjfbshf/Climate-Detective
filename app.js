// Climate Detective - main app

// Code written with SI assistance (Claude). Team: Into the Space.

const START_YEAR = 1981;
const END_YEAR = new Date().getFullYear() - 1;   // complete years only

// NASA POWER variables, described in plain language.
// kind "temp": show change in °F. Otherwise show change as a percent of the starting value.
// up / down: words for the direction of change. why: why a normal person might care.
const VARS = {
  T2M_MIN: { name: "Nighttime low temperature", sub: "How cool it gets at night", units: "°F", kind: "temp", up: "warmer", down: "cooler",
    def: "How cool it gets at night (the coldest point of each day), averaged over the year.",
    why: "Warmer nights give people, animals, and plants less time to cool off after hot days, and mean air conditioners run longer.",
    convert: v => v * 1.8 + 32, digits: 1 },
  T2M_MAX: { name: "Daytime high temperature", sub: "How hot it gets during the day", units: "°F", kind: "temp", up: "warmer", down: "cooler",
    def: "How hot it gets during the day (the hottest point of each day), averaged over the year.",
    why: "Hotter days raise the risk of heat illness, especially for people who work or play outside.",
    convert: v => v * 1.8 + 32, digits: 1 },
  T2M: { name: "Mean air temperature", sub: "Average temperature, day and night", units: "°F", kind: "temp", up: "warmer", down: "cooler",
    def: "The average air temperature, day and night, across the whole year.",
    why: "This is the big-picture measure of whether a place is heating up or cooling down.",
    convert: v => v * 1.8 + 32, digits: 1 },
  PRECTOTCORR: { name: "Annual precipitation", sub: "Total rain (and snow) per year", units: "inches", kind: "pct", friendly: true, up: "more rain", down: "less rain",
    def: "How much rain (and snow) falls in a whole year.",
    why: "More rain can mean more flooding; less rain can mean droughts and water shortages.",
    convert: v => v * 365.25 / 25.4, digits: 1 },
  RH2M: { name: "Relative humidity", sub: "How humid the air feels", units: "%", kind: "pct", friendly: true, up: "more humid", down: "less humid",
    def: "How full of moisture the air is compared with the most it can hold. High humidity is what makes air feel sticky.",
    why: "Humidity changes how hot it feels and how well sweat can cool you down.",
    convert: v => v, digits: 1 },
  QV2M: { name: "Water vapor (specific humidity)", sub: "Actual amount of moisture in the air", units: "g/kg", kind: "pct", up: "more water in the air", down: "less water in the air",
    def: "The actual amount of water vapor floating in the air. Warmer air can hold more.",
    why: "More water in the air can feed heavier downpours and make heat feel worse.",
    convert: v => v, digits: 2 },
  WS2M: { name: "Wind speed", sub: "Average wind near the ground", units: "mph", kind: "pct", friendly: true, up: "windier", down: "calmer",
    def: "The average wind speed near the ground.",
    why: "Wind affects how hot it feels, how pollution spreads, and how much power wind turbines make.",
    convert: v => v * 2.23694, digits: 2 },
  ALLSKY_SFC_SW_DWN: { name: "Surface solar radiation", sub: "Sunlight reaching the ground", units: "kWh/m²/day", kind: "pct", up: "more sunshine", down: "less sunshine",
    def: "How much of the sun's energy makes it to the ground after clouds and haze block some of it.",
    why: "More sunshine means more power from solar panels, and can also mean fewer clouds or cleaner air.",
    convert: v => v, digits: 2 },
  GWETTOP: { name: "Surface soil moisture", sub: "How wet the topsoil is", units: "%", kind: "pct", friendly: true, up: "wetter soil", down: "drier soil",
    def: "How wet the top layer of the ground is, from 0% (bone dry) to 100% (soaked).",
    why: "Drier soil is harder on crops and gardens and can raise wildfire risk.",
    convert: v => v * 100, digits: 1 },
  PS: { name: "Surface air pressure", sub: "Weight of the air above", units: "kPa", kind: "pct", up: "higher pressure", down: "lower pressure",
    def: "The weight of all the air pressing down from above. It shifts with weather patterns.",
    why: "Long-term pressure changes can hint that typical weather patterns are shifting.",
    convert: v => v, digits: 3 }
};

const TAMPA = { lat: 27.95, lon: -82.46 };

// ---------- Place names (offline reverse lookup from Natural Earth) ----------
// Bounding box [west, south, east, north] of a feature
function featureBox(f) {
  let w = 180, so = 90, e = -180, n = -90;
  const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const [x, y] of poly[0]) { if (x < w) w = x; if (x > e) e = x; if (y < so) so = y; if (y > n) n = y; }
  return [w, so, e, n];
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inFeature(lon, lat, f) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(poly => inRing(lon, lat, poly[0]) && !poly.slice(1).some(h => inRing(lon, lat, h)));
}
const SHORT_COUNTRY = { "United States of America": "USA", "United Kingdom": "UK" };
function kmBetween(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
function placeName(lat, lon) {
  const country = GEO_COUNTRIES.features.find(f => inFeature(lon, lat, f));
  const state = GEO_STATES.features.find(f => inFeature(lon, lat, f));
  // Pick the best-known nearby place: distance counts, but bigger/better-known places
  // (the ones that show on the map sooner) are preferred over tiny towns that are only slightly closer.
  let best = null, bestKm = Infinity, bestScore = Infinity;
  for (const [n, clat, clon, mz] of GEO_CITIES) {
    const km = kmBetween(lat, lon, clat, clon);
    if (km > 250) continue;
    const score = km + Math.max(0, mz - 3) * 20;
    if (score < bestScore) { bestScore = score; bestKm = km; best = n; }
  }
  const parts = [];
  if (best) {
    if (bestKm <= 15) parts.push(best);
    else if (bestKm <= 100) parts.push("Near " + best);
    else parts.push(`About ${Math.round(bestKm * 0.621371 / 10) * 10} miles from ${best}`);
  }
  if (state && state.properties.n !== best) parts.push(state.properties.n);
  if (country) parts.push(SHORT_COUNTRY[country.properties.n] || country.properties.n);
  if (!country) return waterName(lat, lon);
  return parts.join(", ");
}
// Over water: "North Atlantic Ocean, about 330 miles east of Jacksonville, Florida, USA"
function waterName(lat, lon) {
  let sea = null;
  for (const f of GEO_MARINE.features) {
    if (inFeature(lon, lat, f) && (!sea || f.properties.r > sea.properties.r)) sea = f;  // most specific body of water
  }
  let ref = null, refKm = 0, bestScore = Infinity;
  for (const c of GEO_REF_CITIES) {
    const km = kmBetween(lat, lon, c[1], c[2]);
    const score = km + Math.max(0, c[5] - 3) * 60;  // prefer well-known cities
    if (score < bestScore) { bestScore = score; ref = c; refKm = km; }
  }
  const seaName = sea ? sea.properties.n : "Open ocean";
  if (!ref) return seaName;
  const where = [ref[0], ref[3], ref[4]].filter(Boolean).join(", ");
  const mi = Math.round(refKm * 0.621371 / 10) * 10;
  if (mi < 30) return `${seaName}, just off ${where}`;
  return `${seaName}, about ${mi} miles ${compass(ref[1], ref[2], lat, lon)} of ${where}`;
}
function compass(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, dl = (lon2 - lon1) * r;
  const y = Math.sin(dl) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dl);
  const deg = (Math.atan2(y, x) / r + 360) % 360;
  return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(deg / 45) % 8];
}

function coordText(lat, lon) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}
let runId = 0;
let lastQuery = null;   // what the current results are for, used for share links
let map, chart, lastRows = [], lastPlace = "", lastCoords = "", lastRegion = null, mode = "point";

// ---------- Map ----------
// GPU-rendered map (MapLibre) drawn from built-in Natural Earth outlines, so it zooms smoothly
// and never depends on a tile server.
const CONTINENTS = [
  ["NORTH AMERICA", 45, -100], ["SOUTH AMERICA", -15, -60], ["EUROPE", 52, 15], ["AFRICA", 5, 20],
  ["ASIA", 45, 90], ["AUSTRALIA", -25, 134], ["ANTARCTICA", -80, 30]
];
const labelMarkers = new Map();   // key -> MapLibre marker (reused so labels never flicker)

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    center: [-70, 30], zoom: 2.6, minZoom: 1, maxZoom: 9,
    attributionControl: false, dragRotate: false, pitchWithRotate: false,
    renderWorldCopies: true,
    style: {
      version: 8,
      sources: {
        land: { type: "geojson", data: GEO_COUNTRIES, tolerance: 0.6 },
        states: { type: "geojson", data: GEO_STATES, tolerance: 0.8 },
        box: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        region: { type: "geojson", data: { type: "FeatureCollection", features: [] }, tolerance: 0.6 },
        samples: { type: "geojson", data: { type: "FeatureCollection", features: [] } }
      },
      layers: [
        { id: "ocean", type: "background", paint: { "background-color": "#a8d0ec" } },
        { id: "land", type: "fill", source: "land", paint: { "fill-color": "#f3f0e8" } },
        { id: "borders", type: "line", source: "land", paint: { "line-color": "#8a8f99", "line-width": 0.8 } },
        { id: "states", type: "line", source: "states", minzoom: 4,
          paint: { "line-color": "#a9adb5", "line-width": 0.6, "line-dasharray": [3, 3] } },
        { id: "region-fill", type: "fill", source: "region", paint: { "fill-color": "#2f6fd6", "fill-opacity": 0.12 } },
        { id: "region-line", type: "line", source: "region", paint: { "line-color": "#2f6fd6", "line-width": 1.6 } },
        { id: "box-fill", type: "fill", source: "box", paint: { "fill-color": "#2f6fd6", "fill-opacity": 0.15 } },
        { id: "box-line", type: "line", source: "box", paint: { "line-color": "#2f6fd6", "line-width": 2 } },
        { id: "samples", type: "circle", source: "samples", paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 6, 7],
            "circle-color": ["match", ["get", "dir"], "up", "#d7301f", "down", "#2b6cb0", "flat", "#9aa1ab", "#ffffff"],
            "circle-stroke-color": "#1d2433", "circle-stroke-width": 1.2 } }
      ]
    }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
  map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: "Map data: Natural Earth" }));
  map.touchZoomRotate.disableRotation();
  initSmoothScrollZoom();

  // Update labels a few times per second while moving, and once more when movement ends
  let lastDraw = 0;
  map.on("move", () => { const t = performance.now(); if (t - lastDraw > 120) { lastDraw = t; drawLabels(); } });
  map.on("moveend", drawLabels);
  map.on("load", drawLabels);

  let lastClick = 0;
  map.on("click", e => {
    if (e.originalEvent && e.originalEvent.detail > 1) return;   // second click of a double-click
    const now = performance.now(); if (now - lastClick < 400) return; lastClick = now;
    const ll = e.lngLat.wrap();
    if (mode === "point") return investigate(ll.lat, ll.lng, null);
    const country = GEO_COUNTRIES.features.find(f => inFeature(ll.lng, ll.lat, f));
    if (!country) { setStatus("Click on land to pick a " + mode + "."); return; }
    if (mode === "country") return investigateRegion([country], country.properties.n, 16, "country");
    const c = country.properties.c;
    if (!c || c.startsWith("Seven")) { setStatus("That spot isn't part of a continent. Try another."); return; }
    investigateRegion(GEO_COUNTRIES.features.filter(f => f.properties.c === c), c, 30, "continent");
  });
  document.querySelectorAll("#demos button").forEach(btn => {
    btn.addEventListener("click", () => {
      setMode("point");
      investigate(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon), btn.dataset.name);
    });
  });
  document.querySelectorAll("#modes button").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
}

const MODE_HINTS = {
  point: "Click any spot on the map to analyze that location (about 30 miles across).",
  country: "Click a country to analyze it as a whole. We average NASA data from up to 16 locations across it.",
  continent: "Click anywhere on a continent to analyze it as a whole. We average NASA data from up to 30 locations across it."
};
function setMode(m) {
  mode = m;
  document.querySelectorAll("#modes button").forEach(b => {
    b.classList.toggle("on", b.dataset.mode === m); b.setAttribute("aria-checked", b.dataset.mode === m);
  });
  document.getElementById("modeHint").textContent = MODE_HINTS[m];
}

// Smooth scroll-wheel zoom: each wheel notch moves a target zoom level, and the map glides
// toward it in one continuous animation (like the click zoom) instead of many small stop-start steps.
function initSmoothScrollZoom() {
  map.scrollZoom.disable();
  const el = map.getCanvasContainer();
  let target = null, lastWheel = 0;
  el.addEventListener("wheel", e => {
    e.preventDefault();
    const now = performance.now();
    if (target === null || now - lastWheel > 400) target = map.getZoom();   // start fresh after a pause
    lastWheel = now;
    // Mouse wheels send big jumps (~100 per notch); trackpads send many small ones. Scale both.
    let dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    dy = Math.max(-250, Math.min(250, dy));
    target = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), target - dy / 220));
    const rect = el.getBoundingClientRect();
    const around = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    map.easeTo({ zoom: target, around, duration: 380, easing: t => 1 - Math.pow(1 - t, 3) });
  }, { passive: false });
}

// Choose which labels to show: by importance, skipping any that would overlap, so the map stays clean.
function drawLabels() {
  const z = map.getZoom(), b = map.getBounds();
  const pad = 0.1 * (b.getEast() - b.getWest()), padY = 0.1 * (b.getNorth() - b.getSouth());
  const inView = (lat, lon) => lon > b.getWest() - pad && lon < b.getEast() + pad && lat > b.getSouth() - padY && lat < b.getNorth() + padY;
  const cands = [];
  if (z <= 3.5) CONTINENTS.forEach(([n, lat, lon]) => cands.push({ n, lat, lon, cls: "lbl-continent", pri: 0 }));
  GEO_OCEAN_LABELS.forEach(([n, lat, lon, mz, kind]) => {
    if (z + 1 >= mz && !(kind === "ocean" && z > 6)) cands.push({ n, lat, lon, cls: kind === "ocean" ? "lbl-ocean" : "lbl-sea", pri: 0.5 + mz / 10 });
  });
  if (z >= 2.5) GEO_COUNTRIES.features.forEach(f => {
    const p = f.properties;
    if (z + 0.5 >= Math.max(3, p.z)) cands.push({ n: p.n, lat: p.ly, lon: p.lx, cls: "lbl-country", pri: 1 + p.z / 10 });
  });
  if (z >= 4.5) GEO_STATES.features.forEach(f => {
    const p = f.properties;
    if (z + 0.5 >= Math.max(5, p.z)) cands.push({ n: p.n, lat: p.ly, lon: p.lx, cls: "lbl-state", pri: 2 + p.z / 10 });
  });
  if (z >= 3.5) for (const [n, lat, lon, mz] of GEO_CITIES) {
    if (mz > z + 0.5) break;  // cities are sorted by the zoom they should appear at
    cands.push({ n, lat, lon, cls: "lbl-city", pri: 3 + mz / 10, dot: true });
  }
  cands.sort((a, b) => a.pri - b.pri);
  const placed = [], keep = new Set();
  for (const c of cands) {
    if (!inView(c.lat, c.lon)) continue;
    const pt = map.project([c.lon, c.lat]);
    const charW = c.cls === "lbl-continent" ? 10 : c.cls === "lbl-ocean" ? 8 : c.cls === "lbl-country" ? 7.5 : 6.5;
    const w = c.n.length * charW + (c.dot ? 10 : 0), h = (c.cls === "lbl-continent" || c.cls === "lbl-ocean") ? 18 : 14;
    const box = { x1: pt.x - w / 2 - 3, y1: pt.y - h / 2 - 2, x2: pt.x + w / 2 + 3, y2: pt.y + h / 2 + 2 };
    if (placed.some(q => box.x1 < q.x2 && box.x2 > q.x1 && box.y1 < q.y2 && box.y2 > q.y1)) continue;
    placed.push(box);
    const key = c.cls + "|" + c.n + "|" + c.lat;
    keep.add(key);
    if (!labelMarkers.has(key)) {
      const el = document.createElement("div");
      el.className = "lbl " + c.cls;
      el.innerHTML = `<span>${c.dot ? '<i class="dot"></i>' : ""}${c.n}</span>`;
      labelMarkers.set(key, new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([c.lon, c.lat]).addTo(map));
    }
    if (placed.length > 220) break;
  }
  for (const [key, m] of labelMarkers) if (!keep.has(key)) { m.remove(); labelMarkers.delete(key); }
}

// NASA POWER weather data uses the MERRA-2 grid: 0.5° latitude x 0.625° longitude
function gridBox(lat, lon) {
  const cLat = Math.round(lat / 0.5) * 0.5;
  const cLon = Math.round(lon / 0.625) * 0.625;
  return [[cLat - 0.25, cLon - 0.3125], [cLat + 0.25, cLon + 0.3125]];
}

// ---------- Fetch + analyze ----------
async function investigate(lat, lon, name) {
  const myRun = ++runId;
  lastQuery = { lat: +lat.toFixed(3), lon: +lon.toFixed(3), name: name || null };
  lastRegion = null;
  if (map.getSource("region")) setRegionOnMap([], []);
  const place = name || placeName(lat, lon);
  lastPlace = place;
  lastCoords = coordText(lat, lon);
  const box = gridBox(lat, lon);
  const [[s0, w0], [n0, e0]] = box;
  map.getSource("box").setData({ type: "Feature", geometry: { type: "Polygon",
    coordinates: [[[w0, s0], [e0, s0], [e0, n0], [w0, n0], [w0, s0]]] } });
  map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7), duration: 800 });

  clearResults();
  setStatus("");
  showLoading(place, 1);

  let paramData;
  try {
    paramData = await fetchPower(lat, lon);
  } catch (e) {
    if (myRun !== runId) return;
    hideLoading();
    setStatus(`<span class="err">Couldn't reach NASA's data right now.</span> Check your internet and try again.`);
    return;
  }

  if (myRun !== runId) return;   // superseded by a newer click
  hideLoading();
  const rows = buildRows(paramData);
  lastRows = rows;
  if (!rows.length) {
    setStatus(`<span class="err">No usable data for this spot.</span> Try a spot on land.`);
    return;
  }
  setStatus(`Analysis complete: <b>${place}</b> (${lastCoords}).`);
  renderSuspects(rows, place);
  updateAddressBar();
  openCase(0);
  if (Math.abs(lat - TAMPA.lat) < 0.5 && Math.abs(lon - TAMPA.lon) < 0.6) renderVerified(rows);
}

async function fetchPower(lat, lon) {
  const key = `cd_${lat.toFixed(2)}_${lon.toFixed(2)}_${END_YEAR}`;
  const params = Object.keys(VARS).join(",");
  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${params}` +
              `&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
              `&start=${START_YEAR}&end=${END_YEAR}&format=JSON`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const p = data.properties && data.properties.parameter;
    if (!p) throw new Error("no data in response");
    try { localStorage.setItem(key, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
    return p;
  } catch (err) {
    // Backup: use the last saved copy for this spot if NASA is unreachable
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    throw err;
  }
}

// Turn POWER monthly data into yearly series: { code: { years, vals } }
function yearlySeries(paramData) {
  const out = {};
  for (const code of Object.keys(VARS)) {
    const series = paramData[code];
    if (!series) continue;
    const years = [], vals = [];
    for (let yr = START_YEAR; yr <= END_YEAR; yr++) {
      let v = series[`${yr}13`];   // POWER's annual value
      if (v === undefined) {
        const months = [];
        for (let m = 1; m <= 12; m++) {
          const mv = series[`${yr}${String(m).padStart(2, "0")}`];
          if (mv !== undefined && mv !== -999) months.push(mv);
        }
        v = months.length === 12 ? months.reduce((a, b) => a + b, 0) / 12 : undefined;
      }
      if (v !== undefined && v !== -999) { years.push(yr); vals.push(VARS[code].convert(v)); }
    }
    if (vals.length >= 15) out[code] = { years, vals };
  }
  return out;
}

function rowsFromSeries(seriesByCode) {
  const rows = [];
  for (const [code, { years, vals }] of Object.entries(seriesByCode)) {
    const a = analyzeSeries(years, vals);
    rows.push({ code, years, vals, ...a, ev: evidenceLevel(a.p) });
  }
  return rows.sort((x, y) => y.score - x.score);
}

function buildRows(paramData) { return rowsFromSeries(yearlySeries(paramData)); }

// ---------- Country / continent analysis ----------
// Spread sample points evenly inside the region, fetch NASA data for each, and average them.
function regionBox(features) {
  let w = 180, so = 90, e = -180, n = -90;
  for (const f of features) { const b = featureBox(f); w = Math.min(w, b[0]); so = Math.min(so, b[1]); e = Math.max(e, b[2]); n = Math.max(n, b[3]); }
  return [w, so, e, n];
}

function regionSamples(features, target) {
  const [w, so, e, n] = regionBox(features);
  const inside = (lat, lon) => features.some(f => inFeature(lon, lat, f));
  const grid = step => {
    const pts = [];
    for (let lat = so + step / 2; lat < n; lat += step) {
      const lonStep = step / Math.max(0.2, Math.cos(lat * Math.PI / 180));   // equal spacing on the ground
      for (let lon = w + lonStep / 2; lon < e; lon += lonStep) if (inside(lat, lon)) pts.push([lat, lon]);
      if (pts.length > 1500) break;
    }
    return pts;
  };
  let step = Math.max(0.5, Math.sqrt((e - w) * (n - so) / target)), pts = [];
  for (let k = 0; k < 14; k++) { pts = grid(step); if (pts.length >= target * 2) break; step *= 0.75; }
  if (!pts.length) return features.map(f => [f.properties.ly, f.properties.lx]).slice(0, target);
  // Pick well-spread points: start near the middle, then keep adding the point farthest from those chosen
  const cLat = pts.reduce((s, p) => s + p[0], 0) / pts.length, cLon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const chosen = [pts.reduce((b, p) => kmBetween(p[0], p[1], cLat, cLon) < kmBetween(b[0], b[1], cLat, cLon) ? p : b)];
  const minD = pts.map(p => kmBetween(p[0], p[1], chosen[0][0], chosen[0][1]));
  while (chosen.length < Math.min(target, pts.length)) {
    let bi = 0;
    for (let i = 1; i < pts.length; i++) if (minD[i] > minD[bi]) bi = i;
    if (minD[bi] === 0) break;
    chosen.push(pts[bi]);
    for (let i = 0; i < pts.length; i++) minD[i] = Math.min(minD[i], kmBetween(pts[i][0], pts[i][1], pts[bi][0], pts[bi][1]));
  }
  return chosen;
}

async function investigateRegion(features, name, target, kind) {
  const myRun = ++runId;
  lastQuery = { [kind]: name };
  lastPlace = name;
  clearResults();
  setRegionOnMap(features, []);
  map.getSource("box").setData({ type: "FeatureCollection", features: [] });
  const [w, so, e, n] = regionBox(features);
  if (e - w > 300) map.easeTo({ center: [features[0].properties.lx, features[0].properties.ly], zoom: 1.5, duration: 800 });
  else map.fitBounds([[w, so], [e, n]], { padding: 40, duration: 800, maxZoom: 6 });

  const pts = regionSamples(features, target);
  lastCoords = `Average of ${pts.length} sample location${pts.length === 1 ? "" : "s"} across ${name}`;
  setRegionOnMap(features, pts.map(([lat, lon]) => ({ lat, lon, dir: "pending" })));

  // Fetch a few at a time so NASA's server isn't overwhelmed
  const results = new Array(pts.length).fill(null);
  let done = 0, next = 0;
  showLoading(name, pts.length);
  const progress = () => {
    if (myRun !== runId) return;   // a newer analysis started; stop updating
    const c = document.getElementById("progCount"), bar = document.getElementById("progBar"), pc = document.getElementById("progPct");
    const pct = (done / pts.length * 100).toFixed(0);
    if (c) c.textContent = done;
    if (bar) bar.style.width = pct + "%";
    if (pc) pc.textContent = pct + "%";
  };
  const worker = async () => {
    while (next < pts.length && myRun === runId) {
      const i = next++;
      try { results[i] = yearlySeries(await fetchPower(pts[i][0], pts[i][1])); } catch (e) { results[i] = null; }
      done++; progress();
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  if (myRun !== runId) return;   // superseded by a newer click
  hideLoading();
  const ok = pts.map((p, i) => ({ lat: p[0], lon: p[1], series: results[i] })).filter(x => x.series);
  if (!ok.length) { setStatus(`<span class="err">Couldn't reach NASA's data right now.</span> Check your internet and try again.`); return; }

  // Average each variable across locations, using years every location has
  const avg = {}, perPoint = {};
  for (const code of Object.keys(VARS)) {
    const have = ok.filter(x => x.series[code]);
    if (!have.length) continue;
    const years = have[0].series[code].years.filter(y => have.every(x => x.series[code].years.includes(y)));
    if (years.length < 15) continue;
    const vals = years.map(y => have.reduce((s, x) => s + x.series[code].vals[x.series[code].years.indexOf(y)], 0) / have.length);
    avg[code] = { years, vals };
    perPoint[code] = have.map(x => {
      const a = analyzeSeries(x.series[code].years, x.series[code].vals);
      return { lat: x.lat, lon: x.lon, perDecade: a.perDecade, p: a.p };
    });
  }
  lastRegion = { features, perPoint, n: ok.length };
  lastCoords = `Average of ${ok.length} sample location${ok.length === 1 ? "" : "s"} across ${name}`;
  const rows = rowsFromSeries(avg);
  lastRows = rows;
  setStatus(`Analysis complete: <b>${name}</b> (${ok.length} locations averaged).`);
  renderSuspects(rows, name);
  updateAddressBar();
  openCase(0);
}

function setRegionOnMap(features, points) {
  if (!points.length || points.every(p => p.dir === "pending")) showMapLegend(null);
  map.getSource("region").setData({ type: "FeatureCollection", features });
  map.getSource("samples").setData({ type: "FeatureCollection", features: points.map(p => ({
    type: "Feature", properties: { dir: p.dir }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) });
}

function showLoading(name, total) {
  setStatus("");
  const el = document.getElementById("loading");
  const single = total === 1;
  el.innerHTML = `
    <div class="ld-title">Collecting NASA climate data</div>
    <div class="ld-place">${name}</div>
    ${single
      ? `<div class="ld-count">Retrieving 40+ years of records…</div>
         <div class="ld-bar"><div class="ld-indet"></div></div>
         <div class="ld-note">Usually takes a few seconds.</div>`
      : `<div class="ld-count"><span id="progCount">0</span> of ${total} locations <span id="progPct" class="ld-pct">0%</span></div>
         <div class="ld-bar"><div id="progBar" style="width:0%"></div></div>
         <div class="ld-note">Each location adds 40+ years of NASA records. Usually 5–20 seconds.</div>`}`;
  el.hidden = false;
}
function hideLoading() { document.getElementById("loading").hidden = true; }

function clearResults() {
  ["intro", "suspects", "caseFile", "verified"].forEach(id => document.getElementById(id).innerHTML = "");
}

// ---------- Rendering ----------
function setStatus(html) { document.getElementById("status").innerHTML = html; }

// Plain-language labels for how sure we are
function sureLabel(row) {
  if (row.ev.cls === "strong") return "Clear trend";
  if (row.ev.cls === "some") return "Possible trend";
  return "No clear trend";
}

// Values along the trend line at the start and end, and the total change
function trendNumbers(row) {
  const y0 = row.years[0], y1 = row.years[row.years.length - 1];
  const start = row.intercept + row.slope * y0, end = row.intercept + row.slope * y1;
  return { y0, y1, start, end, total: end - start };
}

// Short, precise phrase: "Warmed 5.0°F since 1981" / "Increased 6% since 1984"
function changePhrase(row) {
  const v = VARS[row.code], t = trendNumbers(row);
  if (v.kind === "temp") {
    const a = Math.abs(t.total);
    if (a < 0.1) return `Changed less than 0.1°F since ${t.y0}`;
    return `${t.total >= 0 ? "Warmed" : "Cooled"} ${a.toFixed(1)}°F since ${t.y0}`;
  }
  const pct = t.start !== 0 ? t.total / t.start * 100 : 0;
  if (Math.abs(pct) < 1) return `Changed less than 1% since ${t.y0}`;
  return `${pct >= 0 ? "Increased" : "Decreased"} ${Math.abs(pct).toFixed(0)}% since ${t.y0}`;
}
function perDecadeText(row) {
  const v = VARS[row.code];
  return `${row.perDecade >= 0 ? "+" : "−"}${Math.abs(row.perDecade).toFixed(v.digits)} ${v.units} per decade`;
}
function sincePhrase(row) { return changePhrase(row); }

function plainWords(row) {
  const v = VARS[row.code], t = trendNumbers(row);
  if (v.kind === "temp" || v.friendly)
    return `The trend line goes from about <b>${fmtVal(v, t.start)}</b> in ${t.y0} to about <b>${fmtVal(v, t.end)}</b> in ${t.y1} (${perDecadeText(row)}).`;
  const pct = t.start !== 0 ? t.total / t.start * 100 : 0;
  if (Math.abs(pct) < 1) return row.ev.cls === "none"
    ? `It has stayed almost the same since ${t.y0}.`
    : `It has changed by less than 1% since ${t.y0}. That's tiny, but it has moved steadily in one direction (${pct >= 0 ? "up" : "down"}).`;
  return `Compared with ${t.y0}, it is about <b>${Math.abs(pct).toFixed(0)}% ${pct >= 0 ? "higher" : "lower"}</b> in ${t.y1} (${perDecadeText(row)}).`;
}

function fmtVal(v, x) {
  return v.kind === "temp" ? `${x.toFixed(0)}°F` : `${x.toFixed(v.digits)} ${v.units}`;
}

function renderSuspects(rows, place) {
  const maxScore = Math.max(...rows.map(r => r.score), 0.01);
  const clear = rows.filter(r => r.ev.cls === "strong").length;
  document.getElementById("suspects").innerHTML = `
    <h2>What's changing: ${place}</h2>
    <p class="coords">${lastRegion ? lastCoords : lastCoords + " · NASA data area about 30 miles across"}</p>
    <p class="note">We tested 10 climate variables from ${START_YEAR} to ${END_YEAR}. <b>${clear} of ${rows.length}</b> show a clear trend.
      Ranked by how large the change is compared with normal year-to-year variation. <b>Select a row</b> for details.</p>
    <div class="toolbar">
      <button id="btnCsv" title="Download the yearly numbers behind these results">⬇ Download data (CSV)</button>
      <button id="btnLink" title="Copy a link that opens this exact analysis">🔗 Copy link to this result</button>
      <span id="toolMsg" class="note"></span>
    </div>
    <div class="suspect-head"><span></span><span>Variable</span><span title="Change compared with normal year-to-year ups and downs. Longest bar = biggest change in this list.">Size of change ⓘ</span><span>Trend</span></div>
    ${rows.map((r, i) => `
      <div class="suspect" tabindex="0" role="button" data-i="${i}">
        <span class="rank">${i + 1}</span>
        <div><div class="vname">${VARS[r.code].name}</div>
             <div class="vsub">${VARS[r.code].sub}</div>
             <div class="vchange">${changePhrase(r)}</div></div>
        <div class="bar" title="Size of change relative to normal year-to-year variation"><div style="width:${(r.score / maxScore * 100).toFixed(0)}%"></div></div>
        <span class="badge ${r.ev.cls}">${sureLabel(r)}</span>
      </div>`).join("")}`;
  document.getElementById("btnCsv").addEventListener("click", downloadCsv);
  document.getElementById("btnLink").addEventListener("click", copyLink);
  document.querySelectorAll(".suspect").forEach(el => {
    const open = () => openCase(parseInt(el.dataset.i));
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

function oneIn(p) {
  if (p < 0.001) return "less than 1 time in 1,000";
  const n = Math.round(1 / p);
  return n >= 2 ? `about 1 time in ${n.toLocaleString()}` : "very often";
}

function showMapLegend(row) {
  const el = document.getElementById("mapLegend");
  if (!row) { el.hidden = true; return; }
  const v = VARS[row.code];
  const upW = v.kind === "temp" ? "Warming" : "Rising", downW = v.kind === "temp" ? "Cooling" : "Falling";
  el.innerHTML = `<b>${v.name}</b> at each sample location:
    <span><i style="background:#d7301f"></i>${upW} (clear trend)</span>
    <span><i style="background:#2b6cb0"></i>${downW} (clear trend)</span>
    <span><i style="background:#9aa1ab"></i>No clear trend</span>`;
  el.hidden = false;
}

// For countries/continents: color each sample dot by its own trend and count them
function regionBreakdown(row) {
  const pts = lastRegion.perPoint[row.code] || [];
  const dirOf = p => p.p < 0.05 ? (p.perDecade >= 0 ? "up" : "down") : "flat";
  setRegionOnMap(lastRegion.features, pts.map(p => ({ lat: p.lat, lon: p.lon, dir: dirOf(p) })));
  showMapLegend(row);
  const up = pts.filter(p => dirOf(p) === "up").length, down = pts.filter(p => dirOf(p) === "down").length;
  const flat = pts.length - up - down, v = VARS[row.code];
  const upW = v.kind === "temp" ? "warming" : "rising", downW = v.kind === "temp" ? "cooling" : "falling";
  let note = "";
  if (up && down) note = ` <b>Opposite trends:</b> the same variable is ${upW} in some places and ${downW} in others, which an average can hide.`;
  return `<p><b>Across the region:</b> clear ${upW} at <b>${up}</b> of ${pts.length} locations, clear ${downW} at <b>${down}</b>, no clear trend at <b>${flat}</b>.${note}
    <span class="legend"><i style="background:#d7301f"></i>${upW} <i style="background:#2b6cb0"></i>${downW} <i style="background:#9aa1ab"></i>no clear trend</span></p>`;
}

function openCase(i) {
  const row = lastRows[i];
  if (!row) return;
  document.querySelectorAll(".suspect").forEach(el => el.classList.toggle("active", parseInt(el.dataset.i) === i));
  const v = VARS[row.code], t = trendNumbers(row);
  let headline, conf;
  if (row.ev.cls === "none") {
    headline = `<b class="nofound">No clear trend.</b> ${v.name} here has varied from year to year since ${t.y0}, but without a consistent direction.`;
    conf = `<b>Low confidence (${formatP(row.p)}).</b> The year-to-year ups and downs are larger than any overall change, so we cannot call this a real trend.`;
  } else {
    headline = `<b class="found">${row.ev.cls === "strong" ? "Clear trend." : "Possible trend."}</b> ${v.name} has <b>${changePhrase(row).replace(/^./, c => c.toLowerCase())}</b>.`;
    conf = row.ev.cls === "strong"
      ? `<b>High confidence (${formatP(row.p)}).</b> If there were no real trend, a pattern this consistent would appear ${oneIn(row.p)}.`
      : `<b>Moderate confidence (${formatP(row.p)}).</b> If there were no real trend, a pattern like this would appear ${oneIn(row.p)}. Because we test 10 variables at once, this could be a false alarm.`;
  }
  document.getElementById("caseFile").innerHTML = `
    <h2>${v.name}</h2>
    <p class="note" style="margin-top:-4px">${v.sub} · ${lastPlace} (${lastCoords})</p>
    <p class="verdict">${headline}</p>
    <div class="story">
      <p><b>Summary:</b> ${plainWords(row)}${lastRegion ? " This is the average across the whole region." : ""}</p>
      ${lastRegion ? regionBreakdown(row) : ""}
      <p><b>Confidence:</b> ${conf}</p>
      <p><b>Why it matters:</b> ${v.why}</p>
      <p><b>Definition:</b> ${v.def}</p>
    </div>
    <p class="note" style="margin-bottom:4px">Each dot is one year's average. The red line is the long-term trend (Sen's slope).</p>
    <canvas id="chart" height="220" aria-label="Chart of ${v.name} by year with trend line"></canvas>
    <details class="nerd"><summary>Method details</summary>
      Trend rate: ${perDecadeText(row)} (Sen's slope). Significance: Mann-Kendall test, ${formatP(row.p)} (Z = ${row.Z.toFixed(2)}).
      Data: NASA POWER yearly averages, ${t.y0}–${t.y1}, ${lastRegion ? `averaged over ${lastRegion.n} grid cells (~0.5° × 0.625° each) spread across the region` : "~0.5° × 0.625° MERRA-2 grid cell"}.
    </details>`;
  drawChart(row);
}

function drawChart(row) {
  const v = VARS[row.code];
  if (chart) chart.destroy();
  const x0 = row.years[0], x1 = row.years[row.years.length - 1];
  chart = new Chart(document.getElementById("chart"), {
    type: "scatter",
    data: {
      datasets: [
        { label: "Yearly average", data: row.years.map((y, k) => ({ x: y, y: row.vals[k] })),
          backgroundColor: "#2f6fd6", pointRadius: 3.5 },
        { label: "Long-term trend", type: "line", borderColor: "#e0453a", borderWidth: 2.5, pointRadius: 0,
          data: [{ x: x0, y: row.intercept + row.slope * x0 }, { x: x1, y: row.intercept + row.slope * x1 }] }
      ]
    },
    options: {
      animation: false,
      scales: {
        x: { type: "linear", title: { display: true, text: "Year" }, ticks: { callback: val => String(val) } },
        y: { title: { display: true, text: `${v.name} (${v.units})` } }
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: c => c.datasetIndex === 0 ? `${c.parsed.x}: ${c.parsed.y.toFixed(v.digits)} ${v.units}` : "Long-term trend" } }
      }
    }
  });
}

// ---------- Verified panel (Tampa only) ----------
function renderVerified(rows) {
  const find = code => rows.find(r => r.code === code);
  const yrs = NOAA_TAMPA.map(r => r.year);
  const noaa = key => analyzeSeries(yrs, NOAA_TAMPA.map(r => r[key]));
  const gYrs = GPM_TAMPA.map(r => r.year);
  const gpm = analyzeSeries(gYrs, GPM_TAMPA.map(r => r.inches));
  const noaaSame = NOAA_TAMPA.filter(r => r.year >= gYrs[0] && r.year <= gYrs[gYrs.length - 1]);
  const stationRainSame = analyzeSeries(noaaSame.map(r => r.year), noaaSame.map(r => r.prcp));

  const cell = (a, unit, d) => {
    if (!a) return "n/a";
    const lvl = evidenceLevel(a.p);
    const plain = lvl.cls === "strong" ? "Clear trend" : lvl.cls === "some" ? "Possible trend" : "No clear trend";
    return `${a.perDecade >= 0 ? "+" : "−"}${Math.abs(a.perDecade).toFixed(d)}${unit} per decade<br><span class="badge ${lvl.cls}">${plain}</span>`;
  };
  const agree = (a, b) => {
    if (!a || !b) return "";
    const sameDir = Math.sign(a.perDecade) === Math.sign(b.perDecade);
    const bothSig = a.p < 0.05 && b.p < 0.05, bothNot = a.p >= 0.05 && b.p >= 0.05;
    if (sameDir && (bothSig || bothNot)) return `<span class="ok">✓ Agree</span>`;
    if (sameDir) return `<span class="warn">Same direction</span>`;
    return `<span class="err">Disagree</span>`;
  };
  const lines = [
    { label: "Nighttime low temperature", nasa: find("T2M_MIN"), station: noaa("tmin"), u: "°F", d: 1 },
    { label: "Daytime high temperature", nasa: find("T2M_MAX"), station: noaa("tmax"), u: "°F", d: 1 },
    { label: "Mean air temperature", nasa: find("T2M"), station: noaa("tavg"), u: "°F", d: 1 },
    { label: "Annual precipitation", nasa: find("PRECTOTCORR"), station: noaa("prcp"), u: " in", d: 1 }
  ];

  const nightN = find("T2M_MIN"), dayN = find("T2M_MAX"), nightS = noaa("tmin"), dayS = noaa("tmax");
  const ratioN = nightN && dayN && dayN.perDecade ? nightN.perDecade / dayN.perDecade : null;
  const ratioS = nightS.perDecade / dayS.perDecade;
  const nightsFaster = ratioN && ratioN > 1 && ratioS > 1 && nightN.p < 0.05 && nightS.p < 0.05;
  const keyFinding = nightsFaster
    ? `<p class="verdict" style="font-size:15px"><b class="found">Key finding:</b> In Tampa, <b>nights are warming about twice as fast as days</b>, and both the NASA estimate and the NOAA station show it. The station warms somewhat faster overall, likely due to the urban heat island effect (cities retain heat), while NASA's area also includes rural land and water.</p>`
    : `<p class="note">NASA's area-wide estimate and a single airport thermometer measure things a bit differently, so small differences are normal.</p>`;

  document.getElementById("verified").innerHTML = `
    <h2>Validation against independent measurements</h2>
    <p class="note">NASA POWER values are model estimates for an area about 30 miles across. To check them, we compared the same trends with <b>direct measurements from the NOAA weather station at Tampa International Airport</b>, and with rainfall measured from space by NASA's GPM satellite mission.</p>
    <table class="check">
      <tr><th>Variable</th><th>NASA POWER</th><th>NOAA station</th><th>Agreement</th></tr>
      ${lines.map(l => `<tr><td>${l.label}</td><td>${cell(l.nasa, l.u, l.d)}</td><td>${cell(l.station, l.u, l.d)}</td><td>${agree(l.nasa, l.station)}</td></tr>`).join("")}
      <tr><td>Annual precipitation (satellite)<br><span class="note">NASA GPM satellite, 2001–2024</span></td><td>${cell(gpm, " in", 1)}</td><td>${cell(stationRainSame, " in", 1)}<br><span class="note">same years</span></td><td>${agree(gpm, stationRainSame)}</td></tr>
    </table>
    ${keyFinding}`;
}

// ---------- Resize bar between map and results ----------
function initDivider() {
  const main = document.querySelector("main"), bar = document.getElementById("divider");
  let saved = null;
  try { saved = localStorage.getItem("cd_split"); } catch (e) {}
  const setLeft = pct => {
    pct = Math.min(80, Math.max(25, pct));
    main.style.setProperty("--left", pct + "%");
    bar.setAttribute("aria-valuenow", Math.round(pct));
    try { localStorage.setItem("cd_split", pct); } catch (e) {}
    if (map) map.resize();
    if (chart) chart.resize();
  };
  if (saved) setLeft(parseFloat(saved));
  bar.addEventListener("pointerdown", e => {
    bar.setPointerCapture(e.pointerId); bar.classList.add("dragging");
    const rect = main.getBoundingClientRect();
    const move = ev => setLeft((ev.clientX - rect.left) / rect.width * 100);
    const up = () => { bar.classList.remove("dragging"); bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
  });
  bar.addEventListener("keydown", e => {
    const cur = parseFloat(getComputedStyle(main).getPropertyValue("--left")) || 55;
    if (e.key === "ArrowLeft") { setLeft(cur - 5); e.preventDefault(); }
    if (e.key === "ArrowRight") { setLeft(cur + 5); e.preventDefault(); }
  });
}

// ---------- Download data (CSV) ----------
function csvCell(v) { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
function downloadCsv() {
  if (!lastRows.length) return;
  const years = [...new Set(lastRows.flatMap(r => r.years))].sort((a, b) => a - b);
  const lines = [];
  lines.push(["# Climate Detective export"].map(csvCell).join(","));
  lines.push(["# Place", lastPlace].map(csvCell).join(","));
  lines.push(["# Location", lastCoords].map(csvCell).join(","));
  lines.push(["# Source", "NASA POWER monthly API (MERRA-2 / CERES), yearly averages; trends by Sen's slope + Mann-Kendall"].map(csvCell).join(","));
  lines.push("");
  lines.push(["Variable", "Units", "Trend", "Change per decade", "p-value", "First year", "Last year"].map(csvCell).join(","));
  for (const r of lastRows) {
    const v = VARS[r.code];
    lines.push([v.name, v.units, sureLabel(r), r.perDecade.toFixed(4), r.p.toExponential(3), r.years[0], r.years[r.years.length - 1]].map(csvCell).join(","));
  }
  lines.push("");
  lines.push(["Year", ...lastRows.map(r => `${VARS[r.code].name} (${VARS[r.code].units})`)].map(csvCell).join(","));
  for (const y of years) {
    lines.push([y, ...lastRows.map(r => { const k = r.years.indexOf(y); return k >= 0 ? r.vals[k].toFixed(3) : ""; })].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "climate-detective_" + lastPlace.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toolMsg("Downloaded.");
}

// ---------- Share links ----------
function linkFor(q) {
  const u = new URL(location.href.split("?")[0].split("#")[0]);
  for (const [k, v] of Object.entries(q)) if (v !== null && v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}
function updateAddressBar() {
  if (!lastQuery) return;
  try { history.replaceState(null, "", linkFor(lastQuery)); } catch (e) { /* some browsers block this for local files */ }
}
async function copyLink() {
  const link = linkFor(lastQuery || {});
  try { await navigator.clipboard.writeText(link); toolMsg("Link copied!"); }
  catch (e) { window.prompt("Copy this link:", link); }
}
function toolMsg(t) { const el = document.getElementById("toolMsg"); if (el) { el.textContent = t; setTimeout(() => { if (el) el.textContent = ""; }, 2500); } }

// Open an analysis straight from a link like ?lat=27.95&lon=-82.46 or ?country=Brazil or ?continent=Africa
function openFromLink() {
  const q = new URLSearchParams(location.search);
  if (q.has("lat") && q.has("lon")) {
    setMode("point");
    investigate(parseFloat(q.get("lat")), parseFloat(q.get("lon")), q.get("name"));
  } else if (q.has("country")) {
    const f = GEO_COUNTRIES.features.find(x => x.properties.n.toLowerCase() === q.get("country").toLowerCase());
    if (f) { setMode("country"); investigateRegion([f], f.properties.n, 16, "country"); }
  } else if (q.has("continent")) {
    const c = q.get("continent");
    const fs = GEO_COUNTRIES.features.filter(x => x.properties.c.toLowerCase() === c.toLowerCase());
    if (fs.length) { setMode("continent"); investigateRegion(fs, fs[0].properties.c, 30, "continent"); }
  }
}

initMap();
initDivider();
map.on("load", openFromLink);
