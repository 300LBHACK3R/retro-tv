import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { useStore } from '../lib/store';
import { programming } from './programming-fixture';
import { createBroadcastDayAnchor, findChannelByNumber, sortEnabledChannels } from '../lib/viewer';

test('cloud refresh preserves viewer choices; explicit restore restores the snapshot', () => {
  useStore.getState().replaceProgramming(programming);
  useStore.getState().setChannel('25');
  useStore.getState().setTheme('obsidian-gold');
  useStore.getState().setPlayerViewMode('theater');
  useStore.getState().replaceProgramming(programming, { preserveViewer: true });
  expect(useStore.getState().currentChannelId).toBe('25');
  expect(useStore.getState().themeId).toBe('obsidian-gold');
  expect(useStore.getState().viewerSettings.playerViewMode).toBe('theater');
  useStore.getState().replaceProgramming(programming);
  expect(useStore.getState().currentChannelId).toBe('24');
  expect(useStore.getState().themeId).toBe('ttv-neon-crt');
  expect(useStore.getState().viewerSettings.playerViewMode).toBe('normal');
});

test('numeric tuning ignores disabled channels and accepts leading zeroes', () => {
  const channels = sortEnabledChannels([...programming.channels, {id:'99', number:99, name:'Disabled', mediaIds:[], isEnabled:false}]);
  expect(findChannelByNumber(channels,'025')?.id).toBe('25');
  expect(findChannelByNumber(channels,'99')).toBeUndefined();
  const now = new Date(2026, 8, 9, 23, 59);
  expect(createBroadcastDayAnchor(now).getHours()).toBe(0);
  expect(now.getHours()).toBe(23);
});

test('service worker excludes private pages, live HTML, API, media, and RSC requests', () => {
  const source = readFileSync('public/sw.js', 'utf8');
  const context = vm.createContext({ URL, self: { location: {origin:'https://tatestv.ca'}, addEventListener: () => {} } });
  vm.runInContext(source, context);
  for (const path of ['/admin','/backup','/api/programming','/','/library','/_next/static/a.js','/movie.mp4','/help?_rsc=test']) {
    const result = vm.runInContext(`isSafeShellRequest({url: ${JSON.stringify('https://tatestv.ca'+path)}, method:'GET', headers:{get:()=>${JSON.stringify(path.includes('_rsc')?'1':null)}}})`, context);
    expect(result, path).toBe(false);
  }
  expect(vm.runInContext('isSafeShellRequest({url:"https://tatestv.ca/offline",method:"GET",headers:{get:()=>null}})', context)).toBe(true);
});
