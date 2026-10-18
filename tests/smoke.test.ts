import { describe, it, expect } from 'vitest';

// Test that the check-muf-sync.js script itself is valid and exports correctly
describe('check-muf-sync.js', () => {
  it('file exists and is readable', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../tools/check-muf-sync.js');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('contains the muf twin file list', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../tools/check-muf-sync.js');
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
  // Windows checkouts use CRLF; normalise so multi-line source patterns match everywhere.
  return text.replace(/\r\n/g, '\n');
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

describe('Popup design update contracts (2026-10-17)', () => {
  it('dark mode repairs light-only utility classes inside small/big popups and form sheets', () => {
    const styles = readSource('dairy_farm/client/src/muf-style.css');
    expect(styles).toContain('.dark .muf-pup-card :is(.bg-white');
    expect(styles).toContain('.dark .muf-form-sheet :is(.bg-white');
    expect(styles).toContain(':not([class*="dark:bg-"])');
    expect(styles).toContain(':not([class*="dark:text-"])');
  });

  it('Flock dashboard popups: eggs and weekly feed are small, Sick Birds is a list with a call to action', () => {
    const source = readSource('flock_farm/client/src/components/Dashboard.tsx');
    const eggs = source.indexOf('title="Total Eggs Collected"');
    expect(source.indexOf('size="small"', eggs)).toBeGreaterThan(eggs);
    expect(source.slice(eggs, source.indexOf('</DetailModal>', eggs))).not.toContain('size="big"');
    expect(source).toContain("size={key === 'feedWeek' ? 'small' : 'big'}");
    const sick = source.indexOf('title="Sick Birds"');
    const sickBody = source.slice(sick, source.indexOf('</DetailModal>', sick));
    expect(sickBody).toContain('muf-rowlist');
    expect(sickBody).toContain('muf-popup-cta');
    expect(sickBody).toContain("openBirdDetail(b, 'sickBirds')");
    expect(sickBody).toContain("onNavigate('health')");
  });

  it('Flock register filters use accessible segmented controls with counts and a reset', () => {
    const source = readSource('flock_farm/client/src/components/FlockRegister.tsx');
    expect(source).toContain('muf-filter-bar');
    expect(source).toContain('aria-pressed={genderFilter === g}');
    expect(source).toContain('aria-pressed={statusFilter === st}');
    expect(source).toContain('muf-seg-count');
    expect(source).toContain("setSearchTerm(''); setGenderFilter('All'); setStatusFilter('All');");
  });

  it('Flock vaccination log and incubation add flows open from a plus button into a popup', () => {
    const health = readSource('flock_farm/client/src/components/HealthPortal.tsx');
    expect(health).toContain('id="btn-open-vaccination-log"');
    expect(health).toContain('setShowLogModal(true)');
    expect(health).toContain("title={L('Log Vaccination Record')}");
    expect(health).toContain('setShowLogModal(false);');
    expect(health).not.toContain('className="space-y-3 lg:col-span-1"');
    const incubation = readSource('flock_farm/client/src/components/IncubationModule.tsx');
    expect(incubation).toContain('id="btn-open-incubation-add"');
    expect(incubation).toContain('open={editId !== null || showAddModal}');
    expect(incubation).toContain("L('Add Incubation Record')");
    expect(incubation).not.toContain('<form onSubmit={handleSubmit} className="bg-white');
  });

  it('Dairy Top Producers uses segmented ranges, rank rows and meters; Cow P&L is a list', () => {
    const source = readSource('dairy_farm/client/src/components/Dashboard.tsx');
    const top = source.indexOf('<Popup key="top"');
    const topBody = source.slice(top, source.indexOf('</Popup>', top));
    expect(topBody).toContain('muf-seg');
    expect(topBody).toContain('muf-rank');
    expect(topBody).toContain('muf-meter');
    expect(topBody).toContain('setSelectedCowId(p.cow!._id)');
    const pnl = source.indexOf('<Popup key="cowpnl"');
    const pnlBody = source.slice(pnl, source.indexOf('</Popup>', pnl));
    expect(pnlBody).toContain('muf-rowlist');
    expect(pnlBody).not.toContain('lg:grid-cols-3');
    expect(source).toContain('setSelectedCowId(c._id)');
  });

  it('Agri dashboard and formula popups are small; liability and inventory popups are lists, not wide tables', () => {
    const source = readSource('agri_farm/frontend/src/App.tsx');
    const care = source.indexOf("title={L('Care & Operations Roster')}\n                subtitle");
    expect(source.slice(care, care + 500)).toContain('size="small"');
    const recent = source.indexOf("title={L('Recent Activities')}\n                subtitle");
    expect(source.slice(recent, recent + 500)).toContain('size="small"');
    expect(source).toContain("size={ledgerModalData.cardType === 'profit' || ledgerModalData.cardType === 'margin' ? 'small' : 'big'}");
    const liab = source.indexOf('title="Loan & Credit Liability Tracker"');
    const liabBody = source.slice(liab, source.indexOf('</DetailModal>', liab));
    expect(liabBody).toContain('muf-rowlist');
    expect(liabBody).not.toContain('muf-reflow');
    expect(liabBody).toContain('handlePayLiability(l._id)');
    expect(liabBody).toContain('handleDeleteLiability(l._id)');
    const inv = source.indexOf('title="Input Inventory & Stocks"');
    const invBody = source.slice(inv, source.indexOf('</DetailModal>', inv));
    expect(invBody).toContain('muf-rowlist');
    expect(invBody).not.toContain('muf-reflow');
    expect(invBody).toContain('handleDeleteInventory(item._id)');
  });
});

describe('MUF micro-typography utilities', () => {
  it('defines explicit 2xs and 3xs sizes in all three shared stylesheets', () => {
    const stylesheetPaths = [
      'agri_farm/frontend/src/muf-style.css',
      'dairy_farm/client/src/muf-style.css',
      'flock_farm/client/src/muf-style.css',
    ];

    for (const stylesheetPath of stylesheetPaths) {
      const css = readSource(stylesheetPath);
      expect(css).toMatch(/\.text-2xs\s*\{[^}]*font-size:\s*0\.6875rem;[^}]*line-height:\s*1rem;[^}]*\}/);
      expect(css).toMatch(/\.text-3xs\s*\{[^}]*font-size:\s*0\.625rem;[^}]*line-height:\s*0\.875rem;[^}]*\}/);
    }
  });
});

