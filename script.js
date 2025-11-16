//------------------------------------------------------------
// MINIMAL PROTOTYPE — CLEAN GAPMINDER TOOL
//------------------------------------------------------------

// Global state
const state = {
  tariff: 10,
  shipping: 60,
  incentive: 40,
  carbon: 75
};

// Regions and default data
const regions = ["US", "EU", "Australia", "Brazil", "China", "South Africa"];

const baseCost = {
  US: 950,
  EU: 1000,
  Australia: 900,
  Brazil: 760,
  China: 680,
  "South Africa": 830
};

const baseCo2 = {
  US: 380,
  EU: 1850,
  Australia: 420,
  Brazil: 440,
  China: 2100,
  "South Africa": 1750
};

// Year range
const years = [];
for (let y = 2025; y <= 2050; y++) years.push(y);

// Generate full dataset (simple stylized trends)
function genData() {
  const rows = [];
  years.forEach((yr, i) => {
    regions.forEach(region => {
      rows.push({
        region,
        year: yr,
        cost: baseCost[region] + (region === "US" ? -8 * i : 5 * i),
        co2: baseCo2[region] - (region === "US" ? 10 * i : 3 * i),
        volume: 50000 + Math.random() * 30000
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
      bubbleSize: Math.sqrt(d.volume) / 25,
      carbonAdj: delivered + (d.co2 / 1000) * state.carbon
    };
  });
}

// Legend colors
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

// Build animation frames
function buildFrames(all) {
  return years.map(yr => {
    const data = all.filter(d => d.year === yr);
    return {
      name: String(yr),
      data: [{
        x: data.map(d => d.deliveredCost),
        y: data.map(d => d.co2),
        text: data.map(d => `${d.region}<br>${yr}`),
        marker: {
          size: data.map(d => d.bubbleSize),
          color: data.map(d => regionColor(d.region))
        }
      }]
    };
  });
}

// Initial chart
function initChart() {
  const all = computeScenario();
  const init = all.filter(d => d.year === years[0]);
  const frames = buildFrames(all);

  const trace = {
    x: init.map(d => d.deliveredCost),
    y: init.map(d => d.co2),
    mode: "markers",
    type: "scatter",
    text: init.map(d => d.region),
    marker: {
      size: init.map(d => d.bubbleSize),
      color: init.map(d => regionColor(d.region))
    }
  };

  const layout = {
    title: "Cost vs CO₂",
    xaxis: { title: "Delivered Cost ($/ton)" },
    yaxis: { title: "CO₂ (kg/ton)" },
    height: 650,
    showlegend: true,
    legend: { x: 1, y: 1 },
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
        { label: "Play", method: "animate", args: [null, {frame: {duration: 700}}] },
        { label: "Pause", method: "animate", args: [[null], {mode: "immediate"}] }
      ]
    }]
  };

  Plotly.newPlot("chart", [trace], layout).then(() => {
    Plotly.addFrames("chart", frames);
  });
}

// Refresh chart + summary
function updateChart() {
  const all = computeScenario();
  const frames = buildFrames(all);
  const year0 = years[0];
  const d0 = all.filter(d => d.year === year0);

  Plotly.react("chart", [{
    x: d0.map(d => d.deliveredCost),
    y: d0.map(d => d.co2),
    mode: "markers",
    marker: {
      size: d0.map(d => d.bubbleSize),
      color: d0.map(d => regionColor(d.region))
    }
  }], {
    xaxis: { title: "Delivered Cost ($/ton)" },
    yaxis: { title: "CO₂ (kg/ton)" }
  });

  Plotly.addFrames("chart", frames);

  // Update summary table
  const us = all.find(d => d.region === "US" && d.year === year0);
  const cn = all.find(d => d.region === "China" && d.year === year0);

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

// Wire sliders
function bindControls() {
  [
    ["tariffSlider", "tariffValue", "tariff"],
    ["shippingSlider", "shippingValue", "shipping"],
    ["incentiveSlider", "incentiveValue", "incentive"],
    ["carbonSlider", "carbonValue", "carbon"]
  ].forEach(([sliderId, labelId, key]) => {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    label.textContent = slider.value;
    slider.oninput = () => {
      state[key] = Number(slider.value);
      label.textContent = slider.value;
      updateChart();
    };
  });

  // Presets
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
        state.shipping = 100;
        state.incentive = 30;
        state.carbon = 50;
      }
      if (btn.dataset.type === "carbon2050") {
        state.tariff = 5;
        state.shipping = 40;
        state.incentive = 80;
        state.carbon = 200;
      }

      // Update slider UI
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

// Init
document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  initChart();
  updateChart();
});
