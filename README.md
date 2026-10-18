# Punto

A Chrome extension that autofills job applications — including Workday's custom ARIA widgets, radio groups, checkboxes, and 3-input date pickers — using a profile you build through a guided wizard :)

## Why

Workday/Greenhouse/Lever/etc. ask the same ~50 questions over and over:
authorization to work, sponsorship, EEO disclosures, veteran/disability status,
graduation date, signature, agreement disclosures, and so on.

Resume autofill handles your name, contact info, and education. Everything else
— the radio buttons, dropdowns, legal disclosures, and demographic questions —
you fill in by hand every single time.

Punto fixes that. You answer each question **once** in a guided wizard, and
Punto fills it everywhere from then on.

## Features

- **Guided onboarding wizard** — one question per screen, ~47 questions across Identity, Contact, Address, Work Authorization, Education, Experience, Demographics & EEO, Legal Disclosures, Links, and Signature. Resumes where you left off.
- **Workday-aware filler** — handles ARIA `role="radiogroup"`, `role="combobox"`, `aria-haspopup="listbox"` button dropdowns, and the 3-input (Month/Day/Year) date pickers that Workday uses.
- **Generic form support** — also fills native `<input>`, `<select>`, `<textarea>`, and native `<input type="radio"/checkbox>` widgets on any site.
- **Smart signal extraction** — respects form-field boundaries so each question's signal doesn't get contaminated by adjacent questions.
- **Diagnose-this-page button** — when something doesn't fill, exports a JSON report of every detected field with its extracted signal and matched key, so you can debug or send it to a maintainer.
- **Profile completeness indicator** in the popup.
- **Export / import** profile as JSON for backup or moving between machines.
- **Local-only storage** — your data never leaves your browser. No accounts, no servers, no telemetry.

## Installation

Punto is not on the Chrome Web Store yet. To install:

1. Clone this repo: `git clone https://github.com/puneet20011/Punto.git`
2. Open Chrome → `chrome://extensions`
3. Toggle **Developer mode** (top-right)
4. Click **Load unpacked**
5. Select the cloned `Punto` folder
6. A new tab opens with the onboarding wizard — walk through the questions

## Usage

### Setting up your profile

On first install, a setup tab opens automatically. Walk through each question.
Skip the ones marked optional if they don't apply. The wizard saves to local
storage as you go, so you can quit and resume any time via the popup's
**Resume setup** link.

### Autofilling an application

1. Open a job application page (Workday, Greenhouse, etc.)
2. Click the **Punto** icon in your Chrome toolbar
3. Click **Autofill This Page**
4. Review the filled fields, fix anything that needs adjustment, submit

### Editing answers later

- **Edit my answers** — restart the wizard from question 1
- **Resume setup** — jump to the first unanswered question (useful after new questions are added in an update)

### Diagnosing a page that doesn't fill

1. Click the Punto icon → **Diagnose this page**
2. A JSON file downloads to `~/Downloads/punto-diagnose-*.json`
3. The file lists every detected widget with its extracted signal and matched key — open an issue with the file attached, or use it to debug locally

## How it works

```
┌────────────────┐    save     ┌──────────────────┐
│  Onboarding    ├────────────▶│ chrome.storage   │
│    wizard      │             │     .local       │
└────────────────┘             └────────┬─────────┘
                                        │ read
                                        ▼
┌────────────────┐  message   ┌─────────────────────┐
│     Popup      ├───────────▶│   Content Script    │
│  (Autofill)    │            │   on the active     │
└────────────────┘            │       tab           │
                              └─────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │  Detect widgets,    │
                              │  extract signals,   │
                              │  match to profile,  │
                              │  fill via native    │
                              │  value setters +    │
                              │  events             │
                              └─────────────────────┘
```

### Signal extraction

For each widget on the page, Punto builds a "signal" by reading:
`data-automation-id`, `name`, `id`, `aria-label`, `aria-labelledby`,
`aria-describedby`, `placeholder`, associated `<label>`, wrapping `<label>`,
enclosing `<fieldset><legend>`, and ancestor text up to the nearest
form-field boundary.

The signal is matched against a regex map (`FIELD_MAP` in `content.js`) that
maps signal patterns to profile keys.

### Workday gotchas Punto handles

