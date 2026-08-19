export const englishTexts: string[] = [
  "The quick morning light spread across the quiet valley below.",
  "She packed her bag and walked toward the waiting train.",
  "Rain tapped softly on the window while the kettle began to whistle.",
  "He picked up a smooth stone and skipped it across the calm lake.",
  "The old library smelled of paper and rain and warm wood.",
  "A single lantern glowed at the end of the narrow cobblestone street.",
  "They shared a quiet laugh over coffee before the meeting started.",
  "The clock in the hallway ticked louder as midnight drew nearer.",
  "Small waves rolled onto the sand and pulled back into the sea.",
  "A curious cat watched the birds from the top of the fence.",
  "He wrote three pages before the sun had even fully risen.",
  "The wind carried the scent of pine down from the higher slopes.",
  "She traced the map with her finger and chose a longer route.",
  "A cup of tea always tasted better on a slow rainy afternoon.",
  "The bakery opened its doors and warm bread scented the whole street.",
  "He stopped mid step to listen for the sound again in the trees.",
  "Bright yellow leaves gathered around the base of the tall oak tree.",
  "The bridge creaked gently as she stepped across the wooden planks.",
  "A soft melody drifted from the piano in the next quiet room.",
  "He unfolded the note carefully and read it twice before smiling.",
];

export function getRandomText(exclude?: string): string {
  const pool = exclude
    ? englishTexts.filter((t) => t !== exclude)
    : englishTexts;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
