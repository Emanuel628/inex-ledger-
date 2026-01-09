const state = {
  vmk: null,
  userId: null,
  vaultSalt: null,
  vaultKdf: null,
  isUnlocked: false,
  unlockedAt: null,
  lastActiveAt: null,
  vaultData: {},
  dirty: false,
  metadata: {},
};

export const vaultMemory = {
  setUnlocked({ vmk, userId, vaultSalt, vaultKdf, data }) {
    state.vmk = vmk;
    state.userId = userId;
    state.vaultSalt = vaultSalt;
    state.vaultKdf = vaultKdf;
    state.vaultData = data || {};
    state.isUnlocked = true;
    state.unlockedAt = Date.now();
    state.lastActiveAt = Date.now();
    state.dirty = false;
    state.metadata = {};
  },
  clearUnlocked() {
    state.vmk = null;
    state.userId = null;
    state.vaultSalt = null;
    state.vaultKdf = null;
    state.isUnlocked = false;
    state.unlockedAt = null;
    state.lastActiveAt = null;
    state.vaultData = {};
    state.dirty = false;
    state.metadata = {};
  },
  touchActivity() {
    if (!state.isUnlocked) return;
    state.lastActiveAt = Date.now();
  },
  markDirty() {
    state.dirty = true;
  },
  markClean() {
    state.dirty = false;
  },
  getField(key) {
    if (!state.isUnlocked) return null;
    return state.vaultData[key] ?? null;
  },
  setField(key, value, meta = null) {
    if (!state.isUnlocked) return;
    state.vaultData[key] = value;
    state.dirty = true;
    if (meta) {
      state.metadata[key] = { ...state.metadata[key], ...meta };
    }
  },
  getVaultData() {
    return state.vaultData;
  },
  getMetadata(key) {
    return state.metadata[key] || null;
  },
  deleteField(key) {
    if (!state.isUnlocked) return;
    if (key in state.vaultData) {
      delete state.vaultData[key];
      state.dirty = true;
    }
  },
  getVmk() {
    return state.vmk;
  },
  getVaultSalt() {
    return state.vaultSalt;
  },
  getVaultKdf() {
    return state.vaultKdf;
  },
  isUnlocked() {
    return state.isUnlocked;
  },
  getLastActiveAt() {
    return state.lastActiveAt;
  },
  getUserId() {
    return state.userId;
  },
  isDirty() {
    return state.dirty;
  },
};
