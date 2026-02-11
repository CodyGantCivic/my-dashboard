/**
 * sf-extraction.js
 *
 * Extraction functions for Salesforce Analytics (CRM Analytics / Wave) reports.
 * These functions are injected via chrome.scripting.executeScript and must be
 * fully self-contained (no external imports or closures).
 */

/**
 * Check if the Salesforce Analytics report is ready for extraction.
 * Returns true when:
 * - div.report-table-widget exists
 * - It has both classes: widgetReady AND finalState
 * - table.data-grid-full-table exists inside it
 * - At least one td[role="gridcell"] is present
 *
 * This function is intended to be used as a polling check.
 */
function waitForSalesforceReport() {
  try {
    // Find the report widget container
    var widget = document.querySelector('div.report-table-widget');
    if (!widget) {
      return false;
    }

    // Check for both required classes
    var hasWidgetReady = widget.classList.contains('widgetReady');
    var hasFinalState = widget.classList.contains('finalState');

    if (!hasWidgetReady || !hasFinalState) {
      return false;
    }

    // Check for the full data table
    var fullTable = widget.querySelector('table.data-grid-full-table');
    if (!fullTable) {
      return false;
    }

    // Check for at least one grid cell
    var gridCell = fullTable.querySelector('td[role="gridcell"]');
    if (!gridCell) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Alias for waitForSalesforceReport — polls the readiness state.
 * Used by background.js as a pre-extraction readiness check.
 */
function isReportReady() {
  return waitForSalesforceReport();
}

/**
 * Extract data from Salesforce Analytics (Wave) report.
 *
 * Structure:
 * - div.report-table-widget.widgetReady.finalState (container)
 *   - table.data-grid-fixed-column-table (pinned columns: End Date, Task Name)
 *   - table.data-grid-full-table (all columns: fixed + scrollable)
 *
 * Cell values are extracted via aria-label on div.wave-table-cell-text:
 * - Format: "Column Header: Value" (e.g., "Project (Rollup): Project Name: Louisa County VA | MWC Ultimate Redesign 1125")
 * - Parse by splitting on first ": " to get the value
 *
 * Row grouping: Rows are grouped by End Date and Task Name using rowspan.
 * Track currentEndDate and currentTaskType across rows; update when new values appear.
 *
 * Returns:
 * {
 *   needsLogin: boolean,
 *   data: [ { endDate, taskType, taskId, projectName, projectId, colorBlock, tag, setupNotes }, ... ],
 *   diag: { url, iframes, tables, title, ... }
 * }
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

    // ── Diagnostics ──
    var diag = {
      url: location.href.slice(0, 120),
      iframes: document.querySelectorAll('iframe').length,
      tables: document.querySelectorAll('table').length,
      title: document.title.slice(0, 60),
      timestamp: new Date().toISOString(),
    };

    // ── Find Report Widget ──
    var widget = document.querySelector('div.report-table-widget');
    if (!widget) {
      diag.error = 'report-table-widget not found';
      return {
        needsLogin: false,
        data: [],
        error: 'Report widget not found',
        diag: diag,
      };
    }

    // Check for readiness classes
    var isReady =
      widget.classList.contains('widgetReady') && widget.classList.contains('finalState');
    if (!isReady) {
      diag.error = 'widget not ready or in final state';
      return {
        needsLogin: false,
        data: [],
        error: 'Report widget not ready',
        diag: diag,
      };
    }

    // ── Find Full Data Table ──
    var table = widget.querySelector('table.data-grid-full-table');
    if (!table) {
      diag.error = 'data-grid-full-table not found inside widget';
      return {
        needsLogin: false,
        data: [],
        error: 'Full data table not found',
        diag: diag,
      };
    }

    // ── Extract Rows ──
    var rows = table.querySelectorAll('tr');
    if (rows.length === 0) {
      diag.error = 'no tr elements found in table';
      return {
        needsLogin: false,
        data: [],
        error: 'No rows in table',
        diag: diag,
      };
    }

    diag.totalRows = rows.length;

    // ── Parse Rows ──
    var results = [];
    var currentEndDate = '';
    var currentTaskType = '';
    var currentTaskId = '';
    var processedRows = 0;
    var skippedRows = 0;

    rows.forEach(function (row) {
      // Skip header rows (th elements instead of td)
      if (row.querySelectorAll('th').length > 0) {
        skippedRows++;
        return;
      }

      var gridCells = row.querySelectorAll('td[role="gridcell"]');
      if (gridCells.length === 0) {
        skippedRows++;
        return;
      }

      // ── Extract Cell Values via aria-label ──
      // Build a map of column header to cell value
      var cellData = {};
      var hasLink = false;
      var taskLink = null;
      var projectLink = null;

      gridCells.forEach(function (cell, cellIndex) {
        // Get cell text with aria-label (preferred) or data-tooltip
        var cellDiv = cell.querySelector('div.wave-table-cell-text');
        if (!cellDiv) {
          cellDiv = cell.querySelector('div');
        }

        if (!cellDiv) return;

        var ariaLabel = cellDiv.getAttribute('aria-label') || '';
        var dataTooltip = cellDiv.getAttribute('data-tooltip') || '';
        var cellText = ariaLabel || dataTooltip || cellDiv.textContent.trim();

        // Parse aria-label format: "Column Header: Value"
        // Example: "Project (Rollup): Project Name: Louisa County VA | MWC Ultimate Redesign 1125"
        if (ariaLabel && ariaLabel.includes(':')) {
          var parts = ariaLabel.split(': ');
          var columnHeader = parts[0];
          var value = parts.slice(1).join(': '); // Re-join in case value contains ':'

          // Normalize column names
          var normalizedHeader = columnHeader.toLowerCase().trim();

          cellData[normalizedHeader] = value;
          cellData['_raw_' + cellIndex] = cellText;
        } else {
          cellData['_raw_' + cellIndex] = cellText;
        }

        // Extract links for task and project IDs
        var link = cell.querySelector('a');
        if (link) {
          hasLink = true;
          var href = link.getAttribute('href') || '';
          var dataId = link.getAttribute('data-id') || '';

          // Determine if this is a task or project link
          // Task links: typically contain task ID pattern
          // Project links: contain project ID pattern
          if (href && !projectLink) {
            projectLink = { href: href, dataId: dataId };
          }
        }
      });

      // ── Skip Total/Grand Total Rows ──
      var rowText = (row.textContent || '').trim();
      if (rowText.includes('Grand Total') || rowText.includes('lightning-table-grand-total-cell')) {
        skippedRows++;
        return;
      }

      // ── Update Grouped Values (End Date, Task Type) ──
      // These use rowspan, so we track them across rows
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

      // Task type is typically the second fixed column
      var taskTypeCell = row.querySelector('td[role="gridcell"]:nth-child(2)');
      if (taskTypeCell) {
        var taskTypeDiv = taskTypeCell.querySelector('div.wave-table-cell-text');
        var taskTypeText = taskTypeDiv
          ? (taskTypeDiv.textContent || '').trim()
          : (taskTypeCell.textContent || '').trim();

        if (taskTypeText && !taskTypeText.startsWith('Total') && taskTypeText !== '') {
          currentTaskType = taskTypeText;
          // Also try to extract task ID from link in this cell
          var taskLink = taskTypeCell.querySelector('a');
          if (taskLink) {
            currentTaskId = taskLink.getAttribute('data-id') || '';
          }
        }
      }

      // Skip rows without end date or task type
      if (!currentEndDate || !currentTaskType) {
        skippedRows++;
        return;
      }

      // ── Build Result Record ──
      // Look for specific columns in cellData
      var projectName = '';
      var projectId = '';
      var colorBlock = '';
      var tag = '';
      var setupNotes = '';

      // Find project name from cellData (most flexible approach)
      for (var key in cellData) {
        var value = cellData[key];
        var lowerKey = key.toLowerCase();

        if (lowerKey.includes('project') && lowerKey.includes('name')) {
          projectName = value;
        } else if (lowerKey.includes('color')) {
          colorBlock = value;
        } else if (lowerKey.includes('tag')) {
          tag = value;
        } else if (lowerKey.includes('setup') || lowerKey.includes('notes')) {
          setupNotes = value;
        }
      }

      // If no project name found via aria-label, extract from raw text
      if (!projectName) {
        // Fallback: use the last grid cell that has text
        var lastGridCell = gridCells[gridCells.length - 1];
        if (lastGridCell) {
          var projectDiv = lastGridCell.querySelector('div.wave-table-cell-text');
          projectName = projectDiv
            ? (projectDiv.textContent || '').trim()
            : (lastGridCell.textContent || '').trim();
        }
      }

      // Skip if no project name
      if (!projectName || projectName === '') {
        skippedRows++;
        return;
      }

      // Get project ID from link if available
      if (projectLink && projectLink.dataId) {
        projectId = projectLink.dataId;
      }

      // Build the result record
      var record = {
        endDate: currentEndDate,
        taskType: currentTaskType,
        taskId: currentTaskId,
        projectName: projectName,
        projectId: projectId,
        colorBlock: colorBlock,
        tag: tag,
        setupNotes: setupNotes,
      };

      results.push(record);
      processedRows++;
    });

    diag.processedRows = processedRows;
    diag.skippedRows = skippedRows;

    return {
      needsLogin: false,
      data: results,
      diag: diag,
    };
  } catch (e) {
    return {
      needsLogin: false,
      data: [],
      error: 'Extraction error: ' + e.message,
      diag: {
        exception: e.message,
        stack: e.stack ? e.stack.slice(0, 200) : '',
      },
    };
  }
}
