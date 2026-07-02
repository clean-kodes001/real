import PublicLayout from "@/components/layout/PublicLayout";

export default function Terms() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-display font-bold mb-2">Terms & Conditions</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: January 1, 2025</p>
        <div className="space-y-8">
          {[
            {
              title: "1. Acceptance of Terms",
              content: "By accessing and using MyRealtor, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use our platform."
            },
            {
              title: "2. User Accounts",
              content: "You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account."
            },
            {
              title: "3. Property Listings",
              content: "Sellers are solely responsible for the accuracy of their listings. MyRealtor reserves the right to remove any listing that violates our policies. All listings must represent real, legally-owned properties."
            },
            {
              title: "4. Escrow Services",
              content: "MyRealtor's escrow service holds funds securely during transactions. Funds are only released when both parties confirm transaction completion. Disputes are handled per our dispute resolution policy."
            },
            {
              title: "5. Lawyer Services",
              content: "Lawyers listed on MyRealtor are independent professionals. MyRealtor is not responsible for legal advice given by listed lawyers. Users engage lawyers at their own discretion."
            },
            {
              title: "6. Fees and Payments",
              content: "MyRealtor charges a platform fee on completed transactions. Fee schedules are disclosed before transaction confirmation. All fees are non-refundable unless otherwise stated."
            },
            {
              title: "7. Prohibited Activities",
              content: "Users may not post fraudulent listings, engage in money laundering, harass other users, or attempt to circumvent our security measures. Violations result in immediate account termination."
            },
            {
              title: "8. Limitation of Liability",
              content: "MyRealtor shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our platform. Our total liability shall not exceed the fees paid by you in the past 12 months."
            },
            {
              title: "9. Governing Law",
              content: "These Terms shall be governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the courts of Lagos State, Nigeria."
            },
            {
              title: "10. Contact",
              content: "For legal inquiries, contact us at legal@myrealtor.ng."
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
