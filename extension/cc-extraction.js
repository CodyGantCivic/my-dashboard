/**
 * Cloud Coach Extraction Functions
 *
 * Three self-contained functions for navigating to and extracting revision data
 * from the Cloud Coach Gameplan page in Salesforce Lightning.
 *
 * These functions are injected via chrome.scripting.executeScript and must be
 * fully self-contained (no closures, no external dependencies).
 */

/**
 * Navigate to the Cloud Coach revisions list.
 *
 * Strategy:
 * 1. Try Option A (preferred): Click the "Lists" tab using SLDS tab link selector
 * 2. Fallback to Option B: Click the revisions stats item via the custom45 icon
 *
 * Returns: { clicked: boolean, method: string, diag: object }
 */
function clickCloudCoachRevisionsTab() {
  try {
    var diag = {
      url: location.href.slice(0, 120),
      timestamp: new Date().toISOString(),
    };

    // ── OPTION A: Click the "Lists" tab (preferred) ──
    // The Lists tab is a standard SLDS tab link with href="#/home/lists"
    var listsTab = document.querySelector('a.slds-tabs_default__link[href="#/home/lists"]');
    if (listsTab) {
      listsTab.click();
      return {
        clicked: true,
        method: 'lists-tab-slds',
        diag: diag,
      };
    }

    diag.listsTabFound = false;

    // ── OPTION B: Click the revisions stats item (fallback) ──
    // The stats items contain SVG <use> elements with custom icons.
    // The revisions icon uses #custom45.

    // Strategy B1: Look for custom45 via xlink:href
    var allUses = document.querySelectorAll('use');
    for (var i = 0; i < allUses.length; i++) {
      var useEl = allUses[i];
      var href = useEl.getAttribute('href') || '';
      var xlinkHref = useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
      var hrefProp = '';
      try {
        hrefProp = (useEl.href && useEl.href.baseVal) ? useEl.href.baseVal : '';
      } catch (e) {}

      if (href.includes('custom45') || xlinkHref.includes('custom45') || hrefProp.includes('custom45')) {
        // Walk up to the clickable stats-item container
        var clickTarget = useEl.closest('.slds-col') ||
                          useEl.closest('[class*="stats-item"]') ||
                          useEl.closest('button');
        if (clickTarget) {
          clickTarget.click();
          return {
            clicked: true,
            method: 'custom45-icon-xlink',
            diag: diag,
          };
        }
      }
    }

    diag.custom45Found = false;

    // Strategy B2: Click stats-item by index (revisions is typically the second stats item)
    var statsItems = document.querySelectorAll('.stats-item, [class*="stats-item__count"]');
    diag.statsItemsCount = statsItems.length;

    if (statsItems.length >= 2) {
      // Try clicking the second stats item (index 1 = revisions)
      var statsItemParent = statsItems[1].closest('.slds-col') ||
                            statsItems[1].closest('[class*="stat"]') ||
                            statsItems[1].parentElement;
      if (statsItemParent) {
        statsItemParent.click();
        return {
          clicked: true,
          method: 'stats-item-index-1',
          count: (statsItems[1].textContent || '').trim(),
          diag: diag,
        };
      }
    }

    // Strategy B3: Find by icon class pattern
    var iconContainers = document.querySelectorAll('.slds-icon-custom-custom45, [class*="custom45"]');
    diag.custom45Containers = iconContainers.length;

    for (var ic = 0; ic < iconContainers.length; ic++) {
      var container = iconContainers[ic].closest('.slds-col') ||
                      iconContainers[ic].closest('[class*="stats"]') ||
                      iconContainers[ic].parentElement;
      if (container) {
        container.click();
        return {
          clicked: true,
          method: 'custom45-container-class',
          diag: diag,
        };
      }
    }

    return {
      clicked: false,
      error: 'Could not locate revisions tab or stats item',
      diag: diag,
    };
  } catch (e) {
    return {
      clicked: false,
      error: e.message,
      diag: { exception: true },
    };
  }
}

/**
 * Check if the revisions table is ready for extraction.
 *
 * Looks for: cc-sobject-table component with tbody rows
 *
 * Returns: boolean
 */
