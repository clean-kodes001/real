import PublicLayout from "@/components/layout/PublicLayout";

export default function PrivacyPolicy() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: January 1, 2025</p>
        <div className="prose prose-sm max-w-none text-foreground space-y-8">
          {[
            {
              title: "1. Information We Collect",
              content: "We collect information you provide directly to us, such as when you create an account, list a property, or contact us. This includes your name, email address, phone number, government-issued ID for KYC, and financial information for payment processing."
            },
            {
              title: "2. How We Use Your Information",
              content: "We use the information we collect to provide, maintain, and improve our services; process transactions; send you technical notices and support messages; and respond to your comments and questions."
            },
            {
              title: "3. Information Sharing",
              content: "We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential."
            },
            {
              title: "4. KYC and Identity Verification",
              content: "For identity verification purposes, we collect government-issued identification documents. This information is processed securely and stored in encrypted form. KYC data is used solely for verification purposes and is not shared with third parties except as required by law."
            },
            {
              title: "5. Escrow and Payments",
              content: "Financial transaction data is processed through secure, encrypted channels. We retain transaction records as required by Nigerian financial regulations. Payment card information is never stored on our servers."
            },
            {
              title: "6. Data Security",
              content: "We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction."
            },
            {
              title: "7. Your Rights",
              content: "You have the right to access, update, or delete your personal information. You can do this through your account settings or by contacting us at privacy@PlotWise.ng."
            },
            {
              title: "8. Contact Us",
              content: "If you have questions about this Privacy Policy, please contact us at privacy@PlotWise.ng or write to: PlotWise Ltd, 42 Broad Street, Lagos Island, Lagos, Nigeria."
            },
          ].map(section => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold mb-2">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
