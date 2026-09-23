// Cycled by a hash of a name so the same name always gets the same color for
// the length of a page visit, and different people are visually
// distinguishable at a glance — shared by every place a username/sender name
// is rendered in the chat (community feed, pinned announcements, etc).
const NAME_COLORS = [
  "text-accent",
  "text-pink-400",
  "text-purple-400",
  "text-teal-400",
  "text-sky-400",
  "text-emerald-400",
  "text-rose-400",
  "text-lime-400",
];

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}
