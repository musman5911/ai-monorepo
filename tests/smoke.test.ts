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
    expect(content).toMatch(/default behavior is no push, no pull request/i);
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
    const eggs = source.indexOf("title={L('Total Eggs Collected')}");
    expect(source.indexOf('size="small"', eggs)).toBeGreaterThan(eggs);
    expect(source.slice(eggs, source.indexOf('</DetailModal>', eggs))).not.toContain('size="big"');
    expect(source).toContain("size={key === 'feedWeek' ? 'small' : 'big'}");
    const sick = source.indexOf("title={L('Sick Birds')}");
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
    const liab = source.indexOf("title={L('Loan & Credit Liability Tracker')}");
    const liabBody = source.slice(liab, source.indexOf('</DetailModal>', liab));
    expect(liabBody).toContain('muf-rowlist');
    expect(liabBody).not.toContain('muf-reflow');
    expect(liabBody).toContain('handlePayLiability(l._id)');
    expect(liabBody).toContain('handleDeleteLiability(l._id)');
    const inv = source.indexOf("title={L('Input Inventory & Stocks')}");
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


describe('Playwright visual harness (A1)', () => {
  it('defines visual test and reviewed-baseline update commands', () => {
    const pkg = JSON.parse(readSource('package.json'));
    expect(pkg.devDependencies['@playwright/test']).toBe('1.64.1');
    const lock = JSON.parse(readSource('package-lock.json'));
    expect(lock.packages[''].devDependencies['@playwright/test']).toBe('1.64.1');
    for (const packagePath of [
      'node_modules/@playwright/test',
      'node_modules/playwright',
      'node_modules/playwright-core',
    ]) {
      expect(lock.packages[packagePath].version).toBe('1.64.1');
      expect(lock.packages[packagePath].integrity).toMatch(/^sha512-/);
    }
    expect(lock.packages['node_modules/@playwright/test'].dependencies.playwright).toBe('1.64.1');
    expect(lock.packages['node_modules/playwright'].dependencies['playwright-core']).toBe('1.64.1');
    expect(pkg.scripts['test:visual']).toContain('playwright.config.mjs');
    expect(pkg.scripts['test:visual:update']).toContain('--update-snapshots');
  });

  it('covers the three farm entry shells and MUF workbench across five widths and both themes', () => {
    const config = readSource('playwright.config.mjs');
    const suite = readSource('e2e/muf-visual.pw.mjs');
    for (const width of [360, 390, 768, 1024, 1440]) expect(suite).toContain('width: ' + width);
    expect(suite).toContain("const themes = ['light', 'dark']");
    expect(suite).toContain("document.documentElement?.classList.add('dark')");
    expect(suite).toContain("document.documentElement.classList.toggle('dark', requestedTheme === 'dark')");
    for (const target of ['agri-entry', 'dairy-entry', 'flock-entry', 'muf-workbench']) {
      expect(suite).toContain(target);
    }
    expect(config).toContain("testMatch: '**/*.pw.mjs'");
    expect(config).toContain("visual-baselines/{arg}{ext}");
  });
});


describe('Playwright browser preflight (A1)', () => {
  it('fails once with browser-install recovery steps before running visual cases', () => {
    const config = readSource('playwright.config.mjs');
    const setup = readSource('e2e/global-setup.mjs');
    expect(config).toContain("globalSetup: './e2e/global-setup.mjs'");
    expect(setup).toContain('chromium.launch');
    expect(setup).toContain('PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000');
    expect(setup).toContain('npx playwright install --only-shell chromium');
    expect(setup).toContain('Original browser error:');
  });

  it('supports an explicit installed-Chrome fallback and repeats the theme at screenshot time', () => {
    const config = readSource('playwright.config.mjs');
    const setup = readSource('e2e/global-setup.mjs');
    const suite = readSource('e2e/muf-visual.pw.mjs');
    expect(config).toContain("...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})");
    expect(setup).toContain('set PW_CHANNEL=chrome');
    expect(suite).toContain("document.documentElement.classList.toggle('dark', requestedTheme === 'dark')");
    expect(suite).toContain('document.documentElement.style.colorScheme = requestedTheme');
  });
});


