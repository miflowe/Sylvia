"use client";
import { useState } from "react";
import { ASK_MAX_CHARS, ASK_SUGGESTIONS, type Place } from "@sylvia/core";
import { Icon } from "@/components/Icon";
import { withDevice } from "@/lib/device";
import styles from "./home.module.css";

interface Answer {
  question: string;
  answer: string;
  used: { name: string; url: string; observedAt?: string }[];
}

const short = (name: string) => name.match(/\(([^)]+)\)\s*$/)?.[1] ?? name;

/** A question box under Sylvia's summary. Answers come only from the live readings for this home. */
export function AskSylvia({ place, sensitive }: { place: Place; sensitive: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        "/api/ask",
        await withDevice({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: text, lat: place.lat, lon: place.lon, name: place.name, region: place.regionCode, sensitive }),
        }),
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setAnswer({ question: text, answer: body.answer, used: body.used });
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "I couldn't answer just now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.ask} aria-labelledby="ask-title">
      <h2 id="ask-title" className={styles.askTitle}>Ask Sylvia</h2>
      <form
        className={styles.askForm}
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          className={styles.askInput}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={ASK_MAX_CHARS}
          placeholder="Ask about smoke, fire or air today"
          aria-label="Your question for Sylvia"
          enterKeyHint="send"
        />
        <button type="submit" className={styles.askSend} disabled={busy || !question.trim()} aria-label="Ask">
          <Icon name="chevronRight" size={20} />
        </button>
      </form>
      {!answer && !busy && (
        <div className={styles.askChips}>
          {ASK_SUGGESTIONS.map((s) => (
            <button key={s} type="button" className={styles.askChip} onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite">
        {busy && <p className="muted">Checking the latest readings…</p>}
        {error && <p className="muted">{error}</p>}
        {answer && !busy && (
          <div className={styles.askAnswer}>
            <p className={styles.askQuestion}>{answer.question}</p>
            <p>{answer.answer}</p>
            {answer.used.length > 0 && <p className={styles.askUsed}>Readings checked: {answer.used.map((u) => short(u.name)).join(", ")}</p>}
          </div>
        )}
      </div>
      <p className={styles.askNote}>Answers use live readings for {place.name} and can be wrong. In an emergency, follow official alerts and call 911.</p>
    </section>
  );
}
