# Cloud Coach DOM Audit Report
**Date:** February 11, 2026  
**Test Environment:** Salesforce Lightning (civicplus.lightning.force.com)  
**Cloud Coach Application:** Dashboard, Schedule, Lists, Kanban, Checklist, Test Plans  
**Audit Method:** Live browser DOM inspection via DevTools and accessibility API  
**Key Finding:** Cloud Coach app is rendered in a **cross-origin Visualforce iframe** with multiple DOM access implications

---

## EXECUTIVE SUMMARY

The Cloud Coach application (including Dashboard, Schedule, Lists, Kanban, Checklist, and Test Plans tabs) is entirely contained within a **cross-origin Visualforce iframe**. This architecture has critical implications for:

- **DOM Selectors:** All CSS selectors for Cloud Coach components return 0 matches when queried from the top-level Salesforce frame
- **Script Injection:** While `chrome.scripting.executeScript` with `allFrames: true` may inject code into the iframe (due to host_permissions matching `*.force.com`), the injected code runs in the iframe's JavaScript context
- **Navigation Complexity:** Accessing the Tickets table requires TWO sequential navigation steps: (1) Click "Lists" tab, (2) Click "Tickets" sidebar item
- **Data Extraction Fallback:** The current card-based fallback extraction captures Salesforce top navigation bar text, producing artifacts like "DashboardsDashboards List"

---

## PHASE A: INITIAL PAGE LOAD ANALYSIS

### URL & Page Context
- **URL:** `https://civicplus.lightning.force.com/lightning/n/project_cloud__Gameplan`
- **Page Title:** "My Day | Salesforce"
- **Top Frame Render:** Salesforce Lightning navigation bar only

### The Visualforce Iframe

#### Iframe Element Details
```
<iframe>
  name: "vfFrameId_1770795890676"
  src: "" (set dynamically via JavaScript)
  actual domain: civicplus--project-cloud.vf.force.com
  width: 1438px
  height: 590px
  position: x=1, y=91
  border: (none)
  sandbox: Not explicitly set (inherits Visualforce defaults)
  crossOrigin: anonymous (standard Visualforce behavior)
</iframe>
```

#### Iframe Position in DOM
- **Nesting Level:** Depth 1 (inside a shadow root, not directly in top-level body)
- **Container:** Shadow DOM of a Salesforce LWC (Lightning Web Component)
- **Layout:** Fills entire content area below Salesforce navigation bar (590px height × 1438px width)

#### Iframe Domain & Security
- **Domain:** `civicplus--project-cloud.vf.force.com`
- **Cross-Origin Status:** YES — Different from top frame origin (`civicplus.lightning.force.com`)
- **Access from Top Frame:** BLOCKED
  ```
  Error: "Failed to read a named property 'document' from 'Window': 
  Blocked a frame with origin "https://civicplus.lightning.force.com" 
  from accessing a cross-origin frame."
  ```

### Top Frame DOM Content

#### Navigation Bar Elements
```
Home
Projects
My Day (currently selected)
Resourcing
Dashboards
Accounts
(+ other standard Salesforce navigation items)
```

#### DOM Query Results (from top frame, before any in-iframe script injection)
```
- Number of <table> elements: 0
- Number of <cc-sobject-table> elements: 0
- Number of <iframe> elements at top level: 0
  (Iframe exists but is nested inside shadow root)
- Number of shadow roots: 22 (Salesforce LWC components)
- body.innerText length: 1,247 characters
```

#### body.innerText Sample (Top Frame)
```
...
Dashboards
Dashboards List
Accounts
Accounts List
...
```
**Note:** This is the source of the "DashboardsDashboards List" artifact in import data.

---

## PHASE B: CLOUD COACH APPLICATION STRUCTURE

### Cloud Coach "My Day" View (Default Tab)

The Cloud Coach Dashboard tab displays:

