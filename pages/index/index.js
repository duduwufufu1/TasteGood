 const REGIONS = require("../../utils/regions");
 const { COLLECTION } = require("../../utils/constants");
 const recordRegion = require("../../utils/record-region");
 const userRecords = require("../../utils/user-records");
 const photoHelper = require("../../utils/photo-helper");
 const app = getApp();
 const DEFAULT_PROVINCE_MARKER = "/images/marker-prov.png";
 const DEFAULT_RECORD_MARKER = "/images/marker-food.png";

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

  // 鏍规嵁褰撳墠灞傜骇鏇存柊鍦板浘鏍囪
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
      // 鍏ㄥ浗锛氭寜鐪佷唤鑱氬悎锛屾樉绀鸿鐪佷笂浼犲浘鐗囬泦銆?
      const provMap = {};
      allRecords.forEach(r => {
        const info = recordRegion.inferRecordRegion(r);
        if (info.province !== recordRegion.UNKNOWN_PROVINCE) {
          if (!provMap[info.province]) provMap[info.province] = { count: 0, photos: [] };
          provMap[info.province].count += 1;
          const photo = photoHelper.getRecordPhoto(r);
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
              content: p.name + " 路 " + cnt + "瀹?,
              color: "#2f281f",
              fontSize: 13,
              borderRadius: 8,
              bgColor: "#fffaf2",
              padding: 8,
              display: "ALWAYS"
            }
          });
          if (stat.photos.length) {
            iconTasks.push(() => photoHelper.getPhotoStackIconPath(this, stat.photos, DEFAULT_PROVINCE_MARKER).then((iconPath) => {
              marker.iconPath = iconPath;
            }));
          }
        }
      }
    } else if (level === "province") {
      // 鐪佷唤锛氭樉绀鸿鐪佸唴姣忓搴楃殑瀹為檯涓婁紶鍥剧墖銆?
      const normalizedProvince = recordRegion.normalizeProvinceName(province);
      const provRecords = allRecords.filter(r => {
        return recordRegion.inferRecordRegion(r).province === normalizedProvince;
      });
      for (const r of provRecords) {
        const info = recordRegion.inferRecordRegion(r);
        const photos = photoHelper.getRecordPhotos(r);
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
          iconTasks.push(() => photoHelper.getProvinceRecordIconPath(this, photos, DEFAULT_RECORD_MARKER).then((iconPath) => {
            marker.iconPath = iconPath;
          }));
        }
      }
    } else if (level === "city") {
      // 鍩庡競锛氭樉绀鸿鍩庡競鍐呮墍鏈夊叿浣撹褰曠殑涓婁紶鍥剧墖銆?
      const normalizedCity = recordRegion.normalizeCityName(city);
      const cityRecords = allRecords.filter(r => recordRegion.inferRecordRegion(r).city === normalizedCity);
      for (const r of cityRecords) {
        const info = recordRegion.inferRecordRegion(r);
        const photo = photoHelper.getRecordPhoto(r);
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
          iconTasks.push(() => photoHelper.getFastRecordPhotoIconPath(this, photo, DEFAULT_RECORD_MARKER).then((iconPath) => {
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

  // 鐐瑰嚮鏍囪
  onMarkerTap(e) {
    const rawId = e.markerId !== undefined ? e.markerId : (e.detail ? e.detail.markerId : undefined);
    const meta = this.data.markerMeta[String(rawId)];
    if (!meta) return;

    if (meta.type === "record") {
      // 鍏蜂綋璁板綍 鈫?鎵撳紑璇︽儏
      if (meta.recordId) wx.navigateTo({ url: "/pages/detail/detail?id=" + meta.recordId });
    } else if (meta.type === "city") {
      // 鍩庡競鏍囪 鈫?鍒囨崲鍒拌鍩庡競
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
      // 鐪佷唤鏍囪 鈫?鍒囨崲鍒拌鐪佷唤
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

  // 璺緞鏍忥細杩斿洖鍏ㄥ浗
  goCountry() {
    this.setMapLevel({
      level: "country", province: "", city: "",
      mapCenter: { lat: 35.86, lng: 104.19 }, mapScale: 4
    }, () => this.updateMarkers());
  },

  // 璺緞鏍忥細杩斿洖鐪佷唤
  goProvince() {
    const prov = REGIONS.provinces.find(p => p.name === this.data.province);
    if (prov) {
      this.setMapLevel({
        level: "province", city: "",
        mapCenter: prov.center, mapScale: 7
      }, () => this.updateMarkers());
    }
  },

  // 鏄剧ず鍩庡競閫夋嫨寮圭獥
  showCityPicker() {
    const { province, allRecords } = this.data;
    const prov = REGIONS.provinces.find(p => p.name === province);
    if (!prov) return;
    // 缁熻姣忎釜鍩庡競鐨勮褰曟暟
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

  // 閫夋嫨鍩庡競
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

