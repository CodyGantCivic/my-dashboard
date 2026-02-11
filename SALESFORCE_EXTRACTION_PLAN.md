# Salesforce Report → Weekly Planner: Data Extraction Plan

## Source

- **Report**: Resource Assignments & Work — "This Week - Cody"
- **URL**: `https://civicplus.lightning.force.com/lightning/r/Report/00OUv000001hcUTMAY/view`
- **Platform**: Salesforce Lightning (Cloud Coach)

---

## DOM Structure (as of Feb 2026)

The report renders inside an **iframe** with class `isView reportsReportBuilder`. Inside the iframe, the data lives in two parallel `<table>` elements:

| Table | CSS Class | Purpose |
|-------|-----------|---------|
| Fixed column table | `data-grid-fixed-column-table` | Left-side grouping columns (End Date, Task Type) |
| Full table | `data-grid-full-table` | All columns including data fields |

### Key Selector Path

```
document
  → iframe.isView.reportsReportBuilder
    → iframe.contentDocument
      → table.data-grid-full-table
        → tr (rows)
          → td[data-fixed-column="true"]   ← group headers (End Date, Task Type)
          → td[data-fixed-column="false"]  ← data cells
```

### Data Attributes on Cells

Each `<td>` carries:
- `data-row-index` — row position (0-based)
- `data-column-index` — column position (0-based)
- `data-fixed-row` — always `"false"` for data rows
- `data-fixed-column` — `"true"` for group columns, `"false"` for data columns

---

## Column Map

| Index | Column Name | Maps to Planner Field | Notes |
|-------|-------------|----------------------|-------|
| fixed-0 | End (Calculated) | `endDate` | Format: `M/D/YYYY`, followed by `(count)` |
| fixed-1 | Project Task: Project Task Name | `taskType` | Values: `"Design Setup"`, `"Website Launch"`, possibly `"Revision"` |
| 0 | Project (Rollup): Project Name | `title`, `tier` | Contains client name + project type (Ultimate/Premium/Standard) |
| 1 | Project Task: Color Block | `status` | Emoji + text: `"🟩 Green"`, `"🟨 Yellow"`, `"🟥 Red"` |
| 2 | Project Task: Tag | `scheduledTime` | Free-text. For launches, contains date/time (e.g. `"2/11 at 1 pm central"`) |
| 3 | Project (Rollup): Project Setup Notes | `notes` | Free-text with AD name, template info, etc. |
| 4 | Project (Rollup): Owner Name | `projectOwner` | Account manager / project owner name |
| 5 | Project (Rollup): Active Project SharePoint Folder Link | `sharePointLink` | URL to project folder |

---

## Grouping Logic

Rows are grouped by two levels:

1. **End Date** — appears in the first fixed cell when it changes, with format `M/D/YYYY(count)`
2. **Task Type** — appears in the second fixed cell when it changes, with format `TaskName(count)`

When a fixed cell is empty, the previous group value still applies. The extraction script must track `currentEndDate` and `currentTaskType` as state while iterating rows.

A `Total(N)` row appears at the bottom and should be skipped.

---

## Tier Detection

The project tier is embedded in the Project Name string. Detection rules:

```
if projectName contains "Ultimate"          → tier = "ultimate"
if projectName contains "Premium"           → tier = "premium"
if projectName contains "Migration Premium" → tier = "premium"
else                                        → tier = "standard"
```

---

## Current Week Data (Feb 9, 2026)

| Task Type | Count | Projects |
|-----------|-------|----------|
| Design Setup | 3 | Louisa County VA (Ultimate), Rock Hall MD (Premium), Chino Valley AZ (Ultimate) |
| Website Launch | 4-5 | Chaska MN, New Rochelle NY, Boca Raton FL, Saratoga Springs UT, + possibly more |

### Launch Times from Tag Field

The Tag field for Website Launches contains scheduled times that need parsing:

| Project | Raw Tag | Parsed |
|---------|---------|--------|
| Chaska MN | `"February 11th from 10:30 am to 12 pm CST"` | Wed Feb 11, 10:30 AM – 12:00 PM CST |
| New Rochelle NY | `"2/11 at 1 pm central"` | Wed Feb 11, 1:00 PM CST |
| Boca Raton FL | `"2/12 at 1 pm est"` | Thu Feb 12, 1:00 PM EST |
| Saratoga Springs UT | `"Website Launch scheduled for 2/10 from 10:00am-11:00am (CST)"` | Mon Feb 10, 10:00 AM – 11:00 AM CST |

