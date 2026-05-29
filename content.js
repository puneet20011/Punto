// Punto content script — detects job-application form fields and fills them
// from the user's stored profile. Tailored to Workday but works on generic forms.
//
// Debug mode: in DevTools Console, run `window.PUNTO_DEBUG = true` then click
// Autofill. Every detected widget will be logged with its signal and matched key.

(() => {
  if (window.__puntoInjected) return;
  window.__puntoInjected = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "PUNTO_FILL") {
      fillPage(msg.profile)
        .then((filled) => sendResponse({ filled }))
        .catch((err) => {
          console.error("[Punto] fill error", err);
          sendResponse({ filled: 0, error: String(err) });
        });
      return true; // async
    }
    if (msg?.type === "PUNTO_DIAGNOSE") {
      try {
        const report = diagnosePage();
        sendResponse({ report });
      } catch (err) {
        console.error("[Punto] diagnose error", err);
        sendResponse({ report: null, error: String(err) });
      }
      return true;
    }
  });

  const DEBUG = () => !!window.PUNTO_DEBUG;
  const dlog = (...args) => { if (DEBUG()) console.log("[Punto]", ...args); };

  // ---------- Field signal -> profile key mapping ----------
  const FIELD_MAP = [
    ["firstName", /(first.?name|legal.?first|given.?name)/],
    ["middleName", /middle.?name/],
    ["lastName", /(last.?name|legal.?last|family.?name|surname)/],
    ["preferredName", /(preferred.?name|nickname)/],
    ["email", /e[\-_.\s]?mail/],
    ["phoneType", /phone.?(type|device)/],
    ["phone", /(phone|mobile|telephone|cell)/],
    ["address1", /(address.?line.?1|street.?address|^address$|addressline1)/],
    ["address2", /(address.?line.?2|\b(apt|apartment|suite|unit)\b|addressline2)/],
    ["city", /(\bcity\b|\btown\b|\blocality\b)/],
    ["state", /(\bstate\b|\bprovince\b|\bregion\b)/],
    ["postalCode", /(\bzip\b|postal)/],
    ["country", /\bcountry\b/],
    // Specific multi-word patterns first so they match before more general ones
    ["exportControlStatus", /(export.?control|itar|u\.?s\.?.?person|technical.?data|ear.?regulation|us.?citizen.*permanent|indicate.*current.?status)/],
    ["healthcareProfessional", /health.?care.?(professional|organization|provider|industry)/],
    ["availableFullDuration", /(full.?duration|entire.?duration|full.?length|duration.*(co.?op|internship|program)|available.*(co.?op|internship).*program)/],
    ["legallyAuthorized", /(legally.?authoriz|authoriz.*(to.?)?work|authoriz.*lawful|work.?authoriz|right.?to.?work|eligible.*work|legally.?eligible)/],
    ["requiresSponsorship", /(sponsor|visa|immigration.*status)/],
    ["willingToRelocate", /(relocat|willing.*work.*location|able.*work.*location|work.*at.*(the.?)?location|work.*at.*specified.?location)/],
    ["desiredSalary", /(salary|compensation|expected.?pay)/],
    ["startDate", /(start.?date|available.?date|earliest.?start)/],
    ["enteredEducationOnApplication", /(did.?you.?enter.*school|enter.*school.*(education|experience|my.?experience)|under.?education.?\d|education.?1.*my.?experience)/],
    ["graduationDate", /(graduation.?date|anticipated.?graduation|expected.?graduation.?date)/],
    ["gradMonth", /(grad.*month|graduation.*month)/],
    ["gradYear", /(grad.*year|graduation.*year|year.?of.?graduation)/],
    ["school", /(name.?of.*school|most.?recent.*school|current.*school|\bschool\b.*(name|attended)|university|college|institution)/],
    ["degree", /degree/],
    ["major", /(major|field.?of.?study|discipline)/],
    ["gpa", /gpa|grade.?point/],
    ["company", /(current.?company|employer|most.?recent.?company)/],
    ["title", /(job.?title|position.?title|current.?title)/],
    ["yearsExperience", /(years.*experience|experience.*year)/],
    ["gender", /gender/],
    ["hispanic", /(hispanic|latino)/],
    ["ethnicity", /(ethnicity|race)/],
    ["veteran", /veteran/],
    ["disability", /disabil/],
    ["linkedin", /linkedin/],
    ["github", /github/],
    ["portfolio", /portfolio/],
    ["website", /(website|personal.?site|homepage)/],
    ["source", /(how.?did.?you.?hear|hear.?about|source)/],
    ["pronouns", /pronoun/],
    ["age18", /(18.?(years|of.?age)|legal.?age|at.?least.?18|over.?18)/],
    ["felonyConviction", /(felon|convict|criminal.?record|criminal.?history)/],
    ["backgroundCheckConsent", /background.?check/],
    ["drugTestConsent", /(drug.?test|drug.?screen)/],
    ["nonCompete", /(non.?compet|noncompet|non.?solicit|confidentiality.?agreement|post.?employment.?agreement|restrictive.?(agreement|covenant)|prior.?(employment.?)?agreement)/],
    ["previouslyEmployed", /(previously.?(employed|worked)|former.?employee|prior.?employment.?with|ever.?(worked|been.?employed).*(for|with|at)|worked.?(for|with).?(or.?with)?.?(this.?company|us))/],
    ["referredByEmployee", /(referred.?by|employee.?referral|referral)/],
    ["signatureName", /(signature|sign.?here|electronic.?signature|type.?your.?name|legal.?name.?sign)/],
  ];

  function profileKeyFor(signal) {
    if (!signal) return null;
    const s = signal.toLowerCase();
    for (const [key, pattern] of FIELD_MAP) {
      if (pattern.test(s)) return key;
    }
    return null;
  }

  // ---------- Signal extraction ----------
  // Gather everything a human would read to know what this field is asking.
  function getSignal(el) {
    const parts = [];
    const push = (v) => {
      if (!v) return;
      const t = String(v).trim();
      if (t) parts.push(t);
    };

    push(el.getAttribute && el.getAttribute("data-automation-id"));
    push(el.getAttribute && el.getAttribute("name"));
    push(el.getAttribute && el.getAttribute("id"));
    push(el.getAttribute && el.getAttribute("aria-label"));
    push(el.getAttribute && el.getAttribute("placeholder"));
    push(el.getAttribute && el.getAttribute("autocomplete"));
    push(el.getAttribute && el.getAttribute("title"));

    // aria-labelledby (can be space-separated list of IDs)
    const labelledBy = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const e = document.getElementById(id);
        if (e) push(e.innerText);
      });
    }
    const describedBy = el.getAttribute && el.getAttribute("aria-describedby");
    if (describedBy) {
      describedBy.split(/\s+/).forEach((id) => {
        const e = document.getElementById(id);
        if (e) push(e.innerText);
      });
    }

    // <label for="...">
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) push(lbl.innerText);
    }
    // Wrapping <label>
    const wrapLabel = el.closest && el.closest("label");
    if (wrapLabel) push(wrapLabel.innerText);

    // Enclosing fieldset legend
    const fs = el.closest && el.closest("fieldset");
    if (fs) {
      const legend = fs.querySelector(":scope > legend");
      if (legend) push(legend.innerText);
    }

    // Walk up looking for label/heading-like siblings — but stop at form-field
    // boundaries (e.g. Workday's `formField-XXX` containers) to avoid picking up
    // OTHER questions' text as if it were our own label.
    let cur = el.parentElement;
    for (let i = 0; i < 8 && cur; i++) {
      const autoId = (cur.getAttribute && cur.getAttribute("data-automation-id")) || "";

      // Group container's aria-labelledby
      const groupLabelled = cur.getAttribute && cur.getAttribute("aria-labelledby");
      if (groupLabelled) {
        groupLabelled.split(/\s+/).forEach((id) => {
          const e = document.getElementById(id);
          if (e) push(e.innerText);
        });
      }
      // Direct label/heading children
      const labels = cur.querySelectorAll(
        ":scope > label, :scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6"
      );
      labels.forEach((l) => push(l.innerText));
      push(autoId);

      // Stop at form-field boundary (Workday wraps each question in formField-XXX).
      // Anything ABOVE this is a different question and would pollute the signal.
      if (/^formField-/i.test(autoId)) break;

      // Previous siblings — but skip ones that contain form inputs (= other questions)
      let prev = cur.previousElementSibling;
      let prevCount = 0;
      while (prev && prevCount < 2) {
        const tag = prev.tagName?.toLowerCase();
        const prevAutoId = (prev.getAttribute && prev.getAttribute("data-automation-id")) || "";
        const isOtherField =
          /^formField-/i.test(prevAutoId) ||
          prev.querySelector(
            'input, select, textarea, button[aria-haspopup], [role="radiogroup"], [role="checkbox"], [role="combobox"]'
          );
        if (!isOtherField && ["label", "legend", "h1", "h2", "h3", "h4", "h5", "h6", "p", "span"].includes(tag)) {
          const txt = (prev.innerText || "").trim();
          if (txt && txt.length < 300) push(txt);
        }
        prev = prev.previousElementSibling;
        prevCount++;
      }
      cur = cur.parentElement;
    }

    return parts.join(" | ");
  }

  // ---------- Setters that trigger React/Workday change detection ----------
  function nativeSetValue(el, value) {
    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : el.tagName === "SELECT"
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---------- Visibility ----------
  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  // ---------- Matching helpers ----------
  function normalize(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

  function bestOptionMatch(options, value, getText) {
    const v = normalize(value);
    if (!v) return null;
    let exact = null, contains = null, contained = null;
    for (const opt of options) {
      const t = normalize(getText(opt));
      if (!t) continue;
      if (t === v) { exact = opt; break; }
      if (!contains && t.includes(v)) contains = opt;
      if (!contained && v.includes(t)) contained = opt;
    }
    return exact || contains || contained || null;
  }

  // ---------- Fillers ----------

  function fillSelect(el, value) {
    const matched = bestOptionMatch(Array.from(el.options), value, (o) => o.text);
    if (matched) {
      el.value = matched.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  // Native radio group: pick by matching each radio's label to the desired value
  function fillNativeRadioGroup(group, value) {
    const matched = bestOptionMatch(group, value, (r) => radioLabelText(r));
    if (matched) {
      // Click the wrapping label if there is one (more reliable for some frameworks)
      const wrap = matched.closest("label");
      (wrap || matched).click();
      matched.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  function radioLabelText(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.innerText;
    }
    const wrap = el.closest("label");
    if (wrap) return wrap.innerText;
    // Sibling text node / next element
    const next = el.nextElementSibling;
    if (next) return next.innerText;
    return el.parentElement?.innerText || "";
  }

  // ARIA radio group: role="radiogroup" with role="radio" children
  function fillAriaRadioGroup(group, value) {
    const radios = group.querySelectorAll('[role="radio"]');
    const matched = bestOptionMatch(Array.from(radios), value, (r) => ariaOptionText(r));
    if (matched) {
      matched.click();
      // Some Workday widgets respond to keyboard, fire a space key as backup
      matched.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      return true;
    }
    return false;
  }

  function ariaOptionText(el) {
    return (
      el.getAttribute("aria-label") ||
      el.innerText ||
      el.textContent ||
      ""
    );
  }

  // Native checkbox: set checked state based on yes/no value
  function fillNativeCheckbox(el, value) {
    const want = /^(yes|true|on|checked|1|i agree|agree|accept)$/i.test(String(value));
    if (el.checked !== want) {
      const wrap = el.closest("label");
      (wrap || el).click();
    }
    return true;
  }

  // ARIA checkbox: role="checkbox" with aria-checked attribute
  function fillAriaCheckbox(el, value) {
    const want = /^(yes|true|on|checked|1|i agree|agree|accept)$/i.test(String(value));
    const current = el.getAttribute("aria-checked") === "true";
    if (current !== want) el.click();
    return true;
  }

  // Workday button-style dropdown — opens a listbox
  async function fillButtonDropdown(button, value) {
    button.scrollIntoView({ block: "center", behavior: "instant" });
    button.click();
    await sleep(300);
    // Listbox can be portal'd anywhere
    const options = document.querySelectorAll(
      '[role="option"], [data-automation-id="promptOption"], li[role="option"]'
    );
    const visible = Array.from(options).filter(isVisible);
    const target = bestOptionMatch(visible, value, (o) => o.innerText);
    if (target) {
      target.click();
      await sleep(120);
      return true;
    }
    document.body.click();
    return false;
  }

  // Workday combobox — type to filter, then click matching option
  async function fillCombobox(input, value) {
    input.scrollIntoView({ block: "center", behavior: "instant" });
    input.focus();
    nativeSetValue(input, value);
    await sleep(400);
    const options = document.querySelectorAll(
      '[role="option"], [data-automation-id="promptOption"], li[role="option"]'
    );
    const visible = Array.from(options).filter(isVisible);
    const target = bestOptionMatch(visible, value, (o) => o.innerText);
    if (target) {
      target.click();
      await sleep(120);
      return true;
    }
    // Fallback: press Enter
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    return false;
  }

  // Workday 3-input date picker (Month + Day + Year)
  function fillWorkdayDatePicker(monthIn, value, seen) {
    // value is YYYY-MM-DD from the wizard's <input type="date">
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return false;
    const [, year, month, day] = m;

    const container =
      monthIn.closest('[data-automation-id="dateInputWrapper"]') ||
      monthIn.closest('[role="group"]') ||
      monthIn.closest("fieldset") ||
      monthIn.parentElement?.parentElement?.parentElement ||
      monthIn.parentElement;
    if (!container) return false;

    const dayIn = container.querySelector(
      'input[aria-label="Day" i], input[data-automation-id*="dateSectionDay" i]'
    );
    const yearIn = container.querySelector(
      'input[aria-label="Year" i], input[data-automation-id*="dateSectionYear" i]'
    );

    nativeSetValue(monthIn, String(parseInt(month, 10)));
    monthIn.dispatchEvent(new Event("blur", { bubbles: true }));
    if (dayIn) {
      nativeSetValue(dayIn, String(parseInt(day, 10)));
      dayIn.dispatchEvent(new Event("blur", { bubbles: true }));
      seen.add(dayIn);
    }
    if (yearIn) {
      nativeSetValue(yearIn, year);
      yearIn.dispatchEvent(new Event("blur", { bubbles: true }));
      seen.add(yearIn);
    }
    seen.add(monthIn);
    return true;
  }

  // ---------- Main filler ----------
  async function fillPage(profile) {
    let filled = 0;
    const seen = new WeakSet(); // avoid double-handling a widget

    // 0) Workday 3-input date pickers — handle before generic text inputs
    const monthInputs = document.querySelectorAll(
      'input[aria-label="Month" i], input[data-automation-id*="dateSectionMonth" i]'
    );
    for (const monthIn of monthInputs) {
      if (!isVisible(monthIn) || monthIn.disabled) continue;
      const container =
        monthIn.closest('[data-automation-id="dateInputWrapper"]') ||
        monthIn.closest('[role="group"]') ||
        monthIn.closest("fieldset") ||
        monthIn.parentElement?.parentElement?.parentElement;
      const signal = getSignal(container || monthIn);
      const key = profileKeyFor(signal);
      dlog("workday-date", { signal, key, value: key && profile[key] });
      if (key && profile[key] && /^\d{4}-\d{2}-\d{2}/.test(String(profile[key]))) {
        if (fillWorkdayDatePicker(monthIn, profile[key], seen)) filled++;
      }
    }

    // 1) Text inputs and textareas
    const textInputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input[type="date"], input:not([type]), textarea'
    );
    for (const el of textInputs) {
      if (seen.has(el)) continue;
      if (!isVisible(el) || el.disabled || el.readOnly) continue;
      if (el.value && el.value.trim().length > 0) continue;
      // Skip comboboxes here — handled below
      if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list") continue;
      // Skip Workday date sub-inputs — they're handled by step 0 as a group
      const autoId = el.getAttribute("data-automation-id") || "";
      if (/dateSection(Month|Day|Year)-input/i.test(autoId)) continue;
      if (el.getAttribute("role") === "spinbutton") continue;
      const signal = getSignal(el);
      const key = profileKeyFor(signal);
      dlog("text input", { signal, key, value: key && profile[key] });
      if (key && profile[key]) {
        nativeSetValue(el, profile[key]);
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        seen.add(el);
        filled++;
      }
    }

    // 2) Native <select>
    for (const el of document.querySelectorAll("select")) {
      if (!isVisible(el) || el.disabled) continue;
      const signal = getSignal(el);
      const key = profileKeyFor(signal);
      dlog("select", { signal, key, value: key && profile[key] });
      if (key && profile[key] && fillSelect(el, profile[key])) {
        seen.add(el);
        filled++;
      }
    }

    // 3) ARIA radio groups (Workday's native widget)
    const ariaGroups = document.querySelectorAll('[role="radiogroup"]');
    for (const group of ariaGroups) {
      if (!isVisible(group)) continue;
      const signal = getSignal(group);
      const key = profileKeyFor(signal);
      dlog("aria-radiogroup", { signal, key, value: key && profile[key] });
      if (key && profile[key] && fillAriaRadioGroup(group, profile[key])) {
        seen.add(group);
        filled++;
      }
    }

    // 4) Native radio groups
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const groups = new Map();
    for (const r of radios) {
      if (!isVisible(r)) continue;
      const name = r.name || r.getAttribute("data-automation-id") || `_${Math.random()}`;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(r);
    }
    for (const group of groups.values()) {
      const first = group[0];
      // For native groups, signal should come from the GROUP context (fieldset, parent) — not the single radio's own label
      const container = first.closest("fieldset, [role=group], div");
      const signal = getSignal(container || first);
      const key = profileKeyFor(signal);
      dlog("native-radiogroup", { signal, key, value: key && profile[key] });
      if (key && profile[key] && fillNativeRadioGroup(group, profile[key])) {
        group.forEach((r) => seen.add(r));
        filled++;
      }
    }

    // 5) ARIA checkboxes
    for (const el of document.querySelectorAll('[role="checkbox"]')) {
      if (!isVisible(el)) continue;
      if (el.tagName === "INPUT") continue; // handled below
      const signal = getSignal(el);
      const key = profileKeyFor(signal);
      dlog("aria-checkbox", { signal, key, value: key && profile[key] });
      if (key && profile[key] != null && profile[key] !== "") {
        fillAriaCheckbox(el, profile[key]);
        seen.add(el);
        filled++;
      }
    }

    // 6) Native checkboxes
    for (const el of document.querySelectorAll('input[type="checkbox"]')) {
      if (seen.has(el) || !isVisible(el) || el.disabled) continue;
      const signal = getSignal(el);
      const key = profileKeyFor(signal);
      dlog("native-checkbox", { signal, key, value: key && profile[key] });
      if (key && profile[key] != null && profile[key] !== "") {
        fillNativeCheckbox(el, profile[key]);
        seen.add(el);
        filled++;
      }
    }

    // 7) Workday button-style dropdowns
    const ddButtons = document.querySelectorAll(
      'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], [data-automation-id$="Dropdown"] button, [data-uxi-element-id$="selectShowAll"], button[data-automation-id*="elect"]'
    );
    for (const btn of ddButtons) {
      if (seen.has(btn) || !isVisible(btn) || btn.disabled) continue;
      const signal = getSignal(btn);
      const key = profileKeyFor(signal);
      dlog("button-dropdown", { signal, key, value: key && profile[key] });
      if (key && profile[key]) {
        const ok = await fillButtonDropdown(btn, profile[key]);
        if (ok) { seen.add(btn); filled++; }
      }
    }

    // 8) Combobox inputs (Workday Search/select)
    const combos = document.querySelectorAll(
      'input[role="combobox"], input[aria-autocomplete="list"], input[aria-autocomplete="both"]'
    );
    for (const cb of combos) {
      if (seen.has(cb) || !isVisible(cb) || cb.disabled) continue;
      if (cb.value && cb.value.trim().length > 0) continue;
      const signal = getSignal(cb);
      const key = profileKeyFor(signal);
      dlog("combobox", { signal, key, value: key && profile[key] });
      if (key && profile[key]) {
        const ok = await fillCombobox(cb, profile[key]);
        if (ok) { seen.add(cb); filled++; }
      }
    }

    dlog(`done. filled ${filled} widget(s).`);
    return filled;
  }

  // ---------- Diagnostic report ----------
  function diagnosePage() {
    const widgets = [];
    const seen = new WeakSet();
    const truncate = (s, n = 600) => {
      const t = String(s || "").replace(/\s+/g, " ").trim();
      return t.length > n ? t.slice(0, n) + "…" : t;
    };
    const record = (kind, el, opts = {}) => {
      if (seen.has(el)) return;
      seen.add(el);
      const signal = getSignal(el);
      const key = profileKeyFor(signal);
      widgets.push({
        kind,
        key,
        signal: truncate(signal),
        tag: el.tagName?.toLowerCase(),
        role: el.getAttribute && el.getAttribute("role"),
        automationId: el.getAttribute && el.getAttribute("data-automation-id"),
        ariaLabel: el.getAttribute && el.getAttribute("aria-label"),
        name: el.getAttribute && el.getAttribute("name"),
        outerHTML: truncate(el.outerHTML, 1200),
        ...opts,
      });
    };

    // Text inputs / textareas
    document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input[type="date"], input:not([type]), textarea'
    ).forEach((el) => isVisible(el) && record("text", el));

    document.querySelectorAll("select").forEach((el) => isVisible(el) && record("select", el));

    document.querySelectorAll('[role="radiogroup"]').forEach((el) => {
      if (!isVisible(el)) return;
      const opts = Array.from(el.querySelectorAll('[role="radio"]')).map((r) =>
        truncate(ariaOptionText(r), 120)
      );
      record("aria-radiogroup", el, { options: opts });
    });

    // Native radio groups
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const groups = new Map();
    for (const r of radios) {
      if (!isVisible(r)) continue;
      const name = r.name || r.getAttribute("data-automation-id") || `_${Math.random()}`;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(r);
    }
    groups.forEach((group, name) => {
      const first = group[0];
      const container = first.closest("fieldset, [role=group], div");
      const target = container || first;
      if (seen.has(target)) return;
      seen.add(target);
      widgets.push({
        kind: "native-radiogroup",
        key: profileKeyFor(getSignal(target)),
        signal: truncate(getSignal(target)),
        groupName: name,
        options: group.map((r) => truncate(radioLabelText(r), 120)),
        outerHTML: truncate(target.outerHTML, 1200),
      });
    });

    document.querySelectorAll('[role="checkbox"]').forEach((el) => isVisible(el) && record("aria-checkbox", el));
    document.querySelectorAll('input[type="checkbox"]').forEach((el) => isVisible(el) && record("native-checkbox", el));

    document.querySelectorAll(
      'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], [data-automation-id$="Dropdown"] button, button[data-automation-id*="elect"]'
    ).forEach((el) => isVisible(el) && record("button-dropdown", el));

    document.querySelectorAll(
      'input[role="combobox"], input[aria-autocomplete="list"], input[aria-autocomplete="both"]'
    ).forEach((el) => isVisible(el) && record("combobox", el));

    return {
      url: location.href,
      title: document.title,
      capturedAt: new Date().toISOString(),
      widgetCount: widgets.length,
      widgets,
    };
  }
})();
