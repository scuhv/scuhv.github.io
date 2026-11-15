/* ============================================================
   前台访问控制（静态站点登录门槛）
   - 账号密码只以 PBKDF2-SHA256 加盐哈希的形式写在
     assets/js/hv-gate-config.js 中，由后台生成静态网站时写入
   - 登录成功后在 localStorage / sessionStorage 里记一个带过期时间的令牌
   - 本文件由页面在 <head> 中同步加载，未登录会立即跳转 login.html
   ============================================================ */
(function (global) {
  "use strict";

  var CFG = global.HV_GATE || {};
  var STORE_KEY = "hvlab_gate";
  var DAY = 24 * 60 * 60;

  /* 站点根目录：由本脚本地址（…/assets/js/hv-gate.js）反推，
     这样放在子目录里的页面（如 profile/xxx.html）也能正确跳回根目录的 login.html。
     同步脚本执行时 document.currentScript 有效，必须在这里先缓存下来。 */
  var SITE_ROOT = (function () {
    try {
      var src = (document.currentScript && document.currentScript.src) || "";
      src = src.split("?")[0].split("#")[0];
      var at = src.lastIndexOf("assets/js/hv-gate.js");
      return at >= 0 ? src.slice(0, at) : "";
    } catch (e) {
      return "";
    }
  })();
  var LOGIN_PAGE = SITE_ROOT + "login.html";

  function accounts() {
    if (CFG.accounts && CFG.accounts.length) return CFG.accounts;
    // 兼容旧版单账号配置（没有账号名列表）：哈希里已经包含账号，仍可校验
    if (CFG.hash && CFG.salt) return [{ account: null, salt: CFG.salt, hash: CFG.hash }];
    return [];
  }

  function hashes() {
    return accounts().map(function (item) { return item.hash; });
  }

  function findAccount(name) {
    var list = accounts();
    for (var i = 0; i < list.length; i += 1) {
      // account 为 null 表示旧版配置，由输入的账号参与哈希计算
      if (list[i].account === null || list[i].account === name) return list[i];
    }
    return null;
  }

  function enabled() {
    return !!(CFG.enabled && accounts().length);
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function readRaw() {
    var raw = null;
    try { raw = global.localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      try { raw = global.sessionStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    }
    return raw;
  }

  function parseRaw(raw) {
    if (!raw) return null;
    var dot = raw.indexOf(".");
    if (dot <= 0) return null;
    var exp = parseInt(raw.slice(0, dot), 10);
    if (!exp || isNaN(exp)) return null;
    return { exp: exp, sig: raw.slice(dot + 1) };
  }

  function isAuthed() {
    if (!enabled()) return true;
    var token = parseRaw(readRaw());
    if (!token || token.exp <= nowSec()) return false;
    return hashes().indexOf(token.sig) !== -1;
  }

  function writeToken(exp, sig, remember) {
    var raw = exp + "." + sig;
    try {
      if (remember) {
        global.localStorage.setItem(STORE_KEY, raw);
        try { global.sessionStorage.removeItem(STORE_KEY); } catch (e) {}
      } else {
        global.sessionStorage.setItem(STORE_KEY, raw);
        try { global.localStorage.removeItem(STORE_KEY); } catch (e) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function signOut() {
    try { global.localStorage.removeItem(STORE_KEY); } catch (e) {}
    try { global.sessionStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  function currentPage() {
    // 返回相对站点根的路径（可能带子目录，如 profile/profile-1a2b3c4d.html）
    var here = "";
    try { here = String(global.location.href).split("?")[0].split("#")[0]; } catch (e) { here = ""; }
    if (here && SITE_ROOT && here.indexOf(SITE_ROOT) === 0) {
      return here.slice(SITE_ROOT.length) || "index.html";
    }
    var name = "";
    try { name = global.location.pathname.split("/").pop() || ""; } catch (e) { name = ""; }
    if (!name) name = "index.html";
    return name;
  }

  function loginUrl(next) {
    return LOGIN_PAGE + "?next=" + encodeURIComponent(next || currentPage());
  }

  function safeNext() {
    var value = "";
    try {
      value = new URLSearchParams(global.location.search).get("next") || "";
    } catch (e) {
      var m = /[?&]next=([^&#]*)/.exec(global.location.search || "");
      if (m) {
        try { value = decodeURIComponent(m[1]); } catch (e2) { value = ""; }
      }
    }
    value = value.split("#")[0].split("?")[0];
    // 允许 profile/xxx.html 这种子目录页面，但不允许跳出站点（..）
    if (/^[A-Za-z0-9._\/-]+\.html$/.test(value) && value.indexOf("..") === -1) return value;
    return "index.html";
  }

  function toBytes(text) {
    if (global.TextEncoder) return new global.TextEncoder().encode(text);
    var utf8 = unescape(encodeURIComponent(text));
    var out = new Uint8Array(utf8.length);
    for (var i = 0; i < utf8.length; i += 1) out[i] = utf8.charCodeAt(i);
    return out;
  }

  function hexToBytes(hex) {
    var clean = String(hex || "").replace(/[^0-9a-fA-F]/g, "");
    if (clean.length % 2) clean = "0" + clean;
    var out = new Uint8Array(clean.length / 2);
    for (var i = 0; i < out.length; i += 1) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 1) {
      out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    }
    return out;
  }

  // PBKDF2-SHA256(账号 + ":" + 密码, salt, iterations)，后台用 hashlib 同款算法
  function derive(account, password, salt) {
    var subtle = global.crypto && global.crypto.subtle;
    if (!subtle) {
      return Promise.reject(new Error(
        "当前浏览器环境不支持安全校验，请改用 Chrome / Edge / Firefox，或通过 http(s) 打开本页。"));
    }
    var material = toBytes(account + ":" + password);
    return subtle.importKey("raw", material, { name: "PBKDF2" }, false, ["deriveBits"])
      .then(function (key) {
        return subtle.deriveBits({
          name: "PBKDF2",
          salt: hexToBytes(salt),
          iterations: parseInt(CFG.iterations, 10) || 150000,
          hash: "SHA-256"
        }, key, 256);
      })
      .then(function (bits) {
        return bytesToHex(new Uint8Array(bits));
      });
  }

  function signIn(account, password, remember) {
    if (!enabled()) return Promise.resolve(true);
    var entry = findAccount(account);
    if (!entry) return Promise.resolve(false);
    return derive(account, password, entry.salt).then(function (hash) {
      if (hash !== entry.hash) return false;
      var hours = parseFloat(CFG.sessionHours) || 12;
      var exp = nowSec() + Math.max(1, Math.round(hours * 3600));
      return writeToken(exp, entry.hash, remember !== false);
    });
  }

  // 页面守卫：登录页本身不跳转
  function guard() {
    if (!enabled()) return;
    if (document.documentElement.getAttribute("data-auth") === "login") return;
    if (isAuthed()) return;
    document.documentElement.style.visibility = "hidden";
    global.location.replace(loginUrl(currentPage()));
  }

  global.HVGate = {
    config: CFG,
    enabled: enabled,
    isAuthed: isAuthed,
    signIn: signIn,
    signOut: signOut,
    currentPage: currentPage,
    loginUrl: loginUrl,
    safeNext: safeNext,
    guard: guard,
    day: DAY
  };

  guard();
})(window);
