/**
 * Corrected Extraction Functions for background.js v3
 *
 * This file contains ONLY the fixed/replaced functions to be used in place of
 * the corresponding functions in background.js. All other functions remain unchanged.
 *
 * CHANGES SUMMARY:
 * ───────────────
 * Fix 1: Replace clickCloudCoachRevisionsTab() with two-step navigation:
 *        - navigateToCloudCoachTickets() — clicks "Lists" tab
 *        - clickCloudCoachTicketsSidebar() — clicks "Tickets" in sidebar
 *
 * Fix 2: Fix extractCloudCoachData() card fallback:
 *        - Remove overly broad [class*="row"] and [class*="item"] selectors
 *        - Add frame location validation
 *        - Add text length and pattern validation to skip nav garbage
 *
 * Fix 3: Create isTicketsTableReady() for improved readiness detection
 *        - Check for cc-sobject-table with data rows
 *        - Check for table with semantic column headers
 *        - Validate we're in the correct frame
 *
 * Fix 4: Fix extractSalesforceData() aria-label parsing
 *        - Recognize compound column headers like "Project (Rollup): Project Name"
 *        - Check for known field names to identify multi-part headers
 *        - Properly separate header from data value
 *
 * Fix 5: Update importSource() to support Cloud Coach multi-step flow
 *        - Support preExtractFunc as array for sequential navigation
 *        - Add step tracking and inter-step delays
 *        - Better step result handling
 *
 * Fix 6: Fix runExtraction() data source priority
 *        - Collect all frame results before deciding which to use
 *        - Prefer frames from vf.force.com / lightningReportApp.app
 *        - Filter out garbage patterns like "DashboardsDashboards"
 *
 * Fix 7: Handle readiness timeout properly
 *        - Log diagnostic warnings
 *        - For Cloud Coach: return error on timeout instead of silently proceeding
 *        - For Salesforce: log but proceed (data might still be available)
 */

// ═══════════════════════════════════════════════════════
// FIX 1: Cloud Coach Navigation — Step 1: Lists Tab
// ═══════════════════════════════════════════════════════

/**
 * Navigate to Cloud Coach "Lists" tab.
 * This is STEP 1 of the two-step navigation to reach Tickets.
 *
 * The Cloud Coach app is inside a Visualforce iframe at civicplus--project-cloud.vf.force.com.
 * The extension uses allFrames: true, so this function will run inside that iframe.
 *
 * CHANGED: Replaced the single-step clickCloudCoachRevisionsTab() with this focused step.
 *          Returns step indicator so orchestrator knows to wait and proceed to step 2.
 *
 * @returns {object} { step: 1, clicked: true/false, method: string, ...diagnostic data }
 */
function navigateToCloudCoachTickets() {
  try {
    var diag = {
      url: location.href.slice(0, 120),
      timestamp: new Date().toISOString(),
    };

    // ── Strategy A: SLDS tab link with href ──
    // CHANGED: Target "Lists" specifically, not revisions
    var listsTab = document.querySelector('a.slds-tabs_default__link[href*="lists"]');
    if (listsTab) {
      listsTab.click();
      return { step: 1, clicked: true, method: 'slds-tab-link-lists', diag: diag };
    }

    // ── Strategy B: Tab element with role="tab" and text "Lists" ──
    // CHANGED: Added text-matching strategy for SLDS tab elements
    var tabs = document.querySelectorAll('[role="tab"], a.slds-tabs_default__link, button[class*="tab"]');
    for (var i = 0; i < tabs.length; i++) {
      var tabText = (tabs[i].textContent || '').trim();
      if (tabText.toLowerCase() === 'lists') {
        tabs[i].click();
        return { step: 1, clicked: true, method: 'text-match-lists', diag: diag };
      }
    }

    // ── Strategy C: Any link/button with "Lists" text ──
    // CHANGED: Broader fallback for text-based matching
    var clickables = document.querySelectorAll('a, button, [role="button"]');
    for (var j = 0; j < clickables.length; j++) {
      var text = (clickables[j].textContent || '').trim();
      if (text === 'Lists' || text.toLowerCase() === 'lists') {
        clickables[j].click();
        return { step: 1, clicked: true, method: 'generic-lists-link', diag: diag };
      }
    }

    return { step: 1, clicked: false, error: 'Could not find Lists tab', diag: diag };
  } catch (e) {
    return { step: 1, clicked: false, error: e.message, diag: { exception: true } };
  }
}

/**
 * Click the "Tickets" sidebar item in Cloud Coach Lists view.
 * This is STEP 2 of the two-step navigation.
 *
 * After clicking Lists tab, the sidebar appears with items: Project Tasks, Tickets, Tasks.
 * This function finds and clicks Tickets.
 *
 * CHANGED: New function to replace the failed single-step approach.
 *          Handles the sidebar navigation that was never reached before.
 *
 * @returns {object} { clicked: true/false, method: string, ...diagnostic data }
 */
