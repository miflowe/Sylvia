import { SproutScanner } from "./SproutScanner";

export const metadata = { title: "Sprout · Sylvia" };

export default function SproutPage() {
  return (
    <main className="screen">
      <SproutScanner />
    </main>
  );
}
