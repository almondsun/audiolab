"use strict";

const Q23_ONE = 1 << 23;
const MAX_HISTORY = 80;
const MIN_DB = -30;
const MAX_DB = 12;
const BAND_COLORS = ["#70d27b", "#f0c657", "#66c7d6"];
const BAND_DEFS = [
  { id: "mixer0", label: "Low path", frequency: 120, width: 0.82 },
  { id: "mixer1", label: "Mid path", frequency: 1000, width: 0.95 },
  { id: "mixer2", label: "High path", frequency: 8000, width: 0.9 }
];
const PRESET_DEFS = [
  {
    id: 0,
    name: "FLAT",
    description: "Neutral audio pass-through",
    masterPercent: 100,
    bands: [100, 100, 100],
    bypass: false
  },
  {
    id: 1,
    name: "BASS",
    description: "First crossover mixer path only",
    masterPercent: 100,
    bands: [100, 0, 0],
    bypass: false
  },
  {
    id: 2,
    name: "VOICE",
    description: "Second crossover mixer path only",
    masterPercent: 100,
    bands: [0, 100, 0],
    bypass: false
  },
  {
    id: 3,
    name: "NIGHT",
    description: "Reduced all-path mixer gain",
    masterPercent: 100,
    bands: [33, 33, 33],
    bypass: false
  },
  {
    id: 4,
    name: "FILTER",
    description: "Third crossover mixer path only",
    masterPercent: 100,
    bands: [0, 0, 100],
    bypass: false
  }
];

const state = {
  activePreset: 0,
  presets: PRESET_DEFS.map((preset) => clonePreset(preset)),
  undoStack: [],
  redoStack: [],
  dragBand: null,
  lastSnapshot: null,
  dirty: false
};

const els = {
  tabs: document.getElementById("preset-tabs"),
  title: document.getElementById("preset-title"),
  description: document.getElementById("preset-description"),
  canvas: document.getElementById("response-canvas"),
  readout: document.getElementById("graph-readout"),
  bandControls: document.getElementById("band-controls"),
  masterGain: document.getElementById("master-gain"),
  masterGainValue: document.getElementById("master-gain-value"),
  bypassToggle: document.getElementById("bypass-toggle"),
  undoButton: document.getElementById("undo-button"),
  redoButton: document.getElementById("redo-button"),
  resetButton: document.getElementById("reset-button"),
  copyButton: document.getElementById("copy-button"),
  activePresetChip: document.getElementById("active-preset-chip"),
  bypassChip: document.getElementById("bypass-chip"),
  dirtyChip: document.getElementById("dirty-chip"),
  masterQ23: document.getElementById("master-q23"),
  mixerQ23: [
    document.getElementById("mixer0-q23"),
    document.getElementById("mixer1-q23"),
    document.getElementById("mixer2-q23")
  ],
  payloadPreview: document.getElementById("payload-preview")
};

const ctx = els.canvas.getContext("2d");

function clonePreset(preset) {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    masterPercent: preset.masterPercent,
    bands: [...preset.bands],
    bypass: preset.bypass
  };
}

function snapshotState() {
  return JSON.stringify({
    activePreset: state.activePreset,
    presets: state.presets
  });
}

function restoreSnapshot(snapshot) {
  const parsed = JSON.parse(snapshot);
  state.activePreset = parsed.activePreset;
  state.presets = parsed.presets.map((preset) => clonePreset(preset));
}

function commitHistory(previousSnapshot) {
  if (previousSnapshot === null) {
    return;
  }

  const currentSnapshot = snapshotState();
  if (previousSnapshot === currentSnapshot) {
    return;
  }

  state.undoStack.push(previousSnapshot);
  if (state.undoStack.length > MAX_HISTORY) {
    state.undoStack.shift();
  }
  state.redoStack = [];
  state.dirty = true;
  render();
}

function beginTrackedEdit() {
  if (state.lastSnapshot === null) {
    state.lastSnapshot = snapshotState();
  }
}

function finishTrackedEdit() {
  commitHistory(state.lastSnapshot);
  state.lastSnapshot = null;
}

