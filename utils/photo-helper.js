/* === 照片图标处理工具（从 index.js 抽离） === */
const PHOTO_STACK_SIZE = 80;
const PHOTO_STACK_DPR = 2;
const PHOTO_STACK_CARDS = [
  { x: 10, y: 16, size: 42, rotate: -11 },
  { x: 24, y: 11, size: 42, rotate: 9 },
  { x: 17, y: 22, size: 46, rotate: -4 },
  { x: 26, y: 26, size: 42, rotate: 6 }
];
const PHOTO_BUBBLE_SIZE = 70;
const PHOTO_BUBBLE_DPR = 2;

/* --- 纯工具函数 --- */

/** 获取记录的首张照片 */
function getRecordPhoto(record) {
  const images = record && record.images ? record.images : [];
  return images && images.length ? images[0] : "";
}

/** 获取记录的照片列表（最多4张） */
function getRecordPhotos(record) {
  const images = record && record.images ? record.images : [];
  return (images || []).filter(Boolean).slice(0, 4);
}

/** 绘制圆角矩形路径 */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* --- 异步照片加载和缓存 --- */

/** 下载单张照片到本地临时路径（带缓存） */
function getPhotoIconPath(cacheRef, src, fallback) {
  if (!src) return Promise.resolve(fallback);
  cacheRef.photoIconCache = cacheRef.photoIconCache || {};
  if (cacheRef.photoIconCache[src]) return Promise.resolve(cacheRef.photoIconCache[src]);

  if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) {
    return new Promise((resolve) => {
      wx.getImageInfo({
        src,
        success: (res) => {
          cacheRef.photoIconCache[src] = res.path || fallback;
          resolve(cacheRef.photoIconCache[src]);
        },
        fail: () => {
          cacheRef.photoIconCache[src] = fallback;
          resolve(fallback);
        }
      });
    });
  }

  if (src.indexOf("cloud://") !== 0) {
    cacheRef.photoIconCache[src] = src;
    return Promise.resolve(src);
  }

  return wx.cloud.downloadFile({ fileID: src }).then((res) => {
    cacheRef.photoIconCache[src] = res.tempFilePath || fallback;
    return cacheRef.photoIconCache[src];
  }).catch(() => {
    cacheRef.photoIconCache[src] = fallback;
    return fallback;
  });
}

/* --- 独立图标路径获取 --- */

/** 单张照片快速图标 */
function getFastRecordPhotoIconPath(cacheRef, photo, fallback) {
  return getPhotoIconPath(cacheRef, photo, fallback);
}

/* --- 照片组图标（省份标记用） --- */

/** 根据多张照片决定使用叠放或气泡图标 */
function getProvinceRecordIconPath(cacheRef, photos, fallback) {
  const list = (photos || []).filter(Boolean).slice(0, 4);
  if (!list.length) return Promise.resolve(fallback);
  if (list.length === 1) {
    return getPhotoBubbleIconPath(cacheRef, list[0], fallback);
  }
  return getPhotoStackIconPath(cacheRef, list, list[0] || fallback);
}

/* --- 照片叠放图标 --- */

function getPhotoStackIconPath(cacheRef, photos, fallback) {
  const list = (photos || []).slice(0, 4);
  if (!list.length) return Promise.resolve(fallback);
  cacheRef.photoStackCache = cacheRef.photoStackCache || {};
  const key = list.join("|");
  if (cacheRef.photoStackCache[key]) return Promise.resolve(cacheRef.photoStackCache[key]);

  return Promise.all(list.map((p) => getPhotoIconPath(cacheRef, p, "")))
    .then((paths) => {
      const valid = paths.filter(Boolean);
      if (!valid.length) return fallback;
      return composePhotoStack(valid).then((tempPath) => {
        cacheRef.photoStackCache[key] = tempPath || fallback;
        return cacheRef.photoStackCache[key];
      }).catch(() => {
        const result = valid[0] || fallback;
        cacheRef.photoStackCache[key] = result;
        return result;
      });
    })
    .catch(() => {
      cacheRef.photoStackCache[key] = fallback;
      return fallback;
    });
}

/* --- 照片气泡图标 --- */

function getPhotoBubbleIconPath(cacheRef, photo, fallback) {
  if (!photo) return Promise.resolve(fallback);
  cacheRef.photoBubbleCache = cacheRef.photoBubbleCache || {};
  if (cacheRef.photoBubbleCache[photo]) return Promise.resolve(cacheRef.photoBubbleCache[photo]);

  return getPhotoIconPath(cacheRef, photo, "").then((photoPath) => {
    if (!photoPath) return fallback;
    return composePhotoBubble(photoPath).then((tempPath) => {
      cacheRef.photoBubbleCache[photo] = tempPath || fallback;
      return cacheRef.photoBubbleCache[photo];
    }).catch(() => {
      cacheRef.photoBubbleCache[photo] = fallback;
      return fallback;
    });
  }).catch(() => {
    cacheRef.photoBubbleCache[photo] = fallback;
    return fallback;
  });
}

/* --- Canvas 合成 --- */

