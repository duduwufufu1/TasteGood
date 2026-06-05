Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: "完善微信资料" },
    desc: { type: String, value: "" },
    submitText: { type: String, value: "确认登录" },
    avatarUrl: { type: String, value: "" },
    nickName: { type: String, value: "" },
    loading: { type: Boolean, value: false }
  },

  methods: {
    handleClose() {
      if (this.data.loading) return;
      this.triggerEvent("close");
    },

    handleChooseAvatar(e) {
      this.triggerEvent("chooseavatar", e.detail);
    },

    handleNickNameInput(e) {
      this.triggerEvent("nicknameinput", { value: e.detail.value });
    },

    handleConfirm() {
      if (this.data.loading) return;
      this.triggerEvent("confirm");
    },

    noop() {}
  }
});