function currentPreset() {
  return state.presets[state.activePreset];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percentToDb(percent) {
  if (percent <= 0) {
    return MIN_DB;
  }
  return clamp(20 * Math.log10(percent / 100), MIN_DB, MAX_DB);
}

function dbToPercent(db) {
  if (db <= MIN_DB) {
    return 0;
  }
  return Math.round(clamp(100 * Math.pow(10, db / 20), 0, 100));
}

function percentToQ23(percent) {
  return Math.round((Q23_ONE * clamp(percent, 0, 100)) / 100);
}

function multipliedQ23(masterPercent, bandPercent) {
  const master = percentToQ23(masterPercent);
  const band = percentToQ23(bandPercent);
  return Math.round((master * band) / Q23_ONE);
}

function xForFrequency(freq, rect) {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  return rect.left + ((Math.log10(freq) - minLog) / (maxLog - minLog)) * rect.width;
}

function frequencyForX(x, rect) {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  const t = clamp((x - rect.left) / rect.width, 0, 1);
  return Math.pow(10, minLog + t * (maxLog - minLog));
}

function yForDb(db, rect) {
  const t = (clamp(db, MIN_DB, MAX_DB) - MIN_DB) / (MAX_DB - MIN_DB);
  return rect.bottom - t * rect.height;
}

function dbForY(y, rect) {
  const t = clamp((rect.bottom - y) / rect.height, 0, 1);
  return MIN_DB + t * (MAX_DB - MIN_DB);
}

function graphRect() {
  const width = els.canvas.width;
  const height = els.canvas.height;
  return {
    left: 70,
    top: 28,
    right: width - 28,
    bottom: height - 58,
    width: width - 98,
    height: height - 86
  };
}

function responseDbAt(freq, preset) {
  const masterLinear = preset.masterPercent / 100;
  let sum = 0;

  for (let i = 0; i < BAND_DEFS.length; i += 1) {
    const band = BAND_DEFS[i];
    const distance = Math.log2(freq / band.frequency);
    const weight = Math.exp(-(distance * distance) / (2 * band.width * band.width));
    sum += (preset.bands[i] / 100) * weight;
  }

  const normalized = clamp(masterLinear * sum, 0.001, 4);
  return clamp(20 * Math.log10(normalized), MIN_DB, MAX_DB);
}

function drawGrid(rect) {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.fillStyle = "#0b0f0c";
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);

  ctx.strokeStyle = "#1f2a21";
  ctx.lineWidth = 1;
  for (const db of [-30, -24, -18, -12, -6, 0, 6, 12]) {
    const y = yForDb(db, rect);
    ctx.beginPath();
    ctx.moveTo(rect.left, y);
    ctx.lineTo(rect.right, y);
    ctx.stroke();
    ctx.fillStyle = db === 0 ? "#eef3e7" : "#7f8b7c";
    ctx.font = "18px ui-sans-serif, system-ui";
    ctx.textAlign = "right";
    ctx.fillText(`${db} dB`, rect.left - 12, y + 6);
  }

  for (const freq of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
    const x = xForFrequency(freq, rect);
    ctx.beginPath();
    ctx.moveTo(x, rect.top);
    ctx.lineTo(x, rect.bottom);
    ctx.stroke();
    ctx.fillStyle = "#7f8b7c";
    ctx.font = "17px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
    ctx.fillText(label, x, rect.bottom + 30);
  }

  ctx.strokeStyle = "#4e5d50";
  ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
}

