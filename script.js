//------------------------------------------------------------
// ARRAY Steel Cost–Carbon Explorer (Gapminder-style prototype)
// WITH: Temporal animation, bubble-size evolution, full frames
//------------------------------------------------------------

// Global state
const state = {
  tariff: 10,
  shipping: 60,
  incentive: 40,
  carbon: 75
};

// Regions
const regions = ["US", "EU", "Australia", "Brazil", "China", "South Africa"];

// Stylized base costs and emissions
const baseCost = {
  US: 950,
  EU: 1000,
  Australia: 880,
  Brazil: 760,
  China: 650,
  "South Africa": 820
};

const baseCo2 = {
  US: 380,
  EU: 1850,
  Australia: 420,
  Brazil: 440,
  China: 2100,
  "South Africa": 1750
};

// Timeline for animation
const years = [];
for (let y = 2025; y <= 2050; y++) years.push(y);

// Generate stylized dataset WITH YEARLY VOLUME GROWTH
function genData() {
  const rows = [];
  years.forEach((yr, t) => {
    regions.forEach(region => {
      const isUS = region === "US";

      rows.push({
        region,
        year: yr,

        // Cost slopes
        cost:
          baseCost[region] +
          (isUS ? -12 * t : 9 * t) + 
          (Math.random() - 0.5) * 35,


        // Emissions slopes
        co2:
          baseCo2[region] -
          (isUS ? 14 * t : 4 * t) +
          (Math.random() - 0.5) * 55,

        // Volume grows over time → bubble size reflects real trend
        volume: 15000 + t * 3500 + Math.random() * 12000
      });
    });
  });
  return rows;
}

const baseData = genData();

// Apply scenario adjustments
function computeScenario() {
  return baseData.map(d => {
    const isDomestic = d.region === "US";

    const delivered =
      d.cost +
      (isDomestic ? -state.incentive : (state.tariff / 100) * d.cost + state.shipping);

    return {
      ...d,
      deliveredCost: delivered,
      bubbleSize: Math.max(12, Math.sqrt(d.volume) / 9), // volume-driven bubble size
      carbonAdj: delivered + (d.co2 / 1000) * state.carbon
    };
  });
}

// Colors
function regionColor(region) {
  return {
    US: "#1f77b4",
    EU: "#ff7f0e",
    Australia: "#2ca02c",
    Brazil: "#17becf",
    China: "#d62728",
    "South Africa": "#9467bd"
  }[region];
}

// Build all frames for Plotly animation
function buildFrames(all) {
  return years.map(yr => {
    const traces = regions.map(region => {
      const d = all.filter(x => x.region === region && x.year === yr);
      return {
        name: region,
        x: d.map(i => i.deliveredCost),
        y: d.map(i => i.co2),
        text: d.map(i => `${region} (${yr})`),
        mode: "markers",
        marker: {
          size: d.map(i => i.bubbleSize),
          color: regionColor(region),
          opacity: 0.85
        }
      };
    });
    return { name: String(yr), data: traces };
  });
}

// Initialization
function initChart() {
  const scenario = computeScenario();
  const startYear = years[0];

  const initTraces = regions.map(region => {
    const d = scenario.filter(r => r.region === region && r.year === startYear);
    return {
      name: region,
      x: d.map(r => r.deliveredCost),
      y: d.map(r => r.co2),
      text: d.map(r => `${region} (${r.year})`),
      mode: "markers",
      marker: {
        size: d.map(r => r.bubbleSize),
        color: regionColor(region),
        opacity: 0.85
      }
    };
  });

  const frames = buildFrames(scenario);

  const layout = {
    title: "Delivered Cost vs CO₂ Intensity (2025–2050)",
    xaxis: { title: "Delivered Cost ($/ton)" },
    yaxis: { title: "CO₂ Intensity (kg CO₂/ton)" },
    height: 650,
    showlegend: true,
    legend: { x: 1.02, y: 1 },
    sliders: [{
      steps: years.map(yr => ({
        label: String(yr),
        method: "animate",
        args: [[String(yr)], {mode: "immediate"}]
      }))
    }],
    updatemenus: [{
      type: "buttons",
      showactive: false,
      buttons: [
        { label: "Play", method: "animate", args: [null, {frame: {duration: 500}}] },
        { label: "Pause", method: "animate", args: [[null], {mode: "immediate"}] }
      ]
    }]
  };

  Plotly.newPlot("chart", initTraces, layout).then(() =>
    Plotly.addFrames("chart", frames)
  );
}

