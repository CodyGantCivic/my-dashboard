# Chrome Extension Auto-Import Hang Diagnosis

**Date**: 2026-02-11  
**Issue**: Chrome extension's auto-import feature hangs indefinitely and returns wrong data  
**Affected Data Sources**: Cloud Coach (critical), Salesforce Report (medium), Outlook Calendar (unknown)

---

## EXECUTIVE SUMMARY

The extension imports from three Salesforce-integrated sources. The **Cloud Coach integration is fundamentally broken** due to:
1. Entire Cloud Coach UI rendered inside a cross-origin Visualforce iframe
2. Navigation requires two sequential steps (Lists tab → Tickets sidebar), but code only attempts one
3. Extracted data from the wrong DOM state (Dashboard instead of Tickets table) contains garbage
4. Poor orchestration masks failures and allows top-frame navigation text to be returned as data

**Estimated hang duration**: 42–111 seconds per import cycle, often returning invalid data.

---

## ROOT CAUSE #1: CLOUD COACH — Cross-Origin Iframe + Two-Step Navigation

### The Architecture Problem

The Cloud Coach Gameplan page (`/lightning/n/project_cloud__Gameplan`) renders the **entire Cloud Coach application inside a cross-origin Visualforce iframe**:

- **Iframe source**: `civicplus--project-cloud.vf.force.com`
- **Iframe name**: `vfFrameId_*` (dynamically generated)
- **Iframe src**: Set dynamically after page load
- **Iframe fill**: 1438×590 pixels — occupies all content space
- **Top frame content**: Only Salesforce navigation bar (Dashboards, Accounts, Contacts, etc.)

The Cloud Coach iframe loads with the **Dashboard view** by default, showing:
- Assignments
- Colored stat boxes (27, 12, 0, 0, 0)
- Projects list
- Work Load section

**The Tickets table is NOT visible on the Dashboard view.** It only appears after a two-step navigation:

1. Click the "Lists" tab in the Cloud Coach sidebar (among: Dashboard, Schedule, **Lists**, Kanban, Checklist, Test Plans)
2. Click "Tickets" in the secondary sidebar (among: Project Tasks (27), **Tickets (12)**, Tasks (0))

Only then does the Tickets table render inside the iframe with actual ticket data.

### Why clickCloudCoachRevisionsTab() Fails (Code Reference: Lines 486–588)

The `clickCloudCoachRevisionsTab()` function is designed to navigate to the Tickets view. However, it has a critical flaw:

**When executed with `allFrames: true`**:
- The function runs in **both the top frame AND the Visualforce iframe**
- In the **top frame**: All 5 click strategies (A–E) search for tab/button selectors and find **ZERO matches** because the top frame contains only the Salesforce navigation bar
- In the **Visualforce iframe**: The function runs against the **Dashboard view** (the initial state), not the Tickets view

**The function only attempts ONE click attempt per strategy** (looking for "Revisions", "Tickets", "Issues", "Tasks", "Assignments" buttons/tabs). The Dashboard view displays different UI elements than the Lists/Tickets view, so the CSS selectors may not match even if the code tries to click.

**Critical logic gap**: The function does not:
- Confirm that a click succeeded
- Wait for the UI to transition after clicking
- Execute a SECOND click to access the Tickets sidebar item
- Validate that it's now viewing the Tickets table before proceeding

### Why "DashboardsDashboards List" Appears in Extracted Data

This garbage text is the **exact output from the top frame's DOM**:

```
...Dashboards\nDashboards List\nAccounts\nAccounts List...
```

These are Salesforce navigation bar items:
- A link element with text "Dashboards" (href="/lightning/o/Dashboard/home")
- A button element with text "Dashboards List"

**How it gets extracted**:

When `extractCloudCoachData()` runs in the top frame (lines 444–485), it attempts multiple strategies:

1. **Strategy 1** (`cc-sobject-table`): Looks for `class="cc-sobject-table"` — **NO MATCH** in top frame
2. **Strategy 2** (legacy table): Looks for `table` elements — **NO MATCH** in top frame
3. **Fallback to card extraction**: When all strategies fail, it searches for broad selectors:
   ```
   [class*="ticket"], [class*="task"], [class*="card"], [class*="item"], [class*="row"]
   ```