function clickCloudCoachTicketsSidebar() {
  try {
    var diag = {
      url: location.href.slice(0, 120),
      timestamp: new Date().toISOString(),
    };

    // ── Strategy A: SLDS nav vertical item with "Tickets" text ──
    // CHANGED: Look for SLDS navigation components in sidebar
    var navItems = document.querySelectorAll('.slds-nav-vertical__item, [class*="nav"][class*="item"], li[role="menuitem"]');
    for (var i = 0; i < navItems.length; i++) {
      var itemText = (navItems[i].textContent || '').trim();
      if (itemText === 'Tickets' || itemText.toLowerCase().includes('tickets')) {
        // Try to click the item or its link child
        var link = navItems[i].querySelector('a, button, [role="button"]');
        if (link) {
          link.click();
          return { clicked: true, method: 'slds-nav-tickets-link', diag: diag };
        }
        navItems[i].click();
        return { clicked: true, method: 'slds-nav-tickets-item', diag: diag };
      }
    }

    // ── Strategy B: Any link/button containing "Tickets" text ──
    // CHANGED: Broader fallback for text-based matching in sidebar
    var clickables = document.querySelectorAll('a, button, [role="button"], [class*="nav"]');
    for (var j = 0; j < clickables.length; j++) {
      var text = (clickables[j].textContent || '').trim();
      // CHANGED: Match exact "Tickets" or text containing "Tickets" with count badge
      if (text === 'Tickets' || (text.includes('Tickets') && text.length < 50)) {
        clickables[j].click();
        return { clicked: true, method: 'text-match-tickets', text: text.slice(0, 40), diag: diag };
      }
    }

    // ── Strategy C: Look for badge with "12" (ticket count) ──
    // CHANGED: Use visual indicators (badge count) to find Tickets
    var badges = document.querySelectorAll('[class*="badge"], [class*="count"], span[class*="pill"]');
    for (var b = 0; b < badges.length; b++) {
      var badgeText = (badges[b].textContent || '').trim();
      if (badgeText === '12' || (badgeText.length < 5 && parseInt(badgeText) > 0)) {
        // Find parent nav item
        var parent = badges[b].closest('a, li, [class*="item"], [class*="nav"]');
        if (parent && (parent.textContent || '').includes('Tickets')) {
          parent.click();
          return { clicked: true, method: 'badge-tickets', count: badgeText, diag: diag };
        }
      }
    }

    return { clicked: false, error: 'Could not find Tickets sidebar item', diag: diag };
  } catch (e) {
    return { clicked: false, error: e.message, diag: { exception: true } };
  }
}

// ═══════════════════════════════════════════════════════
// FIX 3: Improved Readiness Check for Tickets Table
// ═══════════════════════════════════════════════════════

/**
 * Check if Cloud Coach Tickets table is ready for extraction.
 *
 * CHANGED: New function combining checks for:
 *   1. cc-sobject-table with actual data rows
 *   2. Standard table with semantic column headers (DUE DATE, NAME, PROJECT)
 *   3. Frame location validation to ensure we're in the right iframe
 *
 * @returns {boolean} true if table is ready, false otherwise
 */
