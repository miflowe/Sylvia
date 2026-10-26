import { SavedScans } from "./SavedScans";

export const metadata = { title: "Profile · Sylvia" };

export default function ProfilePage() {
  return (
    <main className="screen">
      <p className="eyebrow">Profile</p>
      <h1 className="display">Your home</h1>
      <SavedScans />
    </main>
  );
}
