// ===============================
// 0. Basic setup and global state
// ===============================

// Global state holds the current slider values and selected year.
const state = {
  year: 2024,
  tariffPercent: 10,      // % tariff on imported steel
  shippingCost: 60,       // extra USD/ton for overseas steel
  iraIncentive: 40,       // USD/ton benefit for domestic (US) steel
  carbonPrice: 75         // USD per ton of CO2
};

// Regions treated as "domestic" for IRA-style incentive.
// This can be changed later if the definition changes.
const domesticRegions = ["US"];

// Regions considered "overseas" and receive full shipping cost.
// You can adjust this logic later if you wish.
const overseasRegions = ["EU", "Australia", "Brazil", "China", "South Africa"];

// ========================================
// 1. Stylized dataset (editable by company)
// ========================================
//
// Each row describes steel from one region and method in one year.
// All numbers here are placeholders and can be replaced with real data.
// Fields:
// - region: name of region
// - method: "EAF" or "BF-BOF"
// - year: calendar year
// - baseCost: base steel price in USD per ton (before tariffs, shipping, etc.)
// - baseCo2: kg CO2 per ton of steel (embodied emissions)
// - volume: available or planned volume in tons (used for bubble size)

const baseData = [];

(function buildBaseData() {
  const regions = ["US", "EU", "Australia", "Brazil", "China", "South Africa"];

  const methods = {
    US: "EAF",
    EU: "BF-BOF",
    Australia: "EAF",
    Brazil: "EAF",
    China: "BF-BOF",
    South_Africa: "BF-BOF"
  };

  const baseCost = {
    US: 950,
    EU: 1000,
    Australia: 900,
    Brazil: 760,
    China: 680,
    South_Africa: 830
  };

  const baseCo2 = {
    US: 380,
    EU: 1850,
    Australia: 420,
    Brazil: 440,
    China: 2100,
    South_Africa: 1750
  };

  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  // Simple trend assumptions:
  // - EAF emissions steadily improve
  // - BF-BOF emissions improve slower
  // - Costs move up/down modestly with noise
  // These are placeholder assumptions and can be replaced with actual forecasts.
  for (const region of regions) {
    const method = region === "South Africa" ? methods.South_Africa : methods[region];
    let cost = baseCost[region === "South Africa" ? "South_Africa" : region];
    let co2 = baseCo2[region === "South Africa" ? "South_Africa" : region];
    let volume = 50000 + Math.floor(Math.random() * 30000); // rough scale

    years.forEach((year, idx) => {
      const isEAF = method === "EAF";

      const costNoise = (Math.random() - 0.5) * 50;
      const trendCost = isEAF ? -10 * idx : 5 * idx;
      const thisYearCost = cost + costNoise + trendCost;

      const improvement = isEAF ? 12 : 20;
      const thisYearCo2 = co2 - improvement * idx + (Math.random() - 0.5) * 40;

      baseData.push({
        region,
        method,
        year,
        baseCost: Number(thisYearCost.toFixed(1)),
        baseCo2: Number(thisYearCo2.toFixed(1)),
        volume: volume + (Math.random() - 0.5) * 8000
      });
    });
  }
})();

// ============================================
// 2. Functions to compute scenario adjustments
// ============================================

// This function takes the base data and returns a new list of points for the
// current year and slider settings.
function computeScenarioData() {
  const { year, tariffPercent, shippingCost, iraIncentive, carbonPrice } = state;

  // Filter to the selected year
  const yearData = baseData.filter(d => d.year === year);

  // For each row, compute delivered cost and carbon-adjusted cost
  return yearData.map(d => {
    const isDomestic = domesticRegions.includes(d.region);
    const isOverseas = overseasRegions.includes(d.region);

    // Tariff is applied to overseas/imported regions only
    const tariffMultiplier = isDomestic ? 0 : tariffPercent / 100;

    // Shipping cost is applied to overseas regions
    const shipping = isOverseas ? shippingCost : 0;

    // IRA incentive lowers cost for domestic regions (US by default)
    const incentive = isDomestic ? iraIncentive : 0;

    const deliveredCost =
      d.baseCost * (1 + tariffMultiplier) + shipping - incentive;

    // Carbon-adjusted cost: put a monetary value on CO2
    const carbonCost = (d.baseCo2 / 1000) * carbonPrice;
    const carbonAdjustedCost = deliveredCost + carbonCost;

    return {
      ...d,
      deliveredCost,
      carbonAdjustedCost
    };
  });
}

// ====================================================
// 3. Plotly chart: create once, then update on changes
// ====================================================

