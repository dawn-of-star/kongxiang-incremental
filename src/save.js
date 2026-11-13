/**
 * save.js —— 存档（localStorage）
 *
 * 三层职责：
 *   ① 读 / 写 / 删；
 *   ② **外层格式**：`{ formatVersion, checksum, payload }`，checksum 对 payload 的
 *      **稳定序列化**结果做 FNV-1a（发现截断 / 手改 / 写入竞争）；
 *   ③ 校验失败时**保留原档并暂停写入** —— 自动存档不能把唯一的旧档覆盖掉。
 *
 * 字段级校验、补全与旧档迁移仍在 `state.js` 的 `deserialize`（显式白名单）里。
 */

import { BASE } from "./config.js";
import { deserialize, newState, serialize } from "./state.js";

/**
 * 当前外层格式版本：
 *   0 = 最老的「裸状态」存档（整个 JSON 就是 state，没有外层字段）
 *   1 = `{ formatVersion, payload }` 旧信封（没有 checksum，读取时容忍）
 *   2 = `{ formatVersion, checksum, payload }` 当前格式
 */
export const SAVE_FORMAT_VERSION = 2;
const CHECKSUM_PREFIX = "fnv1a:";

/**
 * 稳定序列化：对象键排序后输出，数组保持原顺序。
 *
 * 为什么不用 `JSON.stringify` 直接算 checksum：
 *   它的输出取决于属性**插入顺序**；同一个状态换个构造路径就可能算出不同 hash ✗
 *   这里保证 checksum 只取决于内容 ✓
 */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/**
 * FNV-1a（32 位），按 UTF-16 码元逐个喂（ASCII 结果与标准 FNV-1a 完全一致）。
 * 这不是密码学校验，只用于发现**损坏**；拿来防作弊本来就不够。
 */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 对 payload 算 checksum（带算法前缀，便于将来换算法时识别） */
export function checksumOf(payload) {
  return `${CHECKSUM_PREFIX}${fnv1a(stableStringify(payload))}`;
}

/** 把 payload 包成当前格式的存档对象 */
export function createSaveEnvelope(payload) {
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    checksum: checksumOf(payload),
    payload,
  };
}

/**
 * 校验一个**外层信封**。
 *
 * @returns {{ok: true, formatVersion: number, payload: object}
 *          | {ok: false, reason: string, formatVersion?: number, expected?: string, actual?: string}}
 */
export function verifySaveEnvelope(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "not-an-object" };
  }
  const formatVersion = Number(parsed.formatVersion);
  if (!Number.isInteger(formatVersion) || formatVersion < 1) {
    return { ok: false, reason: "bad-format-version" };
  }
  if (formatVersion > SAVE_FORMAT_VERSION) {
    return { ok: false, reason: "future-format-version", formatVersion };
  }
  if (!parsed.payload || typeof parsed.payload !== "object" || Array.isArray(parsed.payload)) {
    return { ok: false, reason: "bad-payload", formatVersion };
  }
  if (typeof parsed.checksum !== "string") {
    return { ok: false, reason: "missing-checksum", formatVersion };
  }
  const expected = checksumOf(parsed.payload);
  if (parsed.checksum !== expected) {
    return {
      ok: false, reason: "checksum-mismatch", formatVersion, expected, actual: parsed.checksum,
    };
  }
  return { ok: true, formatVersion, payload: parsed.payload };
}

// ══════════════════════════════════════════════════════════
// 写入闸门：校验失败后原档必须留在 localStorage 里
// ══════════════════════════════════════════════════════════
let blockedReason = "";

/** 当前是否因载入失败而暂停写入（给测试 / 控制台看） */
export function isSaveWriteBlocked() {
  return blockedReason !== "";
}

/** 暂停写入的原因（空串 = 未暂停） */
export function saveBlockedReason() {
  return blockedReason;
}

function blockWrites(reason) {
  blockedReason = reason;
}

function unblockWrites() {
  blockedReason = "";
}

function corruptResult(reason) {
  return {
    state: newState(),
    offlineSeconds: 0,
    ok: false,
    corrupted: true,
    reason,
  };
}

function isEnvelope(parsed) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    && Object.prototype.hasOwnProperty.call(parsed, "payload");
}

/** 反序列化 payload 并组装 load() 的返回值；字段不合法时按损坏处理。 */
function finishLoad(payload, formatVersion, extra = {}) {
  const { state, ok } = deserialize(payload);
  if (!ok) {
    blockWrites("deserialize-failed");
    return { ...corruptResult("deserialize-failed"), formatVersion };
  }
  unblockWrites();
  const savedAt = Number(payload?.lastSavedAt) || Date.now();
  return {
    state,
    offlineSeconds: Math.max(0, (Date.now() - savedAt) / 1000),
    ok: true,
    corrupted: false,
    formatVersion,
    legacy: formatVersion !== SAVE_FORMAT_VERSION,
    ...extra,
  };
}

/** 处理带 `payload` 的外层信封（v1 无 checksum / v2 当前格式）。 */
function loadEnvelope(parsed) {
  const formatVersion = Number(parsed.formatVersion);
  const oldEnvelope = Number.isInteger(formatVersion)
    && formatVersion >= 1 && formatVersion < SAVE_FORMAT_VERSION;

  // v1 旧信封只有 {formatVersion, payload}：按「旧档」容忍，不要求 checksum
  if (oldEnvelope && typeof parsed.checksum !== "string") {
    return finishLoad(parsed.payload, formatVersion, { legacy: true });
  }

  const check = verifySaveEnvelope(parsed);
  if (!check.ok) {
    console.warn(`[存档] 完整性校验失败（${check.reason}），已保留原档并暂停写入`);
    blockWrites(check.reason);
    return { ...corruptResult(check.reason), formatVersion: check.formatVersion };
  }
  return finishLoad(check.payload, check.formatVersion, {
    legacy: check.formatVersion !== SAVE_FORMAT_VERSION,
  });
}

/**
 * 写存档。成功返回 JSON 字节数（沿用旧接口），失败 / 暂停写入返回 0。
 * @param {object} state
 */
export function save(state) {
  if (blockedReason) {
    console.warn(`[存档] 已暂停写入（${blockedReason}）：原档保留，未覆盖`);
    return 0;
  }
  try {
    state.lastSavedAt = Date.now();
    const json = JSON.stringify(createSaveEnvelope(serialize(state)));
    localStorage.setItem(BASE.saveKey, json);
    return json.length;
  } catch (err) {
    console.warn("存档失败：", err);
    return 0;
  }
}

/** @returns {{state: object, offlineSeconds: number, ok: boolean, corrupted?: boolean,
 *             legacy?: boolean, formatVersion?: number, reason?: string}|null} */
export function load() {
  let raw;
  try {
    raw = localStorage.getItem(BASE.saveKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("存档 JSON 损坏，已保留原档并暂停写入：", err);
    blockWrites("json-parse-error");
    return corruptResult("json-parse-error");
  }

  if (isEnvelope(parsed)) return loadEnvelope(parsed);

  // 最老的存档：整个 JSON 就是 state 本身（formatVersion 视为 0）
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    blockWrites("legacy-not-object");
    return corruptResult("legacy-not-object");
  }
  return finishLoad(parsed, 0, { legacy: true });
}

export function clear() {
  try {
    localStorage.removeItem(BASE.saveKey);
  } catch { /* ignore */ }
  unblockWrites();
}
