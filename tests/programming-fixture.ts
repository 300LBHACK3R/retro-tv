import type { ProgrammingSnapshot } from '../lib/programmingSnapshot';

// Synthetic schedules for UI tests; never read or write production programming.
export const programming: ProgrammingSnapshot = {
  media: [
    { id: 'qa-show-a', title: 'Studio Sessions S01E01', type: 'show', duration: 60, file: '/qa-media.webm', mimeType: 'video/webm' },
    { id: 'qa-show-b', title: 'Studio Sessions S01E02', type: 'show', duration: 60, file: '/qa-media.webm', mimeType: 'video/webm' },
    { id: 'qa-movie', title: 'A Calgary Evening', type: 'movie', duration: 60, file: '/qa-media.webm', mimeType: 'video/webm' },
  ],
  channels: [
    { id: '24', number: 24, name: 'Studio TV', isEnabled: true, mediaIds: ['qa-show-a', 'qa-show-b'], scheduleMode: 'ordered', commercialBreakMode: 'none', branding: { displayName:'Studio TV', callsign:'STUDIO', description:'Original studio sessions.', accentColor:'#60d8ef', logoText:'STUDIO' } },
    { id: '25', number: 25, name: 'Local Cinema', isEnabled: true, mediaIds: ['qa-movie'], scheduleMode: 'ordered', commercialBreakMode: 'none', branding: { displayName:'Local Cinema', callsign:'CINEMA', description:'Independent films.', accentColor:'#ef719e', logoText:'CINEMA' } },
  ],
  currentChannelId: '24', sidebarWidth: 420, guideHeight: 290, appMode: 'viewer',
  themeId: 'ttv-neon-crt', ownedPremiumThemes: [], updatedAt: '2026-09-09T00:00:00.000Z',
};
