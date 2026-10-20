import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";
const video = Buffer.from(readFileSync("tests/fixtures/test-video.webm.base64", "utf8"), "base64");
async function fixture(page: Page) {
  let saved: ProgrammingSnapshot = structuredClone(programming);
  await page.route("**/api/admin/session", route => route.fulfill({json:{ok:true,isAdmin:true}}));
  await page.route("**/api/programming", route => route.fulfill({json:{ok:true,programming:saved,source:"database"}}));
  await page.route("**/api/admin/programming", async route => { saved=route.request().postDataJSON(); await route.fulfill({json:{ok:true,programming:saved}}); });
  await page.route("**/api/engagement", route => route.fulfill({json:{ok:true}}));
  await page.route("**/_vercel/**", route => route.fulfill({status:204}));
  await page.route("https://www.gstatic.com/**", route => route.fulfill({contentType:"application/javascript",body:""}));
  await page.route("https://media.example/**", route => route.fulfill({contentType:"video/webm",body:video}));
  await page.goto("/admin");
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await page.getByRole("button", {name:"Batch Import",exact:true}).click();
  await page.getByLabel("Assign batch to channel").selectOption(programming.channels[0]!.id);
  return () => saved;
}

test("existing links detect runtimes, survive reload and append once after review without uploading", async ({page}, testInfo) => {
  const saved = await fixture(page);
  let signatures = 0;
  await page.route("**/api/admin/uploads/sign", route => { signatures++; return route.fulfill({status:500}); });
  await page.getByText("Already uploaded? Paste public video links", { exact: true }).click();
  await page.getByLabel("Video URLs, one per line").fill("https://media.example/Series.S01E10.webm\nhttps://media.example/Series.S01E02.webm\nhttps://media.example/Series.S01E02.webm\njavascript:alert(1)");
  await page.getByRole("button", {name:"Queue links without reuploading"}).click();
  await expect(page.getByRole("status").filter({hasText:"2 links queued"})).toBeVisible();
  await page.getByLabel("Ad time after each new programme").selectOption("30");
  await page.getByRole("button", {name:"Prepare / retry selected items"}).click();
  await expect(page.locator('.ttv-batch-rows [data-status="ready"]')).toHaveCount(2);
  expect(saved().media).toHaveLength(programming.media.length);
  await page.reload();
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await expect(page.locator('.ttv-batch-rows [data-status="ready"]')).toHaveCount(2);
  await page.getByRole("button", {name:"Sort by title / episode"}).click();
  await expect(page.getByRole("button", {name:"Add 2 ready items to station"})).toBeDisabled();
  await page.getByRole("checkbox", {name:/I reviewed the 2 ready items/}).check();
  await page.getByRole("button", {name:"Add 2 ready items to station"}).click();
  await expect.poll(() => saved().media.length).toBe(programming.media.length+2);
  const additions = saved().media.slice(programming.media.length);
  expect(additions.map(item=>item.title)).toEqual(["Series S01E02","Series S01E10"]);
  expect(saved().channels.find(channel => channel.id === programming.channels[0]!.id)!.mediaIds.slice(-2)).toEqual(additions.map(item => item.id));
  expect(additions.every(item=>item.duration>0 && item.slotLengthSeconds===item.duration+30 && !item.kidsApproved)).toBe(true);
  expect(signatures).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole("heading", {name:"3. Review the queue"}).scrollIntoViewIfNeeded();
  await testInfo.attach("batch-import",{body:await page.screenshot({path:testInfo.outputPath("batch-import.png")}),contentType:"image/png"});
});

test("multiple local files upload with retry, keep successes and register commercials outside playlists", async ({page}) => {
  const saved = await fixture(page);
  const signedNames: string[]=[];
  const attempts = new Map<string,number>();
  await page.route("**/api/admin/uploads/sign", async route => {
    const name=route.request().postDataJSON().filename; signedNames.push(name);
    await route.fulfill({json:{ok:true,uploadUrl:`https://storage.example/${name}`,publicUrl:`https://media.example/${name}`,expiresInSeconds:3600}});
  });
  await page.route("https://storage.example/**", async route => {
    if(route.request().method()==="OPTIONS") {await route.fulfill({status:204}); return;}
    const name=new URL(route.request().url()).pathname;
    const count=(attempts.get(name)||0)+1; attempts.set(name,count);
    await route.fulfill({status:name.includes("02") && count===1?503:200});
  });
  await page.getByLabel("Batch media type").selectOption("commercial");
  await page.getByLabel("Choose batch videos").setInputFiles([
    {name:"Promo02.webm",mimeType:"video/webm",buffer:video},
    {name:"Promo01.webm",mimeType:"video/webm",buffer:video},
  ]);
  await page.getByRole("button", {name:"Prepare / retry selected items"}).click();
  await expect(page.locator('.ttv-batch-rows [data-status="ready"]')).toHaveCount(1);
  await expect(page.locator('.ttv-batch-rows [data-status="error"]')).toHaveCount(1);
  await expect(page.getByRole("button", {name:"Prepare / retry selected items"})).toBeEnabled();
  await page.getByRole("button", {name:"Prepare / retry selected items"}).click();
  await expect(page.locator('.ttv-batch-rows [data-status="ready"]')).toHaveCount(2);
  expect(signedNames.sort()).toEqual(["Promo01.webm","Promo02.webm"]);
  expect(attempts.get("/Promo01.webm")).toBe(1);
  expect(attempts.get("/Promo02.webm")).toBe(2);
  await page.getByRole("checkbox", {name:/I reviewed the 2 ready items/}).check();
  await page.getByRole("button", {name:"Add 2 ready items to station"}).click();
  await expect.poll(()=>saved().media.length).toBe(programming.media.length+2);
  for(const ad of saved().media.slice(programming.media.length)) {
    expect(ad.type).toBe("commercial"); expect(ad.kidsApproved).toBe(false);
    expect(ad.adChannelIds).toEqual([programming.channels[0]!.id]);
    expect(saved().channels.every(channel=>!channel.mediaIds.includes(ad.id))).toBe(true);
  }
});

test("pause stops a two-file transfer queue without publishing and resumes unfinished files", async ({page}) => {
  const saved = await fixture(page);
  let held = true;
  let started = 0;
  const release: (() => void)[] = [];
  await page.route("**/api/admin/uploads/sign", route => {
    const name=route.request().postDataJSON().filename;
    return route.fulfill({json:{ok:true,uploadUrl:`https://storage.example/${name}`,publicUrl:`https://media.example/${name}`}});
  });
  await page.route("https://storage.example/**", async route => {
    if(route.request().method()==="OPTIONS") {await route.fulfill({status:204}); return;}
    started++;
    if(held) await new Promise<void>(resolve => release.push(resolve));
    await route.fulfill({status:200}).catch(()=>{});
  });
  await page.getByLabel("Choose batch videos").setInputFiles([1,2,3].map(n=>({name:`Episode${n}.webm`,mimeType:"video/webm",buffer:video})));
  await page.getByRole("button",{name:"Prepare / retry selected items"}).click();
  await expect.poll(()=>started).toBe(2);
  await page.getByRole("button",{name:"Pause preparation"}).click();
  await expect(page.getByRole("button",{name:"Prepare / retry selected items"})).toBeEnabled();
  expect(saved().media).toHaveLength(programming.media.length);
  expect(started).toBe(2);
  held=false; release.forEach(resolve=>resolve());
  await page.getByRole("button",{name:"Prepare / retry selected items"}).click();
  await expect(page.locator('.ttv-batch-rows [data-status="ready"]')).toHaveCount(3);
  expect(saved().media).toHaveLength(programming.media.length);
});
