# Fix Changelog — background.js v2 → v3

## Summary

Seven fixes addressing the auto-import hang and incorrect data extraction. The Cloud Coach extraction was the critical failure — its entire UI lives inside a cross-origin Visualforce iframe requiring two-step navigation that the extension didn't handle. The Salesforce extraction works but has an aria-label parsing bug. Outlook is unchanged (working correctly).

---

## Fix 1: Cloud Coach Two-Step Navigation
**File:** `background_v3_fixes.js`
**Replaces:** `clickCloudCoachRevisionsTab()` (lines 486–588)
**New functions:** `navigateToCloudCoachTickets()`, `clickCloudCoachTicketsSidebar()`

**Why:** The Cloud Coach Gameplan page loads a Dashboard view by default. Getting to the Tickets data table requires clicking the "Lists" tab first, then clicking "Tickets" in the sidebar. The old function tried a single click with selectors that didn't match the iframe's DOM.

**What changed:**
- Split into two focused functions, each handling one navigation step
- `navigateToCloudCoachTickets()` finds and clicks the "Lists" tab using text matching, SLDS tab selectors, and generic link fallbacks
- `clickCloudCoachTicketsSidebar()` finds and clicks "Tickets" in the sidebar using SLDS nav items, text matching, and badge detection
- Both return structured diagnostic objects for debugging

---

## Fix 2: Cloud Coach Card Fallback Cleanup
**File:** `background_v3_fixes.js`
**Modifies:** `extractCloudCoachData()` card fallback (was lines 818–835)

**Why:** The card fallback used `[class*="row"]` and `[class*="item"]` which matched Salesforce navigation bar elements in the top frame, producing garbage data like "DashboardsDashboards List".

**What changed:**
- Removed `[class*="row"]` and `[class*="item"]` from card selector — far too broad
- Added frame location validation: only runs if `location.href` includes `vf.force.com` or `project_cloud`
- Added pattern filtering to skip text matching known nav patterns ("dashboards", "sidebar", etc.)
- Added specific check for "DashboardsDashboards" repeated text pattern

---

## Fix 3: New Tickets Table Readiness Check
**File:** `background_v3_fixes.js`
**Replaces:** `isRevisionsTableReady()` (lines 594–607)
**New function:** `isTicketsTableReady()`

**Why:** The old readiness check only looked for `cc-sobject-table` which doesn't exist on the initial Dashboard view. It needed to validate that we've actually navigated to the Tickets table.

**What changed:**
- Check 1: `cc-sobject-table` with `tbody` rows AND minimum cell count (not just row existence)
- Check 2: Standard table with semantic column headers matching Tickets structure ("DUE DATE", "NAME", "PROJECT")
- Both checks verify actual data content, not just element existence

---

## Fix 4: Salesforce Aria-Label Parsing
**File:** `background_v3_fixes.js`
**Modifies:** `extractSalesforceData()` aria-label parsing (was lines 182–189)

**Why:** Salesforce report aria-labels have nested colons: `"Project (Rollup): Project Name: Louisa County VA..."`. The code split on the first `': '` and only got `"Project (Rollup)"` as the header, missing "Project Name" and causing `projectName` detection to fail.

**What changed:**
- Added `knownFieldNames` list: `['project name', 'color block', 'tag', 'project setup notes', 'owner name', ...]`
- When aria-label has 3+ parts after splitting on `': '`, checks if `parts[1]` matches a known field name
- If so, combines `parts[0] + ': ' + parts[1]` as the full header, giving correct key like `"project (rollup): project name"`
- This makes `lk.includes('project') && lk.includes('name')` match correctly

---

## Fix 5: Multi-Step Pre-Extraction in importSource()
**File:** `background_v3_fixes.js`
**Modifies:** `importSource()` pre-extraction logic (was lines 925–951)

**Why:** Cloud Coach requires two sequential navigation clicks before extraction can run. The old code only supported a single `preExtractFunc`.

**What changed:**
- `preExtractFunc` parameter now accepts either a single function OR an array of functions
- When array: executes each function sequentially with retry logic
- Added configurable inter-step delay (4 seconds for Cloud Coach, 2 seconds otherwise)
- Added step failure logging for diagnostics

**Also updated:** `importAll()` and `UPDATED_SOURCE_CONFIG` to pass `[navigateToCloudCoachTickets, clickCloudCoachTicketsSidebar]` as the preExtract array for Cloud Coach.

---

## Fix 6: Frame-Prioritized runExtraction()
**File:** `background_v3_fixes.js`
**Modifies:** `runExtraction()` (was lines 844–869)

**Why:** The old code returned the FIRST frame's result with any data. When extracting with `allFrames: true`, the top frame's card fallback could produce garbage data ("DashboardsDashboards List") that got returned before the iframe's real data was even checked.

**What changed:**
- Collects ALL frame results before making a decision
- Sorts by priority: frames from `vf.force.com` / `project_cloud` get preference
- Secondary sort by data count (more data = higher priority)
- Post-filters results to remove entries containing known garbage patterns
- Still returns immediately on `needsLogin` detection

---

## Fix 7: Readiness Timeout Handling
**File:** `background_v3_fixes.js`
**Modifies:** `importSource()` readiness timeout (was lines 955–958)

**Why:** The old code silently ignored readiness timeout and proceeded to extract against unready DOM. For Cloud Coach, this meant extracting the Dashboard view instead of the Tickets table.

**What changed:**
- **Cloud Coach:** If readiness times out, returns an error with diagnostic info instead of attempting extraction. The timeout likely means navigation steps failed.
- **Salesforce:** Logs a warning but proceeds with extraction. The report might still be there even if the polling missed the ready state.

---

## Files NOT Modified

- **`importParser.ts`** — No changes needed. The data shape from corrected extractors matches the existing interfaces (`RawCloudCoachRevision`, `RawSalesforceRow`).
- **`extractOutlookData()`** — Working correctly, no changes.
- **`manifest.json`** — No permission changes needed. `https://*.force.com/*` already covers the Visualforce iframe domain.

---

## How to Apply

1. Open `extension/background.js`
2. Replace the following functions with their v3 versions from `background_v3_fixes.js`:
   - `clickCloudCoachRevisionsTab` → `navigateToCloudCoachTickets` + `clickCloudCoachTicketsSidebar`
   - `isRevisionsTableReady` → `isTicketsTableReady`
   - `extractCloudCoachData` → updated version
   - `extractSalesforceData` → updated version
   - `runExtraction` → updated version
   - `importSource` → updated version
   - `importAll` → updated version
3. Update the `wmp-import-source` config in the message listener to use `UPDATED_SOURCE_CONFIG`
4. Rebuild the extension
5. Reload in `chrome://extensions`
6. Trigger an import and verify

## Testing Checklist

- [ ] Cloud Coach: Navigates to Lists tab successfully
- [ ] Cloud Coach: Clicks Tickets sidebar item
- [ ] Cloud Coach: Tickets table loads and readiness check passes
- [ ] Cloud Coach: Extraction returns ticket data (not "DashboardsDashboards List")
- [ ] Salesforce: Report loads and readiness check passes
- [ ] Salesforce: Aria-labels parse correctly (projectName populated)
- [ ] Outlook: Still works (unchanged)
- [ ] No hang on import — completes within 60 seconds