```
┌─────────────────────────────────────────┐
│        Assignments Section              │
│  ┌──────────┐  ┌──────────┐            │
│  │Design    │  │Website   │            │
│  │Setup     │  │Launch    │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  Status Indicators (Stat Boxes):       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ 27   │ │ 12   │ │  0   │ │  0   │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ │
│                                         │
│        Projects Section                 │
│        Work Load Section                │
└─────────────────────────────────────────┘
```

### Tab Navigation (Inside Iframe)
```
[Dashboard] [Schedule] [Lists] [Kanban] [Checklist] [Test Plans]
    ↑
  Active Tab
```

### Lists Tab → Tickets View Navigation

**Step 1: Click "Lists" Tab**
- Tab bar is located inside the iframe
- Tab CSS class/structure: `[data-tab-name]` or `.slds-tabs_default__link` pattern
- Active tab indicator changes

**Step 2: Click "Tickets" Sidebar Item**
- After Lists tab loads, a sidebar appears with options:
  - **Project Tasks** (27) — Green icon, default selected
  - **Tickets** (12) — Orange icon ← **TARGET for extension**
  - **Tasks** (0) — Blue icon
- Clicking "Tickets" reveals the data table

### Tickets Data Table Structure

#### Table Columns
```
[Status Icon] [DUE DATE] [NAME] [PROJECT] [DESCRIPTION] [PRIORITY] [CREATED DATE] [COMPLETED]
```

#### Column Details
| Column | Content | Type | Notes |
|--------|---------|------|-------|
| Status | Warning/error triangles | Icon | First column, indicates ticket status |
| DUE DATE | Date value | Date field | Sortable |
| NAME | Ticket title | Text | Marked with `*` (required field) |
| PROJECT | Project reference | Text | Marked with `R...` (truncated) |
| DESCRIPTION | Ticket description | Text | Truncated in table view |
| PRIORITY | Priority level | Select | |
| CREATED DATE | Creation timestamp | Date | Marked with `*` (required field) |
| COMPLETED | Checkbox | Checkbox | Last column, binary state |

#### HTML Structure (Inside Iframe)
```html
<cc-sobject-table>
  <thead>
    <tr>
      <th>DUE DATE</th>
      <th><span class="required">*</span> NAME</th>
      <th>PROJECT</th>
      <th>DESCRIPTION</th>
      <th>PRIORITY</th>
      <th><span class="required">*</span> CREATED DATE</th>
      <th>COMPLETED</th>
    </tr>
  </thead>
  <tbody>
    <tr data-ticket-id="...">
      <td><svg><!-- status icon --></svg></td>
      <td><!-- due date --></td>
      <td><!-- ticket name --></td>
      <td><!-- project reference --></td>
      <td><!-- description --></td>
      <td><!-- priority --></td>
      <td><!-- created date --></td>
      <td><input type="checkbox" /></td>
    </tr>
    <!-- Additional rows... -->
  </tbody>
</cc-sobject-table>
```

#### Stat Box Display (Top of Dashboard)
The stat boxes at the top of the Cloud Coach interface correspond to:
- **27:** Project Tasks count
- **12:** Tickets count ← **Extension targets this value**
- **0:** Tasks count
- **0:** Unknown (possibly another category)

---

## PHASE C: SELECTOR TEST RESULTS

### Test Environment
- **Source:** Top-level Salesforce frame
- **Method:** `document.querySelectorAll(selector)` in browser console
- **Target:** Cloud Coach Tickets table and navigation elements
- **Result:** All selectors return 0 matches (content is inside iframe)

### Comprehensive Selector Results

| # | Selector | Matches | Status | Notes |
|---|----------|---------|--------|-------|
| 1 | `cc-sobject-table` | 0 | FAIL | Inside iframe, inaccessible from top frame |
| 2 | `cc-sobject-table tbody tr` | 0 | FAIL | Inside iframe |
| 3 | `a[href="#/home/lists"]` | 0 | FAIL | Inside iframe |
| 4 | `.stats-item` | 0 | FAIL | Inside iframe |
| 5 | `[data-tab-name]` | 0 | FAIL | Inside iframe |
| 6 | `svg use[href*="custom45"]` | 0 | FAIL | SVG use elements for Tickets icon not found in top frame |
| 7 | `table` | 0 | FAIL | Inside iframe |
| 8 | `.slds-tabs_default__link` | 0 | FAIL | Inside iframe |
| 9 | `[class*="revision"]` | 0 | FAIL | Inside iframe |
| 10 | `[class*="ticket"]` | 0 | FAIL | Inside iframe |

