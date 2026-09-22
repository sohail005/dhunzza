import { z } from "zod";

const SONG_NAME_MIN = 2;
const SONG_NAME_MAX = 150;
const REQUESTER_NAME_MIN = 2;
const REQUESTER_NAME_MAX = 60;

// Blocks HTML/script-like payloads. React already escapes everything it
// renders, but request text also flows into the admin dashboard and
// duplicate-detection index, so we reject it up front rather than merely
// neutralizing it.
const HAS_HTML_LIKE_CHARS = /[<>{}\\]/u;
// C0/C1 control characters and Unicode bidi-override characters (used to
// spoof displayed text) have no place in a song title or display name.
const HAS_CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u001F\\u007F-\\u009F\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]",
  "u"
);
// More than 8 identical characters in a row is spam, not a real title/name.
const HAS_EXCESSIVE_REPEATS = /(.)\1{8,}/u;

function isClean(value: string): boolean {
  return (
    !HAS_HTML_LIKE_CHARS.test(value) &&
    !HAS_CONTROL_CHARS.test(value) &&
    !HAS_EXCESSIVE_REPEATS.test(value)
  );
}

export const songNameSchema = z
  .string()
  .trim()
  .min(SONG_NAME_MIN, `Song name must be at least ${SONG_NAME_MIN} characters.`)
  .max(SONG_NAME_MAX, `Song name must be under ${SONG_NAME_MAX} characters.`)
  .refine(isClean, "Song name contains characters that aren't allowed.");

export const requesterNameSchema = z
  .string()
  .trim()
  .min(REQUESTER_NAME_MIN, `Name must be at least ${REQUESTER_NAME_MIN} characters.`)
  .max(REQUESTER_NAME_MAX, `Name must be under ${REQUESTER_NAME_MAX} characters.`)
  .refine(isClean, "Name contains characters that aren't allowed.");

export const songRequestSchema = z.object({
  songName: songNameSchema,
  requesterName: requesterNameSchema,
});

export type SongRequestPayload = z.infer<typeof songRequestSchema>;

/** Collapses internal whitespace and lowercases for duplicate detection.
 * The original, user-formatted songName is kept separately for display. */
export function normalizeSongName(songName: string): string {
  return songName.trim().toLowerCase().replace(/\s+/g, " ");
}
