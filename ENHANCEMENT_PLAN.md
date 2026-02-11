# WorkMetrics Import Enhancement Plan

## What This Document Is

A practical, grounded plan for improving the Import Sources feature of the WorkMetrics planner. Every recommendation here is based on reading the actual codebase (~2,775 lines across 11 files) and understanding the real constraints: no backend, localStorage persistence, Chrome extension with HTML scraping, single user.

This is not a platform roadmap. This is a plan to make your Monday morning import ritual fast, reliable, and pleasant.

---

## Current State (What Actually Exists)

**The import pipeline today:**

```
User clicks "Auto-Import All Sources"
  → ImportWizard sends message via content bridge
  → Extension opens 3 tabs in parallel (Promise.all)
  → Each tab: wait 3-8s → inject extraction script → retry up to 12× at 5s intervals
  → Raw data returns to React app
  → importParser.ts transforms → TimeBlock[]
  → mergeImportedData() deduplicates launches, adds breaks/buffers, auto-schedules setups
  → usePlanner.importBlocks() replaces all blocks → localStorage
```

**What works:** Outlook calendar extraction is reliable. The architecture (content bridge → service worker → script injection) is sound. The parser logic for tier detection, time parsing, and auto-scheduling is solid.

**What doesn't:** Salesforce report extraction is fragile (table selectors, iframe timing). Cloud Coach revisions navigation fails silently (xlink:href selector bug, now fixed). There's no way to preview, undo, or selectively import. One bad import wipes your whole week.

**Codebase size:**

| Area | Files | Lines |
|------|-------|-------|
| Import UI | ImportWizard.tsx | 671 |
| Extension | background.js, content-bridge.js, manifest.json | 916 |
| Parsing | importParser.ts, extractionScripts.ts | 576 |
| State/Logic | usePlanner, useTimecard, useMetrics, plannerLogic | 514 |
| Types | planner.ts | 98 |

---

## What Actually Needs to Change

### The Real Problems (Ranked by Pain)

1. **Destructive imports** — `importBlocks()` replaces ALL blocks. One import wipes manual adjustments. No undo.
2. **No preview** — You can't see what's coming before it hits your planner.
3. **No selective import** — It's all-or-nothing across all 3 sources.
4. **Fragile extraction** — Salesforce and Cloud Coach selectors break when those UIs update.
5. **No cache** — Every import re-scrapes everything, even if nothing changed.
6. **No import history** — You can't see what was imported or when.

### What Does NOT Need to Change

- The content bridge pattern works well
- The parser logic (tier detection, time parsing, auto-scheduling) is solid
- localStorage as the persistence layer is fine for a single-user tool
- The 3 hardcoded sources are the right sources — you don't need a plugin marketplace
- No backend is needed

---

## The Plan: Three Phases

### Phase 1: Safe Imports (3-4 days)

**Goal:** Make imports non-destructive and previewable. This is the highest-value change.

**1a. Import Preview**

Before committing blocks to the planner, show the user what will be imported.

New component: `ImportPreview.tsx`

```
┌─────────────────────────────────────────────┐
│ Import Preview                    [Cancel] [Apply] │
├─────────────────────────────────────────────┤
│ ✓ 4 items from Salesforce                        │
│   □ Chino Valley AZ – Ultimate Setup    Mon 8am  │
│   □ Springfield IL – Premium Setup      Tue 8am  │
│   □ Chino Valley AZ – Launch            Wed 10am │
│   □ Springfield IL – Launch             Thu 2pm  │
│                                                   │
│ ✓ 6 items from Outlook                           │
│   □ Team Standup                        Mon 9am  │
│   □ Design Review                       Tue 2pm  │
│   ...                                            │
│                                                   │
│ ✓ 3 items from Cloud Coach                       │
│   □ Riverside CA – Revision             Mon 3pm  │
│   ...                                            │
│                                                   │
│ ⚠ 1 potential duplicate:                         │
│   "Design Review" overlaps existing "1:1 w/ Josh"│
│   [Skip] [Replace] [Keep Both]                   │
├─────────────────────────────────────────────┤
│ Summary: 13 blocks, ~18.5 hrs scheduled          │
│                        [Cancel]  [Apply Selected] │
└─────────────────────────────────────────────┘
```

**How it works:**
- Import fetches raw data as today, but instead of auto-applying, it shows the preview
- User can uncheck individual items
- Duplicates are flagged (exact match: same title + same day + same hour)
- "Apply Selected" calls the existing `mergeImportedData()` with only checked items

