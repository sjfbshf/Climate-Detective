// Climate Detective - statistics
// Mann-Kendall trend test + Sen's slope (standard non-parametric trend methods).

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Sen's slope: median of all pairwise slopes (units per year)
function senSlope(x, y) {
  const slopes = [];
  for (let i = 0; i < y.length; i++)
    for (let j = i + 1; j < y.length; j++)
      slopes.push((y[j] - y[i]) / (x[j] - x[i]));
  return median(slopes);
}

// Line through the data with Sen's slope (intercept = median of y - slope*x)
function senIntercept(x, y, slope) {
  return median(y.map((v, i) => v - slope * x[i]));
}

// Normal CDF (Abramowitz-Stegun 7.1.26 erf approximation)
function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

// Mann-Kendall test with tie correction. Returns S, Z, two-sided p-value.
function mannKendall(y) {
  const n = y.length;
  let S = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++)
      S += Math.sign(y[j] - y[i]);
  const counts = {};
  y.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  let tieSum = 0;
  Object.values(counts).forEach(t => { if (t > 1) tieSum += t * (t - 1) * (2 * t + 5); });
  const varS = (n * (n - 1) * (2 * n + 5) - tieSum) / 18;
  let Z = 0;
  if (S > 0) Z = (S - 1) / Math.sqrt(varS);
  else if (S < 0) Z = (S + 1) / Math.sqrt(varS);
  const p = 2 * (1 - normCdf(Math.abs(Z)));
  return { S, Z, p };
}

function stdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length - 1));
}

// Full analysis of one yearly series
function analyzeSeries(years, vals) {
  const slope = senSlope(years, vals);
  const intercept = senIntercept(years, vals, slope);
  const mk = mannKendall(vals);
  // "Normal year-to-year swing" = spread of the values around the trend line
  const resid = vals.map((v, i) => v - (intercept + slope * years[i]));
  const swing = stdDev(resid);
  return {
    slope, intercept, p: mk.p, Z: mk.Z,
    perDecade: slope * 10,
    score: swing > 0 ? Math.abs(slope * 10) / swing : 0  // unit-free size of change
  };
}

function evidenceLevel(p) {
  if (p < 0.01) return { label: "Strong evidence", cls: "strong" };
  if (p < 0.05) return { label: "Some evidence", cls: "some" };
  return { label: "No clear trend", cls: "none" };
}

function formatP(p) {
  if (p < 0.001) return "p < 0.001";
  return "p = " + p.toFixed(3);
}

if (typeof module !== "undefined") module.exports = { median, senSlope, senIntercept, normCdf, mannKendall, stdDev, analyzeSeries, evidenceLevel, formatP };