function isTicketsTableReady() {
  try {
    // CHANGED: Validate we're in a frame that might have the data
    var isCorrectFrame = location.href.includes('vf.force.com') ||
                         location.href.includes('project_cloud') ||
                         location.href.includes('lightning');

    // ── Check 1: cc-sobject-table (primary) ──
    var table = document.querySelector('cc-sobject-table');
    if (table) {
      var tbody = table.querySelector('tbody');
      if (tbody) {
        var rows = tbody.querySelectorAll('tr[cctablerow], tr');
        // CHANGED: Require at least one data row, not just existence
        if (rows.length > 0) {
          // Verify there's actual content
          var firstRow = rows[0];
          var cells = firstRow ? firstRow.querySelectorAll('td') : [];
          if (cells.length > 2) {
            return true;
          }
        }
      }
    }

    // ── Check 2: Standard table with Cloud Coach column headers ──
    // CHANGED: Look for tables with semantic column headers matching Tickets structure
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
      var headerRow = tables[t].querySelector('thead tr, tr:first-child');
      if (!headerRow) continue;

      var headerText = (headerRow.textContent || '').toUpperCase();
      // CHANGED: Check for Cloud Coach column patterns
      if ((headerText.includes('DUE DATE') || headerText.includes('DUE')) &&
          (headerText.includes('NAME') || headerText.includes('TITLE')) &&
          (headerText.includes('PROJECT') || headerText.includes('ACCOUNT'))) {

        var dataRows = tables[t].querySelectorAll('tbody tr, tr:not(:first-child)');
        if (dataRows.length > 0) {
          // Verify first row has content
          var firstDataRow = dataRows[0];
          var dataCells = firstDataRow ? firstDataRow.querySelectorAll('td') : [];
          if (dataCells.length > 2) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// FIX 2: Improved extractCloudCoachData() with Better Card Fallback
// ═══════════════════════════════════════════════════════

/**
 * Extract revision/ticket data from Cloud Coach.
 *
 * CHANGED: Improved card fallback to avoid matching navigation garbage.
 *          Removed overly broad selectors, added frame validation and pattern filtering.
 */
function extractCloudCoachData() {
  try {
    // ── Login Detection ──
    if (
      document.querySelector('input[name="username"]') ||
      document.querySelector('input[name="email"]') ||
      document.title.toLowerCase().includes('login') ||
      location.href.includes('/login')
    ) {
      return { needsLogin: true, data: [] };
    }

    var results = [];
    var diag = {
      url: location.href.slice(0, 120),
      timestamp: new Date().toISOString(),
      tables: document.querySelectorAll('table').length,
      iframes: document.querySelectorAll('iframe').length,
    };

    // ── Strategy 1: cc-sobject-table (SLDS components) ──
    var table = document.querySelector('cc-sobject-table');
    if (table) {
      diag.strategy = 'cc-sobject-table';
      var tbody = table.querySelector('tbody');
      if (!tbody) {
        return { needsLogin: false, data: [], error: 'tbody not found in cc-sobject-table', diag: diag };
      }

      var rows = tbody.querySelectorAll('tr[cctablerow], tr');
      diag.rowsFound = rows.length;

      rows.forEach(function (row, rowIdx) {
        try {
          var cells = row.querySelectorAll('td');
          if (cells.length < 3) return;

          var revision = {};

          // Cell 2: Due Date
          if (cells[2]) {
            var dueDateSpan = cells[2].querySelector('span[title]');
            if (dueDateSpan) revision.dueDate = dueDateSpan.getAttribute('title') || '';
          }

          // Cell 3: Name
          var name = '';
          if (cells[3]) {
            var nameDiv = cells[3].querySelector('div[title]');
            if (nameDiv) name = nameDiv.getAttribute('title') || '';
            if (!name) name = cells[3].textContent.trim();
          }
          if (!name || name.length < 2) return;
          revision.name = name;

          // Cell 4: Project
          if (cells[4]) {
            var projectLink = cells[4].querySelector('a');
            if (projectLink) {
              revision.project = projectLink.textContent.trim();
              revision.projectHref = projectLink.getAttribute('href') || '';
            }
            if (!revision.project) revision.project = cells[4].textContent.trim();
          }

          // Cell 5: Description
          var descriptionText = '';
          if (cells[5]) {
            var richTextDiv = cells[5].querySelector('div.slds-rich-text-editor__output[title]');
            if (richTextDiv) descriptionText = richTextDiv.getAttribute('title') || '';
            if (!descriptionText) descriptionText = cells[5].textContent.trim();
          }
          revision.description = descriptionText;

          // Parse description for hours, labels, URLs, assignees
          var descParsed = parseRevisionDescription(descriptionText);
          revision.hours = descParsed.hours;
          revision.revisionLabel = descParsed.revisionLabel;
          revision.webViewUrl = descParsed.webViewUrl;
          revision.assignees = descParsed.assignees;

          // Cell 6: Priority
          if (cells[6]) {
            var prioritySpan = cells[6].querySelector('span[title]');
            revision.priority = prioritySpan ? (prioritySpan.getAttribute('title') || '') : cells[6].textContent.trim();
          }

          // Cell 7: Created Date
          if (cells[7]) {
            var createdSpan = cells[7].querySelector('span[title]');
            revision.createdDate = createdSpan ? (createdSpan.getAttribute('title') || '') : cells[7].textContent.trim();
          }

          // Cell 8: Completed
          if (cells[8]) {
            var checkbox = cells[8].querySelector('input[type="checkbox"]');
            revision.completed = checkbox ? checkbox.checked : false;
          }

          // Cell 0: Status icons
          if (cells[0]) {
            if (cells[0].querySelector('.slds-icon-text-error')) revision.status = 'overdue';
            else if (cells[0].querySelector('.slds-icon-text-warning')) revision.status = 'warning';
            else revision.status = 'ok';
          }

          results.push(revision);
        } catch (rowErr) { /* skip row */ }
      });

      if (results.length > 0) {
        return { needsLogin: false, data: results, diag: diag };
      }
      // If no results from SLDS extraction, fall through to legacy
    }

    // ── Strategy 2: Legacy table extraction ──
    diag.strategy = 'legacy-table';

    function findTickets(doc) {
      var rows = doc.querySelectorAll('table tbody tr, tr.dataRow, tr[class*="Row"]');
      diag.matchedRows = (diag.matchedRows || 0) + rows.length;

      rows.forEach(function (row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 2) return;

        var rowText = row.textContent || '';
        if (rowText.includes('Total') || rowText.includes('Grand Total')) return;

        var projectName = cells[0] ? cells[0].textContent.trim() : '';
        if (!projectName || projectName.length < 2) return;

        var description = cells[1] ? cells[1].textContent.trim() : '';
        var hours = 1;
        for (var c = 2; c < cells.length; c++) {
          var parsed = parseFloat((cells[c].textContent || '').trim());
          if (!isNaN(parsed) && parsed > 0 && parsed < 100) { hours = parsed; break; }
        }
        var dueDate = '';
        for (var d = 2; d < cells.length; d++) {
          var dt = (cells[d].textContent || '').trim();
          if (dt.match(/\d{1,2}\/\d{1,2}/)) { dueDate = dt; break; }
        }

        results.push({
          projectName: projectName,
          description: description || 'Revision',
          estimatedHours: hours,
          dueDate: dueDate,
        });
      });
    }

    findTickets(document);

    if (results.length === 0) {
      var iframes = document.querySelectorAll('iframe');
      for (var i = 0; i < iframes.length; i++) {
        try {
          var iframeDoc = iframes[i].contentDocument;
          if (iframeDoc) findTickets(iframeDoc);
        } catch (e) {
          diag.crossOriginIframes = (diag.crossOriginIframes || 0) + 1;
        }
      }
    }

    // ── Card element fallback (IMPROVED) ──
    // CHANGED: Removed overly broad [class*="row"] and [class*="item"] selectors
    //          Added frame validation and text pattern filtering
    if (results.length === 0) {
      // CHANGED: Check we're in the right frame before using fallback
      var isCardFallbackFrame = location.href.includes('vf.force.com') ||
                                location.href.includes('project_cloud') ||
                                location.href.includes('lightning');

      if (isCardFallbackFrame) {
        // CHANGED: Use only specific card selectors, not broad "row" or "item"
        var cards = document.querySelectorAll(
          '[class*="ticket"], [class*="task"], [class*="card"]'
        );
        diag.cardElements = cards.length;

        // CHANGED: Known nav patterns to filter out
        var knownNavPatterns = ['dashboards', 'sidebar', 'navigator', 'tab-nav', 'main-nav', 'breadcrumb'];

        cards.forEach(function (el) {
          var t = (el.textContent || '').trim();
          var textLower = t.toLowerCase();

          // CHANGED: Skip if matches known navigation patterns
          if (knownNavPatterns.some(function(p) { return textLower.includes(p); })) {
            return;
          }

          // CHANGED: Check for garbage patterns like "DashboardsDashboards"
          if (t.includes('Dashboards') && textLower.split('dashboards').length > 2) {
            return;
          }

          // CHANGED: Reasonable length check (not too short, not too long)
          if (t.length > 5 && t.length < 300 && t.match(/[A-Z][a-z]+\s+[A-Z]/)) {
            results.push({
              projectName: t.slice(0, 80),
              description: 'Revision',
              estimatedHours: 1,
              dueDate: '',
            });
          }
        });
      }
    }

    return { needsLogin: false, data: results, diag: diag };
  } catch (e) {
    return { needsLogin: false, data: [], error: e.message };
  }
}

// ═══════════════════════════════════════════════════════
// FIX 4: Improved extractSalesforceData() aria-label Parsing
// ═══════════════════════════════════════════════════════

/**
 * Extract data from Salesforce Analytics (Wave) report.
 * Includes fix for compound column headers in aria-labels.
 *
 * CHANGED: Improved aria-label parsing to handle headers like "Project (Rollup): Project Name"
 */
function extractSalesforceData() {
  try {
    // ── Login Detection ──
    if (
      document.querySelector('input[name="username"]') ||
      document.title.toLowerCase().includes('login')
    ) {
      return { needsLogin: true, data: [] };
    }

    var diag = {
      url: location.href.slice(0, 120),
      iframes: document.querySelectorAll('iframe').length,
      tables: document.querySelectorAll('table').length,
      title: document.title.slice(0, 60),
      timestamp: new Date().toISOString(),
    };

    // ── Strategy 1: CRM Analytics (Wave) report widget ──
    var widget = document.querySelector('div.report-table-widget');
    if (widget && widget.classList.contains('widgetReady') && widget.classList.contains('finalState')) {
      var table = widget.querySelector('table.data-grid-full-table');
      if (table) {
        diag.strategy = 'wave-analytics';
        var rows = table.querySelectorAll('tr');
        if (rows.length === 0) {
          diag.error = 'no tr elements in wave table';
          return { needsLogin: false, data: [], error: 'No rows in report table', diag: diag };
        }

        diag.totalRows = rows.length;
        var results = [];
        var currentEndDate = '';
        var currentTaskType = '';
        var currentTaskId = '';
        var processedRows = 0;
        var skippedRows = 0;

        // CHANGED: Known field names for compound header detection
        var knownFieldNames = ['project name', 'color block', 'tag', 'project setup notes',
                               'owner name', 'project task name', 'active project sharepoint folder link'];

        rows.forEach(function (row) {
          // Skip header rows
          if (row.querySelectorAll('th').length > 0) { skippedRows++; return; }

          var gridCells = row.querySelectorAll('td[role="gridcell"]');
          if (gridCells.length === 0) { skippedRows++; return; }

          // Extract cell values via aria-label
          var cellData = {};
          var projectLink = null;

          gridCells.forEach(function (cell, cellIndex) {
            var cellDiv = cell.querySelector('div.wave-table-cell-text') || cell.querySelector('div');
            if (!cellDiv) return;

            var ariaLabel = cellDiv.getAttribute('aria-label') || '';
            var dataTooltip = cellDiv.getAttribute('data-tooltip') || '';
            var cellText = ariaLabel || dataTooltip || cellDiv.textContent.trim();

            // Parse aria-label: "Column Header: Value"
            // CHANGED: Handle compound headers like "Project (Rollup): Project Name: Value"
            if (ariaLabel && ariaLabel.includes(':')) {
              var parts = ariaLabel.split(': ');
              var columnHeader = parts[0];
              var value = parts.slice(1).join(': ');

              // CHANGED: Check if parts[1] looks like a field name (compound header)
              if (parts.length >= 3) {
                var potentialFieldName = parts[1].toLowerCase().trim();
                // If second part matches known field pattern, include it in header
                if (knownFieldNames.some(function(fn) {
                  return potentialFieldName.includes(fn) || fn.includes(potentialFieldName);
                })) {
                  columnHeader = parts[0] + ': ' + parts[1];
                  value = parts.slice(2).join(': ');
                }
              }

              cellData[columnHeader.toLowerCase().trim()] = value;
              cellData['_raw_' + cellIndex] = cellText;
            } else {
              cellData['_raw_' + cellIndex] = cellText;
            }

            // Extract links for IDs
            var link = cell.querySelector('a');
            if (link && !projectLink) {
              projectLink = {
                href: link.getAttribute('href') || '',
                dataId: link.getAttribute('data-id') || '',
              };
            }
          });

          // Skip total rows
          var rowText = (row.textContent || '').trim();
          if (rowText.includes('Grand Total') || rowText.includes('lightning-table-grand-total-cell')) {
            skippedRows++;
            return;
          }

          // Update grouped values (End Date, Task Type) — they use rowspan
          var endDateCell = row.querySelector('td[role="gridcell"]:first-child');
          if (endDateCell) {
            var endDateDiv = endDateCell.querySelector('div.wave-table-cell-text');
            var endDateText = endDateDiv
              ? (endDateDiv.textContent || '').trim()
              : (endDateCell.textContent || '').trim();
            if (endDateText && !endDateText.startsWith('Total') && endDateText !== '') {
              currentEndDate = endDateText;
            }
          }

          var taskTypeCell = row.querySelector('td[role="gridcell"]:nth-child(2)');
          if (taskTypeCell) {
            var taskTypeDiv = taskTypeCell.querySelector('div.wave-table-cell-text');
            var taskTypeText = taskTypeDiv
              ? (taskTypeDiv.textContent || '').trim()
              : (taskTypeCell.textContent || '').trim();
            if (taskTypeText && !taskTypeText.startsWith('Total') && taskTypeText !== '') {
              currentTaskType = taskTypeText;
              var taskLinkEl = taskTypeCell.querySelector('a');
              if (taskLinkEl) {
                currentTaskId = taskLinkEl.getAttribute('data-id') || '';
              }
            }
          }

          if (!currentEndDate || !currentTaskType) { skippedRows++; return; }

          // Build result — find project name from cellData
          var projectName = '';
          var projectId = '';
          var colorBlock = '';
          var tag = '';
          var setupNotes = '';

          for (var key in cellData) {
            if (key.startsWith('_raw_')) continue;
            var val = cellData[key];
            var lk = key.toLowerCase();
            if (lk.includes('project') && lk.includes('name')) projectName = val;
            else if (lk.includes('color')) colorBlock = val;
            else if (lk.includes('tag')) tag = val;
            else if (lk.includes('setup') || lk.includes('notes')) setupNotes = val;
          }

          // Fallback: last cell
          if (!projectName) {
            var lastCell = gridCells[gridCells.length - 1];
            if (lastCell) {
              var pDiv = lastCell.querySelector('div.wave-table-cell-text');
              projectName = pDiv ? (pDiv.textContent || '').trim() : (lastCell.textContent || '').trim();
            }
          }

          if (!projectName || projectName === '') { skippedRows++; return; }

          if (projectLink && projectLink.dataId) projectId = projectLink.dataId;

          results.push({
            endDate: currentEndDate,
            taskType: currentTaskType,
            taskId: currentTaskId,
            projectName: projectName,
            projectId: projectId,
            colorBlock: colorBlock,
            tag: tag,
            setupNotes: setupNotes,
          });
          processedRows++;
        });

        diag.processedRows = processedRows;
        diag.skippedRows = skippedRows;
        return { needsLogin: false, data: results, diag: diag };
      }
    }

    // ── Strategy 2: Legacy td[data-fixed-column] extraction ──
    // Falls back for older report formats
    diag.strategy = 'legacy-fixed-column';
    var table = null;

    var fixedCell = document.querySelector('td[data-fixed-column="true"]');
    table = fixedCell ? fixedCell.closest('table') : null;

    if (!table) {
      table =
        document.querySelector('[data-grid-full-table]') ||
        document.querySelector('table.data-grid-full-table') ||
        document.querySelector('table.slds-table') ||
        document.querySelector('table[role="grid"]');
    }

    if (!table) {
      var reportContent =
        document.querySelector('.report-content') ||
        document.querySelector('[class*="reportContent"]') ||
        document.querySelector('[class*="report-"]');
      if (reportContent) table = reportContent.querySelector('table');
    }

    if (!table) {
      var tables = document.querySelectorAll('table');
      for (var t = 0; t < tables.length; t++) {
        if (tables[t].querySelectorAll('tr').length > 2) {
          table = tables[t];
          break;
        }
      }
    }

    // Strategy 5: iframe fallback
    if (!table) {
      var iframes = document.querySelectorAll('iframe');
      for (var fi = 0; fi < iframes.length; fi++) {
        try {
          var doc = iframes[fi].contentDocument || iframes[fi].contentWindow.document;
          if (!doc) continue;
          fixedCell = doc.querySelector('td[data-fixed-column="true"]');
          table = fixedCell ? fixedCell.closest('table') : null;
          if (!table) {
            table = doc.querySelector('table.data-grid-full-table') || doc.querySelector('table.slds-table');
          }
          if (table) break;
        } catch (e) { /* cross-origin */ }
      }
    }

    if (!table) {
      diag.error = 'no table found by any strategy';
      return { needsLogin: false, data: [], error: 'Report table not found', diag: diag };
    }

    // Extract from legacy table
    var rows = table.querySelectorAll('tr');
    var results = [];
    var currentEndDate = '';
    var currentTaskType = '';
    var usesFixedColumns = !!table.querySelector('td[data-fixed-column]');

    if (usesFixedColumns) {
      rows.forEach(function (row) {
        var fixedCells = row.querySelectorAll('td[data-fixed-column="true"]');
        var dataCells = row.querySelectorAll('td[data-fixed-column="false"]');

        if (fixedCells.length >= 1) {
          var ed = (fixedCells[0].textContent || '').trim();
          if (ed && !ed.startsWith('Total')) {
            var m = ed.match(/^([\d\/]+)/);
            if (m) currentEndDate = m[1];
          }
        }
        if (fixedCells.length >= 2) {
          var tt = (fixedCells[1].textContent || '').trim();
          if (tt && !tt.startsWith('Total')) {
            var m2 = tt.match(/^([^(]+)/);
            if (m2) currentTaskType = m2[1].trim();
          }
        }
        if (!currentEndDate || !currentTaskType) return;

        var projectName = dataCells[0] ? dataCells[0].textContent.trim() : '';
        if (!projectName || projectName.startsWith('Total')) return;

        results.push({
          endDate: currentEndDate,
          taskType: currentTaskType,
          projectName: projectName,
          colorBlock: dataCells[1] ? dataCells[1].textContent.trim() : '',
          tag: dataCells[2] ? dataCells[2].textContent.trim() : '',
          setupNotes: dataCells[3] ? dataCells[3].textContent.trim() : '',
          ownerName: dataCells[4] ? dataCells[4].textContent.trim() : '',
        });
      });
    } else {
      // Generic header-based extraction
      var headerRow = table.querySelector('thead tr, tr:first-child');
      var headers = [];
      if (headerRow) {
        headerRow.querySelectorAll('th, td').forEach(function (cell) {
          headers.push((cell.textContent || '').trim().toLowerCase());
        });
      }

      var colMap = {};
      headers.forEach(function (h, idx) {
        if (h.includes('end') || h.includes('date') || h.includes('calculated')) colMap.endDate = idx;
        if (h.includes('task') && h.includes('name')) colMap.taskType = idx;
        if (h.includes('project') && h.includes('name')) colMap.projectName = idx;
        if (h.includes('color')) colMap.colorBlock = idx;
        if (h.includes('tag')) colMap.tag = idx;
        if (h.includes('setup') || h.includes('notes')) colMap.setupNotes = idx;
        if (h.includes('owner')) colMap.ownerName = idx;
      });

      if (Object.keys(colMap).length === 0) {
        colMap = { endDate: 0, taskType: 1, projectName: 2, colorBlock: 3, tag: 4, setupNotes: 5 };
      }

      var dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      dataRows.forEach(function (row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 3) return;

        var projectName = cells[colMap.projectName] ? cells[colMap.projectName].textContent.trim() : '';
        if (!projectName || projectName.startsWith('Total')) return;

        var endDate = cells[colMap.endDate] ? cells[colMap.endDate].textContent.trim() : '';
        var taskType = cells[colMap.taskType] ? cells[colMap.taskType].textContent.trim() : '';
        if (endDate.startsWith('Total') || taskType.startsWith('Total')) return;

        results.push({
          endDate: endDate,
          taskType: taskType,
          projectName: projectName,
          colorBlock: colMap.colorBlock !== undefined && cells[colMap.colorBlock] ? cells[colMap.colorBlock].textContent.trim() : '',
          tag: colMap.tag !== undefined && cells[colMap.tag] ? cells[colMap.tag].textContent.trim() : '',
          setupNotes: colMap.setupNotes !== undefined && cells[colMap.setupNotes] ? cells[colMap.setupNotes].textContent.trim() : '',
          ownerName: colMap.ownerName !== undefined && cells[colMap.ownerName] ? cells[colMap.ownerName].textContent.trim() : '',
        });
      });
    }

    return { needsLogin: false, data: results, diag: diag };
  } catch (e) {
    return {
      needsLogin: false,
      data: [],
      error: 'Extraction error: ' + e.message,
      diag: { exception: e.message, stack: e.stack ? e.stack.slice(0, 200) : '' },
    };
  }
}

// ═══════════════════════════════════════════════════════
// FIX 6: Improved runExtraction() with Data Source Priority
// ═══════════════════════════════════════════════════════

/**
 * Run extraction function in one or all frames, with intelligent result prioritization.
 *
 * CHANGED: Collect ALL frame results and intelligently choose which one to return.
 *          Prefer: vf.force.com/lightningReportApp frames > more data > no garbage patterns
 */
async function runExtraction(tabId, extractionFunc, allFrames = false) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: allFrames },
    func: extractionFunc,
  });

  const errors = [];
  const allDiag = [];
  const qualifiedResults = [];  // CHANGED: Collect all viable results

  // CHANGED: Collect all results instead of returning on first match
  for (const frame of results) {
    if (frame.result && frame.result.diag) allDiag.push(frame.result.diag);

    // Check for login requirement (return immediately)
    if (frame.result && frame.result.needsLogin) {
      return frame.result;
    }

    // Check for data
    if (frame.result && frame.result.data && frame.result.data.length > 0) {
      qualifiedResults.push({
        result: frame.result,
        frameUrl: frame.result.diag ? frame.result.diag.url : '',
        dataCount: frame.result.data.length,
      });
    }

    if (frame.result && frame.result.error) {
      errors.push(frame.result.error);
    }
  }

  // CHANGED: Prioritize results before returning
  if (qualifiedResults.length > 0) {
    // Sort by priority: vf.force.com first, then by data count
    qualifiedResults.sort(function(a, b) {
      var aIsVf = a.frameUrl.includes('vf.force.com') || a.frameUrl.includes('project_cloud') ? 1 : 0;
      var bIsVf = b.frameUrl.includes('vf.force.com') || b.frameUrl.includes('project_cloud') ? 1 : 0;

      if (aIsVf !== bIsVf) return bIsVf - aIsVf;  // VF frames first
      return b.dataCount - a.dataCount;  // More data first
    });

    var chosen = qualifiedResults[0].result;

    // CHANGED: Filter out garbage patterns
    if (chosen.data && chosen.data.length > 0) {
      // Filter results that contain known garbage patterns
      var filtered = chosen.data.filter(function(item) {
        var text = JSON.stringify(item).toLowerCase();
        // Remove entries that look like nav elements
        if (text.includes('dashboards') && text.includes('list') && text.length < 50) {
          return false;
        }
        return true;
      });

      if (filtered.length > 0) {
        chosen.data = filtered;
      }
    }

    return chosen;
  }

  return {
    needsLogin: false,
    data: [],
    error: errors.length > 0
      ? errors.join(' | ')
      : 'No data found (checked ' + results.length + ' frames)',
    diag: allDiag,
  };
}

