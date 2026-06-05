const db = wx.cloud.database();
const recordRegion = require("../../utils/record-region");
 const chinaMap = require("../../utils/china-map-data");
 const auth = require("../../utils/auth");
 const userRecords = require("../../utils/user-records");
 const { buildCityMap, buildWordCloud, buildPhotoWall } = require("../../utils/profile-helper");

const HAS_VECTOR_MAP = chinaMap && chinaMap.cities && chinaMap.cities.length > 0;
const MIN_ATLAS_ZOOM = 0.85;
const MAX_ATLAS_ZOOM = 8;
const TAP_MOVE_LIMIT = 8;
const ATLAS_CACHE_SCALE = 1.5;
const HEAT_STOPS = [
  { t: 0, color: "#edf2e3" },
  { t: 0.22, color: "#f2c879" },
  { t: 0.52, color: "#df7542" },
  { t: 0.76, color: "#b83e4f" },
  { t: 1, color: "#5b1f3b" }
];

function isRealWeChatProfile(profile) {
  if (!profile) return false;
  const nickName = String(profile.nickName || "").trim();
  const avatarUrl = String(profile.avatarUrl || "").trim();
  return !!nickName && nickName !== "瀵邦喕淇婇悽銊﹀煕" && !!avatarUrl;
}

const ATLAS_TEMPLATE = [
  {city:"濞屽牓妲?, province:"鏉堣棄鐣?, shortName:"濞屽牓妲?, left:546, top:46, width:82, height:60, radius:"34rpx 24rpx 28rpx 24rpx", rotate:5, skew:0},
  {city:"婢堆嗙箾", province:"鏉堣棄鐣?, shortName:"婢堆嗙箾", left:558, top:112, width:74, height:54, radius:"24rpx 36rpx 22rpx 30rpx", rotate:-4, skew:0},
  {city:"閸栨ぞ鍚?, province:"閸栨ぞ鍚?, shortName:"閸栨ぞ鍚?, left:456, top:102, width:72, height:58, radius:"34rpx 26rpx 20rpx 28rpx", rotate:-2, skew:-4},
  {city:"婢垛晜瑙?, province:"婢垛晜瑙?, shortName:"婢垛晜瑙?, left:524, top:150, width:70, height:52, radius:"22rpx 30rpx 28rpx 20rpx", rotate:6, skew:0},
  {city:"閻啿顔嶆惔?, province:"濞屽啿瀵?, shortName:"閻啿顔嶆惔?, left:420, top:166, width:104, height:58, radius:"26rpx 20rpx 34rpx 24rpx", rotate:2, skew:-3},
  {city:"濞村骸宕?, province:"鐏炲彉绗?, shortName:"濞村骸宕?, left:498, top:218, width:84, height:58, radius:"26rpx 32rpx 22rpx 28rpx", rotate:-2, skew:0},
  {city:"闂堟帒鐭?, province:"鐏炲彉绗?, shortName:"闂堟帒鐭?, left:576, top:238, width:76, height:54, radius:"22rpx 34rpx 24rpx 30rpx", rotate:4, skew:0},
  {city:"闁垵绐?, province:"濞屽啿宕?, shortName:"闁垵绐?, left:394, top:250, width:92, height:62, radius:"26rpx 22rpx 32rpx 24rpx", rotate:-3, skew:0},
  {city:"鐟楀灝鐣?, province:"闂勬洝銈?, shortName:"鐟楀灝鐣?, left:298, top:258, width:92, height:62, radius:"28rpx 20rpx 30rpx 26rpx", rotate:4, skew:-5},
  {city:"閸氬牐鍋?, province:"鐎瑰绐?, shortName:"閸氬牐鍋?, left:488, top:306, width:78, height:56, radius:"24rpx 20rpx 28rpx 32rpx", rotate:3, skew:0},
  {city:"閸楁ぞ鍚?, province:"濮圭喕瀚?, shortName:"閸楁ぞ鍚?, left:566, top:300, width:76, height:54, radius:"24rpx 30rpx 22rpx 26rpx", rotate:-3, skew:0},
  {city:"閺冪娀鏁?, province:"濮圭喕瀚?, shortName:"閺冪娀鏁?, left:620, top:352, width:62, height:46, radius:"18rpx 28rpx 20rpx 22rpx", rotate:6, skew:0},
  {city:"閼诲繐绐?, province:"濮圭喕瀚?, shortName:"閼诲繐绐?, left:574, top:362, width:64, height:48, radius:"22rpx 18rpx 26rpx 20rpx", rotate:-5, skew:0},
  {city:"娑撳﹥鎹?, province:"娑撳﹥鎹?, shortName:"娑撳﹥鎹?, left:638, top:400, width:66, height:52, radius:"20rpx 30rpx 22rpx 24rpx", rotate:4, skew:0},
  {city:"濮濓附鐪?, province:"濠€鏍у", shortName:"濮濓附鐪?, left:394, top:332, width:92, height:64, radius:"30rpx 22rpx 26rpx 32rpx", rotate:2, skew:0},
  {city:"閸楁妲?, province:"濮圭喕銈?, shortName:"閸楁妲?, left:490, top:394, width:82, height:58, radius:"24rpx 20rpx 34rpx 24rpx", rotate:-4, skew:0},
  {city:"閺夘厼绐?, province:"濞存瑦鐫?, shortName:"閺夘厼绐?, left:574, top:422, width:82, height:58, radius:"26rpx 32rpx 22rpx 30rpx", rotate:3, skew:0},
  {city:"鐎逛焦灏?, province:"濞存瑦鐫?, shortName:"鐎逛焦灏?, left:640, top:468, width:68, height:50, radius:"20rpx 30rpx 20rpx 26rpx", rotate:-3, skew:0},
  {city:"濞撯晛绐?, province:"濞存瑦鐫?, shortName:"濞撯晛绐?, left:584, top:502, width:76, height:52, radius:"24rpx 20rpx 32rpx 22rpx", rotate:5, skew:0},
  {city:"闂€鎸庣煓", province:"濠€鏍у础", shortName:"闂€鎸庣煓", left:384, top:408, width:86, height:62, radius:"28rpx 22rpx 30rpx 26rpx", rotate:-2, skew:0},
  {city:"閺嶎亝搴?, province:"濠€鏍у础", shortName:"閺嶎亝搴?, left:454, top:462, width:76, height:52, radius:"22rpx 30rpx 20rpx 26rpx", rotate:5, skew:0},
  {city:"闁插秴绨?, province:"闁插秴绨?, shortName:"闁插秴绨?, left:286, top:392, width:86, height:62, radius:"28rpx 22rpx 34rpx 24rpx", rotate:3, skew:0},
  {city:"閹存劙鍏?, province:"閸ユ稑绐?, shortName:"閹存劙鍏?, left:198, top:356, width:94, height:66, radius:"34rpx 22rpx 28rpx 30rpx", rotate:-4, skew:0},
  {city:"濡楀倹鐏?, province:"楠炶儻銈?, shortName:"濡楀倹鐏?, left:300, top:478, width:80, height:56, radius:"24rpx 30rpx 22rpx 28rpx", rotate:-3, skew:0},
  {city:"閸楁鐣?, province:"楠炶儻銈?, shortName:"閸楁鐣?, left:244, top:532, width:86, height:60, radius:"30rpx 22rpx 26rpx 34rpx", rotate:4, skew:0},
  {city:"閺勫棙妲?, province:"娴滄垵宕?, shortName:"閺勫棙妲?, left:146, top:502, width:88, height:62, radius:"34rpx 24rpx 28rpx 24rpx", rotate:-5, skew:0},
  {city:"婢堆呮倞", province:"娴滄垵宕?, shortName:"婢堆呮倞", left:70, top:480, width:76, height:54, radius:"30rpx 20rpx 26rpx 24rpx", rotate:4, skew:0},
  {city:"缁傚繐绐?, province:"缁傚繐缂?, shortName:"缁傚繐绐?, left:528, top:514, width:80, height:56, radius:"24rpx 30rpx 28rpx 22rpx", rotate:-4, skew:0},
  {city:"閸橈箓妫?, province:"缁傚繐缂?, shortName:"閸橈箓妫?, left:516, top:572, width:76, height:52, radius:"22rpx 28rpx 22rpx 30rpx", rotate:4, skew:0},
  {city:"楠炲灝绐?, province:"楠炲じ绗?, shortName:"楠炲灝绐?, left:400, top:552, width:84, height:60, radius:"28rpx 22rpx 30rpx 26rpx", rotate:-2, skew:0},
  {city:"娴ｆ稑鍖?, province:"楠炲じ绗?, shortName:"娴ｆ稑鍖?, left:330, top:574, width:74, height:52, radius:"24rpx 20rpx 30rpx 24rpx", rotate:5, skew:0},
  {city:"娑撴粏甯?, province:"楠炲じ绗?, shortName:"娑撴粏甯?, left:480, top:594, width:74, height:52, radius:"20rpx 28rpx 24rpx 30rpx", rotate:-3, skew:0},
  {city:"濞ｅ崬婀?, province:"楠炲じ绗?, shortName:"濞ｅ崬婀?, left:422, top:626, width:78, height:54, radius:"26rpx 22rpx 30rpx 24rpx", rotate:4, skew:0},
  {city:"閻濈姵鎹?, province:"楠炲じ绗?, shortName:"閻濈姵鎹?, left:346, top:632, width:72, height:50, radius:"22rpx 28rpx 20rpx 26rpx", rotate:-4, skew:0},
  {city:"濞村嘲褰?, province:"濞村嘲宕?, shortName:"濞村嘲褰?, left:324, top:700, width:72, height:50, radius:"28rpx 20rpx 28rpx 22rpx", rotate:4, skew:0},
  {city:"娑撳绨?, province:"濞村嘲宕?, shortName:"娑撳绨?, left:406, top:714, width:72, height:50, radius:"22rpx 30rpx 24rpx 20rpx", rotate:-4, skew:0}
];

Page({
  data: {
    isLoggedIn: false,
    loginLoading: false,
    user: {},
    showLoginPanel: false,
    pendingAvatarUrl: "",
    pendingNickName: "",
    profilePanelTitle: "鐎瑰苯鏉藉顔讳繆鐠у嫭鏋?,
    profilePanelDesc: "瑜版挸澧犲顔讳繆閻楀牊婀伴張顏囩箲閸ョ偛銇旈崓蹇旀█缁夊府绱濈拠鐑解偓澶嬪閸氬骸鐣幋鎰瑜?,
    profilePanelSubmitText: "绾喛顓婚惂璇茬秿",
    mapCities: [],
    useVectorMap: HAS_VECTOR_MAP,
    activeCityCount: 0,
    mappedRecordCount: 0,
    maxHeatCount: 0,
    hasMapRecords: false,
    wordCloud: [],
    photoWall: [],
    recentRecords: []
  },

  onShow() {
    const user = auth.getCachedUser();
    if (user && user.openid) {
      this.setData({ isLoggedIn: true, user });
    }
    this.loadStats();
  },

  async loadStats() {
    try {
      const cachedUser = auth.getCachedUser();
      if (!cachedUser || !cachedUser.openid) {
        this.cityTasteMap = {};
        this.atlasMapCache = null;
        this.setData({
          isLoggedIn: false,
          user: {},
          showLoginPanel: false,
          pendingAvatarUrl: "",
          pendingNickName: "",
          profilePanelTitle: "鐎瑰苯鏉藉顔讳繆鐠у嫭鏋?,
          profilePanelDesc: "瑜版挸澧犲顔讳繆閻楀牊婀伴張顏囩箲閸ョ偛銇旈崓蹇旀█缁夊府绱濈拠鐑解偓澶嬪閸氬骸鐣幋鎰瑜?,
          profilePanelSubmitText: "绾喛顓婚惂璇茬秿",
          mapCities: [],
          activeCityCount: 0,
          mappedRecordCount: 0,
          maxHeatCount: 0,
          hasMapRecords: false,
          wordCloud: [],
          photoWall: [],
          recentRecords: []
        });
        return;
      }
      const recordCtx = await userRecords.collection();
      this.setData({ isLoggedIn: true, user: recordCtx.user });
      const result = await recordCtx.col.orderBy("createdAt", "desc").get();
      const records = (result.data || []).map((record) => {
        const info = recordRegion.inferRecordRegion(record);
        return Object.assign({}, record, {
          city: info.city,
          province: info.province
        });
      });
      const cityMap = buildCityMap(records);
      let activeCityCount = 0;
      let mappedRecordCount = 0;
      let maxHeatCount = 0;
      const mapCities = ATLAS_TEMPLATE.map((item) => {
        const recordInfo = cityMap[item.city];
        const count = recordInfo ? recordInfo.count : 0;
        if (count) {
          activeCityCount += 1;
          mappedRecordCount += count;
          if (count > maxHeatCount) maxHeatCount = count;
        }
        return Object.assign({}, item, {
          count,
          statusClass: count ? "is-tasted" : "is-muted",
          heatClass: count > 2 ? "is-hot" : ""
        });
      });
      if (HAS_VECTOR_MAP) {
        activeCityCount = 0;
        mappedRecordCount = 0;
        chinaMap.cities.forEach((city) => {
          const recordInfo = cityMap[city.name];
          if (recordInfo && recordInfo.count) {
            activeCityCount += 1;
            mappedRecordCount += recordInfo.count;
            if (recordInfo.count > maxHeatCount) maxHeatCount = recordInfo.count;
          }
        });
      }

      const wordCloud = buildWordCloud(records, 18);

      const photoWall = buildPhotoWall(records, 12);

      this.cityTasteMap = cityMap;
      this.maxHeatCount = Math.max(1, maxHeatCount);
      this.atlasMapCache = null;
      this.setData({
        mapCities,
        useVectorMap: HAS_VECTOR_MAP,
        activeCityCount,
        mappedRecordCount,
        maxHeatCount,
        hasMapRecords: activeCityCount > 0,
        wordCloud,
        photoWall,
        recentRecords: records.slice(0, 5)
      }, () => {
        if (HAS_VECTOR_MAP) {
          this.drawVectorMap();
        }
      });
    } catch (error) {
      console.error("[profile] load stats failed", error);
    }
  },

  handleLogin() {
    if (this.data.loginLoading) return;
    if (!wx.getUserProfile) {
      wx.showToast({ title: "瑜版挸澧犻崺铏诡攨鎼存挷绗夐弨顖涘瘮閹哄牊娼?, icon: "none" });
      return;
    }
    wx.getUserProfile({
      desc: "閻劋绨€瑰苯鏉界挧鍕灐",
      success: (res) => {
        const profile = res.userInfo || {};
        console.log("[profile] get profile success", profile);
        if (!isRealWeChatProfile(profile)) {
          this.openProfilePanel(profile);
          return;
        }
        this.finishLogin(profile);
      },
      fail: (error) => {
        console.error("[profile] get profile failed", error);
        wx.showToast({
          title: error && error.errMsg && error.errMsg.indexOf("deny") !== -1 ? "瀹告彃褰囧☉鍫熷房閺? : "閹哄牊娼堟径杈Е",
          icon: "none"
        });
      }
    });
  },

  openProfilePanel(profile) {
    this.setData({
      showLoginPanel: true,
      pendingAvatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : "",
      pendingNickName: profile && profile.nickName && profile.nickName !== "瀵邦喕淇婇悽銊﹀煕" ? profile.nickName : "",
      profilePanelTitle: "鐎瑰苯鏉藉顔讳繆鐠у嫭鏋?,
      profilePanelDesc: "瑜版挸澧犲顔讳繆閻楀牊婀伴張顏囩箲閸ョ偛銇旈崓蹇旀█缁夊府绱濈拠鐑解偓澶嬪閸氬骸鐣幋鎰瑜?,
      profilePanelSubmitText: "绾喛顓婚惂璇茬秿"
    });
    wx.showToast({ title: "鐠囩兘鈧瀚ㄦ径鏉戝剼閺勭數袨", icon: "none" });
  },

  handleEditProfile() {
    const user = this.data.user || {};
    this.setData({
      showLoginPanel: true,
      pendingAvatarUrl: user.avatarUrl || "",
      pendingNickName: user.nickName && user.nickName !== "瀵邦喕淇婇悽銊﹀煕" ? user.nickName : "",
      profilePanelTitle: "娣囶喗鏁肩挧鍕灐",
      profilePanelDesc: "閺囧瓨鏌婃径鏉戝剼閸滃本妯€缁夋澘鎮楁导姘箽鐎涙ê鍩岃ぐ鎾冲鐠愶箑褰?,
      profilePanelSubmitText: "娣囨繂鐡ㄧ挧鍕灐"
    });
  },

  closeLoginPanel() {
    if (this.data.loginLoading) return;
    this.setData({
      showLoginPanel: false,
      pendingAvatarUrl: "",
      pendingNickName: "",
      profilePanelTitle: "鐎瑰苯鏉藉顔讳繆鐠у嫭鏋?,
      profilePanelDesc: "瑜版挸澧犲顔讳繆閻楀牊婀伴張顏囩箲閸ョ偛銇旈崓蹇旀█缁夊府绱濈拠鐑解偓澶嬪閸氬骸鐣幋鎰瑜?,
      profilePanelSubmitText: "绾喛顓婚惂璇茬秿"
    }, () => {
      if (HAS_VECTOR_MAP) {
        this.drawVectorMap();
      }
    });
  },

  async confirmLogin() {
    if (this.data.loginLoading) return;
    const nickName = String(this.data.pendingNickName || "").trim();
    const avatarUrl = this.data.pendingAvatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: "鐠囧嘲鍘涢柅澶嬪婢舵潙鍎?, icon: "none" });
      return;
    }
    if (!nickName) {
      wx.showToast({ title: "鐠囧嘲锝為崘娆愭█缁?, icon: "none" });
      return;
    }
    await this.finishLogin({ nickName, avatarUrl });
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({ pendingAvatarUrl: avatarUrl });
    }
  },

  onNickNameInput(e) {
    this.setData({ pendingNickName: e.detail.value });
  },

  async finishLogin(profile) {
    const wasLoggedIn = this.data.isLoggedIn;
    try {
      this.setData({ loginLoading: true });
      const user = await auth.ensureLogin({
        refreshProfile: true,
        profile
      });
      this.setData({
        isLoggedIn: true,
        user,
        showLoginPanel: false,
        pendingAvatarUrl: "",
        pendingNickName: "",
        profilePanelTitle: "鐎瑰苯鏉藉顔讳繆鐠у嫭鏋?,
        profilePanelDesc: "瑜版挸澧犲顔讳繆閻楀牊婀伴張顏囩箲閸ョ偛銇旈崓蹇旀█缁夊府绱濈拠鐑解偓澶嬪閸氬骸鐣幋鎰瑜?,
        profilePanelSubmitText: "绾喛顓婚惂璇茬秿"
      });
      wx.showToast({ title: wasLoggedIn ? "娣囨繂鐡ㄩ幋鎰" : "閻ц缍嶉幋鎰" });
      this.loadStats();
    } catch (error) {
      console.error("[profile] login failed", error);
      wx.showToast({
        title: "閻ц缍嶆径杈Е",
        icon: "none"
      });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  handleLogout() {
    auth.clearUser();
    this.cityTasteMap = {};
    this.atlasMapCache = null;
    this.setData({
      isLoggedIn: false,
      user: {},
      showLoginPanel: false,
      pendingAvatarUrl: "",
      pendingNickName: "",
      profilePanelTitle: "鐎瑰苯鏉藉顔讳繆鐠у嫭鏋?,
      profilePanelDesc: "瑜版挸澧犲顔讳繆閻楀牊婀伴張顏囩箲閸ョ偛銇旈崓蹇旀█缁夊府绱濈拠鐑解偓澶嬪閸氬骸鐣幋鎰瑜?,
      profilePanelSubmitText: "绾喛顓婚惂璇茬秿",
      mapCities: [],
      activeCityCount: 0,
      mappedRecordCount: 0,
      maxHeatCount: 0,
      hasMapRecords: false,
      wordCloud: [],
      photoWall: [],
      recentRecords: []
    }, () => {
      if (this.atlasCtx && this.atlasSize) {
        this.atlasCtx.clearRect(0, 0, this.atlasSize.width, this.atlasSize.height);
      }
    });
  },

  drawVectorMap() {
    wx.createSelectorQuery().in(this).select("#tasteAtlasCanvas").fields({
      node: true,
      size: true,
      rect: true
    }).exec((res) => {
      const canvasInfo = res && res[0];
      if (!canvasInfo || !canvasInfo.node) return;
      const canvas = canvasInfo.node;
      const ctx = canvas.getContext("2d");
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
      const width = canvasInfo.width;
      const height = canvasInfo.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      this.atlasCanvas = canvas;
      this.atlasCtx = ctx;
      this.atlasSize = { width, height };
      this.atlasRect = { left: canvasInfo.left || 0, top: canvasInfo.top || 0 };
      this.canvasMapBox = this.getCanvasMapBox(width, height);
      this.atlasViewport = this.atlasViewport || { zoom: 1, panX: 0, panY: 0 };
      this.buildAtlasMapCache();
      this.renderVectorMap();
    });
  },

  getCanvasMapBox(width, height) {
    const scale = Math.min(width / chinaMap.width, height / chinaMap.height);
    return {
      baseScale: scale,
      left: (width - chinaMap.width * scale) / 2,
      top: (height - chinaMap.height * scale) / 2
    };
  },

  renderVectorMap(forceVector) {
    const ctx = this.atlasCtx;
    const size = this.atlasSize;
    if (!ctx || !size || !this.canvasMapBox) return;
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#fdf7e7";
    ctx.fillRect(0, 0, size.width, size.height);
    if (this.atlasMapCache && !forceVector) {
      const box = this.getAtlasTransform();
      ctx.drawImage(
        this.atlasMapCache.canvas,
        0,
        0,
        this.atlasMapCache.pixelWidth,
        this.atlasMapCache.pixelHeight,
        box.left,
        box.top,
        chinaMap.width * box.scale,
        chinaMap.height * box.scale
      );
      return;
    }
    this.drawHeatMap(ctx, this.getAtlasTransform());
  },

  queueAtlasRender() {
    if (this.pendingAtlasRender) return;
    this.pendingAtlasRender = true;
    const run = () => {
      this.pendingAtlasRender = false;
      this.renderVectorMap();
    };
    if (this.atlasCanvas && this.atlasCanvas.requestAnimationFrame) {
      this.atlasCanvas.requestAnimationFrame(run);
    } else {
      setTimeout(run, 16);
    }
  },

  scheduleCrispAtlasRender() {
    if (this.crispAtlasTimer) clearTimeout(this.crispAtlasTimer);
    this.crispAtlasTimer = setTimeout(() => {
      this.crispAtlasTimer = null;
      this.renderVectorMap(true);
    }, 90);
  },

  buildAtlasMapCache() {
    this.atlasMapCache = null;
    if (!wx.createOffscreenCanvas) return;
    try {
      const pixelWidth = Math.round(chinaMap.width * ATLAS_CACHE_SCALE);
      const pixelHeight = Math.round(chinaMap.height * ATLAS_CACHE_SCALE);
      const canvas = wx.createOffscreenCanvas({
        type: "2d",
        width: pixelWidth,
        height: pixelHeight
      });
      const ctx = canvas.getContext("2d");
      ctx.scale(ATLAS_CACHE_SCALE, ATLAS_CACHE_SCALE);
      ctx.clearRect(0, 0, chinaMap.width, chinaMap.height);
      const cacheTransform = {
        left: 0,
        top: 0,
        scale: 1,
        lineScale: 1.25
      };
      this.drawHeatMap(ctx, cacheTransform);
      this.atlasMapCache = {
        canvas,
        pixelWidth,
        pixelHeight
      };
    } catch (error) {
      console.warn("[profile] offscreen atlas cache unavailable", error);
      this.atlasMapCache = null;
    }
  },

  getAtlasTransform() {
    const box = this.canvasMapBox || { left: 0, top: 0, baseScale: 1 };
    const viewport = this.atlasViewport || { zoom: 1, panX: 0, panY: 0 };
    return {
      scale: box.baseScale * viewport.zoom,
      left: box.left + viewport.panX,
      top: box.top + viewport.panY
    };
  },

  drawHeatMap(ctx, transform) {
    chinaMap.cities.forEach((city) => {
      const count = this.cityTasteMap && this.cityTasteMap[city.name] ? this.cityTasteMap[city.name].count : 0;
      this.drawCityShape(ctx, city, count, transform);
    });
    this.drawActiveCityLabels(ctx, transform);
  },

  drawCityShape(ctx, city, count, transform) {
    const box = transform || this.getAtlasTransform();
    ctx.beginPath();
    city.rings.forEach((ring) => {
      ring.forEach((point, index) => {
        const x = box.left + point[0] * box.scale;
        const y = box.top + point[1] * box.scale;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
    });
    ctx.fillStyle = this.getHeatColor(count);
    ctx.strokeStyle = count ? "rgba(255,247,232,0.82)" : "rgba(109,129,122,0.55)";
    ctx.lineWidth = (count ? 0.75 : 0.36) * (box.lineScale || 1);
    ctx.fill();
    ctx.stroke();
  },

  getHeatColor(count) {
    if (!count) return HEAT_STOPS[0].color;
    const max = this.maxHeatCount || 1;
    const value = Math.min(1, Math.log(count + 1) / Math.log(max + 1));
    for (let i = 1; i < HEAT_STOPS.length; i++) {
      const prev = HEAT_STOPS[i - 1];
      const next = HEAT_STOPS[i];
      if (value <= next.t) {
        const local = (value - prev.t) / (next.t - prev.t || 1);
        return this.mixHexColor(prev.color, next.color, local);
      }
    }
    return HEAT_STOPS[HEAT_STOPS.length - 1].color;
  },

  mixHexColor(from, to, amount) {
    const a = this.hexToRgb(from);
    const b = this.hexToRgb(to);
    const t = Math.max(0, Math.min(1, amount));
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  },

  hexToRgb(hex) {
    const value = String(hex || "#000000").replace("#", "");
    return {
      r: parseInt(value.slice(0, 2), 16) || 0,
      g: parseInt(value.slice(2, 4), 16) || 0,
      b: parseInt(value.slice(4, 6), 16) || 0
    };
  },

  drawActiveCityLabels(ctx, transform) {
    if (!this.cityTasteMap) return;
    chinaMap.cities.forEach((city) => {
      const recordInfo = this.cityTasteMap[city.name];
      if (!recordInfo || !recordInfo.count) return;
      const center = this.getCityLabelCenter(city);
      if (!center) return;
      const x = transform.left + center.x * transform.scale;
      const y = transform.top + center.y * transform.scale;
      ctx.save();
      ctx.font = "500 8px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(255,247,232,0.9)";
      ctx.fillStyle = "#102b28";
      ctx.strokeText(city.name, x, y);
      ctx.fillText(city.name, x, y);
      ctx.restore();
    });
  },

  getCityLabelCenter(city) {
    let ring = null;
    city.rings.forEach((item) => {
      if (!ring || item.length > ring.length) ring = item;
    });
    if (!ring || !ring.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    ring.forEach((point) => {
      if (point[0] < minX) minX = point[0];
      if (point[0] > maxX) maxX = point[0];
      if (point[1] < minY) minY = point[1];
      if (point[1] > maxY) maxY = point[1];
    });
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
  },

  onAtlasTouchStart(e) {
    if (!HAS_VECTOR_MAP || !this.canvasMapBox || !e.touches || !e.touches.length) return;
    const touches = e.touches;
    if (touches.length > 1) {
      const p1 = this.getTouchPoint(touches[0]);
      const p2 = this.getTouchPoint(touches[1]);
      const middle = this.getMiddlePoint(p1, p2);
      this.atlasGesture = {
        mode: "pinch",
        moved: true,
        startDistance: this.getPointDistance(p1, p2),
        startZoom: this.atlasViewport ? this.atlasViewport.zoom : 1,
        startPanX: this.atlasViewport ? this.atlasViewport.panX : 0,
        startPanY: this.atlasViewport ? this.atlasViewport.panY : 0,
        anchor: this.screenToMapPoint(middle.x, middle.y)
      };
      return;
    }

    const point = this.getTouchPoint(touches[0]);
    const viewport = this.atlasViewport || { zoom: 1, panX: 0, panY: 0 };
    this.atlasGesture = {
      mode: "drag",
      moved: false,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      startPanX: viewport.panX,
      startPanY: viewport.panY
    };
  },

  onAtlasTouchMove(e) {
    if (!HAS_VECTOR_MAP || !this.atlasGesture || !e.touches || !e.touches.length) return;
    const gesture = this.atlasGesture;
    if (e.touches.length > 1) {
      const p1 = this.getTouchPoint(e.touches[0]);
      const p2 = this.getTouchPoint(e.touches[1]);
      const distance = this.getPointDistance(p1, p2);
      if (!gesture.startDistance || distance <= 0) return;
      const middle = this.getMiddlePoint(p1, p2);
      const zoom = this.clampAtlasZoom(gesture.startZoom * distance / gesture.startDistance);
      const box = this.canvasMapBox;
      this.atlasViewport = {
        zoom,
        panX: middle.x - box.left - gesture.anchor.x * box.baseScale * zoom,
        panY: middle.y - box.top - gesture.anchor.y * box.baseScale * zoom
      };
      gesture.moved = true;
      this.queueAtlasRender();
      return;
    }

    if (gesture.mode !== "drag") return;
    const point = this.getTouchPoint(e.touches[0]);
    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;
    if (Math.abs(dx) > TAP_MOVE_LIMIT || Math.abs(dy) > TAP_MOVE_LIMIT) {
      gesture.moved = true;
    }
    this.atlasViewport = {
      zoom: this.atlasViewport ? this.atlasViewport.zoom : 1,
      panX: gesture.startPanX + dx,
      panY: gesture.startPanY + dy
    };
    gesture.lastX = point.x;
    gesture.lastY = point.y;
    this.queueAtlasRender();
  },

  onAtlasTouchEnd() {
    const gesture = this.atlasGesture;
    if (!gesture) return;
    this.atlasGesture = null;
    if (gesture.moved) {
      this.scheduleCrispAtlasRender();
      return;
    }
    const point = this.screenToMapPoint(gesture.startX, gesture.startY);
    const city = this.findTouchedCity(point.x, point.y);
    if (!city) return;
    const count = this.cityTasteMap && this.cityTasteMap[city.name] ? this.cityTasteMap[city.name].count : 0;
    if (!count) {
      wx.showToast({ title: city.name + "鏉╂ɑ鐥呯拋鏉跨秿", icon: "none" });
      return;
    }
    wx.showToast({ title: city.name + " " + count + " 閺?, icon: "none" });
  },

  zoomAtlasIn() {
    this.zoomAtlasBy(1.35);
  },

  zoomAtlasOut() {
    this.zoomAtlasBy(1 / 1.35);
  },

  zoomAtlasBy(rate) {
    if (!this.atlasSize || !this.canvasMapBox) return;
    const centerX = this.atlasSize.width / 2;
    const centerY = this.atlasSize.height / 2;
    const anchor = this.screenToMapPoint(centerX, centerY);
    const viewport = this.atlasViewport || { zoom: 1, panX: 0, panY: 0 };
    const zoom = this.clampAtlasZoom(viewport.zoom * rate);
    const box = this.canvasMapBox;
    this.atlasViewport = {
      zoom,
      panX: centerX - box.left - anchor.x * box.baseScale * zoom,
      panY: centerY - box.top - anchor.y * box.baseScale * zoom
    };
    this.queueAtlasRender();
    this.scheduleCrispAtlasRender();
  },

  handleResetAtlasViewport() {
    this.atlasViewport = { zoom: 1, panX: 0, panY: 0 };
    this.queueAtlasRender();
    this.scheduleCrispAtlasRender();
  },

  clampAtlasZoom(zoom) {
    return Math.max(MIN_ATLAS_ZOOM, Math.min(MAX_ATLAS_ZOOM, zoom));
  },

  screenToMapPoint(x, y) {
    const box = this.getAtlasTransform();
    return {
      x: (x - box.left) / box.scale,
      y: (y - box.top) / box.scale
    };
  },

  getTouchPoint(touch) {
    const rect = this.atlasRect || { left: 0, top: 0 };
    const x = typeof touch.x === "number" ? touch.x : Number(touch.clientX || touch.pageX || 0) - rect.left;
    const y = typeof touch.y === "number" ? touch.y : Number(touch.clientY || touch.pageY || 0) - rect.top;
    return { x, y };
  },

  getPointDistance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  },

  getMiddlePoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  },

  findTouchedCity(x, y) {
    for (let i = chinaMap.cities.length - 1; i >= 0; i--) {
      const city = chinaMap.cities[i];
      for (let j = 0; j < city.rings.length; j++) {
        if (this.isPointInRing(x, y, city.rings[j])) {
          return city;
        }
      }
    }
    return null;
  },

  isPointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  handleShowCityTaste(e) {
    const city = e.currentTarget.dataset.city;
    const count = Number(e.currentTarget.dataset.count || 0);
    if (!count) {
      wx.showToast({ title: city + "鏉╂ɑ鐥呯拋鏉跨秿", icon: "none" });
      return;
    }
    wx.showToast({ title: city + " " + count + " 閺?, icon: "none" });
  },

  handlePreviewPhoto(e) {
    const src = e.currentTarget.dataset.src;
    const urls = this.data.photoWall.map((item) => item.src);
    if (src) {
      wx.previewImage({ current: src, urls });
    }
  },

  handleGoDetail(e) {
    wx.navigateTo({ url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id });
  }
});


