import { Clock, Infinity as InfinityIcon, Radio } from "lucide-react";

const features = [
  {
    icon: Radio,
    title: "Timeless Hindi Radio",
    description:
      "A curated stream of old, evergreen Hindi songs that never really left our playlists — tuned to keep playing in the background all day.",
  },
  {
    icon: Clock,
    title: "Shuffled All Day",
    description:
      "Tap in and every song on the site shuffles into a nonstop mix — or pick a category if you want a specific vibe.",
  },
  {
    icon: InfinityIcon,
    title: "Always Open",
    description:
      "Desi Mahol is free, streams straight from your browser, and never closes — no sign-up, no app.",
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="relative bg-transparent px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-[14px] font-semibold tracking-[0.3em] text-amber-400 uppercase">
          Welcome to
        </p>
        <h2 className="font-[family-name:var(--font-devanagari)] text-[32px] text-white sm:text-[50px]">
          Desi Mahol — the Mood of Old Songs
        </h2>
        <p className="mt-6 text-[16px] leading-relaxed text-white/70 sm:text-[18px]">
          Desi Mahol is a free ambient Hindi radio built to recreate one very specific
          feeling: an old shop radio left on in the background, playing timeless Hindi
          songs while the day goes by. Press play, and Desi Mahol streams a nonstop,
          shuffled mix of old Bollywood nostalgia.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-3 sm:gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="liquid-glass rounded-2xl bg-white/5 p-6 text-left hover:bg-white/10"
          >
            <div
              className="liquid-glass mb-4 flex h-10 w-10 items-center justify-center rounded-full border-amber-500/30"
              aria-hidden="true"
            >
              <feature.icon className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="mb-2 text-[18px] font-semibold text-white">{feature.title}</h3>
            <p className="text-[16px] leading-relaxed text-white/60">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
