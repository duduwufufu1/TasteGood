/* === profile 页数据处理工具 === */

const WORDS = ["好吃","推荐","必吃","惊喜","舒服","新鲜","香","辣","甜","咸","酸","脆","嫩","鲜","浓郁","清爽","满足","治愈","精致","实惠","性价比","环境","服务","排队","朋友","家人","下次","踩雷","一般","失望"];

const CLOUD_POSITIONS = [
  {left:210,top:132,rotate:0},{left:86,top:92,rotate:-8},{left:356,top:92,rotate:8},
  {left:142,top:204,rotate:6},{left:334,top:202,rotate:-7},{left:46,top:174,rotate:12},
  {left:464,top:166,rotate:-12},{left:236,top:56,rotate:7},{left:246,top:268,rotate:-6},
  {left:38,top:46,rotate:0},{left:476,top:48,rotate:0},{left:82,top:276,rotate:-10},
  {left:444,top:280,rotate:10},{left:188,top:12,rotate:-6},{left:360,top:20,rotate:6},
  {left:18,top:230,rotate:7},{left:534,top:226,rotate:-7},{left:300,top:318,rotate:0}
];

const CLOUD_COLORS = ["#c84632","#203c3a","#245f73","#93623b","#6f8d67","#a63d57"];

/**
 * 按城市汇总记录计数
 * @param {Array} records - 已标注 city/province 的记录列表
 * @returns {Object} { city: { city, province, count } }
 */
function buildCityMap(records) {
  const map = {};
  records.forEach((record) => {
    const city = record.city;
    if (!map[city]) {
      map[city] = { city, province: record.province, count: 0 };
    }
    map[city].count += 1;
  });
  return map;
}

/**
 * 从记录中构建词云数据
 * @param {Array} records - 已标注 city/province 的记录列表
 * @param {number} maxWords - 最多返回词数
 * @returns {Array} [{ text, count, size, left, top, rotate, color }]
 */
function buildWordCloud(records, maxWords) {
  const limit = maxWords || 18;
  const wordCount = {};
  records.forEach((record) => {
    const text = record.comment || "";
    WORDS.forEach((word) => {
      if (text.indexOf(word) !== -1) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
  });
  return Object.keys(wordCount)
    .sort((a, b) => wordCount[b] - wordCount[a])
    .slice(0, limit)
    .map((text, index) => {
      const pos = CLOUD_POSITIONS[index] || CLOUD_POSITIONS[CLOUD_POSITIONS.length - 1];
      const size = index === 0 ? 52 : (index < 3 ? 44 : (index < 7 ? 36 : (index < 12 ? 30 : 24)));
      return {
        text,
        count: wordCount[text],
        size,
        left: pos.left,
        top: pos.top,
        rotate: pos.rotate,
        color: CLOUD_COLORS[index % CLOUD_COLORS.length]
      };
    });
}

/**
 * 从记录中提取照片墙数据
 * @param {Array} records - 已标注 city/province 的记录列表
 * @param {number} maxPhotos - 最多照片数
 * @returns {Array} [{ src, recordId }]
 */
function buildPhotoWall(records, maxPhotos) {
  const limit = maxPhotos || 12;
  const photoWall = [];
  for (let i = 0; i < records.length && photoWall.length < limit; i++) {
    const record = records[i];
    const images = record.images || [];
    for (let j = 0; j < images.length && photoWall.length < limit; j++) {
      photoWall.push({ src: images[j], recordId: record._id });
    }
  }
  return photoWall;
}

module.exports = {
  buildCityMap,
  buildWordCloud,
  buildPhotoWall,
  WORDS,
  CLOUD_POSITIONS,
  CLOUD_COLORS
};
