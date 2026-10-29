# Lighthouse (live site, mobile)

Run 2026-10-28 after the app redesign, Lighthouse 12.2.1, mobile emulation with simulated throttling, against
`https://ca-web-6x6suo5lxjc5o.icysmoke-e61b83ec.canadacentral.azurecontainerapps.io`. Performance is the median of three
runs (all three shown), because it swings with load on the test PC; the other scores didn't change between runs.

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home (first visit: place picker) | 86 (84, 86, 94) | 100 | 100 | 100 |
| Sprout | 91 (88, 91, 94) | 100 | 100 | 100 |
| Alerts | 78 (73, 78, 98) | 100 | 100 | 100 |
| Profile | 94 (91, 94, 94) | 100 | 100 | 100 |
| Map | 62 (61, 62, 62) | 100 | 100 | 90 |
| Privacy | 97 (87, 97, 98) | 100 | 100 | 100 |

- Accessibility, best practices and SEO are 100 on every page except one SEO point on the map.
- The map scores lower on performance because the Azure Maps SDK is large and draws with WebGL (most of its 8.6 s of
  simulated blocking time is the SDK starting up). Its SEO point is lost on attribution links inside the Azure Maps
  control, which Sylvia doesn't render.
- Home now draws its loading shape before JavaScript finishes, instead of a blank screen.