describe('Dairy popup fields use shared MUF field styles (B1)', () => {
  it('uses shared fields for all 26 visible cow, calf and sale popup controls', () => {
    const source = readSource('dairy_farm/client/src/components/CowsTab.tsx');
    expect(source).not.toContain('className="inp"');
    expect(source).not.toContain('.inp{width:100%');
    expect((source.match(/className="muf-field"/g) || []).length).toBe(26);
  });

  it('uses the shared field class on all five Edit Milk Record controls', () => {
    const source = readSource('dairy_farm/client/src/components/MilkTab.tsx');
    const start = source.indexOf('/* ── Edit milk record');
    const end = source.indexOf('</DetailModal>', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const popup = source.slice(start, end);
    expect((popup.match(/className="muf-field"/g) || []).length).toBe(5);
  });

  it('uses the shared field class for the Health Record notes textarea', () => {
    const source = readSource('dairy_farm/client/src/components/HealthTab.tsx');
    const start = source.indexOf("title={editingId ? L('Edit Health Record') : L('Add Health Record')}");
    const end = source.indexOf('</DetailModal>', start);
    const popup = source.slice(start, end);
    expect(popup).toMatch(/<textarea[\s\S]*?className="muf-field"/);
  });

  it('uses the shared field class for the Breeding quick-action date', () => {
    const source = readSource('dairy_farm/client/src/components/BreedingTab.tsx');
    expect(source).toMatch(/value=\{actionDate\}[\s\S]{0,180}className="muf-field"/);
  });

  it('uses MUF field styling for the compact inline sale-price editor', () => {
    const source = readSource('dairy_farm/client/src/components/CowDetailPopup.tsx');
    const start = source.indexOf('value={priceInput}');
    const end = source.indexOf('/>', start);
    expect(start).toBeGreaterThanOrEqual(0);
    const field = source.slice(start, end);
    expect(field).toContain('className="muf-field muf-field-auto"');
    expect(field).toContain("width: '8rem'");
    expect(field).toContain("fontSize: '0.875rem'");
  });

  it('uses shared field styling for the four Dashboard popup controls', () => {
    const source = readSource('dairy_farm/client/src/components/Dashboard.tsx');
    const markers = [
      'value={customFrom}',
      'value={customTo}',
      'value={feedSettingsDraft.dailyUseKg}',
      'value={feedSettingsDraft.lowStockDays}',
    ];
    for (const marker of markers) {
      const start = source.indexOf(marker);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = source.indexOf('/>', start);
      expect(source.slice(start, end)).toContain('className="muf-field');
    }
  });
});