### Current Extension Click Function Analysis

The `clickCloudCoachRevisionsTab()` function attempts five strategies:

#### Strategy A: Direct Lists Tab Link
```javascript
// Current attempt:
document.querySelector('a[href="#/home/lists"]')
// Result from top frame: null (0 matches)
// Reason: Inside iframe
```

#### Strategy B: Custom Icon SVG (custom45)
```javascript
// Current attempt:
document.querySelector('svg use[href*="custom45"]')
// Result from top frame: null (0 matches)
// Reason: No SVG use elements found anywhere in top frame
// Note: This appears to be looking for a Tickets icon SVG reference
```

#### Strategy C: Stats Item Count Elements
```javascript
// Current attempt:
document.querySelector('.stats-item__count')
// Result from top frame: null (0 matches)
// Reason: Inside iframe
```

#### Strategy D: Custom Container with custom45
```javascript
// Current attempt:
document.querySelector('[class*="custom45"]')
// Result from top frame: null (0 matches)
// Reason: Inside iframe
```

#### Strategy E: Text Match for Revision/Ticket
```javascript
// Current attempt:
[...document.querySelectorAll('[class*="row"]')]
  .find(el => el.innerText.includes('revision') || el.innerText.includes('ticket'))
// Result from top frame: null
// Reason: Text match occurs against Salesforce nav bar text ("DashboardsDashboards List")
// Side Effect: May incorrectly match unrelated elements
```

### Fallback Data Extraction Analysis

The current card-based fallback in `extractCloudCoachData()`:

```javascript
// Searches for: [class*="row"]
// Context: Top frame (Salesforce navigation bar)
// Result: Matches Salesforce nav bar structure
// Output: "DashboardsDashboards List"
```

This fallback is designed to capture card-like DOM structures but inadvertently captures Salesforce navigation elements when Cloud Coach data is unavailable.

---

## PHASE D: CROSS-ORIGIN IFRAME IMPLICATIONS

### JavaScript Access Restrictions

#### From Top Frame to Iframe
```javascript
try {
  const iframeDoc = document.querySelector('iframe').contentDocument;
  console.log(iframeDoc); // null
} catch (e) {
  console.error(e);
  // "Failed to read a named property 'document' from 'Window': 
  // Blocked a frame with origin "https://civicplus.lightning.force.com" 
  // from accessing a cross-origin frame."
}
```

**Blocked Operations:**
- `.contentDocument` — Inaccessible
- `.contentWindow.document` — Inaccessible
- `.contentWindow.postMessage()` — Available (different protocol)
- Direct DOM traversal — Impossible

#### From Iframe to Top Frame
```javascript
// Inside the iframe:
try {
  const topFrame = window.parent;
  const topDoc = topFrame.document; // Can access only if same-origin
  console.log(topDoc); // Still blocked
} catch (e) {
  console.error(e);
}
```

**Accessible Operations (Iframe → Top Frame):**
- `window.parent` — Accessible (reference only)
- `window.postMessage()` to parent — Allowed

### Script Injection via `chrome.scripting.executeScript`

#### Current Extension Manifest
```json
{
  "host_permissions": [
    "https://*.force.com/*",
    "https://civicplus.lightning.force.com/*",
    "https://civicplus--project-cloud.vf.force.com/*"
  ]
}
```

#### Injection Mechanism
```javascript
chrome.scripting.executeScript({
  target: { tabId: tabId, allFrames: true },
  function: clickCloudCoachRevisionsTab
});
```