4. **The `[class*="row"]` selector is overly broad** and matches navigation bar elements in the Salesforce top frame
5. **Matched elements are converted to text** via `row.textContent`, producing:
   - "Dashboards" + "Dashboards List" → "DashboardsDashboards List"
   - Other nav items similarly concatenated

The top frame's `runExtraction()` function (lines 844–869) checks all frames and **returns the FIRST result with data**. If the top frame's card fallback produces this garbage data before the iframe's result is available, the garbage wins and gets returned as "imported tickets."

### Why isRevisionsTableReady() Never Returns True (Lines 594–607)

The readiness check function has a critical state validation problem:

```javascript
function isRevisionsTableReady() {
  const table = document.querySelector('cc-sobject-table');
  const ready = table && table.querySelector('tbody tr');
  return !!ready;
}
```

This checks for:
- A `cc-sobject-table` element
- With a `tbody` containing at least one `tr` (table row)

**In the top frame**: Neither element exists — returns `false` ✗

**In the Visualforce iframe (Dashboard view)**: The `cc-sobject-table` with tickets data does **NOT exist yet** because the Tickets table only renders after the two-step navigation — returns `false` ✗

**In the Visualforce iframe (after correct navigation)**: The elements would exist, but the code never navigates here correctly

The readiness check will timeout after 30 seconds (polling every 1 second, 30 attempts). At that point, the code proceeds to extraction anyway (see "Hang Mechanism" below).

### Why The Hang Mechanism Perpetuates the Problem

**Timeline for a single Cloud Coach import**:

1. `importSource()` opens or finds the Cloud Coach tab (line 959)
2. **Wait 8 seconds** (`INITIAL_DELAY`) for page to load (line 966)
3. **Call `clickCloudCoachRevisionsTab()` three times**:
   - Each call takes ~3 seconds (timeout per attempt)
   - 3 × 3s = 9 seconds
   - **All fail** — no actual navigation occurs
4. **Wait 4 seconds** (`SETTLE_DELAY`) for any DOM changes (line 975)
5. **Poll `isRevisionsTableReady()`** for up to 30 seconds:
   - Checks every 1 second (30 attempts)
   - All return `false` (still on Dashboard, not Tickets)
   - **Times out** after 30 seconds
6. **Code proceeds with extraction anyway** (line 957–958):
   ```javascript
   const isReady = await pollReadiness(tab.id, readinessFunc, allFrames, 30000, 1000);
   // ↑ Returns false, but result is NOT checked
   // Code continues to extraction regardless
   ```
7. **Extraction loop starts** (lines 844–869):
   - Runs `executeScript` with `extractCloudCoachData` in all frames
   - Top frame finds garbage nav text via card fallback: "DashboardsDashboards List"
   - Returns this as the result (first-data-wins logic)
   - **User sees invalid data: "DashboardsDashboards List" as a ticket**
   - OR: If iframe returns first (with empty array), code retries:
     - 12 retry attempts (line 853)
     - 5 seconds per retry (line 854)
     - 60 more seconds wasted

**Total minimum hang time: 8s + 9s + 4s + 30s = 51 seconds**  
**With extraction retries: Up to 111 seconds (almost 2 minutes)**

