const questions = window.QUESTIONS;
const wizard = document.querySelector(".wizard");
const doneScreen = document.getElementById("doneScreen");
const sectionLabel = document.getElementById("sectionLabel");
const promptEl = document.getElementById("prompt");
const helpEl = document.getElementById("help");
const inputContainer = document.getElementById("inputContainer");
const errorEl = document.getElementById("error");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const backBtn = document.getElementById("backBtn");
const skipBtn = document.getElementById("skipBtn");
const nextBtn = document.getElementById("nextBtn");
const closeBtn = document.getElementById("closeBtn");

let profile = {};
let index = 0;

(async function init() {
  const { profile: saved } = await chrome.storage.local.get(["profile"]);
  profile = saved || {};
  // Resume at first unanswered question if user is returning
  const params = new URLSearchParams(location.search);
  if (params.get("edit") === "1") {
    index = 0;
  } else {
    const firstUnanswered = questions.findIndex((q) => !profile[q.id]);
    index = firstUnanswered === -1 ? 0 : firstUnanswered;
  }
  render();
})();

function render() {
  const q = questions[index];
  sectionLabel.textContent = q.section;
  promptEl.textContent = q.prompt + (q.optional ? "" : " *");
  helpEl.textContent = q.help || "";
  helpEl.style.display = q.help ? "block" : "none";
  errorEl.textContent = "";

  const pct = Math.round(((index + 1) / questions.length) * 100);
  progressFill.style.width = pct + "%";
  progressText.textContent = `${index + 1} / ${questions.length}`;

  backBtn.disabled = index === 0;
  skipBtn.style.visibility = q.optional ? "visible" : "hidden";
  nextBtn.textContent = index === questions.length - 1 ? "Finish" : "Next →";

  inputContainer.innerHTML = "";
  inputContainer.appendChild(buildInput(q));
  focusFirstInput();
}

function buildInput(q) {
  const value = profile[q.id] || "";

  if (q.type === "radio") {
    const wrap = document.createElement("div");
    wrap.className = "radio-group";
    q.options.forEach((opt) => {
      const label = document.createElement("label");
      label.className = "radio-option" + (value === opt ? " selected" : "");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = q.id;
      input.value = opt;
      input.checked = value === opt;
      input.addEventListener("change", () => {
        wrap.querySelectorAll(".radio-option").forEach((o) => o.classList.remove("selected"));
        label.classList.add("selected");
      });
      const span = document.createElement("span");
      span.textContent = opt;
      label.append(input, span);
      wrap.appendChild(label);
    });
    return wrap;
  }

  if (q.type === "select") {
    const sel = document.createElement("select");
    sel.id = "field";
    q.options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt || "— select —";
      if (opt === value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  if (q.type === "textarea") {
    const t = document.createElement("textarea");
    t.id = "field";
    t.value = value;
    if (q.placeholder) t.placeholder = q.placeholder;
    return t;
  }

  if (q.type === "signature") {
    return buildSignaturePad(value);
  }

  const input = document.createElement("input");
  input.id = "field";
  input.type = q.type || "text";
  input.value = value;
  if (q.placeholder) input.placeholder = q.placeholder;
  return input;
}

function buildSignaturePad(existing) {
  const wrap = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvas.className = "signature-canvas";
  canvas.width = 560;
  canvas.height = 140;
  wrap.appendChild(canvas);

  const controls = document.createElement("div");
  controls.className = "signature-controls";
  const hint = document.createElement("span");
  hint.textContent = "Draw your signature above";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear";
  controls.append(hint, clearBtn);
  wrap.appendChild(controls);

  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0f172a";
  let drawing = false;
  let hasDrawn = false;

  if (existing && existing.startsWith("data:image")) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = existing;
    hasDrawn = true;
  }

  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return [x, y];
  };
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    hasDrawn = true;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
  });

  wrap.__getSignature = () => (hasDrawn ? canvas.toDataURL("image/png") : "");
  return wrap;
}

function focusFirstInput() {
  const el = inputContainer.querySelector("input, select, textarea");
  if (el) el.focus();
}

function readCurrentValue() {
  const q = questions[index];
  if (q.type === "radio") {
    const checked = inputContainer.querySelector(`input[name="${q.id}"]:checked`);
    return checked ? checked.value : "";
  }
  if (q.type === "signature") {
    const wrap = inputContainer.firstChild;
    return wrap?.__getSignature?.() || "";
  }
  return inputContainer.querySelector("#field")?.value.trim() || "";
}

async function saveCurrent() {
  const q = questions[index];
  const val = readCurrentValue();
  profile[q.id] = val;
  await chrome.storage.local.set({ profile });
}

async function advance(direction) {
  const q = questions[index];
  const val = readCurrentValue();

  if (direction === 1 && !q.optional && !val) {
    errorEl.textContent = "This field is required.";
    return;
  }
  await saveCurrent();

  const newIndex = index + direction;
  if (newIndex >= questions.length) {
    finish();
    return;
  }
  if (newIndex < 0) return;
  index = newIndex;
  render();
}

function finish() {
  wizard.classList.add("hidden");
  doneScreen.classList.remove("hidden");
}

backBtn.addEventListener("click", () => advance(-1));
nextBtn.addEventListener("click", () => advance(1));
skipBtn.addEventListener("click", async () => {
  // Skip = don't validate, don't overwrite; just move on
  const newIndex = index + 1;
  if (newIndex >= questions.length) {
    finish();
    return;
  }
  index = newIndex;
  render();
});
closeBtn.addEventListener("click", () => window.close());

// Enter to advance (but not in textarea)
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
    advance(1);
  }
});
