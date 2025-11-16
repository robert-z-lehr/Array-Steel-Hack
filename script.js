//------------------------------------------------------------
// ARRAY — STEEL COST–CARBON DECISION EXPLORER (UPDATED)
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

// Stylized base values
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

// Timeline
const years = [];
for (let y = 2025; y <= 2050; y++) years.push(y);

// Create realistic stylized long-horizon data
function genData() {
  const rows = [];
  years.forEach((yr, t) => {
    regions.forEach(region => {
      const isUS = region === "US";
      rows.push({
        region,
        year: yr,
        cost: baseCost[region] + (isUS ? -12 * t : 8 * t) + (Math.random() - 0.5) * 40,
        co2: baseCo2[region] - (isUS ? 12 * t : 4 * t) + (Math.random() - 0.5) * 80,
        volume: 30000 + (t * 1000) + Math.random() * 20000
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
      bubbleSize: Math.sqrt(d.volume) / 20,
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

// Frames for animation
function buildFrames(all) {
  return years.map(yr => {
    const d = all.filter(i => i.year === yr);
    return {
      name: String(yr),
      data: [{
        x: d.map(i => i.deliveredCost),
        y: d.map(i => i.co2),
        text: d.map(i => `${i.region} (${yr})`),
        marker: {
          size: d.map(i => i.bubbleSize),
          color: d.map(i => regionColor(i.region))
        }
      }]
    };
  });
}

// Initial chart
function initChart() {
  const scenario = computeScenario();
  const initData = scenario.filter(d => d.year === years[0]);
  const frames = buildFrames(scenario);

  const trace = {
    x: initData.map(d => d.deliveredCost),
    y: initData.map(d => d.co2),
    mode: "markers",
    type: "scatter",
    text: initData.map(d => d.region),
    marker: {
      size: initData.map(d => d.bubbleSize),
      color: initData.map(d => regionColor(d.region))
    }
  };

  const layout = {
    title: "Delivered Cost vs CO₂ Intensity (2025–2050)",
    xaxis: { title: "Delivered Cost ($/ton)" },
    yaxis: { title: "CO₂ (kg CO₂/ton steel)" },
    height: 650,
    showlegend: true,
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

  Plotly.newPlot("chart", [trace], layout).then(() => {
    Plotly.addFrames("chart", frames);
  });
}

// Update chart + summary
function updateChart() {
  const scenario = computeScenario();
  const frames = buildFrames(scenario);
  const initData = scenario.filter(d => d.year === years[0]);

  Plotly.react("chart", [{
    x: initData.map(d => d.deliveredCost),
    y: initData.map(d => d.co2),
    mode: "markers",
    marker: {
      size: initData.map(d => d.bubbleSize),
      color: initData.map(d => regionColor(d.region))
    }
  }], {
    xaxis: { title: "Delivered Cost ($/ton)" },
    yaxis: { title: "CO₂ (kg CO₂/ton)" }
  });

  Plotly.addFrames("chart", frames);

  // Update table
  const us = scenario.find(r => r.region === "US" && r.year === years[0]);
  const cn = scenario.find(r => r.region === "China" && r.year === years[0]);

  document.getElementById("usCost").textContent = us.deliveredCost.toFixed(0);
  document.getElementById("cnCost").textContent = cn.deliveredCost.toFixed(0);
  document.getElementById("deltaCost").textContent = (us.deliveredCost - cn.deliveredCost).toFixed(0);

  document.getElementById("usCo2").textContent = us.co2.toFixed(0);
  document.getElementById("cnCo2").textContent = cn.co2.toFixed(0);
  document.getElementById("deltaCo2").textContent = (us.co2 - cn.co2).toFixed(0);

  document.getElementById("usAdj").textContent = us.carbonAdj.toFixed(0);
  document.getElementById("cnAdj").textContent = cn.carbonAdj.toFixed(0);
  document.getElementById("deltaAdj").textContent = (us.carbonAdj - cn.carbonAdj).toFixed(0);
}

// Link sliders + presets
function bindControls() {
  const sliders = [
    ["tariffSlider", "tariffValue", "tariff"],
    ["shippingSlider", "shippingValue", "shipping"],
    ["incentiveSlider", "incentiveValue", "incentive"],
    ["carbonSlider", "carbonValue", "carbon"]
  ];

  sliders.forEach(([sliderId, labelId, key]) => {
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
