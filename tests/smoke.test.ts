import { describe, it, expect } from 'vitest';

// Test that the check-muf-sync.js script itself is valid and exports correctly
describe('check-muf-sync.js', () => {
  it('file exists and is readable', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../check-muf-sync.js');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('contains the muf twin file list', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../check-muf-sync.js');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('muf-urdu');
    expect(content).toContain('muf-modal');
    expect(content).toContain('muf-style.css');
    expect(content).toContain('muf-charts');
  });
});

// Test that the RULES.md file exists and contains key rules
describe('RULES.md', () => {
  it('file exists and is readable', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../RULES.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('contains the primary color rule', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.resolve(__dirname, '../RULES.md'), 'utf8');
    expect(content).toContain('#16a34a');
  });

  it('contains the no-PR rule', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.resolve(__dirname, '../RULES.md'), 'utf8');
    expect(content).toMatch(/do not open pull requests/i);
  });
});

// Test that all 3 app directories exist
describe('Monorepo structure', () => {
  it('all 3 app directories exist', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'dairy_farm'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'flock_farm'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'agri_farm'))).toBe(true);
  });

  it('all 3 apps have backend server.js', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'dairy_farm/backend/server.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'flock_farm/backend/server.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'agri_farm/backend/server.js'))).toBe(true);
  });
});


// Regression guards for the latest summary-first parent/child popup work.
// These verify key source contracts; they are not a substitute for build/browser tests.
function readSource(relativePath: string): string {
  const fs = require('fs');
  const path = require('path');
  const full = path.resolve(__dirname, '..', relativePath);
  let text = fs.readFileSync(full, 'utf8') as string;
  // muf-style.css is an entry that @imports ./muf/styles/*.css; read entry + parts as one stylesheet.
  if (/muf-style\.css$/.test(relativePath)) {
    for (const m of text.matchAll(/@import\s+'(\.\/[^']+\.css)';/g)) {
      text += '\n' + fs.readFileSync(path.resolve(path.dirname(full), m[1]), 'utf8');
    }
  }
  return text;
}

