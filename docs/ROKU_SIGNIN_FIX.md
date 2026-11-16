# Roku sign-in fix — 0.1.10

The server accepted the owner's sign-in, but selecting a profile produced a 404
that the TV incorrectly described as an unpublished backend. BrightScript
lowercases unquoted associative-array keys and dot-assigned keys. Consequently,
`profileId` was sent as `profileid`, while the server requires `profileId`.
The same mismatch affected refresh tokens, profile grants, viewing progress,
theme selection and diagnostic media IDs.

`AccountTask` now restores the six API field names immediately before JSON
serialization, after the SceneGraph task handoff. It uses bracket insertion
after deleting the old spelling and leaves values and the queued payload alone.
The response parser accepts intrinsic and boxed error strings and preserves
the server's profile error instead of replacing all 404s with deployment advice.

Install `tates-tv-roku-v0.1.10.zip` with **Replace with zip**. This is a native
client fix for the already deployed v0.1.9 backend. No database migration,
password reset or website deployment is needed to use it.

The new `account-wire.brs` regression checks exact, case-sensitive JSON key names,
value types, credential preservation and HTTP/error handling. It explicitly
supplies lowercase keys: brs 0.45.0 preserves unquoted literal spelling and
therefore does not reproduce this physical-Roku behavior by itself. It also
does not fully emulate platform JSON string escaping; the app continues to use
Roku's built-in `FormatJson`. The CI Roku job runs the contract check before
packaging, including on `fix/**` branches.

Reference: [Roku expressions, variables and types](https://developer.roku.com/dev/docs/expressions-variables-types).

Physical acceptance remains pending: select an account profile, restart to
verify session restoration, then exercise shared progress, saved lists and
an already-owned theme. The separate pending Kids-content review still applies.