**1b. Non-Destructive Merge**

Change `importBlocks()` from "replace all" to "merge with existing."

Current behavior:
```typescript
// usePlanner.ts — line 74
importBlocks(blocks: TimeBlock[]) {
  setPlan(prev => ({ ...prev, blocks })) // REPLACES everything
}
```

New behavior:
```typescript
importBlocks(newBlocks: TimeBlock[], mode: 'merge' | 'replace' = 'merge') {
  if (mode === 'replace') {
    setPlan(prev => ({ ...prev, blocks: newBlocks }))
  } else {
    setPlan(prev => {
      // Keep existing blocks that don't have matching sourceIds
      const existingNonImported = prev.blocks.filter(
        b => !b.sourceId || !newBlocks.some(nb => nb.sourceId === b.sourceId)
      )
      return { ...prev, blocks: [...existingNonImported, ...newBlocks] }
    })
  }
}
```

This means: manually added blocks survive imports. Blocks from previous imports get updated (matched by `sourceId`). New blocks get added.

**1c. Undo Last Import**

Store a snapshot of blocks before each import. Simple and effective.

```typescript
// In usePlanner.ts
const [lastSnapshot, setLastSnapshot] = useLocalStorage<TimeBlock[] | null>('wmp-undo', null)

importBlocks(newBlocks, mode) {
  setLastSnapshot(plan.blocks) // Save current state before import
  // ... do the merge
}

undoLastImport() {
  if (lastSnapshot) {
    setPlan(prev => ({ ...prev, blocks: lastSnapshot }))
    setLastSnapshot(null)
  }
}
```

One level of undo is enough. If you need more, something else is wrong.

**Files touched:** `usePlanner.ts`, `ImportWizard.tsx`, new `ImportPreview.tsx`

---

### Phase 2: Import Caching & Per-Source Control (2-3 days)

**Goal:** Don't re-scrape if nothing changed. Let users import one source at a time.

**2a. Import Cache**

Store the last successful extraction result per source with a timestamp.

```typescript
// New file: src/utils/importCache.ts
interface CachedImport {
  source: 'salesforce' | 'outlook' | 'cloudcoach'
  data: any[]
  fetchedAt: number  // Date.now()
  blockCount: number
}

// localStorage key: 'wmp-import-cache'
// TTL: 1 hour (configurable)
```

When the user clicks import:
1. Check cache for each source
2. If cache is <1 hour old, skip extraction — use cached data
3. Show "From cache (47 min ago)" vs "Fresh data" indicator
4. "Force refresh" button bypasses cache

This alone could cut typical import time from 15-20s to <1s for repeat imports.

**2b. Per-Source Import**

Let users import from just one source instead of all three.

The extension already supports this via `wmp-import-source` message handler. The UI just needs checkboxes:

```
┌──────────────────────────────────────┐
│ Import Sources                       │
│                                      │
│ [✓] Salesforce   Last: 23 min ago    │
│ [✓] Outlook      Last: 23 min ago    │
│ [ ] Cloud Coach  Last: 2 hrs ago ⚠   │
│                                      │
│ [Import Selected]  [Import All]      │
└──────────────────────────────────────┘
```

**2c. Last Import Timestamp**

Show when data was last imported on the main planner view. Simple line under the "Import Sources" button:

```
📥 Import Sources
Last import: Today at 8:42 AM (13 items)
```

Stored as a single value in localStorage: `'wmp-last-import'`.

**Files touched:** New `importCache.ts`, `ImportWizard.tsx`, `WeeklyPlanner.tsx`

---

### Phase 3: Extraction Reliability (3-4 days)

**Goal:** Make Salesforce and Cloud Coach extraction resilient to UI changes.

**3a. Smarter Waiting (Replace Fixed Delays)**

The current approach uses fixed `sleep()` calls (3-8 seconds). This is wasteful when pages load fast and insufficient when they load slow.

Replace with polling-based readiness detection:

```javascript
// In background.js
async function waitForElement(tabId, selector, timeoutMs = 30000) {
  const pollScript = (sel) => {
    return !!document.querySelector(sel)
  }

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: pollScript,
      args: [selector]
    })
    if (results.some(r => r.result)) return true
    await sleep(1000)
  }
  return false
}
```