describe('Summary-first detail popup contracts', () => {
  it('Dairy expense summaries defer notes, supplier and receipt to the detail popup', () => {
    const source = readSource('dairy_farm/client/src/components/ExpensesTab.tsx');
    expect(source).toContain('title={L(\'View expense details\')}');
    expect(source).toContain('open={!!selectedExpense}');
    expect(source).toContain('selectedExpense.note?.trim()');
    expect(source).toContain('selectedExpense.receiptBase64');
    expect(source).toContain('const supplier = selectedExpense.supplierId');
    expect(source).toContain('isAdmin &&');
    expect(source).toContain('canDelete &&');
  });

  it('Dairy health parent rows remain compact while the detail popup retains clinical fields', () => {
    const source = readSource('dairy_farm/client/src/components/HealthTab.tsx');
    expect(source).toContain('title={L(\'View health record details\')}');
    expect(source).toContain('{selectedRecord.description}');
    expect(source).toContain('{selectedRecord.medicine}');
    expect(source).toContain('{selectedRecord.vet}');
    expect(source).toContain('event.stopPropagation(); handleEdit(record)');
    expect(source).toContain('event.target !== event.currentTarget');
  });

  it('Dairy milk history opens a read-only detail popup without removing edit flow', () => {
    const source = readSource('dairy_farm/client/src/components/MilkTab.tsx');
    expect(source).toContain('open={!!selectedHistoryRecord}');
    expect(source).toContain('saleableMilkLiters(selectedHistoryRecord)');
    expect(source).toContain('selectedHistoryRecord.fatPercent');
    expect(source).toContain('selectedHistoryRecord.snfPercent');
    expect(source).toContain('title={L(\'Edit Milk Record\')}');
  });

  it('Agri preserves monthly/category parents while opening crop and ledger children', () => {
    const source = readSource('agri_farm/frontend/src/App.tsx');
    expect(source).toContain('current.selectedMonthRow = selectedMonthRow');
    expect(source).toContain('current.selectedExpenseCategory = selectedExpenseCategory');
    expect(source).toContain('prev.selectedMonthRow');
    expect(source).toContain('prev.selectedExpenseCategory');
    expect(source).toContain('openPopup(\'selectedCrop\', c)');
    expect(source).toContain('openPopup(\'selectedFinance\', f)');
  });

  it('Dairy dashboard ranking cards open the shared cow detail popup', () => {
    const source = readSource('dairy_farm/client/src/components/Dashboard.tsx');
    expect(source).toContain('setSelectedCowId(p.cow!._id)');
    expect(source).toContain('setSelectedCowId(c._id)');
    expect(source).toContain('<CowDetailPopup key="cow-detail"');
    expect(source).toContain("aria-label={`${L('Open cow details')}: ${p.cow!.name}`}");
  });

  it('Dairy cow table rows can open details by keyboard and ignore nested action keys', () => {
    const source = readSource('dairy_farm/client/src/components/CowsTab.tsx');
    expect(source).toContain('aria-label={`${L(\'Open cow details\')}: ${cow.name}`}');
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
    expect(source).toContain('event.target !== event.currentTarget');
    expect(source).toContain('e.stopPropagation(); handleEdit(cow)');
  });


  it('Flock Active Birds rows open the shared detail popup by mouse and keyboard', () => {
    const source = readSource('flock_farm/client/src/components/Dashboard.tsx');
    expect(source).toContain("onClick={() => openBirdDetail(b, 'activeBirds')}");
    expect(source).toContain("onKeyDown={(event) => {");
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
    expect(source).toContain("aria-label={L('Open bird details') + ': ' + b.name}");
    expect(source).toContain("return <DetailModal open={modal === 'birdDetail'}");
  });

  it('Flock admin shell uses a bounded mobile viewport and internal scrolling', () => {
    const shell = readSource('flock_farm/client/src/muf/admin/muf-admin-shell.tsx');
    const styles = readSource('flock_farm/client/src/muf-style.css');
    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('overflow-y-auto muf-scroll muf-admin-body');
    expect(styles).toContain('.muf-admin-shell-card[role="dialog"]');
    expect(styles).toContain('max-height: min(var(--muf-popup-mobile-max-height, 70dvh), calc(100dvh - 24px))');
  });

  it('Dairy labor attendance rows show a compact summary and a full detail popup', () => {
    const source = readSource('dairy_farm/client/src/components/LaborTab.tsx');
    expect(source).toContain("setSelectedAttendance(row)");
    expect(source).toContain("title={L('Attendance details')}");
    expect(source).toContain('selectedAttendance.notes?.trim()');
    expect(source).toContain("L('View notes')");
    expect(source).toContain('type="button"');
    expect(source).toContain("aria-label={L('View attendance details') + ': ' + row.date + ' · ' + (worker?.name || L('Worker'))}");
    expect(source).toContain("handleDeleteAttendance(row._id)");
    expect(source).toContain("!row.posted");
  });

  it('Agri labor summaries are accessible, compact, and preserve admin-only actions', () => {
    const source = readSource('agri_farm/frontend/src/components/LaborBoard.tsx');
    expect(source).toContain("aria-label={L('Open worker details') + ': ' + worker.name}");
    expect(source).toContain('setDetailFor(worker)');
    expect(source).toContain("L('View notes')");
    expect(source).toContain('setSelectedAttendance(row)');
    expect(source).toContain("title={L('Attendance details')}");
    expect(source).toContain('selectedAttendance.field');
    expect(source).toContain('selectedAttendance.notes?.trim()');
    const detailStart = source.indexOf("title={L('Attendance details')}");
    const notesStart = source.indexOf('selectedAttendance.notes?.trim()', detailStart);
    expect(source.lastIndexOf('{isAdmin && (', notesStart)).toBeGreaterThan(detailStart);
    expect(source).toContain("isAdmin && !row.posted");
    expect(source).toContain('type="button"');
    expect(source).toContain("aria-label={L('View attendance details') + ': ' + row.date + ' · ' + (worker?.name || L('Worker'))}");
    expect(source).toContain("handleDeleteAttendance(row._id)");
  });

});
