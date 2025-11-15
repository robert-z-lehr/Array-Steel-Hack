//------------------------------------------------------------
// ARRAY STEEL COST–CARBON DECISION TOOL (FULL GAPMINDER VERSION)
//------------------------------------------------------------
// Features implemented:
// ✔ Temporal animation (Gapminder-style)
// ✔ Play/Pause timeline
// ✔ Bubble size per year
// ✔ Click-to-highlight region & fade others
// ✔ Trails (ghost bubbles from past years)
// ✔ Connecting lines (one per region)
// ✔ Sliders update ALL years and ALL frames
//------------------------------------------------------------

// ============================================================
// 0. GLOBAL STATE — the slider values and year choice
// ============================================================

const state = {
  tariff: 10,          // % tariff on imports
  shipping: 60,        // USD/ton shipping for overseas steel
  incentive: 40,       // IRA domestic incentive USD/ton
  carbonPrice: 75,     // $/t CO2 used for carbon-adjusted cost (for info panels)
  highlightedRegion: null // which region is selected, null = none
};

// Regions categorized for logic
const domesticRegions = ["US"];
const overseasRegions = ["EU", "Australia", "Brazil", "China", "South Africa"];

// ============================================================
// 1. BASE DATASET — stylized but editable by non-coders
// ============================================================
//
// baseData is filled with entries like:
// {
//   region: "US",
//   method: "EAF",
//   year: 2024,
//   baseCost: 950,
//   baseCo2: 380,
//   volume: 60000
// }
//
// YOU CAN EDIT THESE values or replace this entire block with CSV loading.

const baseData = [];

(function generateBaseData() {
  const regions = ["US", "EU", "Australia", "Brazil", "China", "South Africa"];

  const methods = {
    US: "EAF",
    EU: "BF-BOF",
    Australia: "EAF",
    Brazil: "EAF",
    China: "BF-BOF",
    "South Africa": "BF-BOF"
  };

  const baseCost0 = {
    US: 950,
    EU: 1000,
    Australia: 900,
    Brazil: 760,
    China: 680,
    "South Africa": 830
  };

  const baseCo20 = {
    US: 380,
    EU: 1850,
    Australia: 420,
    Brazil: 440,
    China: 2100,
    "South Africa": 1750
  };

  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  // Generate modest trends over years
  for (const region of regions) {
    const method = methods[region];
    const costStart = baseCost0[region];
    const co2Start = baseCo20[region];

    for (let i = 0; i < years.length; i++) {
      const yr = years[i];
      const isEAF = method === "EAF";

      // Stylized cost trend (EAF cheaper over time, BF-BOF modest)
      const costTrend = isEAF ? -10 * i : 5 * i;
      const costNoise = (Math.random() - 0.5) * 40;

      // Stylized emissions improvements
      const co2Trend = isEAF ? -15 * i : -5 * i;
      const co2Noise = (Math.random() - 0.5) * 80;

      // Stylized volumes
      const volume = 50000 + Math.random() * 40000;

      baseData.push({
        region,
        method,
        year: yr,
        baseCost: costStart + costTrend + costNoise,
        baseCo2: co2Start + co2Trend + co2Noise,
        volume
      });
    }
  }
})();

// ============================================================
// 2. Compute scenario-adjusted values for ALL YEARS
// ============================================================

function computeScenario() {
  const data = [];

  for (const d of baseData) {
    const isDomestic = domesticRegions.includes(d.region);
    const isOverseas = overseasRegions.includes(d.region);

    const tariffAdj = isDomestic ? 0 : (state.tariff / 100) * d.baseCost;
    const shippingAdj = isOverseas ? state.shipping : 0;
    const incentiveAdj = isDomestic ? state.incentive : 0;

    const deliveredCost =
      d.baseCost + tariffAdj + shippingAdj - incentiveAdj;

    const carbonAdjustedCost =
      deliveredCost + (d.baseCo2 / 1000) * state.carbonPrice;

    data.push({
      ...d,
      deliveredCost,
      carbonAdjustedCost,
      bubbleSize: Math.max(10, Math.sqrt(d.volume) / 25)
    });
  }

  return data;
}

// ============================================================
// 3. Build animation frames for Plotly
// ============================================================

function buildFrames(allData) {
  const frames = [];
  const years = [...new Set(allData.map(d => d.year))];

  for (const year of years) {
    const frameData = allData.filter(d => d.year === year);

    frames.push({
      name: String(year),
      data: [{
        x: frameData.map(d => d.deliveredCost),
        y: frameData.map(d => d.baseCo2),
        text: frameData.map(d =>
          `${d.region} (${d.method})<br>` +
          `Year: ${d.year}<br>` +
          `Delivered: $${d.deliveredCost.toFixed(0)}<br>` +
          `CO₂: ${d.baseCo2.toFixed(0)} kg<br>` +
          `Volume: ${d.volume.toFixed(0)} t`
        ),
        marker: {
          size: frameData.map(d => d.bubbleSize),
          color: frameData.map(d => regionColor(d.region)),
          opacity: frameData.map(d => regionOpacity(d.region))
        }
      }]
    });
  }

  return frames;
}

