export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-primary p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-text-secondary text-sm">
        <p>Last updated: April 10, 2026</p>
        <p>
          Pawen Command Center (&quot;we&quot;, &quot;our&quot;) operates the pawen-command-center.vercel.app website.
          This page informs you of our policies regarding the collection, use, and disclosure of personal data.
        </p>
        <h2 className="text-lg font-semibold text-text-primary mt-6">Data Collection</h2>
        <p>We collect only the data necessary to provide our service: account credentials and project data stored locally in your browser.</p>
        <h2 className="text-lg font-semibold text-text-primary mt-6">Third-Party Services</h2>
        <p>We use Meta Ad Library API, Anthropic Claude API, and fal.ai for ad scraping, translation, and image generation. Data sent to these services is processed according to their respective privacy policies.</p>
        <h2 className="text-lg font-semibold text-text-primary mt-6">Data Deletion</h2>
        <p>You can delete all your data at any time by clearing your browser storage. For server-side data deletion requests, contact us at wailkhamlichipro@gmail.com.</p>
        <h2 className="text-lg font-semibold text-text-primary mt-6">Contact</h2>
        <p>For privacy concerns, contact: wailkhamlichipro@gmail.com</p>
      </div>
    </div>
  );
}