function drawResponse(rect, preset) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = preset.bypass ? "#6d746d" : "#70d27b";
  ctx.beginPath();

  for (let x = rect.left; x <= rect.right; x += 3) {
    const freq = frequencyForX(x, rect);
    const y = yForDb(preset.bypass ? MIN_DB : responseDbAt(freq, preset), rect);
    if (x === rect.left) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawHandles(rect, preset) {
  for (let i = 0; i < BAND_DEFS.length; i += 1) {
    const band = BAND_DEFS[i];
    const x = xForFrequency(band.frequency, rect);
    const y = yForDb(percentToDb(preset.bands[i]), rect);

    ctx.beginPath();
    ctx.arc(x, y, state.dragBand === i ? 14 : 11, 0, Math.PI * 2);
    ctx.fillStyle = BAND_COLORS[i];
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0b0f0c";
    ctx.stroke();

    ctx.fillStyle = "#eef3e7";
    ctx.font = "18px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${preset.bands[i]}%`, x, y - 20);
  }
}

function drawCanvas() {
  const preset = currentPreset();
  const rect = graphRect();
  drawGrid(rect);
  drawResponse(rect, preset);
  drawHandles(rect, preset);
}

function makeBandControl(index) {
  const row = document.createElement("label");
  row.className = "band-row";

  const name = document.createElement("span");
  name.className = "band-name";
  const swatch = document.createElement("span");
  swatch.className = "band-swatch";
  swatch.style.background = BAND_COLORS[index];
  name.append(swatch, BAND_DEFS[index].label);

  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = "100";
  range.dataset.band = String(index);

  const output = document.createElement("output");
  output.dataset.bandOutput = String(index);

  range.addEventListener("input", () => {
    beginTrackedEdit();
    currentPreset().bands[index] = Number(range.value);
    render();
  });

  range.addEventListener("change", finishTrackedEdit);
  range.addEventListener("pointerdown", beginTrackedEdit);
  range.addEventListener("keydown", beginTrackedEdit);

  row.append(name, range, output);
  return row;
}

function renderTabs() {
  els.tabs.innerHTML = "";
  for (const preset of state.presets) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.role = "tab";
    tab.id = `preset-tab-${preset.id}`;
    tab.setAttribute("aria-selected", String(preset.id === state.activePreset));
    tab.textContent = `P${preset.id} ${preset.name}`;
    tab.addEventListener("click", () => {
      if (state.activePreset === preset.id) {
        return;
      }
      const before = snapshotState();
      state.activePreset = preset.id;
      commitHistory(before);
    });
    els.tabs.append(tab);
  }
}

function payloadForPreset(preset) {
  return {
    preset: preset.name,
    preset_id: preset.id,
    bypass_enabled: preset.bypass,
    gain_percent: preset.masterPercent,
    mixer0_q23: multipliedQ23(preset.masterPercent, preset.bands[0]),
    mixer1_q23: multipliedQ23(preset.masterPercent, preset.bands[1]),
    mixer2_q23: multipliedQ23(preset.masterPercent, preset.bands[2]),
    band_gain_percent: {
      mixer0: preset.bands[0],
      mixer1: preset.bands[1],
      mixer2: preset.bands[2]
    }
  };
}

function renderControls() {
  const preset = currentPreset();
  els.title.textContent = preset.name;
  els.description.textContent = preset.description;
  els.activePresetChip.textContent = `P${preset.id} ${preset.name}`;
  els.bypassChip.textContent = preset.bypass ? "Bypass enabled" : "Output active";
  els.dirtyChip.textContent = state.dirty ? "Edited" : "Ready";
  els.bypassToggle.checked = preset.bypass;
  els.masterGain.value = String(preset.masterPercent);
  els.masterGainValue.textContent = `${preset.masterPercent}%`;

  for (let i = 0; i < BAND_DEFS.length; i += 1) {
    const range = els.bandControls.querySelector(`[data-band="${i}"]`);
    const output = els.bandControls.querySelector(`[data-band-output="${i}"]`);
    range.value = String(preset.bands[i]);
    output.textContent = `${preset.bands[i]}%`;
  }

  els.masterQ23.textContent = String(percentToQ23(preset.masterPercent));
  for (let i = 0; i < BAND_DEFS.length; i += 1) {
    els.mixerQ23[i].textContent = String(multipliedQ23(preset.masterPercent, preset.bands[i]));
  }
  els.payloadPreview.textContent = JSON.stringify(payloadForPreset(preset), null, 2);
  els.undoButton.disabled = state.undoStack.length === 0;
  els.redoButton.disabled = state.redoStack.length === 0;
}

function render() {
  renderTabs();
  renderControls();
  drawCanvas();
}