// Update (sliders and presets)
function updateChart() {
  const scenario = computeScenario();
  const startYear = years[0];

  const traces = regions.map(region => {
    const d = scenario.filter(r => r.region === region && r.year === startYear);
    return {
      name: region,
      x: d.map(r => r.deliveredCost),
      y: d.map(r => r.co2),
      text: d.map(r => `${region} (${startYear})`),
      mode: "markers",
      marker: {
        size: d.map(r => r.bubbleSize),
        color: regionColor(region),
        opacity: 0.85
      }
    };
  });

  const frames = buildFrames(scenario);

  Plotly.react("chart", traces, {
    xaxis: { title: "Delivered Cost ($/ton)" },
    yaxis: { title: "CO₂ (kg CO₂/ton)" }
  });

  Plotly.addFrames("chart", frames);

  // Summary table
  const us = scenario.find(d => d.region === "US" && d.year === startYear);
  const cn = scenario.find(d => d.region === "China" && d.year === startYear);

  const costDiff = us.deliveredCost - cn.deliveredCost;
  const co2Diff = us.co2 - cn.co2;
  const adjDiff = us.carbonAdj - cn.carbonAdj;

  document.getElementById("usCost").textContent = `$${us.deliveredCost.toFixed(0)}`;
  document.getElementById("cnCost").textContent = `$${cn.deliveredCost.toFixed(0)}`;
  document.getElementById("deltaCost").textContent =
    `${costDiff >= 0 ? "+" : ""}$${costDiff.toFixed(0)}`;

  document.getElementById("usCo2").textContent = `${us.co2.toFixed(0)} kg`;
  document.getElementById("cnCo2").textContent = `${cn.co2.toFixed(0)} kg`;
  document.getElementById("deltaCo2").textContent =
    `${co2Diff >= 0 ? "+" : ""}${co2Diff.toFixed(0)} kg`;

  document.getElementById("usAdj").textContent = `$${us.carbonAdj.toFixed(0)}`;
  document.getElementById("cnAdj").textContent = `$${cn.carbonAdj.toFixed(0)}`;
  document.getElementById("deltaAdj").textContent =
    `${adjDiff >= 0 ? "+" : ""}$${adjDiff.toFixed(0)}`;
}

// Bind controls
function bindControls() {
  const bindings = [
    ["tariffSlider", "tariffValue", "tariff"],
    ["shippingSlider", "shippingValue", "shipping"],
    ["incentiveSlider", "incentiveValue", "incentive"],
    ["carbonSlider", "carbonValue", "carbon"]
  ];

  bindings.forEach(([sliderId, labelId, key]) => {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    label.textContent = slider.value;

    slider.oninput = () => {
      state[key] = Number(slider.value);
      label.textContent = slider.value;
      updateChart();
    };
  });

  document.querySelectorAll(".preset").forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.type === "baseline") {
        state.tariff = 10;
        state.shipping = 60;
        state.incentive = 40;
        state.carbon = 75;
      }
      if (btn.dataset.type === "highTariff") {
        state.tariff = 30;
        state.shipping = 120;
        state.incentive = 25;
        state.carbon = 40;
      }
      if (btn.dataset.type === "carbon2050") {
        state.tariff = 5;
        state.shipping = 40;
        state.incentive = 80;
        state.carbon = 200;
      }

      // Sync UI
      tariffSlider.value = state.tariff;
      shippingSlider.value = state.shipping;
      incentiveSlider.value = state.incentive;
      carbonSlider.value = state.carbon;

      tariffValue.textContent = state.tariff;
      shippingValue.textContent = state.shipping;
      incentiveValue.textContent = state.incentive;
      carbonValue.textContent = state.carbon;

      updateChart();
    };
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  initChart();
  updateChart();
});
