export type Language = 'en' | 'zh';
export type TextDifficulty = 'short' | 'medium' | 'long';

// English pools — sentences bucketed by rough word count:
//   short  ~5–8 words
//   medium ~10–15 words
//   long   ~18–25 words
const englishShort: string[] = [
  'The old bell rang once.',
  'She closed her book quietly.',
  'He walked home in the rain.',
  'A candle flickered on the windowsill.',
  'The cat curled up beside her.',
  'Steam rose from the black kettle.',
  'He unlocked the small wooden gate.',
  'A warm breeze stirred the curtains.',
  'The letter arrived early on Monday.',
  'She waved at the passing boat.',
];

const englishMedium: string[] = [
  'The quick morning light spread across the quiet valley below.',
  'She packed her bag and walked toward the waiting train.',
  'Rain tapped softly on the window while the kettle began to whistle.',
  'He picked up a smooth stone and skipped it across the calm lake.',
  'The old library smelled of paper and rain and warm wood.',
  'A single lantern glowed at the end of the narrow cobblestone street.',
  'They shared a quiet laugh over coffee before the meeting started.',
  'The clock in the hallway ticked louder as midnight drew nearer.',
  'Small waves rolled onto the sand and pulled back into the sea.',
  'A curious cat watched the birds from the top of the fence.',
  'He wrote three pages before the sun had even fully risen.',
  'She traced the map with her finger and chose a longer route.',
];

const englishLong: string[] = [
  'The old lighthouse stood at the edge of the cliff, sending its steady beam out across the dark and restless sea below.',
  'She spent the long afternoon reading in the quiet corner of the small cafe while rain streaked the tall front windows.',
  'The market at the harbor came alive at dawn with vendors calling out prices and gulls circling above the wooden crates of fish.',
  'He climbed the narrow path up the hillside, pausing every few minutes to catch his breath and glance back at the shrinking village.',
  'The old typewriter on his desk had traveled with him across three countries and countless small apartments over the past twenty years.',
  'A soft golden light filled the kitchen as she set the table for two and waited patiently for the sound of his key.',
  'They spent the entire evening walking along the quiet river path, talking about old friends and the small choices that had shaped them.',
  'The bookshop on the corner had a curious front window that changed every week according to the mood of the elderly owner inside.',
  'He stared at the blank page for almost an hour before writing a single careful sentence and then reading it back to himself twice.',
  'The train wound slowly through the valley, passing tiny farms and church spires while the passengers dozed in the warm afternoon sunlight.',
];

// Chinese pools — sentences bucketed by rough character count (excluding punctuation):
//   short  ~8–12 chars
//   medium ~15–22 chars
//   long   ~25–40 chars
const chineseShort: string[] = [
  '夜里悄悄下起了小雨。',
  '阳光透过树叶洒下来。',
  '咖啡的香气很好闻。',
  '她轻轻合上了书本。',
  '远处传来鸟儿的叫声。',
  '湖面泛起层层涟漪。',
  '小猫蜷缩在沙发上睡着了。',
  '月光洒满了整个花园。',
  '他在窗边静静地坐着。',
  '秋风吹落了满地的黄叶。',
];

const chineseMedium: string[] = [
  '清晨的阳光洒在窗台上,一切都显得那么安静。',
  '她在书店里翻阅一本厚厚的旅行地图。',
  '天空慢慢暗了下来,远处的山影渐渐模糊。',
  '咖啡的香气弥漫在整个房间里,让人感到放松。',
  '他站在阳台上,望着远方缓缓飞过的鸟群。',
  '图书馆里很安静,只有翻书的沙沙声。',
  '雨点轻轻敲打玻璃窗,像是在诉说什么。',
  '街角的小店开着门,飘出淡淡的面包香气。',
  '她把行李箱打开,认真地整理里面的衣物。',
  '微风吹过树梢,树叶发出细碎的响声。',
  '他打开笔记本,认真地写下今天的想法。',
  '桌上的花瓶里插着几支白色的雏菊。',
];

const chineseLong: string[] = [
  '老式的座钟在走廊尽头敲响了午夜十二下,屋里的每个人都抬头望向那口钟。',
  '清晨的湖面泛着淡淡的金色光芒,几只白色的水鸟贴着水面缓缓飞过,留下一串小小的涟漪。',
  '秋日的午后,他一个人坐在公园的长椅上,看着落叶被风吹得打着旋儿飘向远处的湖边。',
  '深夜的书房里只亮着一盏台灯,他伏在书桌前写着信,窗外偶尔传来几声犬吠。',
  '老街的青石板路被昨夜的雨水冲刷得干干净净,店家们陆续拉开卷帘门开始新的一天。',
  '小城的黄昏总是来得格外温柔,晚风带着桂花的甜香拂过每一条安静的巷子。',
  '山间的小屋前搭着一个葡萄架,夏天的傍晚坐在架下喝茶总能听见远处的溪水声。',
  '他从阁楼里翻出一只旧木箱,里面装着几本发黄的日记和一张早已褪色的黑白照片。',
  '海边的木屋在夕阳下泛着淡淡的橙色,远处的渔船正一艘艘慢慢驶回宁静的港湾。',
  '春天的午后阳光正好,她坐在阳台上一边翻着书一边听着邻居家传来的钢琴声。',
];

export const texts: Record<Language, Record<TextDifficulty, string[]>> = {
  en: {
    short: englishShort,
    medium: englishMedium,
    long: englishLong,
  },
  zh: {
    short: chineseShort,
    medium: chineseMedium,
    long: chineseLong,
  },
};

// `difficulty` defaults to 'medium' so single-player callers that only pass
// `lang` continue to behave exactly as before (their existing medium-length
// pool is preserved verbatim).
export function getRandomText(
  lang: Language,
  difficulty: TextDifficulty = 'medium',
  exclude?: string,
): string {
  const bucket = texts[lang][difficulty];
  const pool =
    exclude !== undefined ? bucket.filter((t) => t !== exclude) : bucket;
  // Guard against a degenerate pool (shouldn't happen with min-10 entries per
  // bucket) — fall back to the full bucket rather than crashing on []-index.
  const source = pool.length > 0 ? pool : bucket;
  const idx = Math.floor(Math.random() * source.length);
  return source[idx];
}