**If parallel with other sources and ImportWizard timeout (5 minutes)**, the user experiences:
- Salesforce data loads in ~5–10 seconds (may also have issues, see Root Cause #2)
- Outlook data loads in ~10–15 seconds (unknown status)
- Cloud Coach spins for 51–111 seconds, returning garbage data
- User sees partial/invalid results and may manually refresh or abandon the import

---

## ROOT CAUSE #2: SALESFORCE REPORT — Likely Working But Has Parsing Issues

### Architecture

The Salesforce report page (`/lightning/r/Report/00OUv000001hcUTMAY/view`) renders inside a **same-origin iframe**:

- **Iframe source**: `civicplus.lightning.force.com/reports/lightningReportApp.app`
- **Same-origin**: Content is accessible from the top frame (no cross-origin restrictions)
- **Extension permissions**: Host permissions include `civicplus.lightning.force.com`
- **Expected content**: Rows of project data with columns (Project Name, Owner, Status, etc.)

**Expected selectors** (from code strategy):
- `div.report-table-widget` with classes `widgetReady` and `finalState` ✅
- `table.data-grid-full-table` ✅
- `td[role="gridcell"]` (multiple cells per row) ✅

### Readiness Check — Should Work (Lines 87–106)

The `waitForSalesforceReport()` function checks for the presence of report table markup:

```javascript
const widget = document.querySelector('div.report-table-widget.widgetReady.finalState');
const table = document.querySelector('table.data-grid-full-table');
const cells = document.querySelectorAll('td[role="gridcell"]');
return !!(widget && table && cells.length > 0);
```

**In the Salesforce report iframe**:
- `div.report-table-widget.widgetReady.finalState` — **EXISTS** ✓
- `table.data-grid-full-table` — **EXISTS** ✓
- `td[role="gridcell"]` — **36+ matches** (actual report data) ✓

**Verdict**: The readiness check **should pass correctly** when run inside the iframe. The report waits for the widget to be ready, then extraction proceeds.

### Extraction — Works But Has Aria-Label Parsing Bug (Lines 124–442)

The `extractSalesforceData()` function uses multiple strategies:

**Strategy 1 (Wave Analytics)** — What the code uses:
```javascript
const cells = document.querySelectorAll('div.wave-table-cell-text[aria-label]');
// Returns 36 matches inside iframe with headers + data
```

Each cell has an aria-label like:
```
"Project (Rollup): Project Name: Louisa County VA | MWC Ultimate Redesign 1125"
```

**The parsing bug**:

The code splits this label to extract project name:

```javascript
const parts = label.split(': ');
// parts[0] = "Project (Rollup)"
// parts[1] = "Project Name"
// parts[2] = "Louisa County VA | MWC Ultimate Redesign 1125"

const headerKey = parts[0].toLowerCase(); // "project (rollup)"
const headerValue = parts.slice(1).join(': '); // "Project Name: Louisa County VA..."
```

**The problem**: The header key becomes `"project (rollup)"`, but the code looks for `"projectname"` or `"project name"` to populate `projectName` field:

```javascript
if (headerKey.includes('projectname') || headerKey === 'project name') {
  obj.projectName = headerValue;
}
```

The key `"project (rollup)"` doesn't match, so the fallback is used:

```javascript
if (!obj.projectName) {
  obj.projectName = lastCellValue; // Could be Owner Name or a SharePoint link
}
```

**Result**: `projectName` may contain incorrect data (e.g., the last column's value instead of the actual project name).

### Verdict on Salesforce

- **Should NOT hang** — readiness check passes, data exists, same-origin iframe is accessible
- **May have data quality issues** from the aria-label parsing bug (projectName field unreliable)
- **If it IS hanging**, it's likely due to:
  - `allFrames` script injection failing to target the iframe (low probability, but possible if iframe name is unusual)
  - Browser timing or Salesforce page load race condition
  - Exception being silently caught in the extraction loop

---

## ROOT CAUSE #3: ORCHESTRATION ISSUES

### importSource() — No Error Handling for Readiness Timeout (Lines 957–958)

```javascript
const isReady = await pollReadiness(tab.id, readinessFunc, allFrames, 30000, 1000);
// Result "isReady" is never checked
// Code proceeds to extraction immediately, regardless of readiness
```

**Problem**: After 30 seconds of polling without success, the code should either:
- Return an error ("Could not confirm data is ready, aborting import")
- Use a degraded mode with warnings

Instead, it **silently proceeds to extraction anyway** (line 959+), extracting from a partially-loaded or unready DOM. For Cloud Coach, this means extracting from the Dashboard view instead of the Tickets view.

### runExtraction() — First-Data-Wins Can Return Garbage (Lines 844–869)

```javascript
for (const frame of results) {
  if (frame.result && frame.result.data && frame.result.data.length > 0) {
    return frame.result; // First frame with data wins
  }
}
```

**Problem**: When `allFrames: true` injects the extraction function into multiple frames, the results come back as an array of frame-specific results. The code returns the FIRST frame that has non-empty data.

**For Cloud Coach**:
- Top frame's card fallback finds "DashboardsDashboards List" (1 item) → returns this garbage
- Iframe with actual Tickets data (12 items) → never consulted because top frame already had data

**Better strategy**:
- Prefer iframe results over top-frame results
- Filter out results from non-application frames (e.g., navigation bars)
- Only return data that matches expected structure (columns, required fields, etc.)

### importAll() — Parallel Execution Can Mask Failures (Lines 894–942)

```javascript
const results = await Promise.all([
  importSource('salesforce', ...),
  importSource('cloudcoach', ...),
  importSource('outlook', ...)
]);
```

**Problem**: All three sources run in parallel. If Cloud Coach takes 111 seconds (due to timeouts + retries) and Salesforce/Outlook finish in 15 seconds, the user sees:
- Salesforce data loaded immediately
- Outlook data loaded immediately
- Cloud Coach still spinning... (in background, taking 96 more seconds)

Then the extension displays partial results. If the user opens the import dialog again or if a hard timeout exists (e.g., 5-minute ImportWizard timeout mentioned in workflow description), the entire operation may fail or be cancelled.

---

## SUMMARY TABLE

| **Source** | **Root Cause** | **Type** | **Severity** | **Impact** |
|---|---|---|---|---|
| Cloud Coach | Cross-origin iframe + two-step navigation not handled | Architecture + Logic | **CRITICAL** | Hangs 51–111s, returns nav bar text as data |
| Cloud Coach | Card fallback `[class*="row"]` scrapes nav bar | Selector overshoot | **HIGH** | Returns garbage data "DashboardsDashboards List" |
| Cloud Coach | `clickCloudCoachRevisionsTab()` only attempts 1 of 2 required clicks | Logic | **CRITICAL** | Never reaches Tickets table |
| Cloud Coach | `isRevisionsTableReady()` checks wrong view state | Logic | **HIGH** | Always returns false, causes 30s timeout |
| Cloud Coach | Readiness timeout result ignored | Logic | **HIGH** | Proceeds with unready DOM anyway |
| Salesforce | Aria-label nested colons cause header truncation | Parsing | **MEDIUM** | `projectName` field may contain wrong data |
| Salesforce | `allFrames` injection may not reach iframe reliably | Infrastructure | **LOW** | Unlikely but possible cause of hangs |
| Orchestration | First-data-wins in `runExtraction()` returns top-frame garbage | Logic | **HIGH** | User receives invalid data instead of iframe data |
| Orchestration | Parallel execution masks failure feedback | Design | **MEDIUM** | User doesn't realize Cloud Coach is broken |
| Orchestration | No timeout for entire import operation | Design | **MEDIUM** | Can hang indefinitely if multiple retries trigger |

---

## RECOMMENDED FIX PRIORITY

### PHASE 1: CRITICAL (Implement First)

#### 1.1 **Replace Cloud Coach Navigation Logic** (Lines 486–588)

**Current problem**: Single-click attempt against wrong view state

**Solution**: Multi-step navigation function
```
Function: navigateCloudCoachToTickets()
  Step 1: Click "Lists" tab (wait 2 seconds)
  Step 2: Verify sidebar changed (check for "Tickets" item)
  Step 3: Click "Tickets" in sidebar (wait 2 seconds)
  Step 4: Verify table loaded (look for ticket rows)
  Return: true if successful, false if any step fails
```

**Expected outcome**: Reduces from 51s+ to ~10s, and actually reaches the correct table

#### 1.2 **Fix runExtraction() Frame Precedence** (Lines 844–869)

**Current problem**: First-data-wins returns top-frame garbage

**Solution**:
```
For each source type (cloud coach, salesforce, outlook):
  a) Collect results from all frames that executed successfully
  b) Prefer iframe/content results over top-frame/navigation results
  c) Validate returned data structure (expected columns, data types)
  d) Return highest-quality result only
  e) If no frame returns valid data, return empty array with error
```

**Expected outcome**: Invalid data filtered out, users see empty results instead of garbage

#### 1.3 **Remove Dangerous Card Fallback Selector** (Lines 444–485)

**Current problem**: `[class*="row"]` too broad, matches navigation elements

**Solution**:
- Remove the `[class*="row"]` selector entirely
- Keep only `[class*="ticket"]` and `[class*="task"]`
- Add a validation step: ignore any result without at least 2 items (singleton nav items are suspicious)

**Expected outcome**: Stops scraping nav bar text

#### 1.4 **Check Readiness Result Before Extraction** (Lines 957–958)

**Current problem**: Timeout result ignored, proceeds with unready DOM

**Solution**:
```javascript
const isReady = await pollReadiness(...);
if (!isReady) {
  console.warn('Cloud Coach not ready after 30s; extraction may fail or return incomplete data');
  // Option A: Return error
  // Option B: Proceed with warning (fallback mode)
}
```

**Expected outcome**: Visibility into when data may be unreliable

---

### PHASE 2: HIGH (Implement Next)

#### 2.1 **Fix Salesforce Aria-Label Parsing** (Lines 124–442)

**Current problem**: Nested colons cause header truncation

**Solution**: Parse aria-label more intelligently
```
Label: "Project (Rollup): Project Name: Louisa County VA | MWC Ultimate Redesign 1125"

Improved parsing:
  a) Split on ": " to get segments
  b) For Salesforce reports, segment[1] is always the column name
  c) Use segment[1] as header key, rest as value
  d) Match header key against known report column names (Project Name, Owner, Status, etc.)
```

**Expected outcome**: `projectName` reliably populated from correct column

#### 2.2 **Add Timeout for Entire Import Operation**

**Current problem**: No upper timeout for parallel imports

**Solution**: Wrap `importAll()` with a hard timeout
```javascript
const IMPORT_TIMEOUT = 120000; // 2 minutes
const result = await Promise.race([
  importAll(),
  new Promise((_, reject) => setTimeout(() => reject('Import timeout'), IMPORT_TIMEOUT))
]);
```

**Expected outcome**: User sees timeout error instead of indefinite hang

---

### PHASE 3: MEDIUM (QoL Improvements)

#### 3.1 **Add Progress Feedback**

- Display per-source status (Salesforce: Pending, Cloud Coach: Navigating, Outlook: Ready)
- Show time elapsed and estimated time remaining
- Allow user to cancel any source individually

#### 3.2 **Validate Extracted Data Structure**

Before returning results, verify:
- Required fields present (projectName, tickets count, dates)
- Data types correct (dates are dates, numbers are numbers)
- Row counts reasonable (not singleton navigation items)

#### 3.3 **Implement Retry Logic with Backoff**

- Instead of 12 immediate retries, use exponential backoff (1s, 2s, 4s, 8s...)
- After 3 failures, return error instead of continuing to retry
- Log failure reason for debugging

---

## TESTING CHECKLIST

After implementing fixes, verify:

- [ ] **Cloud Coach import** completes in <20 seconds
- [ ] **Cloud Coach results** contain 12 tickets with recognizable names (not "DashboardsDashboards List")
- [ ] **Salesforce import** completes in <15 seconds
- [ ] **Salesforce projectName** field matches actual project names from report
- [ ] **Outlook import** completes and shows accurate calendar entries
- [ ] **Parallel imports** show all three sources completing with separate statuses
- [ ] **Timeout handling** gracefully fails sources that exceed 60 seconds
- [ ] **Empty results** shown as empty arrays, not garbage data

---

## APPENDIX: Code References

**File**: `background.js` (full source not reproduced, referenced by line number)

**Key functions**:
- `importSource()` — lines 959–980 (orchestration, initial delays)
- `clickCloudCoachRevisionsTab()` — lines 486–588 (single-step navigation, ROOT CAUSE #1)
- `extractCloudCoachData()` — lines 444–485 (card fallback scrapes nav bar, ROOT CAUSE #1)
- `isRevisionsTableReady()` — lines 594–607 (checks wrong view state, ROOT CAUSE #1)
- `waitForSalesforceReport()` — lines 87–106 (readiness check, works correctly)
- `extractSalesforceData()` — lines 124–442 (aria-label parsing bug, ROOT CAUSE #2)
- `runExtraction()` — lines 844–869 (first-data-wins logic, ROOT CAUSE #3)
- `importAll()` — lines 894–942 (parallel execution, ROOT CAUSE #3)
- `pollReadiness()` — lines ~957–958 (timeout handling, ROOT CAUSE #3)

---

## CONCLUSION

The **Cloud Coach integration is fundamentally broken** due to an architecture mismatch: the code expects the Tickets table to be visible by default, but it's only accessible after a two-step navigation. The combination of incorrect navigation, cross-origin iframe constraints, and poor orchestration results in 51–111 second hangs followed by garbage data being returned.

**Quick fix estimate**: 4–6 hours to implement Phase 1 fixes. **Impact**: Reduces hang time by 80%, eliminates garbage data, makes service usable again.

**Long-term**: Consider fetching data directly from Salesforce's APIs instead of scraping the UI, which would eliminate brittle selector-based extraction entirely.

