import Link from "next/link";
import { SITE } from "@sylvia/core";

export const metadata = { title: "Privacy · Sylvia" };

export default function PrivacyPage() {
  return (
    <main className="screen prose">
      <p className="eyebrow">Privacy</p>
      <h1 className="display">What Sylvia stores, and why</h1>
      <p className="muted">Last updated {SITE.policyDate}. Sylvia is a student project by the {SITE.team}.</p>

      <h2>The short version</h2>
      <ul>
        <li>You don&apos;t need an account. Sylvia identifies your device with a random code, not your name or email.</li>
        <li>Your home location stays on your device unless you turn on alerts. Then we store your home area rounded to about 1 km.</li>
        <li>Plant photos have their location data removed on your phone before they&apos;re sent. Saved photos are deleted after 30 days.</li>
        <li>We don&apos;t sell data, show ads or use tracking cookies.</li>
        <li>You can delete what we store from inside the app at any time.</li>
      </ul>

      <h2>What we store on your device</h2>
      <p>
        Your browser keeps a random device code, the home place you choose, whether you said you&apos;re sensitive to smoke, and your
        Sprout region. Clearing your browser&apos;s site data removes them.
      </p>

      <h2>What we store on our servers</h2>
      <table>
        <thead>
          <tr><th>What</th><th>When</th><th>How long</th></tr>
        </thead>
        <tbody>
          <tr><td>Saved plants (name, verdict, swaps) and the photo</td><td>When you tap &quot;Save to My plants&quot;</td><td>Details until you remove them; photos 30 days</td></tr>
          <tr><td>FireSmart checklist ticks and your community (e.g. Central Okanagan), never your location</td><td>When you tick an item</td><td>Until you delete your data</td></tr>
          <tr><td>Alert settings: notification address from your browser, home area rounded to ~1 km, the smoke-sensitive setting</td><td>When you turn on alerts</td><td>Deleted when you turn alerts off</td></tr>
          <tr><td>Alert history</td><td>When an alert is sent to you</td><td>Until you delete your data</td></tr>
          <tr><td>Invasive plant sightings: plant, date, location rounded to ~1 km, with nothing linking it to you</td><td>Only if you tap &quot;Share this sighting&quot;</td><td>Kept for the shared map</td></tr>
          <tr><td>Resident reports: what you saw, location rounded to ~1 km, an optional note and photo, and a one-way code made from your device so we can count different people and limit floods of reports</td><td>Only if you send a report from the map</td><td>Reports 6 hours; photos deleted within a day</td></tr>
          <tr><td>Ask Sylvia questions</td><td>When you ask</td><td>Not stored; the question and live readings go to Azure AI to write the answer</td></tr>
          <tr><td>Technical logs (pages requested, errors)</td><td>As you use the app</td><td>30 days</td></tr>
        </tbody>
      </table>
      <p>
        Data is held in Microsoft Azure. Saved photos are stored in Canada (Canada Central). Saved plants, checklists, alert settings
        and sightings are stored in the United States (West US 2), because Azure had no database capacity for our account in Canada.
      </p>

      <h2>Who else sees what</h2>
      <ul>
        <li><b>Plant photos</b> go to Microsoft Azure AI in Sweden (Sweden Central) and to Pl@ntNet in France to identify the plant. Microsoft doesn&apos;t use them to train its models. Pl@ntNet handles them under <a href="https://plantnet.org/en/privacy-policy/" target="_blank" rel="noreferrer">its own privacy policy</a>.</li>
        <li><b>Your home area</b> (rounded) is sent to Natural Resources Canada for fire danger, Open-Meteo for weather, and Azure Maps for place names and garden-centre search. They receive a location, not who you are.</li>
        <li><b>Notifications</b> travel through your browser&apos;s push service (Google, Apple or Mozilla).</li>
        <li><b>Towns and regional districts</b> can see anonymous totals on community pages. Any group smaller than 5 is hidden.</li>
        <li><b>Resident reports</b> are shown to everyone on the map for 6 hours, marked unverified, with the note and photo if you added them. Notes and photos are checked by Azure AI Content Safety first. Photos have their location data removed on your phone before they&apos;re sent. Reports aren&apos;t sent to fire services: call 911 or your province&apos;s fire line.</li>
      </ul>
      <p>Explanations from &quot;Sylvia&quot; are written by AI from verified facts and checked by Azure AI Content Safety. They can still be wrong.</p>

      <h2>Your choices</h2>
      <ul>
        <li><Link href="/alerts">Alerts</Link> → <b>Turn off alerts</b> deletes your stored home area and notification address.</li>
        <li><Link href="/profile">Profile</Link> → <b>Remove</b> deletes a saved plant and its photo.</li>
        <li>Untick checklist items, or clear your browser&apos;s site data to start fresh.</li>
        {SITE.contactEmail ? (
          <li>For anything else, including a full deletion request, email <b>{SITE.contactEmail}</b>.</li>
        ) : (
          <li>For anything else, contact the {SITE.team}.</li>
        )}
      </ul>

      <h2>Children</h2>
      <p>Sylvia is meant for adults and families managing a home. It isn&apos;t directed at children under 13.</p>

      <p className="muted">
        This policy is written for a student pilot. If Sylvia grows into a service, it will be reviewed by a lawyer and updated, and
        we&apos;ll tell you in the app before anything changes. See also the <Link href="/terms">terms and safety notice</Link>.
      </p>
    </main>
  );
}
