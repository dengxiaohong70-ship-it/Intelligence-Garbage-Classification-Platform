/**
 * 将 EcoVision（waste_classifier）输出的 category / overall 映射到四分类投放桶 ID，
 * 与 YOLOv5 前端文案（可回收 / 厨余 / 有害 / 其它）对齐。
 */
export const BUCKET_IDS = ['recyclable', 'kitchen', 'harmful', 'other'];

export const BUCKET_META = {
  recyclable: { label: '可回收物', short: '可回收', hint: '蓝色桶', color: '#2563eb' },
  kitchen: { label: '厨余垃圾', short: '厨余', hint: '绿色桶', color: '#16a34a' },
  harmful: { label: '有害垃圾', short: '有害', hint: '红色桶', color: '#dc2626' },
  other: { label: '其它垃圾', short: '其它', hint: '灰色桶', color: '#64748b' },
};

/** Eco API 中单条 detection 的 category → 投放桶 */
export function mapEcoCategoryToBucket(cat) {
  switch (cat) {
    case 'hazardous':
      return 'harmful';
    case 'wet':
      return 'kitchen';
    case 'dry':
      return 'recyclable';
    case 'unknown':
    default:
      return 'other';
  }
}

function inferFromOverall(overall) {
  if (!overall || typeof overall !== 'string') return null;
  const t = overall;
  if (/Hazardous|有害/i.test(t)) return 'harmful';
  if (/Wet|Organic|湿|厨余/i.test(t)) return 'kitchen';
  if (/Dry|Recyclable|干(?!\s*湿)|可回收/i.test(t)) return 'recyclable';
  if (/No waste|detected/i.test(t)) return null;
  if (/Mixed|Unable|unknown/i.test(t)) return 'other';
  return null;
}

/**
 * @param {Array<{ category?: string, confidence?: number }>} detections
 * @param {string} overall
 * @returns {{ bucket: string|null, topClass?: string, topConf?: number, source: string }}
 */
export function inferDominantBucket(detections, overall) {
  const rows = Array.isArray(detections) ? detections : [];
  const credible = rows.filter((d) => Number(d.confidence) > 0.2);
  if (credible.length) {
    const best = [...credible].sort((a, b) => Number(b.confidence) - Number(a.confidence))[0];
    return {
      bucket: mapEcoCategoryToBucket(best.category || 'unknown'),
      topClass: best.class_name,
      topConf: Number(best.confidence),
      source: 'detection',
    };
  }
  const fromOverall = inferFromOverall(overall);
  if (fromOverall) {
    return { bucket: fromOverall, topClass: overall, topConf: null, source: 'overall' };
  }
  return { bucket: null, topClass: null, topConf: null, source: 'none' };
}

export function bucketLabel(id) {
  return BUCKET_META[id]?.label || id || '—';
}

/** YOLOv5 / YOLOv8 识别 class_name → 四色投放桶（含 Waste-Detection 五类） */
export function mapYolo5ClassNameToBucket(name) {
  if (name == null || name === '') return 'other';
  const n = String(name).trim();
  if (n.includes('可回收')) return 'recyclable';
  if (n.includes('厨余')) return 'kitchen';
  if (n.includes('有害')) return 'harmful';
  if (n.includes('其他') || n.includes('其它')) return 'other';
  if (/glass|metal|paper|plastic|cardboard|玻璃|金属|纸张|塑料|纸板/i.test(n)) return 'recyclable';
  if (/organic|有机|厨余/i.test(n)) return 'kitchen';
  if (/medical|e-waste|电子|医疗|有害/i.test(n)) return 'harmful';
  if (/waste|一般垃圾|一般废弃/i.test(n)) return 'other';
  return 'other';
}

/**
 * @param {Array<{ class_name?: string, confidence?: number }>} results — /api/detect 的 results
 */
export function inferDominantBucketYolo5(results) {
  const rows = Array.isArray(results) ? results : [];
  const credible = rows.filter((d) => Number(d.confidence) > 0.15);
  if (!credible.length) {
    return { bucket: null, topClass: null, topConf: null, source: 'none' };
  }
  const best = [...credible].sort((a, b) => Number(b.confidence) - Number(a.confidence))[0];
  return {
    bucket: mapYolo5ClassNameToBucket(best.class_name),
    topClass: best.class_name,
    topConf: Number(best.confidence),
    source: 'yolov5',
  };
}
