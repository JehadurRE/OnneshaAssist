import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Building, CheckCircle2, Mail, Phone, Send, User } from "lucide-react";

import { db } from "@/lib/db";

export const Route = createFileRoute("/contact-sales")({
  head: () => ({
    meta: [
      { title: "Contact Sales & Custom Plans · Onnesha Arena" },
      { name: "description", content: "Talk to our team for custom institutional plans, PO billing and support." },
    ],
  }),
  component: ContactSalesPage,
});

function ContactSalesPage() {
  const { lang } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    org: "",
    email: "",
    phone: "",
    students: "500-1000",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.recordSalesLead({
      name: formData.name,
      organization: formData.org,
      email: formData.email,
      phone: formData.phone,
      studentCount: formData.students,
      message: formData.message,
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-2xl w-full px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
            {lang === "bn" ? "কাস্টম প্ল্যান ও সেলস ইনকোয়ারি" : "Talk to our Solutions Team"}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {lang === "bn"
              ? "৫,০০০+ শিক্ষার্থী, বার্ষিক ইনভয়েস বা কাস্টম এলএমএস ইন্টিগ্রেশনের জন্য ফর্মটি পূরণ করুন।"
              : "For organizations needing high-volume capacity, institutional invoices, or custom contracts."}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-glow">
          {submitted ? (
            <div className="text-center py-8 space-y-3 animate-in zoom-in-95">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="font-display text-xl font-bold text-foreground">
                {lang === "bn" ? "ধন্যবাদ! আপনার বার্তা পৌঁছেছে" : "Thank you! Inquiry received"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {lang === "bn"
                  ? "আমাদের প্রতিনিধি ২৪ ঘণ্টার মধ্যে আপনার সাথে যোগাযোগ করবেন।"
                  : "Our solutions advisor will reach out to your organization within 24 hours."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {lang === "bn" ? "আপনার নাম *" : "Your Name *"}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Mohammad Rafiq"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {lang === "bn" ? "প্রতিষ্ঠান বা স্কুলের নাম *" : "Organization / School Name *"}
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ideal School & College / ABC Training Ltd"
                    value={formData.org}
                    onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Work Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      placeholder="name@school.edu.bd"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Contact Phone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      placeholder="01XXXXXXXXX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Expected Participants / Students Count
                </label>
                <select
                  value={formData.students}
                  onChange={(e) => setFormData({ ...formData, students: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="500-1000">500 – 1,000 students</option>
                  <option value="1000-5000">1,000 – 5,000 students</option>
                  <option value="5000+">5,000+ students (Enterprise)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Additional Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your requirements..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs sm:text-sm font-medium outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                <span>{lang === "bn" ? "ইনকোয়ারি পাঠান" : "Submit Inquiry"}</span>
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
