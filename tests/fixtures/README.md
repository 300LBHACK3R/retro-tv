# Synthetic video fixture

`test-video.webm.base64` contains a generated 60-second, 320 x 180, 10 fps solid-colour VP8 video with no audio. It contains no station or customer media. Browser tests decode it in memory, so CI and Windows do not need FFmpeg installed.

To regenerate with FFmpeg, run from the repository root:

```sh
ffmpeg -f lavfi -i color=c=0x10151e:s=320x180:r=10 -t 60 -c:v libvpx -b:v 80k test.webm
```

Then base64-encode the generated file into `tests/fixtures/test-video.webm.base64`. The decoded video is served only by the test harness.

## HTTPS test certificate

`localhost.pfx.base64` is a public test-only self-signed certificate and private key for `localhost` and `127.0.0.1`, with passphrase `tates-tv-tests-only`. It carries no production identity or secrets and must never be used outside local tests. The test server binds only to `127.0.0.1`; Playwright accepts this self-signed certificate for its isolated test contexts.

The production build sends `upgrade-insecure-requests`. WebKit upgrades local HTTP asset URLs too, so an HTTP-only test server prevents its scripts and styles from loading. `tests/https-server.mjs` serves the existing production build over HTTPS with the original security headers intact. Neither Vercel's deployment server nor the app's CSP is changed.

To regenerate the fixture with OpenSSL (not needed to run tests):

```sh
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -keyout localhost-test.key -out localhost-test.crt -days 3650 -subj '/CN=localhost/O=Tates TV Test Fixture' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
openssl pkcs12 -export -out localhost-test.pfx -inkey localhost-test.key -in localhost-test.crt -passout pass:tates-tv-tests-only
```

Base64-encode `localhost-test.pfx` into `tests/fixtures/localhost.pfx.base64` and discard the temporary key and certificate files. Test runs require only Node.js and the existing npm dependencies.