**These are inconsistent formats** — will need a flexible date/time parser or AI-assisted extraction.

---

## Extraction Script (Working Prototype)

This JavaScript runs in the browser console or via a Chrome extension and extracts the full dataset:

```javascript
function extractSalesforceReport() {
  const iframe = document.querySelector('iframe.isView.reportsReportBuilder');
  if (!iframe) throw new Error('Report iframe not found');

  const doc = iframe.contentDocument;
  if (!doc) throw new Error('Cannot access iframe content');

  const fullTable = doc.querySelector('table.data-grid-full-table');
  if (!fullTable) throw new Error('Report table not found');

  const rows = Array.from(fullTable.querySelectorAll('tr')).slice(1);

  let currentEndDate = '';
  let currentTaskType = '';
  const records = [];

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    const fixedCells = cells.filter(c => c.getAttribute('data-fixed-column') === 'true');
    const dataCells = cells.filter(c => c.getAttribute('data-fixed-column') === 'false');

    // Update group context from fixed cells
    fixedCells.forEach(fc => {
      const text = fc.textContent.trim();
      if (text.match(/^\d+\/\d+\/\d+/)) {
        currentEndDate = text.replace(/\(\d+\)$/, '').trim();
      } else if (text && !text.startsWith('Select') && !text.startsWith('Total')) {
        currentTaskType = text.replace(/\(\d+\)$/, '').trim();
      }
    });

    // Skip total rows and empty data rows
    if (dataCells.length === 0 || currentTaskType.startsWith('Total')) return;

    const texts = dataCells.map(c => c.textContent.trim());
    const projectName = texts[0] || '';

    // Detect tier from project name
    let tier = 'standard';
    const nameLower = projectName.toLowerCase();
    if (nameLower.includes('ultimate')) tier = 'ultimate';
    else if (nameLower.includes('premium')) tier = 'premium';

    records.push({
      endDate: currentEndDate,
      taskType: currentTaskType,
      tier,
      projectName,
      colorBlock: texts[1]?.replace(/[🟩🟨🟥]\s*/g, '').trim() || '',
      tag: texts[2] || '',
      setupNotes: texts[3] || '',
      ownerName: texts[4] || '',
    });
  });

  return records;
}
```

---

## Mapping to Weekly Planner Blocks

Each Salesforce record maps to a `TimeBlock` in the planner:

| Salesforce Field | Planner Field | Mapping Logic |
|-----------------|---------------|---------------|
| `taskType` + `tier` | `block.type` | `"Design Setup"` + `"ultimate"` → `"setup-ultimate"` |
| `projectName` | `block.title` | Direct (e.g. `"Louisa County VA – Ultimate Setup"`) |
| `taskType` | `block.durationMinutes` | Setup: estimate by tier. Launch: always 30 min. |
| `tag` (for launches) | `block.day` + `block.startHour` | Parse date/time from tag string |
| — | `block.locked` | `true` for launches (fixed times) |

### Estimated Hours by Task Type

| Task Type | Tier | Default Estimate |
|-----------|------|-----------------|
| Design Setup | Ultimate | 3.0 hours (180 min) |
| Design Setup | Premium | 2.0 hours (120 min) |
| Design Setup | Standard | 1.5 hours (90 min) |
| Website Launch | any | 0.5 hours (30 min) |
| Revision | any | 1.0 hour (60 min) — adjust as needed |

---

## Implementation Phases

### Phase 1: Manual Trigger (Now)
- Add a "Import from Salesforce" button to the planner
- User navigates to the report in Chrome, clicks a bookmarklet or extension button
- Script extracts data, copies JSON to clipboard
- Planner reads clipboard and generates blocks

### Phase 2: Bookmarklet / Extension
- Package the extraction script as a Chrome bookmarklet
- When clicked on the Salesforce report page, it extracts + sends data to `localStorage` under a known key
- The planner app reads from that key on load

### Phase 3: Automated (Future)
- Use Salesforce API (REST or Analytics API) to query the report directly
- Report ID: `00OUv000001hcUTMAY`
- Endpoint: `GET /services/data/vXX.0/analytics/reports/00OUv000001hcUTMAY`
- This returns structured JSON — no DOM parsing needed
- Requires Salesforce Connected App + OAuth token

---

## Source 2: Tickets / Revisions (Cloud Coach Gameplan)

