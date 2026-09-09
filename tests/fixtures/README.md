# Synthetic video fixture

`test-video.webm.base64` contains a generated 60-second, 320 x 180, 10 fps solid-colour VP8 video with no audio. It contains no station or customer media. Browser tests decode it in memory, so CI and Windows do not need FFmpeg installed.

To regenerate with FFmpeg, run from the repository root:

```sh
ffmpeg -f lavfi -i color=c=0x10151e:s=320x180:r=10 -t 60 -c:v libvpx -b:v 80k test.webm
```

Then base64-encode the generated file into `tests/fixtures/test-video.webm.base64`. The decoded video is served only by the test harness.
