export type Language = 'en' | 'zh';

const englishTexts: string[] = [
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

const chineseTexts: string[] = [
  "清晨的阳光洒在窗台上,一切都显得那么安静。",
  "她在书店里翻阅一本厚厚的旅行地图。",
  "天空慢慢暗了下来,远处的山影渐渐模糊。",
  "咖啡的香气弥漫在整个房间里,让人感到放松。",
  "他站在阳台上,望着远方缓缓飞过的鸟群。",
  "图书馆里很安静,只有翻书的沙沙声。",
  "雨点轻轻敲打玻璃窗,像是在诉说什么。",
  "街角的小店开着门,飘出淡淡的面包香气。",
  "她把行李箱打开,认真地整理里面的衣物。",
  "微风吹过树梢,树叶发出细碎的响声。",
  "深夜的公路上,只有远处偶尔驶过的车辆。",
  "他打开笔记本,认真地写下今天的想法。",
  "湖水在月光下泛着淡淡的银色光芒。",
  "桌上的花瓶里插着几支白色的雏菊。",
  "老人坐在长椅上,慢慢地读着手中的报纸。",
  "早晨的公园里,人们在跑步或者散步。",
  "窗外的雪静静落下,给街道披上一层白色。",
  "火车缓缓驶入车站,月台上响起熟悉的广播。",
  "她一边听着音乐一边整理书桌上的文件。",
  "傍晚的天空呈现出淡淡的粉紫色。",
];

export const texts: Record<Language, string[]> = {
  en: englishTexts,
  zh: chineseTexts,
};

export function getRandomText(lang: Language, exclude?: string): string {
  const pool = exclude
    ? texts[lang].filter((t) => t !== exclude)
    : texts[lang];
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