### Location

- **URL**: `https://civicplus.lightning.force.com/lightning/n/project_cloud__Gameplan`
- **Access**: Sidebar → "Tickets" tab (red badge shows count)
- **Platform**: Cloud Coach Gameplan (Visualforce component inside Salesforce Lightning)

### DOM Access Challenge

The Cloud Coach Gameplan component renders inside a **cross-origin Visualforce iframe**. Unlike the standard Salesforce report iframe (which is same-origin and accessible), this Visualforce iframe is served from a different subdomain (`*.visualforce.com`), which means:

- `iframe.contentDocument` returns `null` (blocked by same-origin policy)
- Shadow DOM traversal cannot reach into the iframe
- `get_page_text` and accessibility tree tools only see the outer Lightning shell, not the Cloud Coach content
- No `data-grid-*` attributes are available — the ticket table uses Cloud Coach's own proprietary rendering

**This means the same extraction script approach used for Source 1 will NOT work for tickets.**

### Ticket Data Structure (observed from screenshots, Feb 2026)

The Tickets table has the following columns:

| Column | Description | Example Values |
|--------|-------------|----------------|
| Due Date | Ticket deadline | `2/13/2026`, `2/11/2026`, `2/9/2026` |
| Name | Project identifier | `IL-Crest Hill - Design...`, `Bel Aire, KS - Design...` |
| Project (Rollup) | Parent project reference | Truncated in view |
| Description | Revision details + hour estimate | `"2 hours - Design Revisions (DC..."`, `".25 hour - Design Revisi..."` |
| Priority | Ticket priority level | Visible but truncated |
| Created Date | When ticket was filed | Date values |
| Completed | Completion checkbox | Checkmark or empty |

### Current Tickets (week of Feb 9, 2026)

| # | Project | Hour Estimate | Due Date | Status |
|---|---------|--------------|----------|--------|
| 1 | IL-Crest Hill | 1 hour (inferred) | 2/13/26 | Pending |
| 2 | Bel Aire, KS | 2 hours | 2/13/26 | Pending |
| 3 | CO-Aspen/Pitkin County | 2 hours | 2/13/26 | Pending |
| 4 | Palmetto Bay Village | 0.25 hour (15 min) | 2/13/26 | Pending |
| 5 | San Leandro CA | 0.5 hour (30 min) | 2/11/26 | Pending |
| 6 | OH-Lorain County | 1 hour | 2/9/26 | Overdue |
| 7 | Sanford, NC | unknown | 2/9/26 | Overdue |
| 8 | NY-Ithaca R4 | 1 hour (inferred) | 2/5/26 | Overdue |
| 9 | TN-Pigeon Forge | 1.5 hours | 2/3/26 | Overdue |
| 10 | FL-Boca Raton Library | unknown | 1/29/26 | Overdue |

### Hour Estimate Parsing

Hour estimates are embedded in the Description field with inconsistent formats:

```
"2 hours - Design Revisions..."    → 2.0 hours (120 min)
".25 hour - Design Revisi..."      → 0.25 hours (15 min)
".5 hour - Design Revisio..."      → 0.5 hours (30 min)
"1 hour - a couple of thes..."     → 1.0 hour (60 min)
"1.5 hour Design Revisions..."     → 1.5 hours (90 min)
"1 - Design Revisions..."          → 1.0 hour (60 min) — number before dash
"Can you optimize the ca..."       → unknown — no hour pattern
```

Regex pattern to extract hours from description:
```javascript
function parseRevisionHours(description) {
  // Match patterns like "2 hours", ".5 hour", "1.5 hour", or leading number before dash
  const match = description.match(/^(\d*\.?\d+)\s*hours?/i)
    || description.match(/^(\d*\.?\d+)\s*-/);
  if (match) {
    return parseFloat(match[1]) * 60; // return minutes
  }
  return 60; // default: 1 hour for revisions with no estimate
}
```

### Recommended Extraction Approach for Tickets

Since the Gameplan Visualforce iframe blocks DOM access, there are three viable alternatives:

#### Option A: "My Tickets" Salesforce Report (Recommended)

A private report titled **"My tickets"** was observed in the Salesforce reports sidebar. If this report contains the same ticket data, it would render inside the standard Salesforce report iframe — meaning the **same extraction script pattern from Source 1** would work with minor column mapping changes.

