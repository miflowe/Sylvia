import Link from "next/link";
import { SITE } from "@sylvia/core";

export const metadata = { title: "Terms · Sylvia" };

export default function TermsPage() {
  return (
    <main className="screen prose">
      <p className="eyebrow">Terms and safety</p>
      <h1 className="display">Use Sylvia alongside official alerts</h1>
      <p className="muted">Last updated {SITE.policyDate}.</p>

      <section className="notice" aria-labelledby="safety">
        <h2 id="safety">Safety notice</h2>
        <ul>
          <li><b>Sylvia is not an emergency service.</b> In an emergency, call 911.</li>
          <li><b>Follow official instructions.</b> Evacuation orders come from governments and First Nations, not from Sylvia. Keep Alert Ready and your local alerts on.</li>
          <li><b>Sylvia&apos;s own advisories are unverified.</b> Satellite heat detections aren&apos;t confirmed fires, and sensors can be wrong or offline.</li>
          <li><b>Alerts can be late or not arrive.</b> Phones, networks and data sources fail. Never wait for a Sylvia alert to act.</li>
          <li><b>Official orders shown in Sylvia are copies.</b> Always check the issuing agency&apos;s own website or Alert Ready.</li>
        </ul>
      </section>

      <h2>Plant results</h2>
      <p>
        Plant identification can be wrong, especially from leaf-only or blurry photos. Check before you remove or buy a plant. No plant
        is fireproof: how a plant burns depends on its condition, the weather and what&apos;s around it. Plant information marked
        &quot;not yet reviewed&quot; hasn&apos;t been checked by our team.
      </p>

      <h2>Using Sylvia</h2>
      <p>
        Sylvia is a free student project, provided as is, without guarantees that it&apos;s complete, accurate or always available. To
        the extent the law allows, the team isn&apos;t responsible for decisions made using it. Please don&apos;t misuse it (for
        example, sharing false sightings or overloading it).
      </p>
      <p>These terms are governed by the laws of Ontario, Canada.</p>

      <h2>Data sources and credits</h2>
      <ul>
        <li>Fire danger and fire perimeters: Natural Resources Canada, Canadian Wildland Fire Information System (Open Government Licence – Canada)</li>
        <li>Air Quality Health Index: Environment and Climate Change Canada (Open Government Licence – Canada)</li>
        <li>Satellite fire detections: NASA FIRMS (LANCE/EOSDIS)</li>
        <li>Evacuation orders and alerts: Government of British Columbia (Open Government Licence – British Columbia) and Alert Ready (Pelmorex NAAD)</li>
        <li>Street-level smoke: PurpleAir community sensors</li>
        <li>Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0)</li>
        <li>Native status: VASCAN, Database of Vascular Plants of Canada (via GBIF)</li>
        <li>Plant identification: Microsoft Azure AI and <a href="https://plantnet.org/" target="_blank" rel="noreferrer">Pl@ntNet</a></li>
        <li>Home checklist: based on <a href="https://firesmartcanada.ca/" target="_blank" rel="noreferrer">FireSmart Canada</a> guidance</li>
        <li>Maps: Microsoft Azure Maps, © TomTom</li>
      </ul>

      <p className="muted">How we handle your data is in the <Link href="/privacy">privacy policy</Link>.</p>
    </main>
  );
}
