const STORAGE_KEY = "tastegood_user";

function getCachedUser() {
  return wx.getStorageSync(STORAGE_KEY) || null;
}

function saveUser(user) {
  wx.setStorageSync(STORAGE_KEY, user);
  return user;
}

function clearUser() {
  wx.removeStorageSync(STORAGE_KEY);
}

function isRemoteFile(filePath) {
  return /^cloud:\/\//.test(filePath) || /^https?:\/\//.test(filePath);
}

function getFileExt(filePath) {
  const match = String(filePath || "").match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : "jpg";
}

function getUserProfile() {
  return new Promise((resolve, reject) => {
    if (!wx.getUserProfile) {
      reject(new Error("wx.getUserProfile unavailable"));
      return;
    }
    wx.getUserProfile({
      desc: "用于完善资料",
      success: (res) => resolve(res.userInfo || {}),
      fail: reject
    });
  });
}

async function uploadAvatar(avatarUrl, openid) {
  if (!avatarUrl || isRemoteFile(avatarUrl)) return avatarUrl || "";
  const cloudPath = "avatars/" + openid + "_" + Date.now() + "." + getFileExt(avatarUrl);
  try {
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl
    });
    return res.fileID || avatarUrl;
  } catch (error) {
    console.warn("[auth] upload avatar failed", error);
    return avatarUrl;
  }
}

async function fetchOpenId() {
  const res = await wx.cloud.callFunction({ name: "login" });
  const data = res.result || {};
  if (!data.openid) {
    throw new Error("openid empty");
  }
  return data.openid;
}

async function ensureLogin(options) {
  const opts = options || {};
  const cached = getCachedUser();
  if (cached && cached.openid && !opts.refreshProfile) {
    return cached;
  }

  const openid = cached && cached.openid ? cached.openid : await fetchOpenId();
  const profile = opts.profile || (opts.withProfile ? await getUserProfile() : {});
  const avatarUrl = await uploadAvatar(profile.avatarUrl || (cached && cached.avatarUrl) || "", openid);
  return saveUser({
    openid,
    nickName: profile.nickName || (cached && cached.nickName) || "微信用户",
    avatarUrl,
    loggedAt: Date.now()
  });
}

module.exports = {
  getCachedUser,
  getUserProfile,
  ensureLogin,
  clearUser
};