**Steps:**
1. Navigate to the "My tickets" report
2. Verify it contains: project name, description (with hours), due date, completion status
3. Adapt the `extractSalesforceReport()` script with the ticket column map
4. Combine both extractions (Source 1 + Source 2) into a single JSON payload

#### Option B: Chrome Extension Content Script

A Chrome extension can inject a content script specifically into `*.visualforce.com` pages, bypassing the cross-origin restriction. The content script would:
1. Match the Visualforce iframe URL pattern
2. Query the Cloud Coach ticket table DOM directly
3. Use `postMessage()` to send extracted data back to the parent page
4. The parent page bookmarklet picks it up and merges with report data

**Pros:** Works without changing the workflow
**Cons:** More complex to build and maintain; requires extension installation

#### Option C: Salesforce API (SOQL Query)

Query tickets directly via the Salesforce REST API:
```
SELECT Name, Description, DueDate, Priority, Status, CreatedDate
FROM project_cloud__Ticket__c
WHERE OwnerId = '<current_user_id>'
AND DueDate >= THIS_WEEK
ORDER BY DueDate ASC
```

**Pros:** Most reliable, structured JSON response
**Cons:** Requires Salesforce Connected App + OAuth setup

---

## Ticket → Planner Block Mapping

Each ticket maps to a `TimeBlock` with type `"revision"`:

| Ticket Field | Planner Field | Mapping Logic |
|-------------|---------------|---------------|
| Description (parsed hours) | `block.durationMinutes` | Parse hour estimate from description text |
| Name (project identifier) | `block.title` | e.g. `"Bel Aire, KS – Revision"` |
| Due Date | `block.day` | Map to the weekday of the due date |
| — | `block.type` | Always `"revision"` |
| — | `block.locked` | `false` (revisions can be moved around) |
| — | `block.startHour` | Auto-placed by `findAvailableSlot()` |

### Scheduling Priority

When importing both sources into the planner:

1. **Website Launches** go first — they have fixed times (`locked: true`)
2. **Design Setups** go next — placed in largest available slots
3. **Revisions** fill remaining gaps — sorted by due date (soonest first), overdue items get highest priority

---

## Combined Extraction Workflow

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  Source 1: Report        │     │  Source 2: Tickets       │
│  (Resource Assignments)  │     │  ("My Tickets" report    │
│                          │     │   or API query)          │
│  → Setups               │     │  → Revisions             │
│  → Launches             │     │                          │
└──────────┬──────────────┘     └──────────┬──────────────┘
           │                                │
           └────────────┬───────────────────┘
                        ▼
              ┌─────────────────┐
              │  Merge + Dedupe  │
              │  JSON payload    │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │  Weekly Planner  │
              │  Auto-schedule   │
              │  blocks          │
              └─────────────────┘
```

---

## Source 3: Outlook Calendar (Meetings & Launches)

### Location

- **App**: Microsoft Outlook (new Outlook for Mac v16.105+, also accessible via web)
- **Web URL**: `https://outlook.office.com/calendar/view/workweek`
- **Account**: cody.gant@civicplus.com

### Why This Source Matters

The Outlook calendar is the **authoritative source for meeting times and launch windows**. While the Salesforce Resource Assignments report (Source 1) lists *what* launches and setups are scheduled this week, the Outlook calendar contains the *exact meeting times* — including Zoom links, organizers, and duration. Meetings also consume planner time and need to be blocked out.

### Desktop App Limitation

The new Outlook for Mac (v16.105+) is essentially a web-app wrapper. Its AppleScript dictionary is non-functional:
- `count of exchange accounts` returns `0`
- `count of calendar events` returns `0`
- macOS Accessibility (System Events UI scripting) is blocked by sandboxing

**The Outlook Web App at `outlook.office.com/calendar` is the viable extraction surface.**

### DOM Structure (Outlook Web, as of Feb 2026)

The calendar renders inside a **Shadow DOM or React-managed tree** — standard `document.querySelector()` cannot reach event elements from injected scripts. However, the **accessibility tree** exposes all event data through `button[aria-label]` elements inside the `<main>` region.

Each calendar event is a `<button>` with a rich `aria-label` containing all key fields in a consistent format:

```
"[Title], [StartTime] to [EndTime], [Weekday], [FullDate], [Description/Location], By [Organizer], [Status], [Recurring]"
```

