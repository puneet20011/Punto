const fillBtn = document.getElementById("fillBtn");
const editBtn = document.getElementById("editBtn");
const resumeBtn = document.getElementById("resumeBtn");
const diagnoseBtn = document.getElementById("diagnoseBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const statusEl = document.getElementById("status");
const completenessEl = document.getElementById("completeness");

const onboardingUrl = chrome.runtime.getURL("onboarding.html");

(async function init() {
  const { profile } = await chrome.storage.local.get(["profile"]);
  updateCompleteness(profile || {});
})();

function updateCompleteness(profile) {
  const required = window.QUESTIONS.filter((q) => !q.optional);
  const answered = required.filter((q) => profile[q.id] && String(profile[q.id]).trim()).length;
  const pct = required.length === 0 ? 0 : Math.round((answered / required.length) * 100);
  completenessEl.textContent = `${pct}% complete`;
  completenessEl.style.color = pct === 100 ? "#0a7d2b" : "#64748b";
}

fillBtn.addEventListener("click", async () => {
  const { profile } = await chrome.storage.local.get(["profile"]);
  if (!profile || Object.keys(profile).length === 0) {
    flash("Run setup first.", true);
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "PUNTO_FILL", profile });
    flash(`Filled ${result?.filled ?? 0} field(s).`);
  } catch {
    flash("Can't run on this page.", true);
  }
});

editBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: onboardingUrl + "?edit=1" });
});

resumeBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: onboardingUrl });
});

diagnoseBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "PUNTO_DIAGNOSE" });
    if (!result?.report) {
      flash("Could not diagnose this page.", true);
      return;
    }
    const blob = new Blob([JSON.stringify(result.report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `punto-diagnose-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Captured ${result.report.widgetCount} fields.`);
  } catch {
    flash("Can't run on this page.", true);
  }
});

exportBtn.addEventListener("click", async () => {
  const { profile } = await chrome.storage.local.get(["profile"]);
  const blob = new Blob([JSON.stringify(profile || {}, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "punto-profile.json";
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const profile = JSON.parse(await file.text());
    await chrome.storage.local.set({ profile });
    updateCompleteness(profile);
    flash("Profile imported.");
  } catch {
    flash("Invalid JSON.", true);
  }
});

function flash(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#b91c1c" : "#0a7d2b";
  setTimeout(() => (statusEl.textContent = ""), 2500);
}