function composePhotoBubble(photoPath) {
  return new Promise((resolve) => {
    if (!wx.createOffscreenCanvas) { resolve(photoPath || ""); return; }
    try {
      const canvas = wx.createOffscreenCanvas({
        type: "2d",
        width: PHOTO_BUBBLE_SIZE * PHOTO_BUBBLE_DPR,
        height: PHOTO_BUBBLE_SIZE * PHOTO_BUBBLE_DPR
      });
      const ctx = canvas.getContext("2d");
      ctx.scale(PHOTO_BUBBLE_DPR, PHOTO_BUBBLE_DPR);
      ctx.clearRect(0, 0, PHOTO_BUBBLE_SIZE, PHOTO_BUBBLE_SIZE);
      const image = canvas.createImage();
      image.onload = () => {
        drawBubbleCard(ctx, image);
        wx.canvasToTempFilePath({
          canvas,
          x: 0, y: 0,
          width: PHOTO_BUBBLE_SIZE * PHOTO_BUBBLE_DPR,
          height: PHOTO_BUBBLE_SIZE * PHOTO_BUBBLE_DPR,
          destWidth: PHOTO_BUBBLE_SIZE * PHOTO_BUBBLE_DPR,
          destHeight: PHOTO_BUBBLE_SIZE * PHOTO_BUBBLE_DPR,
          success: (res) => resolve(res.tempFilePath),
          fail: () => resolve(photoPath || "")
        });
      };
      image.onerror = () => resolve(photoPath || "");
      image.src = photoPath;
    } catch (error) {
      resolve(photoPath || "");
    }
  });
}

function drawBubbleCard(ctx, image) {
  const x = 8, y = 5, w = 54, h = 54, r = 14;
  ctx.save();
  ctx.shadowColor = "rgba(37,31,26,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.moveTo(30, y + h - 1);
  ctx.lineTo(35, y + h + 8);
  ctx.lineTo(41, y + h - 1);
  ctx.closePath();
  ctx.fillStyle = "#fffaf2";
  ctx.fill();
  ctx.shadowColor = "transparent";
  roundRectPath(ctx, x + 4, y + 4, w - 8, h - 8, 10);
  ctx.clip();
  ctx.drawImage(image, x + 4, y + 4, w - 8, h - 8);
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.moveTo(30, y + h - 1);
  ctx.lineTo(35, y + h + 8);
  ctx.lineTo(41, y + h - 1);
  ctx.closePath();
  ctx.strokeStyle = "rgba(37,31,26,0.18)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function composePhotoStack(paths) {
  return new Promise((resolve) => {
    if (!wx.createOffscreenCanvas) { resolve(paths[0] || ""); return; }
    try {
      const canvas = wx.createOffscreenCanvas({
        type: "2d",
        width: PHOTO_STACK_SIZE * PHOTO_STACK_DPR,
        height: PHOTO_STACK_SIZE * PHOTO_STACK_DPR
      });
      const ctx = canvas.getContext("2d");
      ctx.scale(PHOTO_STACK_DPR, PHOTO_STACK_DPR);
      ctx.clearRect(0, 0, PHOTO_STACK_SIZE, PHOTO_STACK_SIZE);
      ctx.shadowColor = "rgba(37,31,26,0.28)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      const cards = paths.slice(0, 4);
      let drawnCount = 0;
      const drawNext = (index) => {
        if (index >= cards.length) {
          if (!drawnCount) { resolve(paths[0] || ""); return; }
          wx.canvasToTempFilePath({
            canvas,
            x: 0, y: 0,
            width: PHOTO_STACK_SIZE * PHOTO_STACK_DPR,
            height: PHOTO_STACK_SIZE * PHOTO_STACK_DPR,
            destWidth: PHOTO_STACK_SIZE * PHOTO_STACK_DPR,
            destHeight: PHOTO_STACK_SIZE * PHOTO_STACK_DPR,
            success: (res) => resolve(res.tempFilePath),
            fail: () => resolve(paths[0] || "")
          });
          return;
        }
        const image = canvas.createImage();
        image.onload = () => {
          const card = PHOTO_STACK_CARDS[Math.min(index, PHOTO_STACK_CARDS.length - 1)];
          drawStackCard(ctx, image, card);
          drawnCount += 1;
          drawNext(index + 1);
        };
        image.onerror = () => drawNext(index + 1);
        image.src = cards[index];
      };
      drawNext(0);
    } catch (error) {
      resolve(paths[0] || "");
    }
  });
}

function drawStackCard(ctx, image, card) {
  const cx = card.x + card.size / 2;
  const cy = card.y + card.size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(card.rotate * Math.PI / 180);
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(-card.size / 2 - 3, -card.size / 2 - 3, card.size + 6, card.size + 6);
  ctx.drawImage(image, -card.size / 2, -card.size / 2, card.size, card.size);
  ctx.strokeStyle = "rgba(37,31,26,0.18)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-card.size / 2 - 3, -card.size / 2 - 3, card.size + 6, card.size + 6);
  ctx.restore();
}

module.exports = {
  getRecordPhoto,
  getRecordPhotos,
  getPhotoIconPath,
  getFastRecordPhotoIconPath,
  getProvinceRecordIconPath,
  getPhotoStackIconPath,
  getPhotoBubbleIconPath,
  composePhotoStack,
  composePhotoBubble,
  drawBubbleCard,
  drawStackCard,
  roundRectPath,
  PHOTO_STACK_SIZE,
  PHOTO_STACK_DPR,
  PHOTO_STACK_CARDS,
  PHOTO_BUBBLE_SIZE,
  PHOTO_BUBBLE_DPR
};
