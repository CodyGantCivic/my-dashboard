# Extension Source Code Summary — Extraction Logic

## 1. Salesforce CRM Analytics (Wave) Report

**URL:** `https://civicplus.lightning.force.com/lightning/r/Report/00OUv000001hcUTMAY/view`

**Readiness condition (`waitForSalesforceReport`):**
- `div.report-table-widget` must exist
- Must have BOTH `.widgetReady` AND `.finalState` classes
- Must contain `table.data-grid-full-table`
- Must have at least one `td[role="gridcell"]`

**Primary extraction (Strategy 1 — Wave Analytics):**
- Selectors: `div.report-table-widget.widgetReady.finalState` → `table.data-grid-full-table` → `tr` → `td[role="gridcell"]` → `div.wave-table-cell-text[aria-label]`
- Aria-label format: `"Column Header: Value"`
- Rows grouped by End Date / Task Name via rowspan
- Returns: `{ endDate, taskType, taskId, projectName, projectId, colorBlock, tag, setupNotes }`

**Fallback (Strategy 2 — Legacy):**
- `td[data-fixed-column="true"]` → closest table
- Falls back through: `[data-grid-full-table]`, `table.slds-table`, `table[role="grid"]`, `.report-content table`, any table with >2 rows
- Final fallback: check inside iframes

**allFrames:** true

---

## 2. Cloud Coach Gameplan

**URL:** `https://civicplus.lightning.force.com/lightning/n/project_cloud__Gameplan`

**Pre-extraction (`clickCloudCoachRevisionsTab`) — 5 strategies:**
- A: `a.slds-tabs_default__link[href="#/home/lists"]` → click
- B: SVG `<use>` with xlink:href containing `#custom45` → click closest `.slds-col`
- C: `.stats-item__count` or `h3[class*="stats-item"]` by index (index 1)
- D: `.slds-icon-custom-custom45` or `[class*="custom45"]` → click closest `.slds-col`
- E: Text match on buttons/links/tabs for "revision" or "ticket"

**Readiness condition (`isRevisionsTableReady`):**
- `cc-sobject-table` must exist
- Must contain `tbody` with `tr[cctablerow]` or `tr` rows

**Primary extraction (SLDS components):**
- Selectors: `cc-sobject-table tbody` → `tr[cctablerow], tr` → `td` cells by index
- Cell 2: Due Date (`span[title]`)
- Cell 3: Name (`div[title]`)
- Cell 4: Project (`a` link)
- Cell 5: Description (`div.slds-rich-text-editor__output[title]`)
- Cell 6: Priority (`span[title]`)
- Cell 7: Created Date (`span[title]`)
- Cell 8: Completed (`input[type="checkbox"]`)
- Cell 0: Status icons (`.slds-icon-text-error`, `.slds-icon-text-warning`)
- Returns: `{ name, project, description, hours, dueDate, priority, createdDate, completed, status, revisionLabel, webViewUrl, assignees }`

**Fallback (Legacy table):**
- Generic `table tbody tr` extraction
- Final fallback: card elements matching `[class*="ticket"], [class*="task"], [class*="card"], [class*="item"], [class*="row"]`
  - **WARNING**: This matches ANY element with "row" in a class name — likely grabs navigation/sidebar content

**allFrames:** true

---

## 3. Outlook Calendar (REFERENCE — works correctly)

**URL:** `https://outlook.office.com/calendar/view/week`

**No pre-extraction, no readiness polling.**

**Extraction:**
- Scans ALL elements with `[aria-label]`
- Filters: length > 20, contains time pattern `\d{1,2}:\d{2}` and `(AM|PM)`
- Returns deduplicated labels as string array
- `allFrames:` false

---

## Orchestration (`importSource`)

1. Opens tab via `ensureTab()` (finds existing or creates new)
2. Waits `INITIAL_DELAY` (8s for SF/CC, 3s for Outlook)
3. Pre-extraction: up to 3 attempts with 3s between each, then 4s settle time
4. Readiness polling: 30s timeout, 1s interval → **if timeout, proceeds to extraction anyway** (line 957-958)
5. Extraction retry: up to 12 retries × 5s delay = **60 seconds of retrying**
6. All sources run in parallel via `Promise.all`

**Known risk points:**
- Readiness timeout doesn't throw — proceeds to extract against unready DOM
- Cloud Coach card fallback (`[class*="row"]`) is dangerously broad
- 12 retries × 5s = potential 60s hang per source if extraction returns empty but no error
