# Climate Detective

Live app: https://sjfbshf.github.io/Climate-Detective/

**NASA Space Apps Challenge 2026: "Be An Earth System Trend Detective!"**

Click anywhere on Earth. Climate Detective checks 10 NASA climate variables for that spot, tests each one for a real trend, and ranks the "suspects": the variables that are actually changing. Click a suspect to open its case file: a chart, a trend line, and a plain-English verdict.

## The problem it solves
NASA offers thousands of Earth science variables. It's hard to know which ones are changing in a given place. Instead of making you pick one variable and hope, Climate Detective scans many at once and tells you which ones show real evidence of change.

## How it works
1. **Pick a place.** Click the map or a demo case. The blue box shows the ~50 km area NASA's data covers (the MERRA-2 grid cell).
2. **Get data.** One request to the NASA POWER API pulls monthly data for 10 variables, 1981 to the last complete year.
3. **Remove the seasons.** We use one value per year (yearly averages or totals, and for the coldest-night and hottest-day variables, that year's extreme), so summer/winter cycles don't hide the trend.
4. **Test each variable.**
   - **Sen's slope:** how fast it's changing (per decade).
   - **Mann-Kendall test:** whether the change is a real trend or could be random chance.
5. **Rank the suspects.** We rank by the size of the change compared with normal year-to-year ups and downs, so variables with different units can be compared fairly.
6. **Verify (Tampa).** We compare NASA's results with NOAA's Tampa International Airport weather station and with NASA GPM satellite rainfall.

## Country and continent mode
Switch "Analyze" to **A country** or **A continent** and click the map. The app spreads up to 16 (country) or 30 (continent) evenly spaced sample locations across the region, pulls NASA POWER data for each, averages them, and runs the same trend tests. Opening a result colors every sample location on the map by its own trend (red = rising, blue = falling, gray = no clear trend), so you can see when the **same variable trends in opposite directions in different parts of a region**, exactly what the challenge describes.

## How to run
Open `index.html` in Chrome, Edge, or Brave, or visit the hosted version. An internet connection is needed only to fetch NASA POWER data.

## Key finding
**At Tampa's NOAA airport station, average nighttime lows are warming about 2.2× as fast as daytime highs. NASA POWER shows the same direction: Tampa's coldest night of the year has warmed about 5°F since 1981.**

## Honest limits
- We run 10 tests at once, so a “Possible trend” result could occasionally be a false alarm.
- A trend shows *what* changed, not *why*.
- NASA POWER describes a ~50 km area, not a single street.
- Year-to-year climate values can run in streaks (autocorrelation), which can make trend tests look somewhat more certain than they are.
- Only complete years are used.

## Features
- **Three ways to analyze:** a single location (~30-mile grid cell), a whole country (up to 16 sample locations averaged), or a whole continent (up to 30).
- **Ranked results** in plain language: "Warmed 5.1°F since 1981 · Clear trend."
- **Detail view** for each variable: chart with trend line, plain summary, confidence, why it matters, and method details.
- **Regional map dots** colored by each location's own trend, which reveals opposite trends inside one region.
- **Validation** of NASA POWER trends against the NOAA Tampa International Airport station and NASA GPM satellite rainfall.
- **Download data (CSV)** with every yearly value and trend statistic, so anyone can check the work.
- **Share links** that reopen an exact analysis, e.g. `?lat=27.95&lon=-82.46`, `?country=Brazil`, `?continent=Africa`.
- **Works offline** except for NASA's data: the map is drawn from built-in Natural Earth data and all libraries are included.

## Built with
HTML, CSS, JavaScript. No backend.
- **MapLibre GL JS** (BSD-3-Clause): GPU-rendered map
- **Chart.js** (MIT): charts

## Data sources
- **NASA POWER** (Prediction Of Worldwide Energy Resources), NASA Langley Research Center. Monthly point API. Meteorology from NASA GMAO **MERRA-2**; solar from NASA **CERES**. https://power.larc.nasa.gov/
- **NASA GPM IMERG Final Run, monthly (GPM_3IMERGM v07)**, accessed via **NASA Giovanni** (GES DISC), area-averaged over -82.8, 27.6, -82.1, 28.2. https://giovanni.gsfc.nasa.gov/
- **NOAA NCEI Climate Data Online**, Global Summary of the Year, Tampa International Airport, FL (GHCND:USW00012842). https://www.ncei.noaa.gov/cdo-web/
- **NOAA National Weather Service NOWData** (ThreadEx), Tampa Area monthly mean temperature (used to cross-check).
- Map outlines and place names: Natural Earth (public domain), naturalearthdata.com. Drawn locally so the map works offline.

## Methods references
- Mann, H. B. (1945). Nonparametric tests against trend. *Econometrica*, 13, 245–259.
- Kendall, M. G. (1975). *Rank Correlation Methods*. Griffin, London.
- Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. *JASA*, 63, 1379–1389.
- NASA NTRS 20090042747: Time-Series Analysis of Remotely-Sensed SeaWiFS Chlorophyll in River-Influenced Coastal Regions (challenge resource).
- "Statistical test methods to detect trends in time series data" (Medium) and "A Comprehensive Guide to Statistical Significance" (Statsig) (challenge resources).

## AI use
Code (JavaScript, HTML, CSS) was written with Super Intelligence (SI) assistance from Claude by Anthropic. Project idea, data collection, validation, testing, and design decisions by the team “Into the Space”.


## License
Apache 2.0