function isRevisionsTableReady() {
  try {
    // Look for the Cloud Coach sobject table component
    var table = document.querySelector('cc-sobject-table');
    if (!table) return false;

    // Check if it has a tbody with rows
    var tbody = table.querySelector('tbody');
    if (!tbody) return false;

    var rows = tbody.querySelectorAll('tr[cctablerow], tr');
    return rows.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Extract all Cloud Coach revision data from the revisions table.
 *
 * Returns: { needsLogin: boolean, data: array, diag: object }
 */
function extractCloudCoachData() {
  try {
    // ── Check for login page ──
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
    };

    // ── Find the revisions table ──
    var table = document.querySelector('cc-sobject-table');
    if (!table) {
      diag.tableFound = false;
      return {
        needsLogin: false,
        data: [],
        error: 'cc-sobject-table not found',
        diag: diag,
      };
    }

    var tbody = table.querySelector('tbody');
    if (!tbody) {
      diag.tbodyFound = false;
      return {
        needsLogin: false,
        data: [],
        error: 'tbody not found in table',
        diag: diag,
      };
    }

    var rows = tbody.querySelectorAll('tr[cctablerow], tr');
    diag.rowsFound = rows.length;

    if (rows.length === 0) {
      return {
        needsLogin: false,
        data: [],
        error: 'No rows found in table',
        diag: diag,
      };
    }

    // ── Extract each row ──
    rows.forEach(function (row, rowIdx) {
      try {
        var cells = row.querySelectorAll('td');
        if (cells.length < 3) return; // Skip rows with too few cells

        var revision = {};

        // ── Cell 0-1: Skip (indicators/checkboxes) ──

        // ── Cell 2: Due Date ──
        var dueDateCell = cells[2];
        if (dueDateCell) {
          var dueDateSpan = dueDateCell.querySelector('span[title]');
          if (dueDateSpan) {
            revision.dueDate = dueDateSpan.getAttribute('title') || '';
          }
        }

        // ── Cell 3: Name ──
        var nameCell = cells[3];
        var name = '';
        if (nameCell) {
          var nameDiv = nameCell.querySelector('div[title]');
          if (nameDiv) {
            name = nameDiv.getAttribute('title') || '';
          }
          if (!name) {
            name = nameCell.textContent.trim();
          }
        }

        // Skip rows with no name (empty/header rows)
        if (!name || name.length < 2) return;
        revision.name = name;

        // ── Cell 4: Project ──
        var projectCell = cells[4];
        var projectName = '';
        var projectHref = '';
        if (projectCell) {
          var projectLink = projectCell.querySelector('a');
          if (projectLink) {
            projectName = projectLink.textContent.trim();
            projectHref = projectLink.getAttribute('href') || '';
          }
          if (!projectName) {
            projectName = projectCell.textContent.trim();
          }
        }
        revision.project = projectName;
        revision.projectHref = projectHref;

        // ── Cell 5: Description ──
        var descCell = cells[5];
        var descriptionText = '';
        if (descCell) {
          var richTextDiv = descCell.querySelector('div.slds-rich-text-editor__output[title]');
          if (richTextDiv) {
            descriptionText = richTextDiv.getAttribute('title') || '';
          }
          if (!descriptionText) {
            descriptionText = descCell.textContent.trim();
          }
        }
        revision.description = descriptionText;

        // Parse description for hours, revision label, URL, assignees
        var descParsed = parseRevisionDescription(descriptionText);
        revision.hours = descParsed.hours;
        revision.revisionLabel = descParsed.revisionLabel;
        revision.webViewUrl = descParsed.webViewUrl;
        revision.assignees = descParsed.assignees;

        // ── Cell 6: Priority ──
        var priorityCell = cells[6];
        var priority = '';
        if (priorityCell) {
          var prioritySpan = priorityCell.querySelector('span[title]');
          if (prioritySpan) {
            priority = prioritySpan.getAttribute('title') || '';
          }
          if (!priority) {
            priority = priorityCell.textContent.trim();
          }
        }
        revision.priority = priority;

        // ── Cell 7: Created Date ──
        var createdCell = cells[7];
        var createdDate = '';
        if (createdCell) {
          var createdSpan = createdCell.querySelector('span[title]');
          if (createdSpan) {
            createdDate = createdSpan.getAttribute('title') || '';
          }
          if (!createdDate) {
            createdDate = createdCell.textContent.trim();
          }
        }
        revision.createdDate = createdDate;

        // ── Cell 8: Completed (checkbox) ──
        var completedCell = cells[8];
        var completed = false;
        if (completedCell) {
          var checkbox = completedCell.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.checked) {
            completed = true;
          }
        }
        revision.completed = completed;

        // ── Status: Check first cell for warning/error icons ──
        var statusCell = cells[0];
        var status = 'ok';
        if (statusCell) {
          if (statusCell.querySelector('.slds-icon-text-error')) {
            status = 'overdue';
          } else if (statusCell.querySelector('.slds-icon-text-warning')) {
            status = 'warning';
          }
        }
        revision.status = status;

        results.push(revision);
      } catch (rowErr) {
        // Skip rows that fail to parse
      }
    });

    return {
      needsLogin: false,
      data: results,
      diag: diag,
    };
  } catch (e) {
    return {
      needsLogin: false,
      data: [],
      error: e.message,
    };
  }
}

/**
 * Parse a revision description string for structured data.
 *
 * Expected formats:
 * - Hours: "2 hours", ".25 hour", "1.5 hour"
 * - Revision label: "Design Revisions 1" or "Design Revisions (DC4)"
 * - SharePoint URL: in <a> tag with "Web view" text
 * - Assignees: names in parentheses like "(Kate/Holly)"
 *
 * Returns: { hours, revisionLabel, webViewUrl, assignees[] }
 */
function parseRevisionDescription(descText) {
  var result = {
    hours: 0,
    revisionLabel: '',
    webViewUrl: '',
    assignees: [],
  };

  if (!descText || typeof descText !== 'string') {
    return result;
  }

  // Parse hours: look for pattern like "2 hours", "0.25 hour", "1.5 hour"
  var hoursMatch = descText.match(/(\d+\.?\d*)\s*hours?/i);
  if (hoursMatch) {
    result.hours = parseFloat(hoursMatch[1]);
  }

  // Parse revision label: look for "Design Revisions 1", "Design Revisions (DC4)", etc.
  var labelMatch = descText.match(/Design\s+Revisions?\s+[\w\d\-()]+/i);
  if (labelMatch) {
    result.revisionLabel = labelMatch[0];
  }

  // Parse assignees: look for pattern "(Name/Name)" or "(Name)"
  var assigneeMatch = descText.match(/\(([^)]+)\)/);
  if (assigneeMatch) {
    var assigneeStr = assigneeMatch[1];
    // Split by "/" or comma
    var names = assigneeStr.split(/[\/,\s]+/).filter(function (n) {
      return n.length > 0;
    });
    result.assignees = names;
  }

  // Parse SharePoint URL: look for <a> tag with "Web view" text or any https://...sharepoint...
  var urlMatch = descText.match(/https:\/\/[^\s<>"]+\.sharepoint\.com[^\s<>"]*\b/i);
  if (urlMatch) {
    result.webViewUrl = urlMatch[0];
  }

  return result;
}
