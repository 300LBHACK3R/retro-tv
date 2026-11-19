# Tate’s TV Roku Store candidate

The first Store candidate is a free, ad-free guest app with Live TV, Guide, Search, on-demand Library and free themes. The standard development ZIP continues to use the full lineup and existing features. The Store ZIP only accepts catalog, guide and playback responses marked for the Store edition.

## Choose and verify the Canadian launch slate

Record where each programme, video clip, soundtrack and image was obtained, who can authorize its use, and the licence terms for live and on-demand streaming in Canada. The first release supports items shorter than 15 minutes. Longer VOD requires Roku’s trick-play thumbnails and an extended bookmark policy. Verify accessibility and captions for every item that needs them. Use a production media host and test real devices before adding a public audience.

Configure both server-only environment values for the release deployment. Use permanent IDs from Admin/production programming and separate entries with commas.

| Setting | What it approves |
| --- | --- |
| `TTV_ROKU_STORE_CHANNEL_IDS` | Enabled channels with cleared Store programming |
| `TTV_ROKU_STORE_MEDIA_IDS` | Specific reviewed show/movie files in those channels |

Check rights again before replacing a file under an approved ID. Review each channel’s name, logo and description too. The Store guide, lineups and Library use the same approved entries. Empty or missing configuration returns no programmes. Existing edition URLs retain their current behaviour.

Deploy the reviewed website changes before sideloading the Store ZIP. With the approved configuration, check `catalog?edition=store`, `guide?edition=store` and `play?edition=store` under `/api/roku/`. Confirm every approved title appears in the Library and that an excluded channel or media ID cannot be played directly. Verify Canada-only Store availability and implement any additional territory restrictions required by the licences before launch.

## Build, sign and test

```sh
npm ci
npm --prefix roku ci
npm --prefix roku run build:store
```

`roku/dist/tates-tv-roku-store.zip` is the input to the Roku Development Application Installer. `roku/dist/tates-tv-roku-store-poster.png` is the 540 × 405 listing image. Use a Roku linked to the Tate’s TV developer account to create the signed `.pkg`. Keep the signing credentials private and retain them for future updates.

Test the exact Store build on multiple Roku models. Check cold startup, Back and remote focus, live playback across programme boundaries, Guide and Library, captions, instant replay, seeking, bookmarks after relaunch, and cold/warm launch to the approved content. Test invalid or retired linking IDs. Capture actual 1920 × 1080 screenshots from the candidate for the listing. The prior development build’s successful TV test does not cover these edition-specific checks.

## Store listing draft

- **Name** — Tate’s TV
- **Territory** — Canada, after confirming the rights and required restrictions
- **Monetization** — Free, with no video advertising, sign-in or purchase prompts
- **Device description** — Tune into Tate’s TV’s curated live channels, browse the guide, and watch selected shows on demand. Pick a look with free themes and keep your place on this Roku. No account is needed.
- **Web description** — Tate’s TV brings the feel of classic channel surfing to Roku. Browse a live programme guide, switch between channels, and pick a show from the on-demand library. Search for a title or resume an episode on the same device. Choose from free visual themes. The Canadian lineup features titles selected for this edition.
- **Support** — https://www.tatestv.ca/help. Provide the developer account’s current support contact in the Dashboard.
- **Privacy** — https://www.tatestv.ca/privacy
- **Terms** — https://www.tatestv.ca/terms

Choose the category and rating after reviewing the actual slate. Create a Beta app in the Roku Developer Dashboard and upload the signed package for device testing. For the Public app, fill in the listing and territory, upload the signed package, supply working deep links for each released media type, and run Static Analysis and App Behavior Analysis. Schedule submission only when the candidate passes these checks and the slate is authorized.

Official references: [App publishing](https://developer.roku.com/dev/docs/channel-publishing-guide), [Certification criteria](https://developer.roku.com/dev/docs/certification), [Publishing by territory](https://developer.roku.com/dev/docs/publishing).