function initChart() {
  const data = computeScenarioData();

  const trace = {
    x: data.map(d => d.deliveredCost),
    y: data.map(d => d.baseCo2),
    mode: "markers",
    type: "scatter",
    text: data.map(
      d =>
        `${d.region} (${d.method})<br>` +
        `Delivered cost: $${d.deliveredCost.toFixed(0)}/t<br>` +
        `CO₂: ${d.baseCo2.toFixed(0)} kg/t<br>` +
        `Volume: ${d.volume.toFixed(0)} t<br>` +
        `Carbon-adjusted cost: $${d.carbonAdjustedCost.toFixed(0)}/t`
    ),
    hoverinfo: "text",
    marker: {
      size: data.map(d => Math.max(10, Math.sqrt(Math.abs(d.volume)) / 30)),
      sizemode: "area",
      sizeref: 2.0 * Math.max(...data.map(d => Math.sqrt(Math.abs(d.volume)) / 30)) / (60 ** 2),
      color: data.map(d => regionColor(d.region)),
      opacity: 0.8
    }
  };

  const layout = {
    title: `Steel Cost vs Carbon Intensity – Scenario for Year ${state.year}`,
    xaxis: {
      title: "Delivered Steel Cost (USD per ton)",
      zeroline: false
    },
    yaxis: {
      title: "Carbon Intensity (kg CO₂ per ton of steel)",
      zeroline: false
    },
    margin: { t: 60, r: 20, b: 60, l: 70 },
    showlegend: false
  };

  Plotly.newPlot("chart", [trace], layout, { responsive: true });
}

// Update the chart when sliders or year change
function updateChart() {
  const data = computeScenarioData();
  const x = data.map(d => d.deliveredCost);
  const y = data.map(d => d.baseCo2);
  const sizes = data.map(d => Math.max(10, Math.sqrt(Math.abs(d.volume)) / 30));
  const colors = data.map(d => regionColor(d.region));
  const texts = data.map(
    d =>
      `${d.region} (${d.method})<br>` +
      `Delivered cost: $${d.deliveredCost.toFixed(0)}/t<br>` +
      `CO₂: ${d.baseCo2.toFixed(0)} kg/t<br>` +
      `Volume: ${d.volume.toFixed(0)} t<br>` +
      `Carbon-adjusted cost: $${d.carbonAdjustedCost.toFixed(0)}/t`
  );

  const update = {
    x: [x],
    y: [y],
    text: [texts],
    "marker.size": [sizes],
    "marker.color": [colors]
  };

  const layoutUpdate = {
    title: `Steel Cost vs Carbon Intensity – Scenario for Year ${state.year}`
  };

  Plotly.update("chart", update, layoutUpdate);
}

// Simple color mapping for regions
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

// ============================================
// 4. Summary panel: US vs China comparison
// ============================================

function updateSummaryPanel() {
  const data = computeScenarioData();
  const us = data.find(d => d.region === "US");
  const cn = data.find(d => d.region === "China");

  const usCostCell = document.getElementById("usCostCell");
  const cnCostCell = document.getElementById("cnCostCell");
  const costDiffCell = document.getElementById("costDiffCell");

  const usCo2Cell = document.getElementById("usCo2Cell");
  const cnCo2Cell = document.getElementById("cnCo2Cell");
  const co2DiffCell = document.getElementById("co2DiffCell");

  const usAdjCostCell = document.getElementById("usAdjCostCell");
  const cnAdjCostCell = document.getElementById("cnAdjCostCell");
  const adjCostDiffCell = document.getElementById("adjCostDiffCell");

  if (!us || !cn) {
    usCostCell.textContent = cnCostCell.textContent = costDiffCell.textContent = "N/A";
    usCo2Cell.textContent = cnCo2Cell.textContent = co2DiffCell.textContent = "N/A";
    usAdjCostCell.textContent = cnAdjCostCell.textContent = adjCostDiffCell.textContent = "N/A";
    return;
  }

  const costDiff = us.deliveredCost - cn.deliveredCost;
  const co2Diff = us.baseCo2 - cn.baseCo2;
  const adjCostDiff = us.carbonAdjustedCost - cn.carbonAdjustedCost;

  usCostCell.textContent = `$${us.deliveredCost.toFixed(0)}`;
  cnCostCell.textContent = `$${cn.deliveredCost.toFixed(0)}`;
  costDiffCell.textContent = formatDiff(costDiff);

  usCo2Cell.textContent = `${us.baseCo2.toFixed(0)} kg`;
  cnCo2Cell.textContent = `${cn.baseCo2.toFixed(0)} kg`;
  co2DiffCell.textContent = formatDiff(co2Diff, "kg");

  usAdjCostCell.textContent = `$${us.carbonAdjustedCost.toFixed(0)}`;
  cnAdjCostCell.textContent = `$${cn.carbonAdjustedCost.toFixed(0)}`;
  adjCostDiffCell.textContent = formatDiff(adjCostDiff);
}