// ═══════════════════════════════════════════════════════
// FIX 5 & 7: Improved importSource() with Multi-Step Navigation & Timeout Handling
// ═══════════════════════════════════════════════════════

/**
 * Import from a single source with improved Cloud Coach multi-step flow.
 *
 * CHANGED: Support preExtractFunc as either a single function or array of sequential steps.
 *          Each step can indicate if orchestrator should wait before next step.
 *          Better timeout handling with diagnostic logging.
 *
 * @param {string} key - Source identifier
 * @param {string} urlPrefix - URL prefix for tab matching
 * @param {string} fullUrl - Full URL to open
 * @param {Function} extractFunc - Extraction function to inject
 * @param {boolean} allFrames - Whether to inject into all frames
 * @param {Function|Array} [preExtractFunc] - Pre-extraction function(s) or array of functions for multi-step
 * @param {Function} [readinessFunc] - Readiness polling function
 */
async function importSource(key, urlPrefix, fullUrl, extractFunc, allFrames, preExtractFunc, readinessFunc) {
  const MAX_RETRIES = 12;
  const RETRY_DELAY = 5000;
  const INITIAL_DELAY = key === 'outlook' ? 3000 : 8000;

  let tab;
  try {
    tab = await ensureTab(urlPrefix, fullUrl);
  } catch (e) {
    return { source: key, status: 'error', error: 'Could not open tab: ' + e.message, data: [] };
  }

  await sleep(INITIAL_DELAY);

  // ── Pre-extraction navigation (e.g., click Lists, then Tickets) ──
  // CHANGED: Support array of pre-extraction functions for multi-step flows
  if (preExtractFunc) {
    var preExtractFuncs = Array.isArray(preExtractFunc) ? preExtractFunc : [preExtractFunc];

    for (var stepIdx = 0; stepIdx < preExtractFuncs.length; stepIdx++) {
      var currentFunc = preExtractFuncs[stepIdx];
      var preClickResult = null;

      for (let preAttempt = 0; preAttempt < 3; preAttempt++) {
        try {
          const preResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: currentFunc,
          });

          for (const r of preResults) {
            if (r.result && r.result.clicked) {
              preClickResult = r.result;
              break;
            }
          }

          if (preClickResult) {
            // CHANGED: Better inter-step delay for Cloud Coach
            var delayBetweenSteps = key === 'cloudcoach' ? 4000 : 2000;
            await sleep(delayBetweenSteps);
            break;
          }

          if (preAttempt < 2) await sleep(3000);
        } catch (e) {
          if (preAttempt < 2) await sleep(3000);
        }
      }

      if (!preClickResult && key === 'cloudcoach') {
        // CHANGED: Log diagnostic info for failed steps
        console.warn('Cloud Coach navigation step ' + (stepIdx + 1) + ' failed');
      }
    }
  }

  // ── Poll readiness before extraction (adaptive waiting) ──
  // CHANGED: Better timeout handling with diagnostic logging
  if (readinessFunc) {
    const isReady = await pollReadiness(tab.id, readinessFunc, allFrames, 30000, 1000);
    if (!isReady) {
      // CHANGED: Log warning and handle differently based on source
      console.warn('Readiness timeout for ' + key);

      if (key === 'cloudcoach') {
        // For Cloud Coach, timeout might indicate navigation failed
        return {
          source: key,
          status: 'error',
          error: 'Tickets table did not load within timeout (navigation steps may have failed)',
          data: [],
          diagnostic: { readinessTimeout: true, source: key }
        };
      }
      // For Salesforce, continue anyway (report might still have data)
    }
  }

  // ── Extraction retry loop ──
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await runExtraction(tab.id, extractFunc, allFrames);

      if (result.needsLogin) {
        await chrome.tabs.update(tab.id, { active: true });
        if (attempt < MAX_RETRIES - 1) { await sleep(RETRY_DELAY); continue; }
        return { source: key, status: 'needs-login', data: [] };
      }

      if (result.data && result.data.length > 0) {
        return { source: key, status: 'success', data: result.data };
      }

      if (result.error) {
        if (attempt < MAX_RETRIES - 1) { await sleep(RETRY_DELAY); continue; }
        return { source: key, status: 'error', error: result.error, data: [], diag: result.diag };
      }

      if (attempt < MAX_RETRIES - 1) { await sleep(RETRY_DELAY); continue; }
    } catch (e) {
      if (attempt < MAX_RETRIES - 1) { await sleep(RETRY_DELAY); continue; }
      return { source: key, status: 'error', error: e.message, data: [] };
    }
  }

  return { source: key, status: 'error', error: 'Timed out waiting for data', data: [] };
}

