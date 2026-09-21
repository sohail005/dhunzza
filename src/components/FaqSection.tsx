const faqs = [
  {
    question: "What is Dhunzza?",
    answer:
      "Dhunzza is a free ambient Hindi radio website that recreates the sound of an old shop radio — nonstop, timeless Hindi songs, shuffled and playing all day.",
  },
  {
    question: "Is Dhunzza free to use?",
    answer:
      "Yes. Dhunzza streams entirely for free in your browser, with no sign-up required, on both desktop and mobile.",
  },
  {
    question: "What kind of music plays on Dhunzza?",
    answer: "Old, evergreen Hindi songs organised into categories, so you can pick whatever fits the moment.",
  },
  {
    question: "What happens when I tap \"Tune In\"?",
    answer: "It starts a shuffled mix of every song on the site — no setup needed.",
  },
  {
    question: "Can I pick a specific category or playlist?",
    answer:
      "Yes. Use the Category button to pick a specific vibe, or the All Songs button to shuffle every song on the site.",
  },
];

export default function FaqSection() {
  return (
    <section
      id="faq"
      className="relative border-t border-white/5 bg-transparent px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-2xl">
        <p className="mb-3 text-center text-[14px] font-semibold tracking-[0.3em] text-amber-400 uppercase">
          FAQ
        </p>
        <h2 className="mb-10 text-center font-[family-name:var(--font-devanagari)] text-[32px] text-white sm:text-[38px]">
          Dhunzza, Explained
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              className="faq-item liquid-glass rounded-xl bg-white/5 p-4 hover:bg-white/10 sm:p-5"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium text-white sm:text-[18px]">
                {faq.question}
                <svg
                  className="faq-chevron h-4 w-4 shrink-0 text-amber-400 transition-transform"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="mt-3 text-[16px] leading-relaxed text-white/60">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
