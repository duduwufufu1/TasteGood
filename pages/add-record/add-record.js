const { COLLECTION, TAGS } = require("../../utils/constants");
const recordRegion = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");
const db = wx.cloud.database();
const TENCENT_MAP_KEY = "IWHBZ-24MCH-MEADA-WHWGG-4UH2T-FCBZI";
const TAG_NAME_MAP = {};
TAGS.forEach(tag => { TAG_NAME_MAP[tag.key] = tag.name; });

Page({
  data: {
    id: "",
    isEdit: false,
    pickLat: 39.9042, pickLng: 116.4074, pickScale: 12,
    pickMarkers: [],
    address: "", name: "", rating: 0,
    customTag: "",
    selectedTags: [], comment: "", photos: [],
    submitting: false,
    province: "", city: "",
    TAGS,
    displayTags: TAGS.map(tag => Object.assign({}, tag, { active: false }))
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadRecord();
      return;
    }
    this.initDefaultLocation();
  },

  initDefaultLocation() {
    const latitude = this.data.pickLat;
    const longitude = this.data.pickLng;
    this.setData({
      pickMarkers: [{ id: 0, latitude, longitude, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
    });
    this.determineRegion(latitude, longitude);
  },

  async loadRecord() {
    try {
      const user = await userRecords.getCurrentUser({ interactive: true });
      const res = await db.collection(COLLECTION.RECORDS).doc(this.data.id).get();
      const record = res.data || {};
      const owner = record.userId || record.openid || record._openid || "";
      if (owner !== user.openid) {
        wx.showToast({ title: "鏃犳潈缂栬緫璇ヨ褰?, icon: "none" });
        setTimeout(() => wx.navigateBack(), 900);
        return;
      }
      const location = record.location || { lat: this.data.pickLat, lng: this.data.pickLng };
      const lat = Number(location.lat || location.latitude || this.data.pickLat);
      const lng = Number(location.lng || location.longitude || this.data.pickLng);
      const info = recordRegion.inferRecordRegion(record);
      this.setData({
        name: record.name || "",
        address: record.address || "",
        rating: Number(record.rating) || 0,
        comment: record.comment || "",
        selectedTags: record.tags || [],
        photos: record.images || [],
        province: record.province || info.province,
        city: record.city || info.city,
        pickLat: lat,
        pickLng: lng,
        pickMarkers: [{ id: 0, latitude: lat, longitude: lng, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
      });
      this.refreshDisplayTags();
    } catch (e) {
      console.error(e);
      if (e && (e.code === "LOGIN_REQUIRED" || e.message === "LOGIN_REQUIRED")) {
        wx.showToast({ title: "璇峰厛鍒版垜鐨勯〉鐧诲綍", icon: "none" });
        setTimeout(() => wx.switchTab({ url: "/pages/profile/profile" }), 900);
        return;
      }
      wx.showToast({ title: "璁板綍鍔犺浇澶辫触", icon: "none" });
      this.initDefaultLocation();
    }
  },


  // 浠庡湴鍧€鏂囨湰涓彁鍙栫渷浠藉拰鍩庡競淇℃伅锛岃繑鍥?{ province?, city? } 鎴?null
  getRegionFromText(text) {
    const value = String(text || "");
    if (!value) return null;
    const province = recordRegion.normalizeProvinceNameFromAddressStart(value);
    const city = recordRegion.normalizeCityNameFromAddressStart(value, province || this.data.province);
    const result = {};
    if (province) result.province = province;
    if (city) result.city = city;
    if (!result.province && city) {
      const cityInfo = recordRegion.getCityEntry(city);
      if (cityInfo) result.province = cityInfo.province;
    }
    if (!result.province && !result.city) return null;
    return result;
 },

  reverseGeocode(lat, lng) {
    if (!TENCENT_MAP_KEY) return;
    wx.request({
      url: "https://apis.map.qq.com/ws/geocoder/v1/",
      data: { location: lat + "," + lng, key: TENCENT_MAP_KEY },
      success: (res) => {
        if (res.data && res.data.result) {
          const addr = res.data.result;
          this.setData({
            address: addr.address,
            province: addr.address_component ? recordRegion.normalizeProvinceName(addr.address_component.province) : this.data.province,
            city: addr.address_component ? recordRegion.normalizeCityName(addr.address_component.city) : this.data.city
          });
        }
      }
    });
  },

 handleMapTap(e) {
   const { latitude, longitude } = e.detail;
   const nearest = recordRegion.nearestRegion(latitude, longitude);
   this.setData({
     pickLat: latitude,
     pickLng: longitude,
     address: "宸查€夋嫨浣嶇疆 " + latitude.toFixed(4) + ", " + longitude.toFixed(4),
     province: nearest?.province || this.data.province,
     city: nearest?.city || this.data.city,
     pickMarkers: [{ id: 0, latitude, longitude, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
   });
   wx.showToast({ title: "浣嶇疆宸查€夊畾", icon: "none" });
   this.reverseGeocode(latitude, longitude);
 },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onCommentInput(e) { this.setData({ comment: e.detail.value }); },
  onCustomTagInput(e) { this.setData({ customTag: e.detail.value }); },
 onRatingChange(e) { this.setData({ rating: e.detail.rating }); },

  handleSearchLocation() {
    wx.chooseLocation({
      latitude: this.data.pickLat,
      longitude: this.data.pickLng,
      success: (res) => {
        const latitude = Number(res.latitude);
        const longitude = Number(res.longitude);
        if (!isFinite(latitude) || !isFinite(longitude)) return;
        this.setData({
          pickLat: latitude,
          pickLng: longitude,
          pickScale: 15,
          name: this.data.name || res.name || "",
          address: res.address || res.name || ("宸查€夋嫨浣嶇疆 " + latitude.toFixed(4) + ", " + longitude.toFixed(4)),
          pickMarkers: [{ id: 0, latitude, longitude, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
        });
        if (!this.applyRegionFromText(res.address || "")) {
          this.determineRegion(latitude, longitude);
        }
      },
      fail: (err) => {
        console.warn(err);
        wx.showToast({ title: "鏈€夋嫨浣嶇疆", icon: "none" });
      }
    });
  },

  handleToggleTag(e) {
    const key = e.currentTarget.dataset.key;
    let sel = this.data.selectedTags;
    sel = sel.indexOf(key) !== -1 ? sel.filter(t => t !== key) : [...sel, key];
    this.setData({ selectedTags: sel }, () => this.refreshDisplayTags());
  },

  handleAddCustomTag() {
    const tag = this.data.customTag.trim().replace(/^#/, "");
    if (!tag) { wx.showToast({ title: "璇疯緭鍏ユ爣绛?, icon: "none" }); return; }
    if (tag.length > 8) { wx.showToast({ title: "鏍囩鏈€澶?涓瓧", icon: "none" }); return; }
    if (this.data.selectedTags.includes(tag)) {
      this.setData({ customTag: "" });
      return;
    }
    this.setData({
      selectedTags: [...this.data.selectedTags, tag],
      customTag: ""
    }, () => this.refreshDisplayTags());
  },

  refreshDisplayTags() {
    const selectedMap = {};
    this.data.selectedTags.forEach(tag => { selectedMap[tag] = true; });
    const customTags = this.data.selectedTags
      .filter(tag => !TAG_NAME_MAP[tag])
      .map(tag => ({ key: tag, name: tag }));
    const displayTags = TAGS.concat(customTags).map(tag => {
      return Object.assign({}, tag, { active: !!selectedMap[tag.key] });
    });
    this.setData({ displayTags });
  },

  handleAddPhoto() {
    wx.chooseImage({
      count: 9 - this.data.photos.length,
      sizeType: ["compressed"],
      sourceType: ["camera", "album"],
      success: (res) => {
        this.setData({ photos: [...this.data.photos, ...res.tempFilePaths].slice(0,9) });
      }
    });
  },

  handleRemovePhoto(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ photos: this.data.photos.filter((_, i) => i !== idx) });
  },

  async handleSubmit() {
    const { id, isEdit, name, rating, comment, selectedTags, photos, pickLat, pickLng, address, province, city } = this.data;
    if (!name) { wx.showToast({ title: "璇疯緭鍏ュ簵閾哄悕绉?, icon: "none" }); return; }
    if (rating === 0) { wx.showToast({ title: "璇疯瘎鍒?, icon: "none" }); return; }

    this.setData({ submitting: true });

    try {
      const user = await userRecords.getCurrentUser({ interactive: true });
      let imgs = [];
      for (const photo of photos) {
        if (photo.indexOf("cloud://") === 0 || photo.indexOf("http://") === 0 || photo.indexOf("https://") === 0) {
          imgs.push(photo);
          continue;
        }
        const ext = photo.match(/\.(\w+)$/)?.[1] || "jpg";
        const cloudPath = "records/" + Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: photo });
        imgs.push(up.fileID);
      }

      const regionInfo = recordRegion.inferRecordRegion({
        address,
        province,
        city,
        location: { lat: pickLat, lng: pickLng }
      });

      const data = {
        name, address,
        province: regionInfo.province,
        city: regionInfo.city,
        location: { lat: pickLat, lng: pickLng },
        rating, comment, images: imgs, tags: selectedTags,
        updatedAt: new Date()
      };

      if (isEdit && id) {
        await db.collection(COLLECTION.RECORDS).doc(id).update({ data: userRecords.withOwner(data, user) });
      } else {
        await db.collection(COLLECTION.RECORDS).add({
          data: userRecords.withOwner(Object.assign({}, data, { createdAt: new Date() }), user)
        });
      }

      wx.showToast({ title: isEdit ? "淇敼鎴愬姛" : "淇濆瓨鎴愬姛" });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch(e) {
      console.error(e);
      if (e && (e.code === "LOGIN_REQUIRED" || e.message === "LOGIN_REQUIRED")) {
        wx.showToast({ title: "璇峰厛鍒版垜鐨勯〉鐧诲綍", icon: "none" });
        setTimeout(() => wx.switchTab({ url: "/pages/profile/profile" }), 900);
        return;
      }
      wx.showToast({ title: "淇濆瓨澶辫触", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});

