/* Question specs for the two chat questionnaires.
 *
 * DESIGN RULE: enumerate wherever a fixed set is honest, free-text only where
 * the answer is genuinely open. Free text is expensive to analyse and people
 * write less of it than you hope; a `company_size` of "11-50" is worth more
 * than "we're a smallish team" no matter how charming the latter reads.
 *
 * ⚠ SCOPE: market intent only. No health, financial, or otherwise sensitive
 * data is requested here, and none should be added. "Industry: Healthcare" is
 * a market segment; anything about a patient is not, and does not belong on a
 * public form.
 *
 * Question types:
 *   text      single-line free text
 *   email     text + shape validation
 *   choice    one of `options` (rendered as a select)
 *   multi     any of `options` (rendered as toggle chips)
 *   longtext  free text, the few places it earns its keep
 */

const DOMAINS = [
  "Agent mesh (A2A)", "Travel", "Trading", "Healthcare", "Drug design",
  "Call centre", "SRE / platform", "Security & compliance", "Quantum", "Other",
];

window.NOETL_FORMS = {
  /* ── waitlist ──────────────────────────────────────────────────────── */
  waitlist: {
    endpoint: "/api/waitlist",
    /* Name and email come first so a drop-off still leaves a contactable
       lead. See the partial-save note in app.js. */
    questions: [
      { key: "name", type: "text", q: "NoETL opens in January 2027. What should we call you?",
        placeholder: "Your name",
        validate: v => v.trim().length >= 1 || "A name, or anything you'd like to be called." },

      { key: "email", type: "email", q: "Where should we send the launch note?",
        placeholder: "you@company.com",
        validate: v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) || "That doesn't look like an email address." },

      { key: "role", type: "choice", q: "What's your role?",
        options: ["Engineer / developer", "Engineering lead / manager", "Architect",
                  "Data / ML", "SRE / platform / ops", "Product", "Founder / exec",
                  "Analyst / researcher", "Other"] },

      { key: "company", type: "text", q: "Company or team? Optional, say 'skip' to pass.",
        placeholder: "Optional", optional: true },

      { key: "company_size", type: "choice", q: "How big is the organisation?",
        options: ["Solo", "2 to 10", "11 to 50", "51 to 200", "200+"] },

      { key: "industry", type: "choice", q: "Which industry is that in?",
        options: ["Software / SaaS", "Financial services", "Healthcare / life sciences",
                  "Travel / hospitality", "Telecom / contact centre", "Manufacturing / IoT",
                  "Energy / utilities", "Retail / e-commerce", "Public sector",
                  "Research / academia", "Other"] },

      { key: "domains", type: "multi", q: "Which of the showcases matter to you? Pick any that apply.",
        options: DOMAINS,
        validate: v => v.length > 0 || "Pick at least one, or choose Other." },

      { key: "use_case", type: "longtext",
        q: "What would you point NoETL at first? The more concrete, the more it shapes what we build.",
        placeholder: "e.g. nightly reconciliation across three systems, with replayable audit",
        validate: v => v.trim().length >= 5 || "A sentence is plenty. It genuinely drives prioritisation." },

      { key: "stack", type: "text",
        q: "What would it integrate with, or replace? Tools, languages, schedulers, anything.",
        placeholder: "e.g. Airflow, dbt, Postgres, Kafka, custom Python",
        optional: true },

      { key: "scale", type: "choice", q: "Roughly what volume? Executions, signals or events per day.",
        options: ["Under 100 / day", "100 to 10k / day", "10k to 1M / day", "Over 1M / day", "Not sure yet"] },

      { key: "timeline", type: "choice", q: "Where are you in the process?",
        options: ["Evaluating now", "This quarter", "Next 6 months", "Just exploring"] },

      { key: "hosting", type: "choice", q: "Self-hosted or managed?",
        options: ["Self-hosted", "Managed / cloud", "Either works", "Not sure yet"] },

      { key: "source", type: "choice", q: "Last one. How did you hear about NoETL?",
        options: ["GitHub", "Search", "Social / X / LinkedIn", "Word of mouth",
                  "Conference / talk", "Newsletter / blog", "Other"] },
    ],
    done: id => [
      "You're on the list. Your reference is " + id + ". We'll email you when NoETL opens in January 2027.",
      "Thanks for the detail; the domain, scale and timeline answers are what actually drive what gets built first.",
    ],
  },

  /* ── feedback ──────────────────────────────────────────────────────── */
  feedback: {
    endpoint: "/api/feedback",
    questions: [
      { key: "resonated", type: "choice", q: "Which showcase landed best for you?",
        options: DOMAINS.concat(["None of them"]) },

      { key: "missing", type: "longtext",
        q: "What's missing? Concretely, what would have to be true for you to adopt this?",
        placeholder: "e.g. a managed control plane, an Airflow migration path, SOC 2",
        validate: v => v.trim().length >= 5 || "Even a short specific answer beats a long vague one." },

      { key: "willingness_to_pay", type: "choice",
        q: "If it did exactly that, what would it plausibly be worth to your team?",
        options: ["Open source only, wouldn't pay", "Under $100 / month", "$100 to $1k / month",
                  "$1k to $10k / month", "Over $10k / month", "Depends entirely on scope",
                  "Rather not say"] },

      { key: "comment", type: "longtext", q: "Anything else? Optional, say 'skip' to pass.",
        placeholder: "Optional", optional: true },

      { key: "email", type: "text", q: "Email, only if you'd like a reply. Otherwise say 'skip'.",
        placeholder: "Optional",
        optional: true,
        validate: v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) || "That doesn't look like an email address." },
    ],
    done: id => [
      "Noted, saved as " + id + ". Thank you; the 'what's missing' answers get read properly, not aggregated away.",
    ],
  },
};