- Workday wraps each question in `<div data-automation-id="formField-XXX">`. These wrappers are siblings, so naïve ancestor traversal pollutes each question's signal with neighboring questions' text. Punto stops walking at this boundary.
- Workday doesn't use native `<input type="radio">`. It uses `[role="radiogroup"]` with `[role="radio"]` children.
- Dropdowns are `<button aria-haspopup="listbox">` that open a portal-rendered listbox. Punto clicks the button, waits for the listbox, then clicks the matching option.
- Date inputs are three `role="spinbutton"` inputs with `data-automation-id` ending in `dateSectionMonth-input`, `dateSectionDay-input`, `dateSectionYear-input`. Punto splits the stored `YYYY-MM-DD` value across them.
- Short keyword regexes use word boundaries — `\bcity\b` (avoids "ca**pa**city"), `\bunit\b` (avoids "**Unit**ed States"), `\bstate\b`, etc.

### React-compatible value setting

For controlled inputs (React/Workday), setting `el.value = ...` directly is
ignored on the next render. Punto uses the native prototype setter
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set`)
followed by `input` and `change` events, which React's synthetic event system
picks up.

## Project structure

```
Punto/
├── manifest.json         MV3 manifest
├── background.js         Opens the wizard on install
├── content.js            Field detection + filler + diagnose
├── questions.js          Wizard question schema (shared by wizard + popup)
├── onboarding.html       Wizard markup
├── onboarding.css        Wizard styles
├── onboarding.js         Wizard logic (navigation, persistence, signature pad)
├── popup.html            Toolbar popup
├── popup.css             Popup styles
├── popup.js              Popup logic (autofill, diagnose, export/import)
├── icons/                16/48/128 px extension icons
├── LICENSE               MIT
└── README.md             This file
```

## Supported field types

| Field type | Handled how |
|---|---|
| Text inputs (`text`, `email`, `tel`, `url`, `number`) | Native value setter + `input`/`change`/`blur` events |
| `<textarea>` | Native value setter |
| `<input type="date">` | Set as `YYYY-MM-DD` |
| Workday 3-input date pickers | Split `YYYY-MM-DD` across Month/Day/Year sub-inputs |
| Native `<select>` | Match option by text, set value, fire `change` |
| Native `<input type="radio">` groups | Match radio's label to profile value, click the label |
| ARIA `[role="radiogroup"]` | Match `[role="radio"]` text, click the radio |
| Native `<input type="checkbox">` | Toggle if needed based on Yes/No value |
| ARIA `[role="checkbox"]` | Toggle via click if `aria-checked` doesn't match |
| Workday button dropdowns (`button[aria-haspopup="listbox"]`) | Click → wait → click matching `[role="option"]` |
| ARIA `[role="combobox"]` / `aria-autocomplete="list"` | Focus → type value → click matching option |

## Privacy

- Punto stores your profile in `chrome.storage.local`, which lives only on your machine and is not synced anywhere.
- No network requests, no telemetry, no analytics.
- The extension's `host_permissions` cover `<all_urls>` because it needs to inject the content script on whatever job application page you're viewing. It does not read or transmit page contents to any server.

## Limitations

- **Resume upload** — Chrome's security model blocks programmatic file inputs. You still need to drag-drop or click-to-upload your resume manually.
- **Cascading dropdowns** — Some Workday country/state pairs filter each other after selection. Punto doesn't currently re-order to fill country first.
- **Drawn-signature injection** — The wizard captures a drawn signature, but Punto doesn't yet inject it into signature pad widgets on applications.
- **One profile** — No support yet for multiple profiles (e.g., "with sponsorship" vs. "without").
- **No resume parsing** — Phase 2. Would require bundling pdf.js or calling an LLM.

## Roadmap

- [ ] Resume PDF upload → prefill the wizard (pdf.js or LLM)
- [ ] Per-company overrides for fields like referral source
- [ ] Drawn-signature injection into canvas signature pads
- [ ] Multiple profile support
- [ ] More ATS coverage (Greenhouse, Lever, Ashby, iCIMS — diagnose-first approach)
- [ ] Cascading-dropdown ordering (country → state → city)
- [ ] Chrome Web Store publish

## Contributing

The fastest way to help cover a new application page is to:

1. Open the application
2. Click Punto → **Diagnose this page**
3. Open a GitHub issue with the downloaded JSON attached, plus a one-line description of which fields didn't fill

If you want to fix it yourself, the relevant files are usually:

- `content.js` → `FIELD_MAP` (regex for matching question text to profile keys)
- `questions.js` (add a new wizard question if a brand-new field is needed)

## License

[MIT](LICENSE) © 2026 Puneet Puri