function undo() {
  if (state.undoStack.length === 0) {
    return;
  }
  const current = snapshotState();
  const previous = state.undoStack.pop();
  state.redoStack.push(current);
  restoreSnapshot(previous);
  state.dirty = true;
  render();
}

function redo() {
  if (state.redoStack.length === 0) {
    return;
  }
  const current = snapshotState();
  const next = state.redoStack.pop();
  state.undoStack.push(current);
  restoreSnapshot(next);
  state.dirty = true;
  render();
}

function resetPreset() {
  const before = snapshotState();
  state.presets[state.activePreset] = clonePreset(PRESET_DEFS[state.activePreset]);
  commitHistory(before);
}

function pointerToCanvas(event) {
  const bounds = els.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * els.canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * els.canvas.height
  };
}

function closestBand(point, rect, preset) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < BAND_DEFS.length; i += 1) {
    const x = xForFrequency(BAND_DEFS[i].frequency, rect);
    const y = yForDb(percentToDb(preset.bands[i]), rect);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return bestDistance <= 34 ? best : null;
}

function setBandFromPoint(index, point) {
  const rect = graphRect();
  const db = dbForY(point.y, rect);
  const percent = dbToPercent(db);
  currentPreset().bands[index] = percent;
  els.readout.textContent = `${BAND_DEFS[index].label}: ${percent}% (${db.toFixed(1)} dB)`;
  render();
}

function wireEvents() {
  els.bandControls.innerHTML = "";
  for (let i = 0; i < BAND_DEFS.length; i += 1) {
    els.bandControls.append(makeBandControl(i));
  }

  els.masterGain.addEventListener("pointerdown", () => {
    beginTrackedEdit();
  });
  els.masterGain.addEventListener("keydown", () => {
    beginTrackedEdit();
  });
  els.masterGain.addEventListener("input", () => {
    beginTrackedEdit();
    currentPreset().masterPercent = Number(els.masterGain.value);
    render();
  });
  els.masterGain.addEventListener("change", finishTrackedEdit);

  els.bypassToggle.addEventListener("change", () => {
    const before = snapshotState();
    currentPreset().bypass = els.bypassToggle.checked;
    commitHistory(before);
  });

  els.undoButton.addEventListener("click", undo);
  els.redoButton.addEventListener("click", redo);
  els.resetButton.addEventListener("click", resetPreset);

  els.copyButton.addEventListener("click", async () => {
    const text = els.payloadPreview.textContent;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      els.copyButton.textContent = "Copied";
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(els.payloadPreview);
      selection.removeAllRanges();
      selection.addRange(range);
      els.copyButton.textContent = "Selected";
    }
    window.setTimeout(() => {
      els.copyButton.textContent = "Copy";
    }, 900);
  });

  els.canvas.addEventListener("pointerdown", (event) => {
    const point = pointerToCanvas(event);
    const rect = graphRect();
    const band = closestBand(point, rect, currentPreset());
    if (band === null) {
      return;
    }
    state.dragBand = band;
    beginTrackedEdit();
    els.canvas.setPointerCapture(event.pointerId);
    setBandFromPoint(band, point);
  });

  els.canvas.addEventListener("pointermove", (event) => {
    const point = pointerToCanvas(event);
    const rect = graphRect();
    const hovered = closestBand(point, rect, currentPreset());

    if (state.dragBand !== null) {
      setBandFromPoint(state.dragBand, point);
      return;
    }

    if (hovered !== null) {
      els.readout.textContent = `${BAND_DEFS[hovered].label}: drag to tune gain`;
    }
  });

  els.canvas.addEventListener("pointerup", (event) => {
    if (state.dragBand === null) {
      return;
    }
    els.canvas.releasePointerCapture(event.pointerId);
    state.dragBand = null;
    finishTrackedEdit();
  });

  els.canvas.addEventListener("pointercancel", () => {
    if (state.dragBand === null) {
      return;
    }
    state.dragBand = null;
    finishTrackedEdit();
  });

  els.canvas.addEventListener("pointerleave", () => {
    if (state.dragBand === null) {
      els.readout.textContent = "Drag a band handle";
    }
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey))) {
      event.preventDefault();
      redo();
    }
  });
}

wireEvents();
render();