describe('C5 Urdu labels for the October 17 popup batch', () => {
  const dictionaryApps = [
    'dairy_farm/client',
    'flock_farm/client',
    'agri_farm/frontend',
  ];
  const translationGroups = [
    { part: 1, entries: [
      ['{count} bird{plural} need care', '{count} بیمار پرندوں کو دیکھ بھال کی ضرورت ہے'],
      ['{count} eggs over 1 day · {range}', '{range} میں ایک دن کے دوران {count} انڈے جمع ہوئے'],
      ['{count} eggs over {days} days · {range}', '{range} میں {days} دنوں کے دوران {count} انڈے جمع ہوئے'],
      ['{count} recorded liabilities', '{count} واجبات درج ہیں'],
      ['{count} recorded stock items', '{count} اسٹاک آئٹمز درج ہیں'],
      ['{count} total activities', '{count} کل سرگرمیاں'],
      ['{count} pending tasks', '{count} زیر التوا کام'],
    ] },
    { part: 4, entries: [
      ['Add Incubation Record', 'انکیوبیشن کا ریکارڈ شامل کریں'],
      ['Add incubation record', 'انکیوبیشن کا ریکارڈ شامل کریں'],
      ['Clear filters', 'فلٹرز صاف کریں'],
      ['Dashboard Ledger Flow', 'ڈیش بورڈ لیجر کی تفصیل'],
      ['Bottom {count}', 'کم کارکردگی والے: {count}'],
      ['Broken/waste', 'ٹوٹے / ضائع شدہ'],
    ] },
    { part: 5, entries: [
      ['Feed Purchased This Week', 'اس ہفتے خریدا گیا چارہ'],
      ['Financial Ledger Flow', 'مالی لیجر کی تفصیل'],
      ['Go to Health Portal', 'صحت کے پورٹل پر جائیں'],
      ['Home use', 'گھریلو استعمال'],
      ['Lifetime (with purchase)', 'خریداری سمیت مکمل مدت'],
      ['Milk + sale income minus operating expenses (feed/medicine) per cow.', 'فی گائے دودھ اور فروخت کی آمدنی میں سے عملی اخراجات (چارہ/دوا) منہا۔'],
      ['Income Source', 'آمدنی کا ذریعہ'],
      ['Expense Breakdown', 'اخراجات کی تفصیل'],
      ['Log Vaccination Record', 'ویکسینیشن کا ریکارڈ درج کریں'],
      ['Log vaccination record', 'ویکسینیشن کا ریکارڈ درج کریں'],
      ['Margin Formula', 'منافع کی شرح کا فارمولا'],
      ['P&L mode', 'نفع و نقصان کا طریقہ'],
      ['Profit Formula', 'منافع کا فارمولا'],
    ] },
    { part: 6, entries: [
      ['Reports Ledger Flow', 'رپورٹس کے لیجر کی تفصیل'],
      ['Total Eggs Collected', 'کل جمع شدہ انڈے'],
      ['Running (no purchase)', 'جاری حساب (خریداری کے بغیر)'],
      ['Running P&L minus the cow\'s purchase price — full lifecycle picture.', 'گائے کی خریداری کی قیمت منہا کرنے کے بعد نفع نقصان، یعنی پوری مدت کا حساب۔'],
      ['Total weight', 'کل وزن'],
      ['Track fertilizer, seed credit debts, and crop dealer loans (unpaid outlays count as committed crop costs).', 'کھاد، بیج کے ادھار اور فصل کے ڈیلر کے قرض دیکھیں (غیر ادا شدہ خرچے فصل کی لاگت میں شمار ہوں گے)۔'],
      ['Track seeds, fertilizer, and pesticide stock levels (manually adjust or correct counts anytime).', 'بیج، کھاد اور زرعی ادویات کا اسٹاک دیکھیں (گنتی کسی بھی وقت دستی طور پر درست کریں)۔'],
    ] },
  ] as const;

  it('provides the new Urdu labels in all three identical dictionary copies', () => {
    for (const app of dictionaryApps) {
      for (const group of translationGroups) {
        const source = readSource(`${app}/src/muf/data/muf-urdu-terms-${group.part}.ts`);
        for (const [english, urdu] of group.entries) {
          const escapedEnglish = english.replace(/'/g, "\\'");
          expect(source).toContain(`'${escapedEnglish}': '${urdu}'`);
        }
      }
    }
  });

  it('uses L() for the redesigned popup headings, buttons, count subtitles and ledger formula titles', () => {
    const flockDashboard = readSource('flock_farm/client/src/components/Dashboard.tsx');
    const flockHealth = readSource('flock_farm/client/src/components/HealthPortal.tsx');
    const flockRegister = readSource('flock_farm/client/src/components/FlockRegister.tsx');
    const incubation = readSource('flock_farm/client/src/components/IncubationModule.tsx');
    const dairyDashboard = readSource('dairy_farm/client/src/components/Dashboard.tsx');
    const agriApp = readSource('agri_farm/frontend/src/App.tsx');

    expect(flockDashboard).toContain("title={L('Sick Birds')}");
    expect(flockDashboard).toContain("subtitle={L('{count} bird{plural} need care'");
    expect(flockDashboard).toContain("title={L('Total Eggs Collected')}");
    expect(flockDashboard).toContain("L(uniqueDaysCount === 1 ? '{count} eggs over 1 day · {range}'");
    expect(flockDashboard).toContain("title: L('Feed Purchased This Week')");
    expect(flockDashboard).toContain("{L('Go to Health Portal')}");
    expect(flockDashboard).not.toMatch(/>\s*Go to Health Portal\s*→/);
    expect(flockRegister).toContain("L('Clear filters')");
    expect(flockHealth).toContain("title={L('Log Vaccination Record')}");
    expect(flockHealth).toContain("{L('Log Vaccination Record')}");
    expect(flockHealth).toContain("label={L('Sick Birds')}");
    expect(incubation).toContain("L('Add Incubation Record')");
    expect(incubation).toContain("L('Add incubation record')");
    expect(dairyDashboard).toContain("aria-label={L('P&L mode')}");
    expect(dairyDashboard).toContain("L(m === 'running' ? 'Running (no purchase)' : 'Lifetime (with purchase)')");
    expect(dairyDashboard).toContain("L(pnlMode === 'running'");
    expect(dairyDashboard).toContain("L('Bottom {count}'");
    expect(flockDashboard).toContain("label={L('Home use')}");
    expect(flockDashboard).toContain("label={L('Broken/waste')}");
    expect(flockDashboard).toContain("label={L('Total weight')}");

    expect(agriApp).toContain("title={L('Loan & Credit Liability Tracker')}");
    expect(agriApp).toContain("subtitle={L('{count} recorded liabilities'");
    expect(agriApp).toContain("title={L('Input Inventory & Stocks')}");
    expect(agriApp).toContain("subtitle={L('{count} recorded stock items'");
    expect(agriApp).toContain("subtitle={L('{count} total activities'");
    expect(agriApp).toContain("subtitle={L('{count} pending tasks'");
    expect(agriApp).toContain("L('Dashboard Ledger Flow')");
    expect(agriApp).toContain("L('Reports Ledger Flow')");
    expect(agriApp).toContain("L('Financial Ledger Flow')");
    expect(agriApp).toContain("L('Income Source')");
    expect(agriApp).toContain("L('Expense Breakdown')");
    expect(agriApp).toContain("L('Profit Formula')");
    expect(agriApp).toContain("L('Margin Formula')");
  });
});