**Examples:**
```
"Weekly Commitments and Goal Review, 10:00 AM to 10:30 AM, Monday, February 9, 2026, By Rachel Butts, Busy, Recurring event"
"Redesign Launch – New Rochelle, NY, 1:00 PM to 4:00 PM, Wednesday, February 11, 2026, Main Site and 3 Ultimate DHPs, Colby Torrez"
"Redesign Launch w 4 Ultimate DHPs - Boca Raton, FL, 12:00 PM to 3:00 PM, Thursday, February 12, 2026, Reminder Only/No Meeting, Briana Reardon"
"Canceled: RGB Meeting, 2:30 PM to 3:00 PM, Monday, February 9, 2026, By Ella Henton, Free, Recurring"
```

### Event Fields (parsed from aria-label)

| Field | Source | Example |
|-------|--------|---------|
| Title | First segment before comma | `"Redesign Launch – New Rochelle, NY"` |
| Start Time | Time pattern | `1:00 PM` |
| End Time | After "to" | `4:00 PM` |
| Day | Weekday name | `Wednesday` |
| Date | Full date | `February 11, 2026` |
| Description | Middle segments | `"Main Site and 3 Ultimate DHPs"` |
| Organizer | After "By" keyword | `Rachel Butts` |
| Status | `Busy` / `Free` | `Busy` |
| Recurring | Trailing flag | `Recurring event` |
| Cancelled | Title prefix | `Canceled:` prefix |
| Reminder Only | Description | `"Reminder Only"` or `"Reminder Only/No Meeting"` |

### Inner DOM Structure

Each event button also contains child elements:
```
button[aria-label="full event description"]
  └─ div (title text)
       └─ span (organizer name)
  └─ img "Repeating event" (if recurring)
```

The event container class is `.calendar-SelectionStyles-resizeBoxParent` with data attributes:
- `data-calitemid` — Unique calendar item ID
- `data-tabid` — Tab/item identifier (base64-encoded Exchange item ID)
- `data-conflict` — `"0"` or `"1"` (overlapping events)
- `data-itemindex` — Position index

### Current Week Events (Feb 9–13, 2026)

**Monday, Feb 9:**
| Time | Event | Type | Organizer |
|------|-------|------|-----------|
| 10:00–10:30 AM | Weekly Commitments and Goal Review | Meeting (recurring) | Rachel Butts |
| 10:30–11:00 AM | WebDev Huddle | Meeting (recurring) | Ella Henton |
| 2:30–2:55 PM | Site Review | Meeting (recurring) | Rachel Butts |
| 2:30–3:00 PM | ~~RGB Meeting~~ (Canceled) | — | Ella Henton |

**Tuesday, Feb 10:**
| Time | Event | Type | Organizer |
|------|-------|------|-----------|
| 10:00–11:00 AM | City of Saratoga Springs, UT - In-Place Redesign Launch | **Launch** | Justin Blecha |
| 11:30 AM–12:00 PM | (unnamed event) | Unknown | — |

**Wednesday, Feb 11:**
| Time | Event | Type | Organizer |
|------|-------|------|-----------|
| 8:45–9:00 AM | ~~Implementation Announcements Standup~~ (Canceled) | — | — |
| 9:00–10:00 AM | ~~Web Central Sprint Review~~ (Canceled) | — | — |
| 10:30 AM–12:00 PM | Redesign Launch: MN - City of Chaska + 1 Standard DHP | **Launch** (Reminder Only) | Liliana Castro |
| 1:00–4:00 PM | Redesign Launch – New Rochelle, NY (Main Site + 3 Ultimate DHPs) | **Launch** | Colby Torrez |

**Thursday, Feb 12:**
| Time | Event | Type | Organizer |
|------|-------|------|-----------|
| 12:00–3:00 PM | Redesign Launch w 4 Ultimate DHPs - Boca Raton, FL | **Launch** (Reminder Only) | Briana Reardon |
| 3:30–4:30 PM | AI Learning Series Office Hours (Optional) | Meeting (recurring) | CP Meetings And Events |

**Friday, Feb 13:**
| Time | Event | Type | Organizer |
|------|-------|------|-----------|
| 9:00–9:15 AM | Implementation Teams Standup (No Managers/Agenda) | Meeting (recurring) | Rachel Butts |
| 11:00–11:25 AM | Designers Unite Meeting [DUM] | Meeting (recurring) | Rachel Butts |
| 11:00–11:30 AM | ~~DUM Meeting~~ (Canceled) | — | — |
| 2:00–2:25 PM | Review Past Due Task Reports | Meeting (recurring, Free) | Rachel Butts |
| 3:00–3:30 PM | Comp Completions Due (Reminder Only) | Reminder (recurring) | Rachel Davis |
| 4:30–5:00 PM | ~~Submit Timesheet~~ (Canceled, Reminder Only) | — | — |

