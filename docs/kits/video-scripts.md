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
- Turn on Do Not Disturb so personal notifications don't appear. Turn alerts on in the app first, so replay
  notifications show.
- Home set to **Kamloops, BC**. On Alerts, tap **Clear replay alerts** so history starts empty.
- Have `barberry.jpg` (in `apps/web/test-fixtures/`) saved in the phone's photos, or a real barberry plant.
- One narrator records the voice-over live while another person taps. Practise the taps until they're smooth.

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:12 | Home tab, Kamloops | "This is Sylvia, a free app that buys people time before and during a wildfire. I've set my home to Kamloops." |
| 0:12–0:30 | Scroll Home slowly: fire danger, AQHI, fire activity, weather, "Sylvia says" | "Home shows the official fire danger from Natural Resources Canada, air quality from Environment Canada, and satellite heat nearby, each with its source and time. Sylvia's summary is written by GPT-4o in Azure AI Foundry, and checked by Azure AI Content Safety." |
| 0:30–0:42 | Map tab; tap one fire area to open its card | "The map brings fire areas, satellite heat, smoke sensors and air quality into one place. Every card says what it is, and what it isn't. This is an estimated outline, not an official perimeter." |
| 0:42–1:10 | Sprout tab → Ontario → choose barberry photo → result → scroll to swaps | "Prevention starts in the yard. I scan a shrub. Two AI models identify it: GPT-4o in Azure AI Foundry, and Pl@ntNet as a second opinion. They agree: Japanese barberry, invasive in Ontario. Azure AI Search finds native plants that look similar, like common ninebark, and I can save it to My plants." |
| 1:10–1:45 | Alerts tab → Replay → Start → Next moment ×5, pausing on each banner; a notification drops in | "Now a real fire. This replays the Quilpituk Creek wildfire from August, using only the data available at each moment. At 2:20 a.m., satellites detected heat 21 kilometres north: a Level 1 advisory, clearly marked unverified. Then the Regional District's official evacuation alert, relayed. Then the official order, Level 3, with the agency named. Sylvia never orders anyone to leave on its own." |
| 1:45–2:00 | Profile: checklist; then Communities with sample data on | "Residents get a FireSmart checklist, and towns get an anonymous Communities view, shown here with sample data. Sylvia: more time when it matters." |

**Microsoft AI to name out loud:** Azure AI Foundry (GPT-4o), Azure AI Search, Azure AI Content Safety, plus Azure
Maps. Judges score whether the demo actually shows Microsoft AI working.

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
| 2:25–2:45 | [C] | Architecture, Node | "It's built on Microsoft Azure, with four Microsoft AI services in production. And as an engineering club, we're designing the Sylvia Node, a solar smoke sensor that keeps working when the power goes out." |
| 2:45–3:00 | [A] | Roadmap | "This spring we pilot with communities in Central Okanagan and Northwestern Ontario. Sylvia: more time when it matters. Thank you." |

Fill every `[bracket]` from the interview findings before filming. Don't invent a quote or a number.