For Salesforce: wait for `table` or `td[data-fixed-column]` to appear.
For Cloud Coach: wait for `.stats-item__count` to appear.
For Outlook: wait for `[aria-label]` elements with time patterns.

This adapts to actual load time instead of guessing.

**3b. Extraction Versioning**

When Salesforce or Cloud Coach updates their UI and selectors break, the user currently gets a cryptic "0 items" result. Add clear diagnostics:

```javascript
// Each extraction function returns:
{
  data: [...],
  version: 'sf-v2',  // Extraction strategy version
  diag: {
    url: '...',
    strategy: 'fixed-column',  // Which strategy succeeded
    tablesFound: 3,
    iframesFound: 1,
    renderTime: 4200  // ms from tab open to data found
  }
}
```

When extraction fails, show actionable messages:
- "Salesforce report loaded but table structure has changed. Try the manual import method."
- "Cloud Coach page loaded but revisions tab couldn't be found. Click the tab manually and try again."

**3c. Manual Paste Fallback (Improved)**

The current manual mode (copy script → paste in console) works but is clunky. Improve it:

Add a "Paste Data" button that accepts JSON directly:

```
┌────────────────────────────────────────────┐
│ Manual Import                              │
│                                            │
│ If auto-import fails, paste extracted       │
│ data here:                                  │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ [Paste JSON data here...]             │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [Parse & Preview]                          │
└────────────────────────────────────────────┘
```

This gives users an escape hatch when selectors break, without requiring them to understand the console.

**Files touched:** `background.js`, `ImportWizard.tsx`, new `ManualImport.tsx`

---

## What I'm Deliberately NOT Including

These were in your original prompt. Here's why they're cut:

**Plugin/adapter architecture** — You have 3 sources. They're all CivicPlus-specific. A SourceAdapter interface, adapter registry, plugin discovery system, and configuration UI would be ~800 lines of abstraction wrapping ~200 lines of actual logic. If you ever need a 4th source, add it directly. You'll spend less time than building the framework.

**Webhook ingestion** — Requires a server. You don't have one. Running Express inside a Chrome extension is hacky. If you need external tool integration, CSV import (which is just a file picker + parser) covers the same use case with zero infrastructure.

**Import scheduling** — MV3 Service Workers get killed after 30 seconds of inactivity. `chrome.alarms` can wake them, but then you need the user's browser open with the right tabs logged in. For a tool you open every Monday morning, clicking "Import" once is fine.

**Transformation rules engine** — "If tag = 'urgent', add 30min" is a rule you'll write once and forget. Hardcode it in `importParser.ts`. A visual rules UI for one user is unjustifiable.

**Import analytics** — "Salesforce provides 60% of your imports" is interesting for 5 seconds. Your time is better spent making the import itself reliable.

**CSV import** — This is the one cut item worth revisiting later. It's simple (file picker + Papa Parse + map columns to TimeBlock fields) and genuinely useful as a fallback. But it's Phase 4 material, not a priority.

---

## Implementation Order

| Phase | Days | What You Get |
|-------|------|-------------|
| 1: Safe Imports | 3-4 | Preview, non-destructive merge, undo |
| 2: Caching & Control | 2-3 | Instant repeat imports, per-source selection, timestamps |
| 3: Reliability | 3-4 | Adaptive waiting, better error messages, manual fallback |

Total: 8-11 days of focused work.

---

## Success Criteria

**Phase 1 done when:**
- You can see exactly what will be imported before it happens
- You can uncheck items you don't want
- Manually added blocks survive re-imports
- You can undo the last import with one click

**Phase 2 done when:**
- Second import in the same hour loads from cache in <1 second
- You can import just Outlook without touching Salesforce
- The planner shows when you last imported

**Phase 3 done when:**
- Import waits for actual page content instead of fixed delays
- Failed extractions show clear, actionable error messages
- You can paste JSON data as a fallback when auto-import breaks

---

## Open Questions (Only the Ones That Matter)

1. **Merge behavior on re-import:** When you re-import the same Salesforce data that's already in your planner, should it update the existing blocks (move times, rename) or leave them alone? Current recommendation: update by `sourceId` match.

2. **Deduplication threshold:** How similar do two blocks need to be to flag as duplicates? Current recommendation: same title (case-insensitive) + same day + start times within 30 minutes = flagged. Exact match = auto-skipped.

3. **Cache duration:** 1 hour feels right for a tool used in morning planning sessions, but you may want longer if you import once and tweak all day. Preference?