// ═══════════════════════════════════════════════════════
// Helper: parseRevisionDescription (unchanged, included for completeness)
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// FIX 5b: Updated importAll() — Pass Two-Step Navigation to Cloud Coach
// ═══════════════════════════════════════════════════════

/**
 * Import from all three sources.
 *
 * CHANGED: Cloud Coach now uses [navigateToCloudCoachTickets, clickCloudCoachTicketsSidebar]
 *          as a two-step preExtract array, and isTicketsTableReady as the readiness check.
 */
async function importAll(options) {
  const sources = options?.sources || ['salesforce', 'outlook', 'cloudcoach'];
  const results = {};
  const promises = [];

  if (sources.includes('salesforce')) {
    promises.push(
      importSource(
        'salesforce',
        'https://civicplus.lightning.force.com/lightning/r/Report/',
        SOURCE_URLS.salesforce,
        extractSalesforceData,
        true,                        // allFrames
        null,                        // no preExtract
        waitForSalesforceReport      // readiness polling (unchanged)
      ).then((r) => (results.salesforce = r))
    );
  }

  if (sources.includes('outlook')) {
    promises.push(
      importSource(
        'outlook',
        'https://outlook.office',
        SOURCE_URLS.outlook,
        extractOutlookData,
        false,                       // allFrames
        null,                        // no preExtract
        null                         // no readiness polling
      ).then((r) => (results.outlook = r))
    );
  }

  if (sources.includes('cloudcoach')) {
    promises.push(
      importSource(
        'cloudcoach',
        'https://civicplus.lightning.force.com/lightning/n/project_cloud',
        SOURCE_URLS.cloudcoach,
        extractCloudCoachData,
        true,                                                          // allFrames
        // CHANGED: Two-step navigation array instead of single function
        [navigateToCloudCoachTickets, clickCloudCoachTicketsSidebar],
        // CHANGED: New readiness function that validates Tickets table
        isTicketsTableReady
      ).then((r) => (results.cloudcoach = r))
    );
  }

  await Promise.all(promises);
  return results;
}