### Event Classification Rules

Events should be classified into planner block types:

```javascript
function classifyEvent(title, description) {
  const t = (title + ' ' + description).toLowerCase();

  // Skip cancelled events
  if (title.startsWith('Canceled:')) return 'skip';

  // Launches — title contains "launch" or "redesign launch"
  if (t.includes('redesign launch') || t.includes('launch')) return 'launch';

  // Reminders (no actual meeting) — block as informational only
  if (t.includes('reminder only') && !t.includes('launch')) return 'reminder';

  // Regular meetings
  return 'meeting';
}
```

### Recommended Extraction Approach

#### Option A: Microsoft Graph API (Recommended)

The Microsoft Graph API provides the cleanest, most reliable access to calendar events. Outlook Web uses this API internally.

**Endpoint:**
```
GET https://graph.microsoft.com/v1.0/me/calendarview
  ?startDateTime=2026-02-09T00:00:00
  &endDateTime=2026-02-14T00:00:00
  &$select=subject,start,end,organizer,location,isRecurring,isCancelled,showAs,body
  &$orderby=start/dateTime
```

**Response format (simplified):**
```json
{
  "value": [
    {
      "subject": "Redesign Launch – New Rochelle, NY",
      "start": { "dateTime": "2026-02-11T13:00:00", "timeZone": "Central Standard Time" },
      "end": { "dateTime": "2026-02-11T16:00:00", "timeZone": "Central Standard Time" },
      "organizer": { "emailAddress": { "name": "Colby Torrez" } },
      "showAs": "busy",
      "isCancelled": false,
      "isRecurring": false,
      "body": { "content": "Main Site and 3 Ultimate DHPs" }
    }
  ]
}
```

**Authentication:**
- Register an Azure AD app in the CivicPlus tenant (or use a personal app registration)
- Request scope: `Calendars.Read`
- Use OAuth2 authorization code flow
- Store refresh token locally for weekly automated extraction

#### Option B: Accessibility Tree Scraping (Bookmarklet)

If API access isn't available, a bookmarklet can read the accessibility tree by querying buttons inside the main calendar region:

```javascript
function extractOutlookCalendar() {
  // Outlook Web renders events as buttons with rich aria-labels
  const buttons = document.querySelectorAll('button[aria-label]');
  const eventPattern = /^(.+?),\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*to\s*(\d{1,2}:\d{2}\s*(?:AM|PM)),\s*(\w+),\s*(\w+ \d{1,2},\s*\d{4})/;

  const events = [];
  buttons.forEach(btn => {
    const label = btn.getAttribute('aria-label') || '';
    const match = label.match(eventPattern);
    if (!match) return;

    const [, title, startTime, endTime, weekday, date] = match;
    const remaining = label.slice(match[0].length);

    // Parse organizer (after "By ")
    const orgMatch = remaining.match(/By\s+([^,]+)/);
    const organizer = orgMatch ? orgMatch[1].trim() : '';

    // Parse status
    const isCancelled = title.startsWith('Canceled:');
    const isRecurring = remaining.includes('Recurring');
    const showAs = remaining.includes('Free') ? 'free' : 'busy';
    const isReminderOnly = remaining.toLowerCase().includes('reminder only');

    events.push({
      title: isCancelled ? title.replace('Canceled: ', '') : title,
      startTime, endTime, weekday, date,
      organizer, isCancelled, isRecurring, showAs, isReminderOnly,
      raw: label.substring(0, 300)
    });
  });

  return events;
}
```

**Note:** This requires the user to have the calendar open in Chrome and may break if Outlook changes its DOM structure. The aria-label format has been stable but is not an official API.

#### Option C: ICS Export

Outlook supports exporting calendar data as `.ics` files via Share → Publish. This generates a URL that can be polled periodically. However, it includes ALL events (not just the current week) and requires parsing the iCalendar format.

---

## Calendar → Planner Block Mapping

Each Outlook event maps to a `TimeBlock` in the planner:

