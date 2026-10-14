#!/usr/bin/env node
/**
 * MUF popup + frontend style inventory.
 * Read-only against app source. Writes local reports under .audit-output by default.
 *
 * Run from repo root: node audit-muf-design-system.mjs
 * Optional output folder: node audit-muf-design-system.mjs --out-dir .
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const argIndex = process.argv.indexOf('--out-dir');
const OUTPUT_DIR = path.resolve(REPO_ROOT, argIndex >= 0 ? (process.argv[argIndex + 1] || '.audit-output') : '.audit-output');
const PROJECTS = [
  { name: 'Agri', src: 'agri_farm/frontend/src' },
  { name: 'Dairy', src: 'dairy_farm/client/src' },
  { name: 'Flock', src: 'flock_farm/client/src' },
];
const POPUP_SUFFIX = /(Modal|Popup|Dialog|Overlay|Sheet|Drawer|Lightbox)$/i;
const EXPLICIT_POPUPS = new Set(['DetailModal', 'QrWaybillModal', 'CowDetailPopup', 'BirdDetailPopup']);
const STYLE_PROPERTIES = [
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'gap', 'rowGap', 'columnGap', 'fontSize', 'lineHeight', 'fontWeight',
  'color', 'background', 'backgroundColor', 'borderColor', 'borderRadius',
  'width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight',
];

function loadTypeScript() {
  const require = createRequire(import.meta.url);
  for (const root of PROJECTS) {
    const candidate = path.join(REPO_ROOT, root.src.replace(/\/src$/, ''), 'node_modules', 'typescript');
    if (fs.existsSync(candidate)) {
      try { return require(candidate); } catch { /* try another frontend install */ }
    }
  }
  throw new Error('TypeScript was not found in frontend node_modules. Run build-all.bat once to install frontend dependencies, then rerun the audit.');
}
function walk(directory, extensions, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) walk(absolute, extensions, output);
    } else if (extensions.has(path.extname(entry.name).toLowerCase())) output.push(absolute);
  }
  return output;
}
function rel(file) { return path.relative(REPO_ROOT, file).split(path.sep).join('/'); }
function lineAt(source, position) {
  let line = 1;
  for (let i = 0; i < position && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}
function attr(ts, node, name) {
  return node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText() === name);
}
function attrText(ts, attribute, sourceFile) {
  if (!attribute || !attribute.initializer) return '';
  const init = attribute.initializer;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
  return init.getText(sourceFile);
}
function cleanExpression(value) {
  return String(value || '').replace(/^\{\s*/, '').replace(/\s*\}$/, '').replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
}
function collectFile(ts, sourceFile, project, absolutePath, source, popupRecords, parserIssues) {
  const pathValue = rel(absolutePath);
  const sharedInfra = /(^|\/)muf-[^/]+\.(tsx|jsx)$/i.test(pathValue);
  if (sourceFile.parseDiagnostics && sourceFile.parseDiagnostics.length) {
    for (const diagnostic of sourceFile.parseDiagnostics) {
      parserIssues.push({
        path: pathValue,
        line: diagnostic.start == null ? 1 : lineAt(source, diagnostic.start),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
      });
    }
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const role = cleanExpression(attrText(ts, attr(ts, node, 'role'), sourceFile));
      const className = attrText(ts, attr(ts, node, 'className'), sourceFile);
      const overlayClass = /(?:fixed\s+inset-0|inset-0\s+fixed|fixed\s+top-0\s+right-0\s+bottom-0\s+left-0)/.test(className);
      const hasDialogRole = role === 'dialog';
      const nativeDialog = tag.toLowerCase() === 'dialog';
      const directMufModal = tag === 'DetailModal';
      const customPopupComponent = POPUP_SUFFIX.test(tag) || EXPLICIT_POPUPS.has(tag);
      const size = cleanExpression(attrText(ts, attr(ts, node, 'size'), sourceFile)) || 'unspecified';
      const title = cleanExpression(attrText(ts, attr(ts, node, 'title'), sourceFile));
      const styleAttribute = attr(ts, node, 'style');
      let inlinePropertyNames = [];
      if (styleAttribute && styleAttribute.initializer && ts.isJsxExpression(styleAttribute.initializer) &&
          styleAttribute.initializer.expression && ts.isObjectLiteralExpression(styleAttribute.initializer.expression)) {
        inlinePropertyNames = styleAttribute.initializer.expression.properties
          .filter(ts.isPropertyAssignment)
          .map((property) => property.name && property.name.getText(sourceFile).replace(/^['"]|['"]$/g, ''))
          .filter((name) => STYLE_PROPERTIES.includes(name));
      }
      if (directMufModal || customPopupComponent || hasDialogRole || nativeDialog || overlayClass ||
          tag === 'MufAdminShell' || tag === 'AdminMenu') {
        popupRecords.push({
          project: project.name,
          path: pathValue,
          line: lineAt(source, node.getStart(sourceFile)),
          tag,
          title: title.slice(0, 130),
          size: directMufModal ? size : '',
          directMufModal,
          customPopupComponent,
          hasDialogRole,
          nativeDialog,
          overlayClass,
          sharedInfra,
          inlineStyleObject: Boolean(styleAttribute && styleAttribute.initializer &&
            ts.isJsxExpression(styleAttribute.initializer) && styleAttribute.initializer.expression &&
            ts.isObjectLiteralExpression(styleAttribute.initializer.expression)),
          inlineStylePropertyNames: inlinePropertyNames,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}
function count(text, regex) { return [...text.matchAll(regex)].length; }
function auditComponentStyles(files, ts) {
  const result = {
    jsxFiles: files.length, inlineStyleObjects: 0, inlineStyleVisualPropertyOccurrences: 0,
    hexLiteralOccurrences: 0, rgbHslLiteralOccurrences: 0, arbitraryColorClasses: 0,
    arbitrarySpacingClasses: 0, arbitraryFontClasses: 0, inlineStylePropertyOccurrences: {},
    filesWithInlineStyles: [],
  };
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const kind = path.extname(file).toLowerCase() === '.jsx' ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    let inlineCount = 0;
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const styleAttribute = attr(ts, node, 'style');
        if (styleAttribute && styleAttribute.initializer && ts.isJsxExpression(styleAttribute.initializer) &&
            styleAttribute.initializer.expression && ts.isObjectLiteralExpression(styleAttribute.initializer.expression)) {
          inlineCount++;
          for (const property of styleAttribute.initializer.expression.properties) {
            if (!ts.isPropertyAssignment(property) || !property.name) continue;
            const name = property.name.getText(parsed).replace(/^['"]|['"]$/g, '');
            if (STYLE_PROPERTIES.includes(name)) {
              result.inlineStylePropertyOccurrences[name] = (result.inlineStylePropertyOccurrences[name] || 0) + 1;
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    result.inlineStyleObjects += inlineCount;
    result.hexLiteralOccurrences += count(source, /#[0-9a-fA-F]{3,8}\\b/g);
    result.rgbHslLiteralOccurrences += count(source, /\\b(?:rgb|rgba|hsl|hsla)\\(/g);
    result.arbitraryColorClasses += count(source, /\\b(?:bg|text|border|ring|from|to|via)-\\[(?:#|rgb|rgba|hsl|hsla|[a-zA-Z])/g);
    result.arbitrarySpacingClasses += count(source, /\\b(?:p[trblxy]?|m[trblxy]?|gap|space-[xy])-\\[[^\\]]+\\]/g);
    result.arbitraryFontClasses += count(source, /\\b(?:text|leading|tracking)-\\[(?:\\d|\\.)[^\\]]+\\]/g);
    if (inlineCount) result.filesWithInlineStyles.push({ path: rel(file), count: inlineCount });
  }
  result.inlineStyleVisualPropertyOccurrences = Object.values(result.inlineStylePropertyOccurrences).reduce((sum, value) => sum + value, 0);
  result.filesWithInlineStyles.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  return result;
}
function auditCss(files) {
  const result = {
    cssFiles: files.length, hexColorOccurrences: 0, rgbHslColorOccurrences: 0,
    importantDeclarations: 0, dimensionDeclarationOccurrences: 0,
    mufVariableOccurrences: 0, uniqueMufVariables: [],
    selectorBlockOccurrences: 0, repeatedSelectors: [], filesByLiteralColors: [],
  };
  const variables = new Set();
  const selectors = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const hex = count(source, /#[0-9a-fA-F]{3,8}\b/g);
    const rgb = count(source, /\b(?:rgb|rgba|hsl|hsla)\(/g);
    result.hexColorOccurrences += hex;
    result.rgbHslColorOccurrences += rgb;
    result.importantDeclarations += count(source, /!important\b/g);
    result.dimensionDeclarationOccurrences += count(source, /(?:margin|padding|font-size|line-height|gap|width|height|min-width|max-width|min-height|max-height)\s*:[^;}]*\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|dvh|%)/gi);
    for (const match of source.matchAll(/(--muf-[\w-]+)\s*:/g)) {
      variables.add(match[1]);
      result.mufVariableOccurrences++;
    }
    for (const match of source.matchAll(/(^|\})\s*([^@{}][^{}]+)\{/gm)) {
      const selector = match[2].trim().replace(/\s+/g, ' ');
      if (!selector || selector.startsWith('/*') || selector.startsWith('*')) continue;
      result.selectorBlockOccurrences++;
      const item = selectors.get(selector) || { selector, count: 0, files: new Set() };
      item.count++;
      item.files.add(rel(file));
      selectors.set(selector, item);
    }
    if (hex || rgb) result.filesByLiteralColors.push({ path: rel(file), hex, rgbHsl: rgb });
  }
  result.uniqueMufVariables = [...variables].sort();
  result.repeatedSelectors = [...selectors.values()].filter((item) => item.count > 1)
    .map((item) => ({ selector: item.selector, count: item.count, files: [...item.files] }))
    .sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector)).slice(0, 50);
  result.filesByLiteralColors.sort((a, b) => (b.hex + b.rgbHsl) - (a.hex + a.rgbHsl));
  return result;
}
function table(headers, rows) {
  const escape = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
  return ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...rows.map((row) => '| ' + row.map(escape).join(' | ') + ' |')].join('\n');
}
function main() {
  const ts = loadTypeScript();
  const records = [];
  const parserIssues = [];
  const summary = {};
  const componentStyles = {};
  const cssStyles = {};
  for (const project of PROJECTS) {
    const sourceRoot = path.join(REPO_ROOT, project.src);
    const jsxFiles = walk(sourceRoot, new Set(['.tsx', '.jsx']));
    const cssFiles = walk(sourceRoot, new Set(['.css']));
    for (const file of jsxFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const kind = path.extname(file).toLowerCase() === '.jsx' ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
      collectFile(ts, ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind),
        project, file, source, records, parserIssues);
    }
    const rows = records.filter((item) => item.project === project.name);
    const detail = rows.filter((item) => item.directMufModal);
    const customDialogs = rows.filter((item) => item.hasDialogRole && !item.sharedInfra);
    const customOverlays = rows.filter((item) => item.overlayClass && !item.sharedInfra);
    const otherPopupComponents = rows.filter((item) => item.customPopupComponent && !item.directMufModal && !item.sharedInfra);
    const sizes = {
      small: detail.filter((item) => item.size === 'small').length,
      big: detail.filter((item) => item.size === 'big').length,
      unspecified: detail.filter((item) => !['small', 'big'].includes(item.size)).length,
    };
    summary[project.name] = {
      jsxFiles: jsxFiles.length,
      detailModalCallSites: detail.length,
      detailModalSizes: sizes,
      detailModalFiles: new Set(detail.map((item) => item.path)).size,
      otherPopupComponentCallSites: otherPopupComponents.length,
      customDialogElements: customDialogs.length,
      customFixedOverlayElements: customOverlays.length,
      nativeDialogElements: rows.filter((item) => item.nativeDialog && !item.sharedInfra).length,
      portalCalls: jsxFiles.reduce((sum, file) => sum + count(fs.readFileSync(file, 'utf8'), /createPortal\s*\(/g), 0),
      inlineStyleObjects: jsxFiles.reduce((sum, file) => sum + count(fs.readFileSync(file, 'utf8'), /style\s*=\s*\{\s*\{/g), 0),
    };
    componentStyles[project.name] = auditComponentStyles(jsxFiles, ts);
    cssStyles[project.name] = auditCss(cssFiles);
  }

  const detailRows = records.filter((item) => item.directMufModal).map((item) => [
    item.project, item.path, item.line, item.size, item.title || '(dynamic title)', '<DetailModal>',
  ]);
  const otherRows = records.filter((item) =>
    (item.customPopupComponent && !item.directMufModal && !item.sharedInfra) ||
    ((item.hasDialogRole || item.nativeDialog || item.overlayClass) && !item.sharedInfra)
  ).map((item) => [
    item.project, item.path, item.line, item.tag,
    [item.hasDialogRole ? 'role=dialog' : '', item.nativeDialog ? 'native dialog' : '',
      item.overlayClass ? 'fixed/inset overlay' : ''].filter(Boolean).join('; ') || 'popup-like component',
  ]);
  const inventory = [
    '# MUF popup inventory', '',
    'Generated by node audit-muf-design-system.mjs. This is a source-level inventory, not a browser-runtime count. Custom overlay candidates must be manually reviewed because some overlays may be menus, image viewers, or other specialized UI.',
    '', '## Summary by project', '',
    table(['Project', 'TSX/JSX files', 'DetailModal call sites', 'Small', 'Big', 'Unspecified', 'Other popup component calls', 'Custom role=dialog nodes', 'Custom fixed/inset overlays', 'Native dialog nodes', 'createPortal calls', 'Inline style objects'],
      Object.entries(summary).map(([name, item]) => [name, item.jsxFiles, item.detailModalCallSites,
        item.detailModalSizes.small, item.detailModalSizes.big, item.detailModalSizes.unspecified,
        item.otherPopupComponentCallSites, item.customDialogElements, item.customFixedOverlayElements,
        item.nativeDialogElements, item.portalCalls, item.inlineStyleObjects])),
    '', '## Every DetailModal call site', '',
    table(['Project', 'File', 'Line', 'Size', 'Title', 'Component'], detailRows),
    '', '## Other popup-like components and custom overlay candidates', '',
    table(['Project', 'File', 'Line', 'Element/component', 'Detected signal'], otherRows),
    '', '## Interpretation notes', '',
    '- DetailModal call sites are component uses, not unique visual designs or simultaneous open popups.',
    '- Shared MUF shell implementation is included in the record data but excluded from custom-overlay candidate totals.',
    '- Overlay candidates require a human review before migration to ensure dropdowns, camera/gallery viewers, and specialized flows keep their behavior.',
    '- Inline style-object counts only cover JSX style={{ ... }} expressions in scanned TSX/JSX source.',
    '', '## TypeScript JSX parser diagnostics', '',
    parserIssues.length ? table(['File', 'Line', 'Parser message'], parserIssues.map((item) => [item.path, item.line, item.message])) : 'No TypeScript JSX parse diagnostics found.',
    '',
  ].join('\n');

  const styleAudit = [
    '# MUF frontend style audit', '',
    'Generated by node audit-muf-design-system.mjs. Counts are source patterns to review, not automatic proof of defects. Dynamic styles and semantic/status colors can be legitimate.',
    '', '## Component source styling', '',
    table(['Project', 'TSX/JSX files', 'Inline style objects', 'Hex literals', 'RGB/HSL literals', 'Arbitrary color classes', 'Arbitrary spacing classes', 'Arbitrary typography classes'],
      Object.entries(componentStyles).map(([name, item]) => [name, item.jsxFiles, item.inlineStyleObjects,
        item.hexLiteralOccurrences, item.rgbHslLiteralOccurrences, item.arbitraryColorClasses,
        item.arbitrarySpacingClasses, item.arbitraryFontClasses])),
    '', '## CSS styling', '',
    table(['Project', 'CSS files', 'Hex color occurrences', 'RGB/HSL occurrences', '!important occurrences', 'Dimension declarations with fixed units', 'MUF variable names'],
      Object.entries(cssStyles).map(([name, item]) => [name, item.cssFiles, item.hexColorOccurrences,
        item.rgbHslColorOccurrences, item.importantDeclarations, item.dimensionDeclarationOccurrences,
        item.uniqueMufVariables.length])),
    '', '## Repeated CSS selector patterns', '',
    Object.entries(cssStyles).map(([name, item]) => [
      '### ' + name, '',
      item.repeatedSelectors.length ? table(['Selector', 'Block count', 'Files'], item.repeatedSelectors.map((s) => [s.selector, s.count, s.files.join(', ')])) : 'No repeated selector blocks detected.',
      '',
    ].join('\n')).join('\n'),
    '## Files with the most JSX inline style objects', '',
    table(['Project', 'File', 'Inline style objects'], Object.entries(componentStyles).flatMap(([name, item]) =>
      item.filesWithInlineStyles.slice(0, 20).map((file) => [name, file.path, file.count]))),
    '', '## Files with the most literal CSS colors', '',
    table(['Project', 'File', 'Hex', 'RGB/HSL'], Object.entries(cssStyles).flatMap(([name, item]) =>
      item.filesByLiteralColors.slice(0, 20).map((file) => [name, file.path, file.hex, file.rgbHsl]))),
    '',
  ].join('\n');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'MUF_POPUP_INVENTORY.md'), inventory, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'MUF_STYLE_AUDIT.md'), styleAudit, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'MUF_UI_AUDIT.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), projects: summary, componentStyles, cssStyles,
    popupRecords: records, parserDiagnostics: parserIssues,
  }, null, 2), 'utf8');

  console.log('MUF design-system audit finished.');
  console.log(Object.entries(summary).map(([name, item]) => name + ': ' +
    item.detailModalCallSites + ' DetailModal calls (' + item.detailModalSizes.small + ' small, ' +
    item.detailModalSizes.big + ' big, ' + item.detailModalSizes.unspecified + ' unspecified), ' +
    item.customDialogElements + ' custom dialog nodes, ' + item.customFixedOverlayElements +
    ' custom overlay candidates').join('\n'));
  console.log('Reports written to: ' + OUTPUT_DIR);
  if (parserIssues.length) {
    console.warn('Warning: ' + parserIssues.length + ' JSX parser diagnostic(s). Review the report before relying on counts.');
    process.exitCode = 1;
  }
}
main();