// ============================================================
// 4. Build trail traces and connecting lines (static)
// ============================================================

function buildTrails(allData) {
  const regions = [...new Set(allData.map(d => d.region))];
  const trails = [];

  for (const region of regions) {
    const regionData = allData.filter(d => d.region === region);
    regionData.sort((a, b) => a.year - b.year);

    const xs = regionData.map(d => d.deliveredCost);
    const ys = regionData.map(d => d.baseCo2);

    // Ghost bubbles (semi-transparent)
    trails.push({
      x: xs,
      y: ys,
      mode: "markers",
      marker: {
        size: regionData.map(d => d.bubbleSize),
        color: regionColor(region),
        opacity: 0.15
      },
      hoverinfo: "skip",
      showlegend: false
    });

    // Connecting lines
    trails.push({
      x: xs,
      y: ys,
      mode: "lines",
      line: {
        width: 1.5,
        color: regionColor(region)
      },
      opacity: 0.3,
      hoverinfo: "skip",
      showlegend: false
    });
  }

  return trails;
}

// ============================================================
// 5. Region color and opacity logic
// ============================================================

function regionColor(region) {
  const map = {
    US: "#1f77b4",
    EU: "#ff7f0e",
    Australia: "#2ca02c",
    Brazil: "#17becf",
    China: "#d62728",
    "South Africa": "#9467bd"
  };
  return map[region] || "#7f7f7f";
}

function regionOpacity(region) {
  if (state.highlightedRegion === null) return 1.0;
  return region === state.highlightedRegion ? 1.0 : 0.15;
}

// ============================================================
// 6. Plotly initialization
// ============================================================

function initChart() {
  const scenario = computeScenario();
  const years = [...new Set(scenario.map(d => d.year))];
  const initYear = years[0];
  const initData = scenario.filter(d => d.year === initYear);

  const trails = buildTrails(scenario);
  const frames = buildFrames(scenario);

  const mainBubbleTrace = {
    x: initData.map(d => d.deliveredCost),
    y: initData.map(d => d.baseCo2),
    mode: "markers",
    type: "scatter",
    text: initData.map(d =>
      `${d.region} (${d.method})<br>Delivered: $${d.deliveredCost.toFixed(0)}<br>CO₂: ${d.baseCo2.toFixed(0)}`
    ),
    marker: {
      size: initData.map(d => d.bubbleSize),
      color: initData.map(d => regionColor(d.region)),
      opacity: initData.map(d => regionOpacity(d.region))
    }
  };

  const layout = {
    title: "Steel Cost vs Carbon (Interactive Gapminder-Style)",
    xaxis: { title: "Delivered Cost (USD/ton)" },
    yaxis: { title: "CO₂ Intensity (kg/ton steel)" },
    hovermode: "closest",
    updatemenus: [{
      type: "buttons",
      showactive: false,
      x: 0.05,
      y: 1.15,
      buttons: [{
        label: "Play",
        method: "animate",
        args: [null, {fromcurrent: true, frame: {duration: 800, redraw: true}}]
      },{
        label: "Pause",
        method: "animate",
        args: [[null], {mode: "immediate"}]
      }]
    }],
    sliders: [{
      active: 0,
      steps: years.map(yr => ({
        label: yr,
        method: "animate",
        args: [[String(yr)], {mode: "immediate", frame: {duration: 0, redraw: true}}]
      }))
    }]
  };

  Plotly.newPlot("chart", [...trails, mainBubbleTrace], layout).then(chart => {
    chart.on("plotly_click", e => {
      const idx = e.points[0].pointIndex;
      const region = scenario.filter(d => d.year === initYear)[idx].region;

      if (state.highlightedRegion === region) {
        state.highlightedRegion = null;
      } else {
        state.highlightedRegion = region;
      }

      updateChart();
    });
  });

  Plotly.addFrames("chart", frames);
}

// ============================================================
// 7. Update chart after sliders or highlight change
// ============================================================

function updateChart() {
  const scenario = computeScenario();
  const frames = buildFrames(scenario);
  const trails = buildTrails(scenario);

  // Reinitialize plot
  Plotly.react("chart", [...trails, frames[0].data[0]], {
    title: "Steel Cost vs Carbon (Interactive Gapminder-Style)"
  });
  Plotly.addFrames("chart", frames);
}

// ============================================================
// 8. Link sliders to state changes
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initChart();

  const tariffSlider = document.getElementById("tariffSlider");
  const shippingSlider = document.getElementById("shippingSlider");
  const iraSlider = document.getElementById("iraSlider");
  const carbonSlider = document.getElementById("carbonPriceSlider");

  tariffSlider.oninput = () => {
    state.tariff = Number(tariffSlider.value);
    updateChart();
  };
  shippingSlider.oninput = () => {
    state.shipping = Number(shippingSlider.value);
    updateChart();
  };
  iraSlider.oninput = () => {
    state.incentive = Number(iraSlider.value);
    updateChart();
  };
  carbonSlider.oninput = () => {
    state.carbonPrice = Number(carbonSlider.value);
    updateChart();
  };
});
