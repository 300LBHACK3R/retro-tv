import { test, expect, type Page } from '@playwright/test';
import { programming } from './programming-fixture';
import { existsSync } from 'node:fs';

async function openDirectory(page: Page) {
  await page.getByRole('button', { name: 'Browse all', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Channel directory' })).toBeVisible();
}
async function openMore(page: Page) {
  const desktop = page.getByRole('button', { name: 'Open viewer settings and more options', exact: true });
  if (await desktop.isVisible()) await desktop.click();
  else await page.getByRole('navigation', { name: 'Mobile viewer navigation' }).getByRole('button', {name:'More',exact:true}).click();
  await expect(page.getByRole('dialog', { name: "More from Tate's TV" })).toBeVisible();
}
async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Isolate viewer behavior from live Supabase, tracking, and physical Cast devices.
  await page.route('**/api/programming', route => route.fulfill({ json: {ok:true, programming, source:'database'} }));
  await page.route('https://www.gstatic.com/**', route => route.fulfill({contentType:'application/javascript',body:''}));
  await page.route('**/_vercel/**', route => route.fulfill({status:204}));
  await page.route('**/qa-media.webm', route => existsSync('.qa/test.webm')
    ? route.fulfill({path:'.qa/test.webm',contentType:'video/webm'})
    : route.fulfill({status:404}));
});

test('load programming, search channels, tune, and retain an uncluttered player', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?ch=24');
  await expect(page.getByRole('heading', {name:'Studio TV',exact:true})).toBeVisible();
  await expect(page.getByRole('region', {name:'On-screen remote'})).toHaveCount(0);
  await openDirectory(page);
  await page.getByRole('searchbox', {name:'Find a channel'}).fill('25');
  await page.getByRole('button', {name:'Tune to CH 25 Local Cinema',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Local Cinema',exact:true})).toBeVisible();
  await expect(page.getByRole('region', {name:'Now and next programming'})).toContainText('A Calgary Evening');
  await noPageOverflow(page);
  expect(errors).toEqual([]);
  await testInfo.attach('live-viewer', {body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});

test('guide stays readable and keyboard input stays inside the dialog', async ({ page }) => {
  await page.goto('/?ch=24');
  await expect(page.getByRole('heading', {name:'Studio TV',exact:true})).toBeVisible();
  const desktop = page.getByRole('button', {name:'Open live guide',exact:true});
  if (await desktop.isVisible()) await desktop.click();
  else await page.getByRole('navigation', {name:'Mobile viewer navigation'}).getByRole('button', {name:'Guide',exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Live Guide',exact:true});
  await expect(dialog).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) <= 1024) await expect(page.getByRole('region', {name:'Mobile live TV guide'})).toBeVisible();
  await page.getByRole('button', {name:'Close live guide',exact:true}).press('ArrowDown');
  await expect(page.getByRole('heading', {name:'Studio TV',exact:true})).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-ttv-overlay-open','true');
  await noPageOverflow(page);
});

test('theme changes preserve layout and survive reloading cloud programming', async ({ page }) => {
  await page.goto('/?ch=24');
  await expect(page.getByRole('heading', {name:'Studio TV',exact:true})).toBeVisible();
  await openMore(page);
  await page.getByRole('button', {name:'Theme library Open',exact:true}).click();
  await expect(page.getByRole('dialog', {name:/Theme Library/i})).toBeVisible();
  await page.getByRole('button', {name:'Apply theme: Obsidian Gold',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-ttv-theme','obsidian-gold');
  await expect(page.getByRole('region',{name:"Live Tate's TV player"})).toBeVisible();
  await noPageOverflow(page);
  await page.reload();
  await expect(page.getByRole('heading', {name:'Studio TV',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-ttv-theme','obsidian-gold');
});

test('Library filters and selects an on-demand title', async ({ page }, testInfo) => {
  await page.goto('/library');
  await expect(page.getByRole('heading',{name:'Your time. Your TV.'})).toBeVisible();
  const search = page.getByRole('textbox',{name:"Search the Tate's TV library"});
  await search.fill('A Calgary Evening');
  await expect(page.getByRole('heading',{name:'A Calgary Evening',exact:true})).toBeVisible();
  await search.fill('no-such-title-123');
  await expect(page.getByText('No matching library titles', {exact:true})).toBeVisible();
  await noPageOverflow(page);
  await testInfo.attach('library',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});

test('TV mode keeps channel navigation available and hides station management', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'television');
  await page.goto('/tv?ch=25');
  await expect(page.getByRole('navigation',{name:'Primary'})).toBeVisible();
  await expect(page.locator('[aria-label="Live on CH 25"]')).toBeVisible();
  await openMore(page);
  await expect(page.getByText('Station admin',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Submit a clip/})).toHaveCount(0);
  await page.getByRole('button',{name:'Close viewer controls',exact:true}).click();
  await noPageOverflow(page);
});
