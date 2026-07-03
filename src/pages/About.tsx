import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import PublicLayout from "@/components/layout/PublicLayout";

const team = [
  { name: "Adebayo Okafor", role: "CEO & Co-Founder", initials: "AO" },
  { name: "Chioma Eze", role: "CTO", initials: "CE" },
  { name: "Emeka Nwosu", role: "Head of Legal", initials: "EN" },
  { name: "Fatima Al-Hassan", role: "Head of Operations", initials: "FA" },
];

const values = [
  { icon: "solar:shield-check-bold", title: "Trust & Transparency", desc: "Every transaction is verifiable, every user is KYC-verified." },
  { icon: "solar:hand-money-bold", title: "Security First", desc: "Escrow-protected funds ensure no party loses in a failed deal." },
  { icon: "solar:user-rounded-bold", title: "Client Obsession", desc: "We put buyers, sellers, and lawyers first in every decision." },
  { icon: "solar:chart-bold", title: "Innovation", desc: "Continuously improving our platform with cutting-edge technology." },
];

export default function About() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-5xl font-display font-bold mb-4">About PlotWise</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We're building Nigeria's most trusted real estate platform — where every transaction is safe, transparent, and legally protected.
          </p>
        </motion.div>

        <section className="mb-16">
          <h2 className="text-2xl font-display font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            PlotWise was founded with a single mission: to make property transactions in Nigeria safe for everyone. We've seen too many Nigerians lose money to fraudulent listings and unverified agents. By combining verified listings, secure escrow, expert legal support, and identity verification, we've built a platform where both buyers and sellers can transact with complete confidence.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-display font-bold mb-8">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="flex gap-4 p-5 rounded-2xl bg-muted">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon icon={v.icon} className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-display font-bold mb-8">Meet Our Team</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {team.map((member, i) => (
              <motion.div key={member.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg mx-auto mb-3">
                  {member.initials}
                </div>
                <p className="font-semibold text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
