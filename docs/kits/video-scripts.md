# Sylvia: Imagine Cup video scripts

Two videos, both required for the MVP round:
- **Demo video:** 2:00 maximum, narrated, shows the working product and its Microsoft AI.
- **Pitch video:** 3:00 maximum, filmed as if a judge is sitting in front of you.

**Rules that shape these scripts:** no editing except trimming the start and end, so each video is one continuous
take. Only registered team members (4 max) may appear. Host each video at a public link with no password
(OneDrive or YouTube "unlisted"), and keep each file under 100 MB.

Rehearse with a timer. Read lines word for word the first few times, then loosen up. If a take goes past the time
limit, cut words rather than speed up.

---

## Demo video (2:00)

**Setup before recording**
- Record the phone screen (Android: built-in screen recorder; iPhone: Control Centre → Screen Recording), or a
  laptop browser at phone size. Use the live app, not localhost.
- Clear Sylvia's site data (or use a fresh private window) right before the take, so the "hello" and leaves intro
  plays as the opening. Then set home to **Kamloops, BC** in the first seconds, or set it the day before and clear
  only the intro by removing `sylvia.welcomed` in the browser's site storage.
- Turn on Do Not Disturb so personal notifications don't appear.
- Have `barberry.jpg` (in `apps/web/test-fixtures/`) saved in the phone's photos, or a real barberry plant.
- One narrator records the voice-over live while another person taps. Practise the taps until they're smooth.

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:10 | First launch: "hello" is written, leaves fall and blow away, Home appears for Kamloops | "This is Sylvia, a free app that buys people time before and during a wildfire. My home is Kamloops." |
| 0:10–0:30 | Home: fire danger, smoke forecast, "Sylvia says"; tap the "Is it OK to go for a run today?" suggestion | "Home shows the official fire danger, Environment Canada's smoke forecast for the next two days, and air quality, each with its source and time. I can ask Sylvia. GPT-4o in Azure AI Foundry answers only from these live readings, and Azure AI Content Safety checks every answer." |
| 0:30–0:42 | Map tab: named fires with their status; tap "Report what you see" and show the sheet, then close it | "The map shows named fires with their official status, evacuation areas, satellite heat and smoke sensors. Neighbours can report smoke they see. Reports are marked unverified, and the 911 and fire-line numbers come first." |
| 0:42–1:05 | Sprout tab → Ontario → choose barberry photo → result → swaps | "Prevention starts in the yard. Two AI models identify this shrub: GPT-4o and Pl@ntNet. Japanese barberry, invasive in Ontario. Azure AI Search finds native look-alikes, like common ninebark." |
| 1:05–1:45 | Map → "Replay a past fire": let it play; it pauses on each alert | "Now a real fire: the Quilpituk Creek wildfire from August, replayed on the map hour by hour. Satellites see heat overnight: a Level 1 advisory, marked unverified. The estimated fire area grows. Then the Regional District's evacuation alert, relayed. Then the official order, Level 3, with the agency named. Sylvia never orders anyone to leave on its own." |
| 1:45–2:00 | Profile: checklist; then Communities with sample data on | "Residents get a FireSmart checklist, and towns get an anonymous Communities view, shown with sample data. Sylvia: more time when it matters." |

**Microsoft AI to name out loud:** Azure AI Foundry (GPT-4o), Azure AI Search, Azure AI Content Safety (with Prompt
Shields on Ask Sylvia), plus Azure Maps. Judges score whether the demo actually shows Microsoft AI working.

---

## Pitch video (3:00)

**Setup:** camera at the height and distance of a judge sitting across a table. Two or three speakers, standing: pick [A], [B] and [C] from Mina Adnan (team lead), Aniket Arbatti, Salwa Mukhtar and Thirshan Varatharajah.
The deck can be on a screen behind you, but the pitch must work without reading slides. Quiet room, good light
from the front.

| Time | Speaker | Slide | Script |
|---|---|---|---|
| 0:00–0:20 | [A] | Cover | "Hi, we're Team Sylvia: Mina, Aniket, Salwa and Thirshan, from Toronto Metropolitan University. When a wildfire comes, the people who need the most time to get ready often hear last. We built Sylvia to give them that time back." |
| 0:20–0:50 | [A] | Problem | "Fire seasons are getting worse: 2023 burned more than 15 million hectares in Canada. When fire comes, alerts are broadcasts, the same message for everyone, whether you're healthy or on oxygen. And before any fire, our yards make it worse: invasive plants spread from gardens, and some burn easily." |
| 0:50–1:05 | [A] | People | "We talked to [N] residents, nurseries and town staff in Ontario and BC. [One real quote from an interview.]" |
| 1:05–1:40 | [B] | Solution, Sprout, Alerts | "Sylvia is one free app. It shows your official fire danger and air quality in plain words. Sprout scans a plant in your yard, tells you if it's invasive where you live, and suggests a native swap. And our alerts warn you about nearby fire and smoke, always labelled unverified, while official evacuation orders are relayed word for word, naming the agency." |
| 1:40–2:00 | [B] | Replay | "We replayed a real fire from this August, Quilpituk Creek near Kelowna. Sylvia flagged satellite heat at 2:20 in the morning, then relayed the official alert and the order, as they happened." |
| 2:00–2:25 | [C] | Business | "Residents never pay. Towns and regional districts already fund FireSmart and invasive-plant programs; our Communities view shows them where residents are ready and where they're not. Nurseries pay for referrals when Sprout suggests a native plant. [Validation: what towns or nurseries told you about paying.]" |
| 2:25–2:40 | [C] | Architecture, Node | "It's built on Microsoft Azure, with four Microsoft AI services in production. And as an engineering club, we're designing the Sylvia Node, a solar smoke sensor that keeps working when the power goes out." |
| 2:40–3:00 | [A] | Roadmap | "This spring we pilot with communities in Central Okanagan and Northwestern Ontario. Sylvia works on four UN Sustainable Development Goals: health, safer communities, climate adaptation and invasive species. Sylvia: more time when it matters. Thank you." |

Fill every `[bracket]` from the interview findings before filming. Don't invent a quote or a number.

**If a judge asks about the UN goals:** name the targets and the proof behind each. 3.9 (illness from air
pollution): smoke alerts that adjust for people sensitive to smoke. 11.5 (people affected by disasters): the
Quilpituk Creek replay. 13.1 (resilience to climate hazards): fire danger in plain words and the FireSmart
checklist. 15.8 (invasive alien species): Sprout, 83% right on its first guess across 48 test photos.