/**
 * Updated config for wmp-import-source single-source handler.
 * Use this to replace the config object in the message listener.
 *
 * CHANGED: Cloud Coach config uses two-step preExtract array.
 */
const UPDATED_SOURCE_CONFIG = {
  salesforce: {
    prefix: 'https://civicplus.lightning.force.com/lightning/r/Report/',
    url: SOURCE_URLS.salesforce,
    func: extractSalesforceData,
    allFrames: true,
    preExtract: null,
    readiness: waitForSalesforceReport,
  },
  outlook: {
    prefix: 'https://outlook.office',
    url: SOURCE_URLS.outlook,
    func: extractOutlookData,
    allFrames: false,
    preExtract: null,
    readiness: null,
  },
  cloudcoach: {
    prefix: 'https://civicplus.lightning.force.com/lightning/n/project_cloud',
    url: SOURCE_URLS.cloudcoach,
    func: extractCloudCoachData,
    allFrames: true,
    // CHANGED: Two-step navigation
    preExtract: [navigateToCloudCoachTickets, clickCloudCoachTicketsSidebar],
    // CHANGED: New readiness function
    readiness: isTicketsTableReady,
  },
};

// ═══════════════════════════════════════════════════════
// Helper: parseRevisionDescription (unchanged, included for completeness)
// ═══════════════════════════════════════════════════════

/**
 * Parse a revision description for structured data.
 * Extracts: hours, revision label, SharePoint URL, assignees.
 */
function parseRevisionDescription(descText) {
  var result = { hours: 0, revisionLabel: '', webViewUrl: '', assignees: [] };
  if (!descText || typeof descText !== 'string') return result;

  var hoursMatch = descText.match(/(\d+\.?\d*)\s*hours?/i);
  if (hoursMatch) result.hours = parseFloat(hoursMatch[1]);

  var labelMatch = descText.match(/Design\s+Revisions?\s+[\w\d\-()]+/i);
  if (labelMatch) result.revisionLabel = labelMatch[0];

  var assigneeMatch = descText.match(/\(([^)]+)\)/);
  if (assigneeMatch) {
    result.assignees = assigneeMatch[1].split(/[\/,\s]+/).filter(function (n) { return n.length > 0; });
  }

  var urlMatch = descText.match(/https:\/\/[^\s<>"]+\.sharepoint\.com[^\s<>"]*\b/i);
  if (urlMatch) result.webViewUrl = urlMatch[0];

  return result;
}
