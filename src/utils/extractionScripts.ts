/**
 * Extraction scripts for each data source.
 * These are designed to be pasted into the browser console on each source page.
 * They extract relevant data and send it back to the dashboard via postMessage.
 */

// ── Source URLs ──────────────────────────────────────────
export const SOURCE_URLS = {
  salesforce:
    'https://civicplus.lightning.force.com/lightning/r/Report/00OUv000001hcUTMAY/view',
  outlook: 'https://outlook.office.com/calendar/view/week',
  cloudcoach:
    'https://civicplus.lightning.force.com/lightning/n/project_cloud__Gameplan',
};

// ── Salesforce Report Extraction Script ──────────────────
// Grabs the "This Week - Cody" assignments report.
// Looks inside the report iframe for the data-grid table.
export const SALESFORCE_SCRIPT = `(function(){
  try {
    var iframe = document.querySelector('iframe.isView');
    var doc = iframe ? (iframe.contentDocument || iframe.contentWindow.document) : document;
    var table = doc.querySelector('[data-grid-full-table]') || doc.querySelector('table.data-grid-full-table');
    if (!table) {
      // Fallback: try all tables in iframe
      var tables = doc.querySelectorAll('table');
      for (var t = 0; t < tables.length; t++) {
        if (tables[t].querySelectorAll('tr').length > 3) { table = tables[t]; break; }
      }
    }
    if (!table) { alert('Could not find report table. Make sure the report is fully loaded.'); return; }
    var rows = table.querySelectorAll('tr');
    var results = [];
    var currentEndDate = '', currentTaskType = '';
    rows.forEach(function(row) {
      var fixedCells = row.querySelectorAll('td[data-fixed-column="true"]');
      var dataCells = row.querySelectorAll('td[data-fixed-column="false"]');
      if (fixedCells.length >= 1) {
        var ed = (fixedCells[0].textContent || '').trim();
        if (ed && !ed.startsWith('Total')) {
          var m = ed.match(/^([\\d\\/]+)/);
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
        ownerName: dataCells[4] ? dataCells[4].textContent.trim() : ''
      });
    });
    if (results.length === 0) { alert('No data rows found. Scroll down to load all rows first.'); return; }
    window.opener.postMessage({ source: 'wmp-salesforce', data: results, ts: Date.now() }, '*');
    alert('Sent ' + results.length + ' assignments to dashboard!');
  } catch(e) { alert('Error: ' + e.message); }
})();`;

// ── Outlook Calendar Extraction Script ───────────────────
// Grabs calendar events from Outlook Web App's week view.
// Uses aria-label attributes on event buttons (Shadow DOM safe).
export const OUTLOOK_SCRIPT = `(function(){
  try {
    var labels = [];
    document.querySelectorAll('[aria-label]').forEach(function(el) {
      var lbl = el.getAttribute('aria-label') || '';
      // Calendar events contain time patterns and day/date references
      if (lbl.length > 20 && lbl.match(/\\\\d{1,2}:\\\\d{2}/) && lbl.match(/(AM|PM)/i)) {
        if (labels.indexOf(lbl) === -1) labels.push(lbl);
      }
    });
    if (labels.length === 0) { alert('No events found. Make sure you are on the Week calendar view.'); return; }
    window.opener.postMessage({ source: 'wmp-outlook', data: labels, ts: Date.now() }, '*');
    alert('Sent ' + labels.length + ' calendar events to dashboard!');
  } catch(e) { alert('Error: ' + e.message); }
})();`;

// ── Cloud Coach Tickets Extraction Script ────────────────
// Grabs revision tickets from the Gameplan page.
// Tries the main page first, then falls back to iframes.
export const CLOUDCOACH_SCRIPT = `(function(){
  try {
    var results = [];
    // Try to find ticket table rows
    var findTickets = function(doc) {
      // Look for table rows with ticket data
      doc.querySelectorAll('table tbody tr, tr.dataRow, tr[class*="Row"]').forEach(function(row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        var text = row.textContent || '';
        if (text.includes('Revision') || text.includes('revision') || text.includes('Design')) {
          results.push({
            projectName: cells[0] ? cells[0].textContent.trim() : '',
            description: cells[1] ? cells[1].textContent.trim() : 'Design Revisions',
            estimatedHours: parseFloat(cells[2] ? cells[2].textContent.trim() : '1') || 1,
            dueDate: cells[3] ? cells[3].textContent.trim() : ''
          });
        }
      });
    };
    findTickets(document);
    // Try iframes if nothing found on main page
    if (results.length === 0) {
      var iframes = document.querySelectorAll('iframe');
      for (var i = 0; i < iframes.length; i++) {
        try { findTickets(iframes[i].contentDocument); } catch(e) { /* cross-origin */ }
      }
    }
    // Fallback: look for any ticket-like elements
    if (results.length === 0) {
      document.querySelectorAll('[class*="ticket"], [class*="task"], [class*="card"]').forEach(function(el) {
        var t = (el.textContent || '').trim();
        if (t.length > 5 && t.length < 200 && (t.includes('Revision') || t.includes('Design'))) {
          results.push({ projectName: t.slice(0, 80), description: 'Design Revisions', estimatedHours: 1, dueDate: '' });
        }
      });
    }
    window.opener.postMessage({ source: 'wmp-cloudcoach', data: results, ts: Date.now() }, '*');
    alert('Sent ' + results.length + ' tickets to dashboard!' + (results.length === 0 ? ' (Navigate to the Tickets tab first)' : ''));
  } catch(e) { alert('Error: ' + e.message); }
})();`;
