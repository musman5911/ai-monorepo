import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const shops = [
  { farm: 'dairy', base: 'dairy_farm/client/src', main: 'dairy_farm/client/src/main.tsx' },
  { farm: 'flock', base: 'flock_farm/client/src', main: 'flock_farm/client/src/main.tsx' },
  { farm: 'agri', base: 'agri_farm/frontend/src', main: 'agri_farm/frontend/src/main.tsx' },
];

describe('MU Farms public shop isolation', () => {
  const component = read('dairy_farm/client/src/muf-shop/MufShop.tsx');
  const css = read('dairy_farm/client/src/muf-shop/muf-shop.css');

  it('keeps the dedicated shop component, stylesheet and README identical across all apps', () => {
    const readme = read('dairy_farm/client/src/muf-shop/README.md');
    for (const shop of shops) {
      expect(read(shop.base + '/muf-shop/MufShop.tsx')).toBe(component);
      expect(read(shop.base + '/muf-shop/muf-shop.css')).toBe(css);
      expect(read(shop.base + '/muf-shop/README.md')).toBe(readme);
    }
  });

  it('mounts a separate lazy-loaded /shop route without statically importing the farm app', () => {
    for (const shop of shops) {
      const main = read(shop.main);
      expect(main).toContain("const App = lazy(() => import('./App'))");
      expect(main).toContain("const MufShop = lazy(() => import('./muf-shop/MufShop'))");
      expect(main).toContain('const isMufShopRoute');
      expect(main).toContain('/shop');
      expect(main).toContain('<MufShop currentFarm="' + shop.farm + '" />');
      expect(main).not.toMatch(/import\s+App\s+from/);
      expect(main).toContain("if ('serviceWorker' in navigator && !isMufShopRoute)");
    }
  });

  it('reads public product endpoints without sending credentials', () => {
    expect(component).toContain('/products/public');
    expect(component).toContain("credentials: 'omit'");
    expect(component).toContain("cache: 'no-store'");
    expect(component).not.toMatch(/\/api\/(?:admin|auth|buyers|users)\b/i);
    expect(component).not.toMatch(/\b(?:getToken|Authorization|localStorage)\b/);
  });

  it('maps only public fields and ignores private product properties', () => {
    for (const field of ['id', 'farmName', 'name', 'kind', 'unit', 'price', 'quantity', 'photoUrl']) expect(component).toContain(field);
    for (const expression of ['row.farmId', 'row.cost', 'row.buyer', 'row.password', 'row.published']) expect(component).not.toContain(expression);
  });

  it('has Crops, Dairy and Poultry sections with their allowed product kinds', () => {
    expect(component).toContain("title:'Crops'");
    expect(component).toContain("title:'Dairy'");
    expect(component).toContain("title:'Poultry'");
    expect(component).toContain("kinds:['produce']");
    expect(component).toContain("kinds:['milk','animal']");
    expect(component).toContain("kinds:['egg','bird']");
  });

  it('prepares WhatsApp order messages and uses safe external links', () => {
    expect(component).toContain('encodeURIComponent(message)');
    expect(component).toContain('https://wa.me/');
    expect(component).toContain('target="_blank"');
    expect(component).toContain('rel="noopener noreferrer"');
    expect(component).toContain('Listed price: Rs ');
    expect(component).toContain("'Farm: '+product.farmName");
  });

  it('keeps styles scoped and supports reduced-motion preferences', () => {
    expect(css).toContain('.muf-shop{');
    expect(css).toContain('@media(max-width:650px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).not.toMatch(/(^|\})\s*(?:body|:root|button|input)\s*\{/m);
  });
});