| Event Field | Planner Field | Mapping Logic |
|-------------|---------------|---------------|
| `subject` / title | `block.title` | Direct mapping |
| Classification | `block.type` | `"launch"`, `"meeting"`, or skip |
| Start time | `block.startHour` | Parse hour from start time |
| Start time | `block.day` | Map weekday to planner day |
| Duration (end - start) | `block.durationMinutes` | Calculate difference |
| `isCancelled` | — | Skip cancelled events |
| `isReminderOnly` | `block.locked` | Reminders → unlocked (can be moved) |
| — | `block.locked` | Meetings with Zoom links → `true` (fixed time) |

### Overlap with Source 1 (Salesforce Report)

Launches appear in **both** the Salesforce report and Outlook calendar. The calendar provides the **authoritative time slot**, while Salesforce provides the **project tier and setup details**. Merging logic:

1. Match by project name (fuzzy match: `"Boca Raton"` in both sources)
2. Take time/day from Outlook calendar (more precise)
3. Take tier/type from Salesforce report
4. If a launch is in the calendar but not Salesforce → still add as a launch block
5. If a launch is in Salesforce but not the calendar → use the Tag field for time, mark as tentative

---

## Updated Combined Extraction Workflow

```
┌──────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
│  Source 1: SF Report  │  │ Source 2: Tickets    │  │ Source 3: Outlook    │
│  (Resource Assign.)   │  │ ("My Tickets" rpt    │  │ Calendar (Graph API  │
│                       │  │  or API query)       │  │  or DOM scrape)      │
│  → Setups (tier)      │  │ → Revisions (hours)  │  │ → Launches (times)   │
│  → Launches (tier)    │  │                      │  │ → Meetings (times)   │
└──────────┬────────────┘  └──────────┬───────────┘  └──────────┬───────────┘
           │                          │                          │
           └──────────────┬───────────┴──────────────────────────┘
                          ▼
                ┌─────────────────────┐
                │  Merge Engine        │
                │                      │
                │  1. Launches: match  │
                │     SF tier + OL time│
                │  2. Setups: from SF  │
                │     auto-place       │
                │  3. Revisions: from  │
                │     tickets, by due  │
                │  4. Meetings: from   │
                │     OL, locked times │
                │  5. Deduplicate      │
                └──────────┬──────────┘
                           ▼
                ┌─────────────────────┐
                │  Weekly Planner      │
                │  Auto-schedule       │
                │  blocks              │
                └─────────────────────┘
```

---

## Risks & Edge Cases

1. **DOM structure may change** — Salesforce Lightning updates can rename classes. The `data-grid-full-table` and `data-fixed-column` attribute selectors are relatively stable but should be validated each time.

2. **Tag field format is inconsistent** — Launch times are free-text with varying formats. A regex-based parser will cover 80% of cases; an LLM pass can handle the rest.

3. **iframe access requires same-origin** — The extraction script must run from within the Salesforce domain (bookmarklet, console, or extension content script). It cannot be called from `localhost`.

4. **Report may have pagination** — If the report exceeds the visible row limit, you'd need to scroll or change report settings. Currently 7 records fits in one page.

5. **Revisions may not appear in Source 1** — The Resource Assignments report only shows "Design Setup" and "Website Launch" task types. Revisions must come from Source 2 (tickets).

6. **Cloud Coach Gameplan is cross-origin** — The Tickets view in the Gameplan page renders in a Visualforce iframe that blocks direct DOM access. Use the "My Tickets" report or Salesforce API instead.

7. **Ticket hour estimates are inconsistent** — Some tickets have no hour estimate in the Description field. Default to 60 minutes for revisions with missing estimates.

8. **Overdue tickets need handling** — Tickets past their due date should still appear in the current week's planner (backlog), flagged with a visual indicator.

9. **Outlook Web uses Shadow DOM** — Standard `document.querySelector()` from injected JavaScript cannot reach calendar event elements. The accessibility tree (aria-labels on buttons) is the reliable extraction surface, or use the Graph API.

10. **New Outlook for Mac has no AppleScript support** — The desktop app (v16.105+) returns 0 calendar events via AppleScript. Web-based extraction or Graph API are the only viable approaches.

11. **Launch events overlap between sources** — Launches appear in both Salesforce (Source 1) and Outlook (Source 3). The merge engine must deduplicate by project name and prefer Outlook for time data, Salesforce for tier/type data.

12. **Cancelled events in Outlook** — Titles prefixed with `"Canceled:"` should be filtered out during extraction. Some weeks may have 4+ cancelled recurring meetings.
