const REGIONS = require("../../utils/regions");
const { COLLECTION } = require("../../utils/constants");
const recordRegion = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");
const app = getApp();
const DEFAULT_PROVINCE_MARKER = "/images/marker-prov.png";
const DEFAULT_RECORD_MARKER = "/images/marker-food.png";
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

Page({
  data: {
    level: "country", province: "", city: "",
    mapCenter: { lat: 35.86, lng: 104.19 },
    mapScale: 4,
    markers: [],
    markerMeta: {},
    allRecords: [],
    showPicker: false,
    pickerItems: []
  },

  onShow() {
    const selCity = app.globalData.selectCity;
    const selCenter = app.globalData.selectCenter;
    if (selCity && selCenter) {
      app.globalData.selectCity = null;
      app.globalData.selectCenter = null;
      const normalizedCity = recordRegion.normalizeCityName(selCity);
      const prov = REGIONS.provinces.find(p =>
        p.cities.some(c => c.name === normalizedCity)
      );
      this.markerBuildVersion = (this.markerBuildVersion || 0) + 1;
      this.setData({
        level: "city", province: prov ? prov.name : "", city: normalizedCity,
        mapCenter: selCenter, mapScale: 12,
        markers: [],
        markerMeta: {}
      });
      this.loadRecords();
      return;
    }
    this.loadRecords();
  },

  onReady() {
    this.mapCtx = wx.createMapContext("tasteMap", this);
    this.photoIconCache = {};
    this.photoStackCache = {};
    this.photoBubbleCache = {};
    this.markerBuildVersion = 0;
  },

  async loadRecords() {
    try {
      const res = await userRecords.getAll();
      this.setData({ allRecords: res.data || [] });
      this.updateMarkers();
    } catch(e) { console.error("load error", e); }
  },

  // 根据当前层级更新地图标记
  async updateMarkers() {
    const buildVersion = (this.markerBuildVersion || 0) + 1;
    this.markerBuildVersion = buildVersion;
    const { level, province, city, allRecords } = this.data;
    let markers = [];
    const markerMeta = {};
    const iconTasks = [];
    let nextMarkerId = 1;
    const addMarker = (type, payload, marker) => {
      const id = nextMarkerId++;
      markerMeta[id] = Object.assign({ type }, payload || {});
      const markerItem = Object.assign({ id }, marker);
      markers.push(markerItem);
      return markerItem;
    };

    if (level === "country") {
      // 全国：按省份聚合，显示该省上传图片集。
      const provMap = {};
      allRecords.forEach(r => {
        const info = recordRegion.inferRecordRegion(r);
        if (info.province !== recordRegion.UNKNOWN_PROVINCE) {
          if (!provMap[info.province]) provMap[info.province] = { count: 0, photos: [] };
          provMap[info.province].count += 1;
          const photo = this.getRecordPhoto(r);
          if (photo && provMap[info.province].photos.length < 4) {
            provMap[info.province].photos.push(photo);
          }
        }
      });
      for (const p of REGIONS.provinces) {
        const stat = provMap[p.name] || { count: 0, photos: [] };
        const cnt = stat.count || 0;
        if (cnt > 0) {
          const marker = addMarker("province", { province: p.name }, {
            latitude: p.center.lat,
            longitude: p.center.lng,
            title: p.name + " (" + cnt + ")",
            width: stat.photos.length ? 68 : 48,
            height: stat.photos.length ? 68 : 56,
            iconPath: DEFAULT_PROVINCE_MARKER,
            callout: {
              content: p.name + " · " + cnt + "家",
              color: "#2f281f",
              fontSize: 13,
              borderRadius: 8,
              bgColor: "#fffaf2",
              padding: 8,
              display: "ALWAYS"
            }
          });
          if (stat.photos.length) {
            iconTasks.push(() => this.getPhotoStackIconPath(stat.photos, DEFAULT_PROVINCE_MARKER).then((iconPath) => {
              marker.iconPath = iconPath;
            }));
          }
        }
      }
    } else if (level === "province") {
      // 省份：显示该省内每家店的实际上传图片。
      const normalizedProvince = recordRegion.normalizeProvinceName(province);
      const provRecords = allRecords.filter(r => {
        return recordRegion.inferRecordRegion(r).province === normalizedProvince;
      });
      for (const r of provRecords) {
        const info = recordRegion.inferRecordRegion(r);
        const photos = this.getRecordPhotos(r);
        const photo = photos[0] || "";
        const marker = addMarker("record", { recordId: r._id || "" }, {
          latitude: info.center.lat, longitude: info.center.lng,
          title: r.name,
          width: photos.length > 1 ? 68 : (photo ? 56 : 40),
          height: photos.length > 1 ? 68 : (photo ? 62 : 46),
          iconPath: DEFAULT_RECORD_MARKER,
          callout: {
            content: r.name,
            color: "#2f281f",
            fontSize: 12,
            borderRadius: 8,
            bgColor: "#fffaf2",
            padding: 8,
            display: "BYCLICK"
          }
        });
        if (photo) {
          iconTasks.push(() => this.getProvinceRecordIconPath(photos, DEFAULT_RECORD_MARKER).then((iconPath) => {
            marker.iconPath = iconPath;
          }));
        }
      }
    } else if (level === "city") {
      // 城市：显示该城市内所有具体记录的上传图片。
      const normalizedCity = recordRegion.normalizeCityName(city);
      const cityRecords = allRecords.filter(r => recordRegion.inferRecordRegion(r).city === normalizedCity);
      for (const r of cityRecords) {
        const info = recordRegion.inferRecordRegion(r);
        const photo = this.getRecordPhoto(r);
        const marker = addMarker("record", { recordId: r._id || "" }, {
          latitude: info.center.lat, longitude: info.center.lng,
          title: r.name,
          width: photo ? 56 : 40,
          height: photo ? 62 : 46,
          iconPath: DEFAULT_RECORD_MARKER,
          callout: {
            content: r.name,
            color: "#2f281f",
            fontSize: 12,
            borderRadius: 8,
            bgColor: "#fffaf2",
            padding: 8,
            display: "BYCLICK"
          }
        });
        if (photo) {
          iconTasks.push(() => this.getFastRecordPhotoIconPath(photo, DEFAULT_RECORD_MARKER).then((iconPath) => {
            marker.iconPath = iconPath;
          }));
        }
      }
    }
    if (buildVersion !== this.markerBuildVersion) return;
    this.setData({ markers, markerMeta });
    if (iconTasks.length) {
      this.runMarkerIconTasks(iconTasks).then(() => {
        if (buildVersion === this.markerBuildVersion) {
          this.setData({ markers: markers.slice() });
        }
      });
    }
  },

  runMarkerIconTasks(tasks) {
    const queue = tasks.slice();
    const workers = [];
    const limit = Math.min(3, queue.length);
    const runNext = () => {
      const task = queue.shift();
      if (!task) return Promise.resolve();
      return task().catch((error) => {
        console.warn("[index] marker icon task failed", error);
      }).then(runNext);
    };
    for (let i = 0; i < limit; i++) {
      workers.push(runNext());
    }
    return Promise.all(workers);
  },

  getRecordPhoto(record) {
    const images = record && record.images ? record.images : [];
    return images && images.length ? images[0] : "";
  },

  getRecordPhotos(record) {
    const images = record && record.images ? record.images : [];
    return (images || []).filter(Boolean).slice(0, 4);
  },

  async getProvinceRecordIconPath(photos, fallback) {
    const list = (photos || []).filter(Boolean).slice(0, 4);
    if (!list.length) return fallback;
    if (list.length === 1) {
      return this.getPhotoBubbleIconPath(list[0], fallback);
    }
    return this.getPhotoStackIconPath(list, list[0] || fallback);
  },

  async getFastRecordPhotoIconPath(photo, fallback) {
    return this.getPhotoIconPath(photo, fallback);
  },

  async getPhotoIconPath(src, fallback) {
    if (!src) return fallback;
    this.photoIconCache = this.photoIconCache || {};
    if (this.photoIconCache[src]) return this.photoIconCache[src];
    if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) {
      try {
        const res = await new Promise((resolve, reject) => {
          wx.getImageInfo({
            src,
            success: resolve,
            fail: reject
          });
        });
        const tempPath = res.path || fallback;
        this.photoIconCache[src] = tempPath;
        return tempPath;
      } catch (error) {
        console.warn("[index] marker remote image load failed", error);
        this.photoIconCache[src] = fallback;
        return fallback;
      }
    }
    if (src.indexOf("cloud://") !== 0) {
      this.photoIconCache[src] = src;
      return src;
    }
    try {
      const res = await wx.cloud.downloadFile({ fileID: src });
      const tempPath = res.tempFilePath || fallback;
      this.photoIconCache[src] = tempPath;
      return tempPath;
    } catch (error) {
      console.warn("[index] marker photo download failed", error);
      this.photoIconCache[src] = fallback;
      return fallback;
    }
  },

  async getPhotoStackIconPath(photos, fallback) {
    const list = (photos || []).slice(0, 4);
    if (!list.length) return fallback;
    this.photoStackCache = this.photoStackCache || {};
    const key = list.join("|");
    if (this.photoStackCache[key]) return this.photoStackCache[key];
    const paths = [];
    try {
      for (const photo of list) {
        const path = await this.getPhotoIconPath(photo, "");
        if (path) paths.push(path);
      }
      if (!paths.length) return fallback;
      const tempPath = await this.composePhotoStack(paths);
      this.photoStackCache[key] = tempPath || fallback;
      return this.photoStackCache[key];
    } catch (error) {
      console.warn("[index] compose photo stack failed", error);
      this.photoStackCache[key] = paths[0] || fallback;
      return this.photoStackCache[key];
    }
  },

  async getPhotoBubbleIconPath(photo, fallback) {
    if (!photo) return fallback;
    this.photoBubbleCache = this.photoBubbleCache || {};
    if (this.photoBubbleCache[photo]) return this.photoBubbleCache[photo];
    try {
      const photoPath = await this.getPhotoIconPath(photo, "");
      if (!photoPath) return fallback;
      const tempPath = await this.composePhotoBubble(photoPath);
      this.photoBubbleCache[photo] = tempPath || fallback;
      return this.photoBubbleCache[photo];
    } catch (error) {
      console.warn("[index] compose photo bubble failed", error);
      this.photoBubbleCache[photo] = fallback;
      return fallback;
    }
  },

  composePhotoBubble(photoPath) {
    return new Promise((resolve) => {
      if (!wx.createOffscreenCanvas) {
        resolve(photoPath || "");
        return;
      }
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
          this.drawBubbleCard(ctx, image);
          wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
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
        console.warn("[index] offscreen bubble unavailable", error);
        resolve(photoPath || "");
      }
    });
  },

  drawBubbleCard(ctx, image) {
    const x = 8;
    const y = 5;
    const w = 54;
    const h = 54;
    const r = 14;
    ctx.save();
    ctx.shadowColor = "rgba(37,31,26,0.28)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    this.roundRectPath(ctx, x, y, w, h, r);
    ctx.moveTo(30, y + h - 1);
    ctx.lineTo(35, y + h + 8);
    ctx.lineTo(41, y + h - 1);
    ctx.closePath();
    ctx.fillStyle = "#fffaf2";
    ctx.fill();
    ctx.shadowColor = "transparent";
    this.roundRectPath(ctx, x + 4, y + 4, w - 8, h - 8, 10);
    ctx.clip();
    ctx.drawImage(image, x + 4, y + 4, w - 8, h - 8);
    ctx.restore();
    ctx.save();
    this.roundRectPath(ctx, x, y, w, h, r);
    ctx.moveTo(30, y + h - 1);
    ctx.lineTo(35, y + h + 8);
    ctx.lineTo(41, y + h - 1);
    ctx.closePath();
    ctx.strokeStyle = "rgba(37,31,26,0.18)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  },

  roundRectPath(ctx, x, y, w, h, r) {
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
  },

  composePhotoStack(paths) {
    return new Promise((resolve) => {
      if (!wx.createOffscreenCanvas) {
        resolve(paths[0] || "");
        return;
      }
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
            if (!drawnCount) {
              resolve(paths[0] || "");
              return;
            }
            wx.canvasToTempFilePath({
              canvas,
              x: 0,
              y: 0,
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
            this.drawStackCard(ctx, image, card);
            drawnCount += 1;
            drawNext(index + 1);
          };
          image.onerror = () => drawNext(index + 1);
          image.src = cards[index];
        };
        drawNext(0);
      } catch (error) {
        console.warn("[index] offscreen stack unavailable", error);
        resolve(paths[0] || "");
      }
    });
  },

  drawStackCard(ctx, image, card) {
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
  },

  setMapLevel(data, callback) {
    this.ignoreNextScaleChange = true;
    const shouldClearMarkers = data.level && data.level !== this.data.level;
    if (shouldClearMarkers) {
      this.markerBuildVersion = (this.markerBuildVersion || 0) + 1;
    }
    const nextData = shouldClearMarkers ? Object.assign({}, data, {
      markers: [],
      markerMeta: {}
    }) : data;
    this.setData(nextData, () => {
      if (callback) callback();
      setTimeout(() => {
        this.ignoreNextScaleChange = false;
      }, 450);
    });
  },

  // 点击标记
  onMarkerTap(e) {
    const rawId = e.markerId !== undefined ? e.markerId : (e.detail ? e.detail.markerId : undefined);
    const meta = this.data.markerMeta[String(rawId)];
    if (!meta) return;

    if (meta.type === "record") {
      // 具体记录 → 打开详情
      if (meta.recordId) wx.navigateTo({ url: "/pages/detail/detail?id=" + meta.recordId });
    } else if (meta.type === "city") {
      // 城市标记 → 切换到该城市
      const cityName = meta.city;
      const prov = REGIONS.provinces.find(p => p.name === this.data.province);
      const city = prov ? prov.cities.find(c => c.name === cityName) : null;
      const cityInfo = recordRegion.getCityEntry(cityName);
      if (city || cityInfo) {
        this.setMapLevel({
          level: "city", city: cityName,
          mapCenter: city ? city.center : cityInfo.center, mapScale: 12
        }, () => this.updateMarkers());
      }
    } else if (meta.type === "province") {
      // 省份标记 → 切换到该省份
      const provName = meta.province;
      const prov = REGIONS.provinces.find(p => p.name === provName);
      if (prov) {
        this.setMapLevel({
          level: "province", province: provName, city: "",
          mapCenter: prov.center, mapScale: 7
        }, () => this.updateMarkers());
      }
    }
  },

  // 路径栏：返回全国
  goCountry() {
    this.setMapLevel({
      level: "country", province: "", city: "",
      mapCenter: { lat: 35.86, lng: 104.19 }, mapScale: 4
    }, () => this.updateMarkers());
  },

  // 路径栏：返回省份
  goProvince() {
    const prov = REGIONS.provinces.find(p => p.name === this.data.province);
    if (prov) {
      this.setMapLevel({
        level: "province", city: "",
        mapCenter: prov.center, mapScale: 7
      }, () => this.updateMarkers());
    }
  },

  // 显示城市选择弹窗
  showCityPicker() {
    const { province, allRecords } = this.data;
    const prov = REGIONS.provinces.find(p => p.name === province);
    if (!prov) return;
    // 统计每个城市的记录数
    const cityCount = {};
    const normalizedProvince = recordRegion.normalizeProvinceName(province);
    allRecords.filter(r => recordRegion.inferRecordRegion(r).province === normalizedProvince).forEach(r => {
      const city = recordRegion.inferRecordRegion(r).city;
      if (city) cityCount[city] = (cityCount[city] || 0) + 1;
    });
    const items = prov.cities.map(c => ({
      name: c.name, center: c.center,
      count: cityCount[c.name] || 0
    }));
    this.setData({ showPicker: true, pickerItems: items });
  },

  hidePicker() { this.setData({ showPicker: false }); },

  // 选择城市
  selectCity(e) {
    const { name, lat, lng } = e.currentTarget.dataset;
    this.setMapLevel({
      level: "city", city: name,
      mapCenter: { lat: Number(lat), lng: Number(lng) },
      mapScale: 12, showPicker: false
    }, () => this.updateMarkers());
  },

  onRegionChange(e) {
    if (e.type !== "end" || this.ignoreNextScaleChange) return;
    const causedBy = e.detail ? e.detail.causedBy : "";
    if (causedBy && causedBy !== "scale") return;

    const fallbackScale = e.detail ? Number(e.detail.scale || e.detail.zoom) : NaN;
    const applyScale = (scale) => {
      if (!isFinite(scale)) return;
      this.syncLevelByScale(scale);
    };

    if (this.mapCtx && this.mapCtx.getScale) {
      this.mapCtx.getScale({
        success: (res) => applyScale(Number(res.scale)),
        fail: () => applyScale(fallbackScale)
      });
      return;
    }
    applyScale(fallbackScale);
  },

  syncLevelByScale(scale) {
    const currentLevel = this.data.level;
    if (scale <= 5.5 && currentLevel !== "country") {
      this.goCountry();
      return;
    }
    if (scale <= 8.5 && currentLevel === "city") {
      this.goProvince();
    }
  },

  goAddRecord() { wx.navigateTo({ url: "/pages/add-record/add-record" }); }
});