function formatDiff(value, unit = "USD") {
  const sign = value > 0 ? "+" : "";
  if (unit === "USD") {
    return `${sign}$${value.toFixed(0)}`;
  }
  return `${sign}${value.toFixed(0)} ${unit}`;
}

// =====================================
// 5. Hook up sliders and preset buttons
// =====================================

function initControls() {
  const yearSlider = document.getElementById("yearSlider");
  const yearValue = document.getElementById("yearValue");
  yearValue.textContent = state.year;
  yearSlider.addEventListener("input", e => {
    state.year = Number(e.target.value);
    yearValue.textContent = state.year;
    onStateChange();
  });

  const tariffSlider = document.getElementById("tariffSlider");
  const tariffValue = document.getElementById("tariffValue");
  tariffValue.textContent = `${state.tariffPercent}%`;
  tariffSlider.addEventListener("input", e => {
    state.tariffPercent = Number(e.target.value);
    tariffValue.textContent = `${state.tariffPercent}%`;
    onStateChange();
  });

  const shippingSlider = document.getElementById("shippingSlider");
  const shippingValue = document.getElementById("shippingValue");
  shippingValue.textContent = `$${state.shippingCost}/t`;
  shippingSlider.addEventListener("input", e => {
    state.shippingCost = Number(e.target.value);
    shippingValue.textContent = `$${state.shippingCost}/t`;
    onStateChange();
  });

  const iraSlider = document.getElementById("iraSlider");
  const iraValue = document.getElementById("iraValue");
  iraValue.textContent = `$${state.iraIncentive}/t`;
  iraSlider.addEventListener("input", e => {
    state.iraIncentive = Number(e.target.value);
    iraValue.textContent = `$${state.iraIncentive}/t`;
    onStateChange();
  });

  const carbonPriceSlider = document.getElementById("carbonPriceSlider");
  const carbonPriceValue = document.getElementById("carbonPriceValue");
  carbonPriceValue.textContent = `$${state.carbonPrice}/t CO₂`;
  carbonPriceSlider.addEventListener("input", e => {
    state.carbonPrice = Number(e.target.value);
    carbonPriceValue.textContent = `$${state.carbonPrice}/t CO₂`;
    onStateChange();
  });

  // Scenario preset buttons
  document.querySelectorAll(".presets button").forEach(btn => {
    btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
  });
}

// Called whenever any slider or preset changes the state
function onStateChange() {
  updateChart();
  updateSummaryPanel();
}

// ==========================
// 6. Scenario preset logic
// ==========================

function applyPreset(name) {
  const yearSlider = document.getElementById("yearSlider");
  const tariffSlider = document.getElementById("tariffSlider");
  const shippingSlider = document.getElementById("shippingSlider");
  const iraSlider = document.getElementById("iraSlider");
  const carbonPriceSlider = document.getElementById("carbonPriceSlider");

  if (name === "baseline") {
    state.year = 2024;
    state.tariffPercent = 10;
    state.shippingCost = 60;
    state.iraIncentive = 40;
    state.carbonPrice = 75;
  } else if (name === "highTariff") {
    state.year = 2025;
    state.tariffPercent = 25;
    state.shippingCost = 80;
    state.iraIncentive = 50;
    state.carbonPrice = 75;
  } else if (name === "carbon2030") {
    state.year = 2030;
    state.tariffPercent = 10;
    state.shippingCost = 90;
    state.iraIncentive = 80;
    state.carbonPrice = 200;
  }

  // Update sliders and labels to match new state
  yearSlider.value = state.year;
  document.getElementById("yearValue").textContent = state.year;

  tariffSlider.value = state.tariffPercent;
  document.getElementById("tariffValue").textContent = `${state.tariffPercent}%`;

  shippingSlider.value = state.shippingCost;
  document.getElementById("shippingValue").textContent = `$${state.shippingCost}/t`;

  iraSlider.value = state.iraIncentive;
  document.getElementById("iraValue").textContent = `$${state.iraIncentive}/t`;

  carbonPriceSlider.value = state.carbonPrice;
  document.getElementById("carbonPriceValue").textContent =
    `$${state.carbonPrice}/t CO₂`;

  onStateChange();
}

// ============================
// 7. Initialize everything
// ============================

document.addEventListener("DOMContentLoaded", () => {
  initControls();
  initChart();
  updateSummaryPanel();
});