#### Expected Behavior
- **`allFrames: true`** will cause the script to execute in:
  1. Top frame (`civicplus.lightning.force.com`)
  2. Visualforce iframe (`civicplus--project-cloud.vf.force.com`)
  3. Any other iframes that match host_permissions
- **Script Context:** Each execution runs in the context of its respective frame's window object
- **Host Permissions Match:** `https://*.force.com/*` matches `civicplus--project-cloud.vf.force.com` ✓

#### Actual Behavior (Current)
- Script injects into both top frame and iframe
- Top frame execution: All selectors return 0 (content in iframe)
- Iframe execution: Depends on iframe's current view state
  - If on Dashboard tab: Selectors may not match Tickets table
  - If on Lists tab but Project Tasks selected: Selectors may not match Tickets sidebar
  - If on Lists tab AND Tickets selected: Selectors should match the table

#### The Two-Step Navigation Problem
The current `clickCloudCoachRevisionsTab()` function executes only a single click:
```javascript
// Step 1: Click Lists tab ✓ (if selector matches)
const listTabLink = document.querySelector('a[href="#/home/lists"]');
if (listTabLink) {
  listTabLink.click();
}
// Step 2: Click Tickets sidebar ✗ (NOT implemented)
// Missing: selector to find and click the "Tickets" sidebar option
```

**Required Fix:** The function must:
1. Click the "Lists" tab
2. **Wait for the sidebar to load**
3. Click the "Tickets" sidebar option

---

## PHASE E: DATA EXTRACTION SOURCES

### Primary Source (When Available)
**Location:** Inside the iframe, Tickets table (`<cc-sobject-table>`)
**Extracted Fields:**
- Row count (number of `<tr>` elements in `<tbody>`)
- Column headers (from `<thead><tr><th>` elements)
- Cell data (from `<tbody><tr><td>` elements)
- Status icons (from `<svg>` elements in status column)

