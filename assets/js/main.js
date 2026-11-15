/* VCTI Lab · 个人学术主页 —— 交互脚本（无依赖） */
(function () {
  "use strict";

  /* ---------------- 年份占位 ---------------- */
  var thisYear = String(new Date().getFullYear());
  Array.prototype.forEach.call(document.querySelectorAll(".js-year"), function (el) {
    el.textContent = thisYear;
  });

  /* ---------------- 深浅色切换 ---------------- */
  var themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var root = document.documentElement;
      var cur = root.getAttribute("data-theme");
      var isDark = cur
        ? cur === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;

      if (isDark) {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", "dark");
      }

      try {
        localStorage.setItem("theme", isDark ? "light" : "dark");
      } catch (e) {}
    });
  }

  /* ---------------- 图片点击看大图 ---------------- */
  var zoomBox = null;

  function closeZoom() {
    if (!zoomBox) return;
    zoomBox.remove();
    zoomBox = null;
    document.documentElement.classList.remove("zoom-open");
  }

  function openZoom(img) {
    closeZoom();
    zoomBox = document.createElement("div");
    zoomBox.className = "zoom";
    var big = document.createElement("img");
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || "";
    zoomBox.appendChild(big);
    zoomBox.addEventListener("click", closeZoom);
    document.body.appendChild(zoomBox);
    document.documentElement.classList.add("zoom-open");
  }

  document.addEventListener("click", function (ev) {
    var img = ev.target && ev.target.closest ? ev.target.closest("img[data-zoom]") : null;
    if (img) {
      ev.preventDefault();
      openZoom(img);
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeZoom();
  });

  /* ---------------- 项目页：算法研究 / 硬件开发 / 开源项目 ---------------- */
  (function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".proj-tab"));
    if (!tabs.length) return;

    var panels = {};
    tabs.forEach(function (tab) {
      panels[tab.getAttribute("data-tab")] = document.getElementById("ppanel-" + tab.getAttribute("data-tab"));
    });

    function activate(name, remember) {
      if (!panels[name]) return;
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-tab") === name;
        tab.classList.toggle("is-on", on);
        if (on) {
          tab.setAttribute("aria-current", "page");
        } else {
          tab.removeAttribute("aria-current");
        }
        if (panels[tab.getAttribute("data-tab")]) {
          panels[tab.getAttribute("data-tab")].hidden = !on;
        }
      });
      if (remember && history.replaceState) {
        history.replaceState(null, "", "#" + name);
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (ev) {
        var name = tab.getAttribute("data-tab");
        // 详情页没有对应面板，交给链接跳回项目页对应标签
        if (!panels[name]) return;
        ev.preventDefault();
        activate(name, true);
      });
      tab.addEventListener("keydown", function (ev) {
        var i = tabs.indexOf(tab);
        var next = null;
        if (ev.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (ev.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (next) {
          ev.preventDefault();
          next.focus();
          if (panels[next.getAttribute("data-tab")]) {
            activate(next.getAttribute("data-tab"), true);
          }
        }
      });
    });

    var fromHash = (location.hash || "").replace("#", "");
    if (fromHash && panels[fromHash]) activate(fromHash, false);
  })();

  /* ---------------- 硬件产品图集：大图 + 底部缩略图导航条 ---------------- */
  var viewerBox = null;    // 看图弹窗
  var viewerState = null;  // { images, index, img, count, rail }

  function gallerySources(trigger) {
    var card = trigger.closest(".hw-card");
    var box = card ? card.querySelector(".hw-card__gallery") : null;
    var list = [];
    if (box) {
      Array.prototype.forEach.call(box.querySelectorAll("img"), function (im) {
        var src = im.currentSrc || im.getAttribute("src");
        if (src) {
          list.push({
            src: src,
            alt: im.alt || "",
            caption: (im.getAttribute("data-caption") || "").trim()
          });
        }
      });
    }
    if (!list.length) {
      var cover = trigger.querySelector("img") || trigger;
      var src = cover.currentSrc || cover.getAttribute("src");
      if (src) list.push({ src: src, alt: cover.alt || "" });
    }
    return list;
  }

  function closeViewer() {
    if (!viewerBox) return;
    viewerBox.remove();
    viewerBox = null;
    viewerState = null;
    document.documentElement.classList.remove("zoom-open");
  }

  // 切到第 index 张：右侧换原图、左侧高亮点亮并自动滚到可见
  function viewerShow(index) {
    if (!viewerState) return;
    var total = viewerState.images.length;
    // 到第一张 / 最后一张就停住，不循环
    if (index < 0) index = 0;
    if (index > total - 1) index = total - 1;
    viewerState.index = index;
    var item = viewerState.images[index];
    viewerState.img.src = item.src;
    viewerState.img.alt = item.alt || "";
    viewerState.count.textContent = (index + 1) + " / " + total;
    // 每张小图的小标题（后台可填，未填则不显示）
    var caption = item.caption || "";
    viewerState.caption.textContent = caption;
    viewerState.caption.hidden = !caption;
    Array.prototype.forEach.call(viewerState.rail.children, function (btn, i) {
      btn.classList.toggle("is-on", i === index);
    });
    // 底部横排导航：把当前缩略图滚到可见区域（不动页面本身）
    var rail = viewerState.rail;
    var active = rail.children[index];
    if (active) {
      var r = active.getBoundingClientRect();
      var railRect = rail.getBoundingClientRect();
      if (r.left < railRect.left) rail.scrollLeft -= railRect.left - r.left + 12;
      else if (r.right > railRect.right) rail.scrollLeft += r.right - railRect.right + 12;
    }
  }

  // 看图弹窗：上方原图 + 底部缩略图导航条；滚轮 / ← → 切换，Esc 或点空白关闭
  function openViewer(images, index, title) {
    if (!images || !images.length) return;
    closeViewer();

    var box = document.createElement("div");
    box.className = "zoom zoom--viewer";

    var wrap = document.createElement("div");
    wrap.className = "viewer";

    var rail = document.createElement("nav");
    rail.className = "viewer__rail";
    rail.setAttribute("aria-label", "图片缩略图");
    images.forEach(function (im, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "viewer__thumb";
      btn.setAttribute("aria-label", "查看第 " + (i + 1) + " 张");
      var thumb = document.createElement("img");
      thumb.src = im.src;
      thumb.alt = "";
      thumb.loading = "lazy";
      btn.appendChild(thumb);
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        viewerShow(i);
      });
      rail.appendChild(btn);
    });

    var stage = document.createElement("figure");
    stage.className = "viewer__stage";
    var img = document.createElement("img");
    img.className = "viewer__img";
    img.alt = title || "";
    stage.appendChild(img);
    var caption = document.createElement("p");
    caption.className = "viewer__caption";
    caption.hidden = true;
    stage.appendChild(caption);

    var count = document.createElement("figcaption");
    count.className = "viewer__count";
    stage.appendChild(count);

    // 先放原图舞台、再放缩略图条，视觉上导航条才会在底部
    wrap.appendChild(stage);
    wrap.appendChild(rail);
    box.appendChild(wrap);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "photo__close";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      closeViewer();
    });
    box.appendChild(closeBtn);

    // 点背景（不点缩略图和图片本身）关闭
    box.addEventListener("click", function (ev) {
      if (ev.target === box || ev.target === wrap || ev.target === stage) closeViewer();
    });

    // 滚轮切换上一张 / 下一张；在缩略图栏上滚动则滚缩略图
    var acc = 0;
    var lock = 0;
    box.addEventListener("wheel", function (ev) {
      // 指针在底部缩略图条上时，滚轮用来横向滚动缩略图
      if (ev.target.closest && ev.target.closest(".viewer__rail")) {
        if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
          rail.scrollLeft += ev.deltaY;
          ev.preventDefault();
        }
        return;
      }
      ev.preventDefault();
      var now = Date.now();
      if (now < lock) return;
      acc += ev.deltaY;
      if (Math.abs(acc) < 30) return;
      var step = acc > 0 ? 1 : -1;
      acc = 0;
      lock = now + 220;
      viewerShow(viewerState.index + step);
    }, { passive: false });

    viewerBox = box;
    viewerState = { images: images, index: 0, img: img, count: count, rail: rail,
                    caption: caption };
    document.body.appendChild(box);
    document.documentElement.classList.add("zoom-open");
    viewerShow(index || 0);
  }

  function closeGallery() {
    closeViewer();
  }

  function openGallery(trigger) {
    var images = gallerySources(trigger);
    if (!images.length) return;
    var card = trigger.closest(".hw-card");
    var titleEl = card ? card.querySelector(".hw-card__title") : null;
    openViewer(images, 0, titleEl ? titleEl.textContent.trim() : "");
  }

  document.addEventListener("click", function (ev) {
    var trigger = ev.target && ev.target.closest ? ev.target.closest("[data-gallery]") : null;
    if (!trigger) return;
    // 首页自动滚动条也用 data-gallery 标记容器，这里只处理硬件产品卡片
    if (!trigger.closest(".hw-card")) return;
    ev.preventDefault();
    openGallery(trigger);
  });

  document.addEventListener("keydown", function (ev) {
    if (!viewerState) return;
    if (ev.key === "ArrowRight") { viewerShow(viewerState.index + 1); return; }
    if (ev.key === "ArrowLeft") { viewerShow(viewerState.index - 1); return; }
    if (ev.key === "Escape") closeViewer();
  });

  /* ---------------- 教材出版信息弹窗 ---------------- */
  // 让弹窗贴在书名下方、左端对齐
  function placeBookDialog(dlg, anchor) {
    var r = anchor.getBoundingClientRect();
    var box = dlg.getBoundingClientRect();
    var left = Math.round(r.left);
    var maxLeft = window.innerWidth - box.width - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;

    var top = Math.round(r.bottom + 8);
    var maxTop = window.innerHeight - Math.min(box.height, window.innerHeight - 24) - 12;
    if (top > maxTop) top = Math.max(12, maxTop);

    dlg.style.position = "fixed";
    dlg.style.margin = "0";
    dlg.style.right = "auto";
    dlg.style.bottom = "auto";
    dlg.style.left = left + "px";
    dlg.style.top = top + "px";
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-book-dialog]") : null;
    if (btn) {
      var dlg = document.getElementById(btn.getAttribute("data-book-dialog"));
      if (!dlg) return;
      ev.preventDefault();
      if (typeof dlg.showModal === "function") {
        if (dlg.open) {
          dlg.close();
        } else {
          dlg.showModal();
          placeBookDialog(dlg, btn);
        }
      } else {
        dlg.setAttribute("open", "");
      }
      return;
    }

    // 点击弹窗外的遮罩区域关闭
    if (ev.target && ev.target.matches && ev.target.matches("dialog.book-dialog, dialog.cite-dialog, dialog.cert-dialog")) {
      var rect = ev.target.getBoundingClientRect();
      var outside = ev.clientX < rect.left || ev.clientX > rect.right ||
        ev.clientY < rect.top || ev.clientY > rect.bottom;
      if (outside && ev.target.close) ev.target.close();
    }
  });

  /* ---------------- 专利授权证书弹窗 ---------------- */
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-cert-dialog]") : null;
    if (!btn) return;
    var dlg = document.getElementById(btn.getAttribute("data-cert-dialog"));
    if (!dlg) return;
    ev.preventDefault();
    if (typeof dlg.showModal === "function") {
      if (dlg.open) {
        dlg.close();
      } else {
        dlg.showModal();
      }
    } else {
      dlg.setAttribute("open", "");
    }
  });

  /* ---------------- 论文引用格式弹窗 ---------------- */
  /* @cite-format-start */
  var COMPOUND_SURNAMES = ["欧阳", "司马", "上官", "诸葛", "东方", "皇甫", "尉迟",
    "公孙", "慕容", "长孙", "宇文", "司徒", "夏侯", "独孤", "南宫", "令狐"];

  function citeNameParts(name) {
    var text = String(name == null ? "" : name).trim();
    if (!text) return null;
    if (/[\u4e00-\u9fff]/.test(text)) {
      var surname = text.slice(0, 1);
      for (var i = 0; i < COMPOUND_SURNAMES.length; i += 1) {
        if (text.indexOf(COMPOUND_SURNAMES[i]) === 0) {
          surname = COMPOUND_SURNAMES[i];
          break;
        }
      }
      return { cn: true, surname: surname, given: text.slice(surname.length), full: text };
    }
    var tokens = text.split(/\s+/);
    var last = tokens.length > 1 ? tokens[tokens.length - 1] : tokens[0];
    var first = tokens.length > 1 ? tokens.slice(0, -1).join(" ") : "";
    return { cn: false, surname: last, given: first, full: text };
  }

  function citeInitials(given) {
    return String(given || "").split(/\s+/).filter(Boolean)
      .map(function (word) { return word.charAt(0).toUpperCase(); }).join("");
  }

  function citeAuthorList(data, mode) {
    var parts = (data.a || []).map(citeNameParts).filter(Boolean);
    var short = mode === "initials-first" || mode === "surname-initials";
    var use = short ? parts.slice(0, 3) : parts;
    var names = use.map(function (person) {
      var initials = citeInitials(person.given);
      if (mode === "initials-first") {
        return person.cn ? person.full : (initials + " " + person.surname);
      }
      if (mode === "surname-initials") {
        return person.cn ? person.full : (person.surname + (initials ? " " + initials : ""));
      }
      if (mode === "full-surname") {
        return person.cn ? person.full
          : (person.surname + (person.given ? " " + person.given : ""));
      }
      return person.cn ? person.full
        : (person.given ? person.given + " " + person.surname : person.surname);
    });
    var text = names.join(", ");
    if (short && parts.length > 3) text += ", et al";
    return text;
  }

  function citeSource(data) {
    var venue = data.v || "";
    var year = data.y || "";
    var vol = data.vol || "";
    var issue = data.no || "";
    var pages = data.pg || "";
    var loc = vol ? vol + (issue ? "(" + issue + ")" : "") : "";
    var text = venue;
    if (year) text += (text ? ", " : "") + year;
    if (loc) text += ", " + loc;
    if (pages) text += ": " + pages;
    return text;
  }

  function citePlain(data, mode) {
    var authors = citeAuthorList(data, mode);
    var text = authors ? authors + ". " : "";
    text += (data.t || "") + "[" + (data.k || "J") + "]. ";
    text += citeSource(data) + ".";
    if (data.doi) text += " DOI: " + data.doi + ".";
    return text;
  }

  function citeBibtex(data) {
    var parts = (data.a || []).map(citeNameParts).filter(Boolean);
    var authors = parts.map(function (person) {
      return person.cn ? person.full : (person.surname + ", " + person.given);
    }).join(" and ");
    var first = parts[0] || { cn: false, given: "", full: "" };
    var keyBase = (first.cn ? first.full : (first.given || "")).replace(/[^0-9A-Za-z\u4e00-\u9fff]/g, "");
    var titleWord = String(data.t || "").split(/\s+/)[0].replace(/[^0-9A-Za-z]/g, "");
    var type = data.k === "C" ? "inproceedings" : "article";
    var field = data.k === "C" ? "booktitle" : "journal";
    var lines = [
      "@" + type + "{" + keyBase + (data.y || "") + titleWord.charAt(0).toUpperCase() + ",",
      "  title = {" + (data.t || "") + "},",
      "  author = {" + authors + "},",
      "  " + field + " = {" + (data.v || "") + "},"
    ];
    if (data.y) lines.push("  year = {" + data.y + "},");
    if (data.vol) lines.push("  volume = {" + data.vol + "},");
    if (data.no) lines.push("  number = {" + data.no + "},");
    if (data.pg) lines.push("  pages = {" + data.pg + "},");
    if (data.doi) lines.push("  doi = {" + data.doi + "},");
    lines.push("}");
    return lines.join("\n");
  }

  function formatCitations(data) {
    return [
      { label: "① 缩写在名前（IEEE 常用）", text: citePlain(data, "initials-first") },
      { label: "② 缩写在姓后", text: citePlain(data, "surname-initials") },
      { label: "③ 全名·姓在前（GB/T 7714）", text: citePlain(data, "full-surname") },
      { label: "④ 全名·名在前", text: citePlain(data, "full-given") },
      { label: "⑤ BibTeX", text: citeBibtex(data) }
    ];
  }
  /* @cite-format-end */

  function copyPlainText(text, button) {
    var done = function () {
      var old = button.textContent;
      button.textContent = "已复制";
      setTimeout(function () { button.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  function fillCiteDialog(data) {
    var list = document.getElementById("citeList");
    var title = document.getElementById("citeTitle");
    if (!list) return;
    if (title) title.textContent = data.t || "引用格式";
    list.textContent = "";
    formatCitations(data).forEach(function (item) {
      var wrap = document.createElement("div");
      wrap.className = "cite-item";

      var head = document.createElement("div");
      head.className = "cite-item__head";
      var name = document.createElement("span");
      name.className = "cite-item__name";
      name.textContent = item.label;
      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "cite-item__copy";
      copy.textContent = "复制";
      copy.addEventListener("click", function () { copyPlainText(item.text, copy); });
      head.appendChild(name);
      head.appendChild(copy);

      var pre = document.createElement("pre");
      pre.className = "cite-item__text";
      pre.textContent = item.text;

      wrap.appendChild(head);
      wrap.appendChild(pre);
      list.appendChild(wrap);
    });
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-cite-btn]") : null;
    if (!btn) return;
    var card = btn.closest(".pub");
    var dialog = document.getElementById("citeDialog");
    if (!card || !dialog) return;
    var data;
    try {
      data = JSON.parse(card.getAttribute("data-cite") || "{}");
    } catch (e) {
      return;
    }
    ev.preventDefault();
    fillCiteDialog(data);
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  });

  /* ---------------- 批量导出引用 ---------------- */
  var exportDialog = document.getElementById("exportDialog");

  if (exportDialog) {
    var exportText = document.getElementById("exportText");
    var exportFormat = document.getElementById("exportFormat");
    var exportCount = document.getElementById("exportCount");
    var exportTip = document.getElementById("exportTip");
    var exportCopy = document.getElementById("exportCopy");
    var exportDownload = document.getElementById("exportDownload");

    var visibleCitationData = function () {
      return Array.prototype.slice
        .call(document.querySelectorAll(".pub[data-cite]"))
        .filter(function (card) { return !card.hidden; })
        .map(function (card) {
          try {
            return JSON.parse(card.getAttribute("data-cite") || "{}");
          } catch (e) {
            return null;
          }
        })
        .filter(function (data) { return data && data.t; });
    };

    var buildExport = function () {
      var items = visibleCitationData();
      var fmt = parseInt(exportFormat && exportFormat.value, 10) || 0;
      var lines = items.map(function (data, i) {
        var text = formatCitations(data)[fmt].text;
        return fmt === 4 ? text : (i + 1) + ". " + text;
      });
      if (exportText) exportText.value = lines.join(fmt === 4 ? "\n\n" : "\n");
      if (exportCount) exportCount.textContent = "共 " + items.length + " 条";
      if (exportTip) exportTip.textContent = "";
      return { bibtex: fmt === 4 };
    };

    if (exportFormat) {
      exportFormat.addEventListener("change", buildExport);
    }

    if (exportCopy) {
      exportCopy.addEventListener("click", function () {
        if (!exportText || !exportText.value) return;
        copyPlainText(exportText.value, exportCopy);
        if (exportTip) exportTip.textContent = "已复制到剪贴板";
      });
    }

    if (exportDownload) {
      exportDownload.addEventListener("click", function () {
        var info = buildExport();
        if (!exportText || !exportText.value) return;
        var blob = new Blob([exportText.value], { type: "text/plain;charset=utf-8" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = info.bibtex ? "citations.bib" : "citations.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        if (exportTip) exportTip.textContent = "已下载引用文件";
      });
    }

    document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-export-btn]") : null;
      if (!btn) return;
      ev.preventDefault();
      buildExport();
      if (typeof exportDialog.showModal === "function" && !exportDialog.open) {
        exportDialog.showModal();
      }
    });
  }

  /* ---------------- 侧栏社交图标 ---------------- */
  var SOCIAL = [
    { match: "github.com", mark: "G", color: "#24292f" },
    { match: "scholar.google", mark: "S", color: "#4285f4" },
    { match: "orcid.org", mark: "iD", color: "#a6ce39" },
    { match: "dblp", mark: "D", color: "#1f4e79" },
    { match: "researchgate", mark: "R", color: "#00a89d" },
    { match: "mailto:", mark: "@", color: "#6b7280" }
  ];

  Array.prototype.forEach.call(document.querySelectorAll(".links a"), function (a) {
    var href = (a.getAttribute("href") || "").toLowerCase();
    for (var i = 0; i < SOCIAL.length; i += 1) {
      if (href.indexOf(SOCIAL[i].match) !== -1) {
        var ico = document.createElement("span");
        ico.className = "ico";
        ico.style.setProperty("--c", SOCIAL[i].color);
        ico.textContent = SOCIAL[i].mark;
        a.insertBefore(ico, a.firstChild);
        break;
      }
    }
  });

  /* ---------------- 作者名胶囊化 ---------------- */
  function decorateAuthors(p) {
    var frag = document.createDocumentFragment();
    var buf = [];
    var self = false;

    function flush() {
      var name = buf
        .join("")
        .replace(/^[\s,，]+/, "")
        .replace(/[\s,，]+$/, "")
        .replace(/^and\s+/i, "");

      if (name) {
        var span = document.createElement("span");
        span.className = self ? "au au--self" : "au";
        span.textContent = name;
        frag.appendChild(span);
      }
      buf = [];
      self = false;
    }

    Array.prototype.forEach.call(p.childNodes, function (node) {
      if (node.nodeType === 3) {
        node.nodeValue.split(/[,，]/).forEach(function (text, i) {
          if (i > 0) flush();
          if (text.trim()) buf.push(text);
        });
      } else if (node.nodeType === 1) {
        if (node.tagName === "STRONG") self = true;
        buf.push(node.textContent);
      }
    });
    flush();

    p.textContent = "";
    p.appendChild(frag);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".pub__authors"), decorateAuthors);

  /* ---------------- 搜索关键词高亮 ---------------- */
  var HIT_CLASS = "search-hit";

  function clearHits(root) {
    if (!root || !root.querySelectorAll) return;
    var marks = root.querySelectorAll("mark." + HIT_CLASS);
    for (var i = marks.length - 1; i >= 0; i -= 1) {
      var mark = marks[i];
      var parent = mark.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
  }

  function applyHits(root, query) {
    if (!root || !query) return;
    var q = String(query).toLowerCase();
    if (!q) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      var parent = node.parentNode;
      var skip = false;
      while (parent && parent !== root) {
        var tag = parent.nodeName ? parent.nodeName.toLowerCase() : "";
        if (tag === "script" || tag === "style" || tag === "textarea" || tag === "mark") {
          skip = true;
          break;
        }
        parent = parent.parentNode;
      }
      if (!skip) nodes.push(node);
    }

    nodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var lower = text.toLowerCase();
      var at = lower.indexOf(q);
      if (at === -1) return;

      var frag = document.createDocumentFragment();
      var last = 0;
      while (at !== -1) {
        if (at > last) frag.appendChild(document.createTextNode(text.slice(last, at)));
        var mark = document.createElement("mark");
        mark.className = HIT_CLASS;
        mark.textContent = text.slice(at, at + q.length);
        frag.appendChild(mark);
        last = at + q.length;
        at = lower.indexOf(q, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  window.HVHighlight = {
    clear: clearHits,
    apply: applyHits,
    update: function (root, query) {
      clearHits(root);
      applyHits(root, query);
    }
  };

  /* ---------------- 论文筛选 ---------------- */
  var searchInput = document.getElementById("pubSearch");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var pubs = Array.prototype.slice.call(document.querySelectorAll(".pub[data-type]"));
  var emptyTip = document.getElementById("pubEmpty");
  var yearNav = document.querySelector(".yearnav");

  if (pubs.length) {
    var state = { q: "", type: "all" };

    var apply = function () {
      var visible = 0;

      pubs.forEach(function (pub) {
        var matchType = state.type === "all" || pub.dataset.type === state.type;
        var matchText =
          !state.q || pub.textContent.toLowerCase().indexOf(state.q) !== -1;
        var show = matchType && matchText;
        pub.hidden = !show;
        if (show) visible += 1;
      });

      Array.prototype.slice
        .call(document.querySelectorAll(".pub-year"))
        .forEach(function (sec) {
          var any = Array.prototype.some.call(
            sec.querySelectorAll(".pub"),
            function (p) {
              return !p.hidden;
            }
          );
          sec.hidden = !any;
        });

      if (emptyTip) emptyTip.hidden = visible > 0;
      if (yearNav) yearNav.hidden = visible === 0;

      // 搜索结果：把命中的关键词标上背景色
      pubs.forEach(function (pub) {
        clearHits(pub);
      });
      if (state.q) {
        pubs.forEach(function (pub) {
          if (!pub.hidden) applyHits(pub, state.q);
        });
      }
    };

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.q = this.value.trim().toLowerCase();
        apply();
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) {
          c.classList.remove("is-active");
        });
        chip.classList.add("is-active");
        state.type = chip.dataset.filter || "all";
        apply();
      });
    });
  }

  /* ---------------- 教材与专著筛选 ---------------- */
  var bookSearch = document.getElementById("bookSearch");
  var bookItems = Array.prototype.slice.call(document.querySelectorAll(".book"));
  var bookEmpty = document.getElementById("bookEmpty");
  var bookSection = document.getElementById("books");

  if (bookSearch && bookItems.length) {
    var applyBooks = function () {
      var q = bookSearch.value.trim().toLowerCase();
      var visible = 0;

      bookItems.forEach(function (item) {
        var show = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
        item.hidden = !show;
        if (show) visible += 1;
        clearHits(item);
      });

      if (q) {
        bookItems.forEach(function (item) {
          if (!item.hidden) applyHits(item, q);
        });
      }

      if (bookSection) bookSection.hidden = !!q && visible === 0;
      if (bookEmpty) bookEmpty.hidden = !(q && visible === 0);
    };

    bookSearch.addEventListener("input", applyBooks);
  }

  /* ---------------- 论文列表：展开 / 收起全部信息 ---------------- */
  var pubsToggles = Array.prototype.slice.call(
    document.querySelectorAll("[data-pubs-toggle]")
  );

  if (pubsToggles.length) {
    var TITLES_ONLY_KEY = "pubsTitlesOnly";

    var applyTitlesOnly = function (collapsed) {
      document.body.classList.toggle("pubs-titles-only", collapsed);
      pubsToggles.forEach(function (btn) {
        btn.textContent = collapsed ? "展开全部信息" : "收起全部信息";
        btn.setAttribute("aria-expanded", String(!collapsed));
        btn.title = collapsed ? "显示作者、期刊、链接等信息" : "只显示文献标题";
      });
    };

    var startCollapsed = false;
    try {
      startCollapsed = window.localStorage.getItem(TITLES_ONLY_KEY) === "1";
    } catch (e) {}
    applyTitlesOnly(startCollapsed);

    pubsToggles.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = !document.body.classList.contains("pubs-titles-only");
        applyTitlesOnly(next);
        try {
          window.localStorage.setItem(TITLES_ONLY_KEY, next ? "1" : "0");
        } catch (e) {}
      });
    });
  }

  /* ---------------- 页内导航高亮（论文年份 / 资源分类） ---------------- */
  function setupScrollSpy(navSelector) {
    var links = Array.prototype.slice.call(document.querySelectorAll(navSelector));
    var targets = links
      .map(function (a) {
        var href = a.getAttribute("href") || "";
        return href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
      })
      .filter(Boolean);

    if (!links.length || !targets.length || !("IntersectionObserver" in window)) return;

    var linkMap = {};
    links.forEach(function (a) {
      linkMap[(a.getAttribute("href") || "").slice(1)] = a;
    });

    var current = null;

    var setActive = function (id) {
      var link = linkMap[id];
      if (!link || link === current) return;
      current = link;
      links.forEach(function (a) {
        a.classList.toggle("is-active", a === link);
      });
    };

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-12% 0px -78% 0px", threshold: 0 }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  setupScrollSpy(".yearnav a");
  setupScrollSpy(".resnav a");

  /* ---------------- 首页图片画廊：按配置速度计算滚动时长 ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-gallery]"), function (box) {
    var track = box.querySelector(".gal__track");
    if (!track) return;
    var speed = parseFloat(box.dataset.speed) || 60; // px / 秒

    var fit = function () {
      var half = track.scrollWidth / 2; // 一份内容 + 一个间距
      if (!half || !speed) return;
      track.style.animationDuration = Math.max(4, half / speed).toFixed(2) + "s";
    };

    fit();
    window.addEventListener("load", fit);
    window.addEventListener("resize", fit);
  });

  /* ---------------- 专利引用导出 ---------------- */
  (function () {
    var dialog = document.getElementById("patentExportDialog");
    if (!dialog) return;

    var openBtn = document.querySelector("[data-patent-export]");
    var text = document.getElementById("patentExportText");
    var format = document.getElementById("patentExportFormat");
    var count = document.getElementById("patentExportCount");
    var tip = document.getElementById("patentExportTip");
    var copyBtn = document.getElementById("patentExportCopy");
    var downloadBtn = document.getElementById("patentExportDownload");

    /* 从专利卡片读取标题、发明人、专利号与日期 */
    var readCard = function (card) {
      var titleEl = card.querySelector(".patent__title");
      var authorEl = card.querySelector(".patent__authors");
      var spans = card.querySelectorAll(".patent__num span");
      var dateText = spans[1] ? spans[1].textContent : "";
      var dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
      var authors = (authorEl ? authorEl.textContent : "")
        .split(/[,，、;；]/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s; });
      return {
        t: titleEl ? titleEl.textContent.trim() : "",
        a: authors,
        n: spans[0] ? spans[0].textContent.trim() : "",
        d: dateMatch ? dateMatch[0] : dateText.trim()
      };
    };

    /* brief = true 时，超过 3 位发明人只保留前三位加「等」 */
    var authorText = function (list, brief) {
      if (!list.length) return "";
      if (brief && list.length > 3) return list.slice(0, 3).join(",") + ",等";
      return list.join(",");
    };

    /* 标题与发明人之间用英文句号「.」分隔，其余仍用逗号 */
    var dotted = function (left, right) {
      if (!left) return right;
      if (!right) return left;
      return left + "." + right;
    };

    var patentLine = function (item, fmt) {
      var all = authorText(item.a, false);
      var brief = authorText(item.a, true);
      var head;
      if (fmt === 1) head = dotted(item.t, brief);
      else if (fmt === 2) head = dotted(all, item.t);
      else if (fmt === 3) head = dotted(brief, item.t);
      else head = dotted(item.t, all);
      return [head, item.n, item.d].join(",");
    };

    var build = function () {
      var cards = Array.prototype.slice
        .call(document.querySelectorAll(".patent[data-state]"))
        .filter(function (card) { return !card.hidden; });
      var fmt = parseInt(format && format.value, 10) || 0;
      var lines = cards.map(function (card, i) {
        return i + 1 + ". " + patentLine(readCard(card), fmt) + ".";
      });
      if (text) text.value = lines.join("\n");
      if (count) count.textContent = "共 " + cards.length + " 条";
      if (tip) tip.textContent = "";
    };

    if (format) format.addEventListener("change", build);

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!text || !text.value) return;
        copyPlainText(text.value, copyBtn);
        if (tip) tip.textContent = "已复制到剪贴板";
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        if (!text || !text.value) return;
        var blob = new Blob([text.value], { type: "text/plain;charset=utf-8" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "patent-citations.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        if (tip) tip.textContent = "已下载引用文件";
      });
    }

    if (openBtn) {
      openBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        build();
        if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
      });
    }
  })();

})();
