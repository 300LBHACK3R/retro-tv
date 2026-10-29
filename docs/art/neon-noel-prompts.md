# Cyberpunk Christmas: Neon Noël

Original artwork generated with the built-in image-generation tool. This is an additional free theme under Seasonal → Christmas. Christmas '96 remains the scheduled November entrance theme.

## Project assets

- `public/themes/christmas-neon-noel-world.webp`: 1672 × 941; 430,940 bytes.
- `public/themes/christmas-neon-noel-mobile.webp`: 940 × 1672; 405,882 bytes.
- `public/themes/neon-noel-lights.svg`: code-drawn reusable festive wire and diamond bulbs.

Both raster assets use WebP quality 92 at their native generated resolution. Sharp performed format encoding only. The portrait is separately composed from the landscape reference, rather than cropped. Static imports provide versioned URLs; the scene serves these WebP assets directly to avoid a second lossy compression pass. The theme card shares the landscape artwork.

## Generation prompts, condensed

### Landscape

Use case: stylized-concept. Asset: a cinematic cyberpunk Christmas background for a retro television website, wide 16:9. A luxurious futuristic apartment and arcade listening lounge overlooks a dense, snowy neon city at midnight on Christmas Eve. A full Christmas tree at the far left has cyan fibre-optic lights, ruby ornaments, magenta accents, a star and presents. Garland and a wreath decorate the top beam. A warm high-tech console nook sits at the far right. Graphite metal, plum upholstery, gold, cyan and rose lighting. Keep the central 60% calm and dark for the actual player and controls; tell the story at the edges. Pulled-back composition, detailed and crisp. No people, weapons, readable text, logos, interface, watermark or blur.

### Portrait

Use the landscape as the reference for a separately recomposed tall 9:16 mobile scene of the same environment. Pull back instead of cropping. Preserve the whole wreath and garland at the top, tree at the left, console at the right and snowy skyline in the lower centre. Brighter cyan and magenta ceiling neon; maintain a calm dark centre, the same style and atmosphere. No people, text, logos, interface or blur.

## Integration

The scene loads only when selected. Decoration is non-interactive and sits behind the viewer. Glow and snowfall animate opacity or transforms; shared seasonal styles pause motion on hidden pages, disable it for reduced-motion preferences and hide decorative scenery in forced-colour mode. Lights repeat across the navigation and guide headers with dedicated space below controls. Narrow phone headers give the wordmark and account actions separate rows.

The scene fills the viewport edge to edge with `object-fit: cover`, using the landscape or portrait artwork as appropriate. The centred fit crops only what differing screen proportions require; it does not add zoom or stretch the images. Wider desktop gutters, safe-area-aware phone gutters and a translucent navigation panel expose more of the room without shrinking playback in short phone landscape mode.

Browser coverage checks selection under the Christmas filter, profile persistence after reload, image loading, light strings, control separation, overflow and reduced motion. Existing theme-switching coverage includes this theme.
