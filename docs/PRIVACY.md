# Privacy

What the Rewind desktop app sends off your device, to whom, and when. This describes
the code in this repository. What any server does with the data it receives is not
covered here.

If you change what the app sends, update this file in the same pull request.

## Summary

- **No telemetry, analytics or crash reporting.** The telemetry client is a stub that
  sends nothing. The error screen's report is only copied to your clipboard when you
  click "Copy error details".
- **Searches and the music catalog go to YouTube Music directly from your device.** The
  Liner catalog is used as a fallback if the client-side lookup fails.
- **Your configured app API handles your account:** sign-in, profile, library,
  playlists, and playback history are sent to the server configured by `VITE_API_URL`.
  This is separate from the catalog service configured by `VITE_CATALOG_API_URL`.
- **Catalog requests do not include your app account token, user id, username, or
  listening-history list.** If the client-side radio lookup fails, the catalog receives
  the seed track and radio options; previously played ids are filtered locally.
- **Your own audio files never leave the device.** Not the files, not their names or
  paths, not their tags (except to Discord, see below).
- **There is no hardware or device identifier.** Every id the app generates is a random
  UUID per request, per session or per sign-in.

## Music catalog service (`api.tryliner.fun` by default)

Catalog requests carry:

- the app version and your OS family (`windows`, `macos`, `linux`);
- a random request id;
- a request signature (HMAC over the method, path, time and body; it contains no device
  data);

When a client-side lookup fails, the catalog service can receive:

| Data                                                    | When                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| Search query                                            | Client-side catalog search fails                           |
| Catalog item id                                         | Client-side track, album, artist, or playlist lookup fails |
| Radio seed id and radio options                         | Client-side radio lookup fails                             |
| Track id and optional title, artist, and duration hints | Lyrics lookup                                              |

Your app account token, profile, library, playlist edits, play events, and listening
history are sent to the API configured by `VITE_API_URL`, not to the catalog service.
Playlist imports from Spotify, Apple Music, Deezer, SoundCloud and YouTube run on your
device. Your configured app API receives the finished playlist when you save it.

## YouTube and Google

The app talks to YouTube Music the way its web and TV clients do, from your own IP:

- **Visitor data** from `youtube.com` at launch, which Google uses as an anonymous
  session id.
- **Search queries**, album, artist and playlist pages, radio, and video ids for playback.
- **Audio** from `googlevideo.com`, with a proof-of-origin token that a hidden YouTube
  page generates on your device.
- **Titles and artists** of tracks that need a YouTube match, during playlist imports and
  for SoundCloud tracks that fail to play.

If you sign in with your YouTube account (TV device-code sign-in):

- The app asks for access to your YouTube and YouTube Music account and paid content.
- Playback and the library sync run as your account, or as the brand channel you pick.
  Google can link what you play to your account.
- The tokens are stored in `userData/auth/youtube-session.json`, encrypted with the OS
  keychain when it is available. If it is not, they are stored unencrypted, readable only
  by your user.
- Your YouTube library is only read, to show it in the app. It is not sent to the music
  catalog service. The app does not like, rate or report anything to YouTube.
- Signing out revokes the token with Google.

## Other services

| Service                                                                                                                                 | What it gets                                                                                                | When                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discord** (local Discord app)                                                                                                         | Track title, artist, album, cover URL, position, artist picture, and a "Listen on Rewind" link to the track | While Rich Presence is on (it is on by default; turn it off in Settings → Discord). Local files show title and artist only, without the link or cover |
| **SoundCloud**                                                                                                                          | The SoundCloud link you paste, and stream requests                                                          | Only for SoundCloud links and tracks. Free-text searches never go to SoundCloud                                                                       |
| **Spotify, Apple Music, Deezer**                                                                                                        | The playlist link you paste, with an anonymous guest token                                                  | Importing a playlist                                                                                                                                  |
| **Google Fonts**                                                                                                                        | Your IP and browser user agent                                                                              | At launch, to load the fonts                                                                                                                          |
| **Image hosts** (YouTube, Google, SoundCloud, `covers.tryliner.fun`)                                                                    | Requests for cover images                                                                                   | Showing covers                                                                                                                                        |
| **GitHub releases**, `updates.tryliner.fun`                                                                                             | Your IP and user agent                                                                                      | Update checks: 4 seconds after launch, then every 15 minutes                                                                                          |
| **Connectivity checks** (`api`, `covers` and `link.tryliner.fun`, `google.com/generate_204`, Cloudflare trace, a traceroute to the API) | Your IP                                                                                                     | When several requests fail in a row, or when you run the check. Results are shown only to you                                                         |

## Your own audio files

Files you add under "On this device" are copied into `userData/local-tracks/` and played
from there. Their id is a hash of the file content. The app never:

- uploads the files, their names or their paths;
- sends their tags to the Liner server or YouTube (no play events, lyrics lookups, radio,
  likes, playlist adds or share links for them);
- looks them up on YouTube to find a replacement.

The only place a local track's title and artist go is Discord Rich Presence, when it is
on.

## What stays on your device

- Search history, settings, the queue and the audio, cover and lyrics caches. See
  [STORAGE.md](./STORAGE.md).
- The error report on the crash screen, unless you copy it and send it yourself.
- In development builds only, `renderer.log` with the app's console output.