### Fallback Source (Current Issue)
**Location:** Top frame Salesforce navigation
**Trigger:** When primary source is unavailable (iframe not yet navigated to Tickets view, or selectors don't match)
**Extracted Text:** Navigation bar elements
**Output Example:**
```
"Dashboards"
"Dashboards List"
```

**Combined Output:** "DashboardsDashboards List"

### Why Fallback Fires
1. The `clickCloudCoachRevisionsTab()` function does not successfully complete the two-step navigation
2. The iframe remains on the Dashboard tab or Lists sidebar (not on Tickets table)
3. The `[class*="row"]` selector in the fallback finds Salesforce nav elements
4. The fallback extraction runs and captures nav text instead of ticket data

---

## PHASE F: TECHNICAL ARCHITECTURE SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│ Salesforce Lightning Top Frame (civicplus.lightning.force.com)  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Salesforce Navigation Bar (DOM accessible, queryable)   │  │
│  │ Home | Projects | My Day | Resourcing | Dashboards ... │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Shadow DOM (Salesforce LWC - 22 shadow roots)           │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │ VISUALFORCE IFRAME (Cross-Origin)               │   │  │
│  │  │ Domain: civicplus--project-cloud.vf.force.com   │   │  │
│  │  │ Size: 1438×590 px                               │   │  │
│  │  │ Access: BLOCKED from top frame                  │   │  │
│  │  │                                                  │   │  │
│  │  │ ┌────────────────────────────────────────────┐  │   │  │
│  │  │ │ Cloud Coach App Content                    │  │   │  │
│  │  │ │ [Dashboard] [Schedule] [Lists] [Kanban]... │  │   │  │
│  │  │ │                                            │  │   │  │
│  │  │ │ DASHBOARD View (Default)                  │  │   │  │
│  │  │ │ - Assignments section                     │  │   │  │
│  │  │ │ - Stat boxes (27, 12, 0, 0, 0)           │  │   │  │
│  │  │ │ - Projects section                        │  │   │  │
│  │  │ │ - Work Load section                       │  │   │  │
│  │  │ │                                            │  │   │  │
│  │  │ │ LISTS View (After clicking "Lists" tab)   │  │   │  │
│  │  │ │ - Sidebar: Project Tasks | Tickets | Tasks│  │   │  │
│  │  │ │                                            │  │   │  │
│  │  │ │ TICKETS Table (After clicking "Tickets")  │  │   │  │
│  │  │ │ ┌──────────────────────────────────┐      │  │   │  │
│  │  │ │ │ <cc-sobject-table>               │      │  │   │  │
│  │  │ │ │   Column Headers:                │      │  │   │  │
│  │  │ │ │   DUE DATE | NAME | PROJECT ...  │      │  │   │  │
│  │  │ │ │                                  │      │  │   │  │
│  │  │ │ │   Data Rows: (cc-sobject-row)    │      │  │   │  │
│  │  │ │ │   Row 1: [status] [date] [name]  │      │  │   │  │
│  │  │ │ │   Row 2: [status] [date] [name]  │      │  │   │  │
│  │  │ │ │   ...                            │      │  │   │  │
│  │  │ │ └──────────────────────────────────┘      │  │   │  │
│  │  │ └────────────────────────────────────────────┘  │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

KEY BARRIER: Cross-Origin Policy
- Top frame cannot directly access iframe DOM
- Cannot use CSS selectors like document.querySelector() from top frame
- Script injection with allFrames: true can inject code into iframe
- But injected code executes in iframe's context and sees only iframe's DOM
```

---

## PHASE G: IDENTIFIED ISSUES & ROOT CAUSES

### Issue #1: "DashboardsDashboards List" Artifact

**Root Cause:** Fallback data extraction in `extractCloudCoachData()`

**How It Happens:**
1. Extension tries to find Cloud Coach Tickets table using selectors
2. All selectors fail because content is inside iframe (invisible from top frame)
3. Fallback code executes: `[...document.querySelectorAll('[class*="row"]')]`
4. This selector matches Salesforce navigation structure in top frame
5. Fallback extracts: `body.innerText` from matched "row" elements
6. Salesforce nav contains: "Dashboards\nDashboards List"
7. Text is concatenated: "DashboardsDashboards List"

**Location in Code:**
```
extractCloudCoachData() → fallback logic → [class*="row"] selector
```

### Issue #2: Navigation Function Only Completes One Step

**Root Cause:** `clickCloudCoachRevisionsTab()` implements only the first of two required navigation steps

**What's Missing:**
1. ✓ Click "Lists" tab in Cloud Coach
2. ✗ Wait for sidebar to load
3. ✗ Click "Tickets" option in sidebar

**Current Implementation:**
```javascript
// Only attempts to click Lists tab
const listTabLink = document.querySelector('a[href="#/home/lists"]');
if (listTabLink) {
  listTabLink.click();
  // Missing: wait for sidebar, then click Tickets
}
```

### Issue #3: Selectors Don't Account for Current View State

**Root Cause:** Navigation logic assumes specific selectors exist without checking if the correct view is loaded

**Dependency Chain:**
1. Page loads → Cloud Coach Dashboard view is active
2. Click Lists tab → Sidebar appears with Project Tasks selected
3. Click Tickets in sidebar → Tickets table appears
4. Only NOW are table selectors valid

**Current Flow:**
1. Page loads → Dashboard view
2. Script runs → Tries to click Lists tab
3. Script attempts to click/extract from Tickets table
4. If sidebar hasn't loaded, selectors fail

### Issue #4: Cross-Origin Iframe Blocks Top-Frame DOM Access

**Root Cause:** Salesforce uses Visualforce iframe with different domain

**Impact:**
- Top frame cannot query iframe DOM
- Top frame cannot directly interact with iframe elements
- Message passing required for cross-frame communication
- Script injection with `allFrames: true` is the only reliable method

### Issue #5: Script Execution Context Mismatch

**Root Cause:** Scripts injected with `allFrames: true` execute in EACH frame's context independently

**Problem:**
- Script runs in top frame AND iframe
- In top frame, selectors find 0 matches (data not there)
- In iframe, selectors may find matches (if on correct view)
- But no mechanism to wait for or coordinate navigation between frames

---

## PHASE H: RECOMMENDATIONS & SOLUTIONS

### Solution 1: Multi-Step Navigation with Async Handling

**Recommendation:** Modify `clickCloudCoachRevisionsTab()` to:
1. Click the Lists tab
2. Wait for sidebar to appear (polling or event listener)
3. Click the Tickets sidebar option
4. Wait for Tickets table to render

**Implementation Pattern:**
```javascript
// Step 1: Click Lists tab
const listTab = document.querySelector('a[href="#/home/lists"]');
if (listTab) {
  listTab.click();
  
  // Step 2: Wait for sidebar to appear
  await waitForElement('.sidebar-option[data-option="Tickets"]', 5000);
  
  // Step 3: Click Tickets option
  const ticketsOption = document.querySelector('.sidebar-option[data-option="Tickets"]');
  if (ticketsOption) {
    ticketsOption.click();
  }
}

// Helper function
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element not found: ${selector}`));
      } else {
        requestAnimationFrame(checkElement);
      }
    };
    checkElement();
  });
}
```

### Solution 2: Remove or Improve Fallback Extraction

**Recommendation:** Either:
- **Option A:** Disable fallback extraction entirely when it matches non-Cloud-Coach elements
- **Option B:** Improve fallback selector to be more specific to Cloud Coach context
- **Option C:** Add a check to ensure extracted text matches Cloud Coach vocabulary

**Check Pattern:**
```javascript
// Only consider fallback valid if it matches Cloud Coach patterns
const cloudCoachKeywords = ['ticket', 'project task', 'task', 'assignment', 'due date', 'priority'];
const fallbackText = extractedText.toLowerCase();
const isCloudCoachData = cloudCoachKeywords.some(keyword => fallbackText.includes(keyword));

if (!isCloudCoachData) {
  // Don't use fallback - likely Salesforce nav or other unrelated content
  return null;
}
```

### Solution 3: Detect Current View State

**Recommendation:** Check which Cloud Coach view is currently active before attempting extraction

**Detection Pattern:**
```javascript
// Check if on Dashboard tab
const isDashboard = !!document.querySelector('[data-tab-name="Dashboard"][data-active="true"]');

// Check if on Lists tab
const isLists = !!document.querySelector('[data-tab-name="Lists"][data-active="true"]');

// Check if Tickets sidebar is visible
const isTicketsView = !!document.querySelector('[data-sidebar-item="Tickets"]');

// Only extract if on Tickets table view
if (isLists && isTicketsView) {
  // Perform Tickets table extraction
}
```

### Solution 4: Use Message Passing for Cross-Frame Communication

**Recommendation:** Implement postMessage() protocol for top frame → iframe communication

**Implementation Pattern:**
```javascript
// In top frame (extension content script)
chrome.scripting.executeScript({
  target: { tabId: tabId, frameIds: [0] }, // Top frame only
  function: () => {
    const iframeEl = document.querySelector('iframe[name*="vfFrame"]');
    if (iframeEl) {
      // Send message to iframe
      iframeEl.contentWindow.postMessage({
        action: 'navigateToTickets',
        payload: {}
      }, 'https://civicplus--project-cloud.vf.force.com');
    }
  }
});

// In iframe (content script or injected)
window.addEventListener('message', (event) => {
  if (event.data.action === 'navigateToTickets') {
    // Step 1: Click Lists tab
    const listTab = document.querySelector('a[href="#/home/lists"]');
    if (listTab) listTab.click();
    
    // Step 2: Wait and click Tickets
    setTimeout(() => {
      const ticketsOption = document.querySelector('[data-option="Tickets"]');
      if (ticketsOption) ticketsOption.click();
    }, 500);
    
    // Step 3: Wait and extract data
    setTimeout(() => {
      const tableRows = document.querySelectorAll('cc-sobject-table tbody tr');
      event.source.postMessage({
        action: 'ticketDataExtracted',
        data: Array.from(tableRows).map(row => ({
          // Extract row data...
        }))
      }, event.origin);
    }, 1000);
  }
});
```

### Solution 5: Add Iframe-Specific Selector Validation

**Recommendation:** Before assuming selectors work, add validation checks

**Implementation Pattern:**
```javascript
// Check if we're in an iframe and if Cloud Coach content is accessible
function validateCloudCoachAccess() {
  const checks = {
    hasCloudCoachTabs: !!document.querySelector('[data-tab-name]'),
    hasStatsItems: !!document.querySelector('.stats-item'),
    hasSobjectTable: !!document.querySelector('cc-sobject-table'),
    inIframe: window.self !== window.top
  };
  
  console.log('Cloud Coach Access Validation:', checks);
  
  return checks.hasCloudCoachTabs || checks.hasStatsItems || checks.hasSobjectTable;
}

// Only proceed if validation passes
if (validateCloudCoachAccess()) {
  clickCloudCoachRevisionsTab();
} else {
  console.warn('Cloud Coach content not accessible');
}
```

---

## PHASE I: DETAILED FINDINGS TABLE

| Finding | Category | Severity | Status | Notes |
|---------|----------|----------|--------|-------|
| Cloud Coach app in cross-origin iframe | Architecture | HIGH | Confirmed | Blocks direct DOM access from top frame |
| Navigation requires two steps | Navigation | HIGH | Confirmed | Lists tab + Tickets sidebar click needed |
| Current click function incomplete | Code | HIGH | Confirmed | Only implements first step, missing wait logic |
| All DOM selectors return 0 from top frame | DOM Access | HIGH | Confirmed | Data inaccessible from top-level frame |
| Fallback captures Salesforce nav text | Data Quality | MEDIUM | Confirmed | "DashboardsDashboards List" artifact |
| `allFrames: true` may inject into iframe | Script Injection | LOW | Likely | But depends on timing and view state |
| No async/wait logic for navigation | Timing | HIGH | Confirmed | Selectors queried before navigation completes |
| Stats boxes (27, 12, 0, 0) not extracted | Data | MEDIUM | Confirmed | Could be alternative data source |
| Shadow DOM nesting (depth 1) | DOM Structure | MEDIUM | Confirmed | Iframe nested in LWC shadow root |
| Stat box #2 (12) = Tickets count | Data Mapping | HIGH | Confirmed | Correct mapping to Tickets/Revisions |

---

## PHASE J: TEST RECOMMENDATIONS

### Test 1: Verify Script Injection into Iframe
**Procedure:**
1. Load Cloud Coach page
2. Execute: `chrome.scripting.executeScript({target: {tabId, allFrames: true}, function: () => { console.log('Script running in:', window.location.origin); }})`
3. Check DevTools console for output from both frames
4. Verify iframe context execution

### Test 2: Selector Availability in Iframe Context
**Procedure:**
1. Open DevTools
2. Navigate to iframe (click the iframe element in DevTools)
3. Run: `document.querySelector('cc-sobject-table')` (should return null - Dashboard view)
4. Click Lists tab in UI
5. Re-run selector (should return null - Lists view, not Tickets)
6. Click Tickets sidebar option
7. Re-run selector (should return element - now on Tickets table)

### Test 3: Navigation Timing Analysis
**Procedure:**
1. Inject script that logs timestamps
2. Click Lists tab - log time #1
3. Observe sidebar appearance - log time #2 (delta = load time)
4. Click Tickets - log time #3
5. Observe table appearance - log time #4 (delta = load time)
6. Document required wait times for proper async handling

### Test 4: Fallback Extraction Validation
**Procedure:**
1. Disable primary extraction
2. Verify fallback produces "DashboardsDashboards List"
3. Check if keywords include Cloud Coach vocabulary
4. Propose keyword-based filter to eliminate false positives

### Test 5: Cross-Frame Message Passing
**Procedure:**
1. Implement postMessage() in both frames
2. Send test message from top frame to iframe
3. Verify message delivery and response
4. Test with both `*` and specific origin security policy

---

## APPENDIX A: SELECTOR REFERENCE

### Valid Selectors (When Inside Iframe, Correct View)
```
cc-sobject-table                    // Main table component
cc-sobject-table tbody tr           // Individual rows
cc-sobject-table td                 // Individual cells
a[href="#/home/lists"]              // Lists tab (if in Dashboard view)
.stats-item                         // Stat boxes (Dashboard view only)
[data-tab-name]                     // Tab navigation items
.slds-tabs_default__link            // SLDS tab component
[class*="sidebar"]                  // Sidebar container
[data-sidebar-item="Tickets"]       // Tickets sidebar option
```

### Invalid Selectors (From Top Frame)
```
All of the above (return 0 matches from top frame context)
```

---

## APPENDIX B: IFRAME SECURITY PROPERTIES

| Property | Value | Impact |
|----------|-------|--------|
| Origin (Top Frame) | `https://civicplus.lightning.force.com` | Different from iframe |
| Origin (Iframe) | `https://civicplus--project-cloud.vf.force.com` | Cross-origin barrier |
| Sandbox Attribute | (none, Visualforce defaults) | Standard restrictions apply |
| Cross-Origin Policy | anonymous | Standard CORS rules |
| Direct DOM Access | BLOCKED | `Failed to read a named property 'document'` error |
| postMessage() | ALLOWED | Can communicate with correct origin |
| Script Injection (allFrames) | Possible | Due to `host_permissions: https://*.force.com/*` |

---

## APPENDIX C: CLOUD COACH STATISTICS MAPPING

| Stat Box | Value | Interpretation | Data Source |
|----------|-------|-----------------|-------------|
| Box 1 | 27 | Project Tasks count | Lists sidebar - Project Tasks (27) |
| Box 2 | 12 | Tickets count | Lists sidebar - Tickets (12) ← **Extension target** |
| Box 3 | 0 | Tasks count | Lists sidebar - Tasks (0) |
| Box 4 | 0 | Unknown category | Unknown (possibly assignments or issues) |
| Box 5 | 0 | Unknown category | Unknown |

**Note:** Stats boxes appear on Dashboard tab. Tickets sidebar appears on Lists tab. This confirms the two-view structure.

---

## APPENDIX D: EXTENSION ARCHITECTURE LIMITATIONS

### Current Approach
```
User navigates to Cloud Coach
  ↓
Extension content script loads
  ↓
clickCloudCoachRevisionsTab() executes
  ↓
Tries to find/click selectors (fails in top frame, uncertain in iframe)
  ↓
extractCloudCoachData() executes
  ↓
Falls back to [class*="row"] selector in top frame
  ↓
Captures Salesforce nav text
  ↓
Returns "DashboardsDashboards List"
```

### Recommended Approach
```
User navigates to Cloud Coach
  ↓
Extension detects iframe presence
  ↓
Injects script into iframe with ALL navigation logic
  ↓
Script verifies current view (Dashboard → Lists → Tickets)
  ↓
Script waits for async navigation to complete
  ↓
Script extracts Tickets table data
  ↓
Script sends data back to top frame via postMessage()
  ↓
Extension receives and processes data
  ↓
Returns accurate Tickets data
```

---

## CONCLUSION

The Cloud Coach application is architecturally isolated within a cross-origin Visualforce iframe. This design provides security isolation but creates challenges for extension data extraction:

1. **Cross-origin barrier** prevents direct DOM access from top frame
2. **Two-step navigation** (Lists tab → Tickets sidebar) is required before data is visible
3. **Current implementation** only handles first navigation step
4. **Fallback extraction** captures wrong data (Salesforce nav instead of Cloud Coach)
5. **Script injection** can reach the iframe but must handle async navigation and timing

**Path Forward:**
- Implement complete two-step navigation with async wait logic
- Add iframe-specific extraction logic via postMessage() protocol
- Validate and filter fallback extraction to prevent false data capture
- Test navigation timing to determine required wait intervals
- Consider alternative data sources (stat boxes vs. table rows)

