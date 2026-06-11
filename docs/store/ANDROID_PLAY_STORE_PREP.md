# Tate's TV Android Store Prep

## Recommended package name

`ca.tatestv.app`

## Recommended app name

`Tate's TV`

## Recommended short name

`TTV`

## Android wrapper approach

Use a Trusted Web Activity wrapper for Google Play.

Official concept:
- Website remains the source of truth.
- Android wrapper launches the production PWA.
- Normal web updates continue through Vercel.
- Native wrapper updates only needed for wrapper/signing/store changes.

## Required before submission

- Google Play Console account
- Android App Bundle
- Release signing key
- SHA-256 certificate fingerprint
- Updated `/.well-known/assetlinks.json`
- Screenshots
- Feature graphic
- App icon
- Privacy policy URL
- App category
- Content rating questionnaire
- Data safety form
- Store listing copy

## Production URL

https://www.tatestv.ca

## Important routes

- https://www.tatestv.ca/
- https://www.tatestv.ca/install
- https://www.tatestv.ca/help
- https://www.tatestv.ca/privacy
- https://www.tatestv.ca/terms
- https://www.tatestv.ca/.well-known/assetlinks.json
