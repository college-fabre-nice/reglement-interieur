const root = document.getElementById("reglement-root");
const defaultDocumentTitle = document.title;
let searchMarks = [];
let activeSearchIndex = -1;
let setActiveTocLink = null;
let suspendSpyUntil = 0;

function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createElement(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

function renderParagraph(text) {
  return `<p class="text-justify">${escapeHtml(text)}</p>`;
}

function renderListItems(items = []) {
  return items.map((item) => {
    if (typeof item === "string") {
      return `<li>${escapeHtml(item)}</li>`;
    }

    if (item && typeof item === "object") {
      const text = escapeHtml(item.text || "");
      const children = Array.isArray(item.children) && item.children.length
        ? `<ul class="reglement-list text-justify">${renderListItems(item.children)}</ul>`
        : "";
      return `<li>${text}${children}</li>`;
    }

    return "";
  }).join("");
}

function renderList(items = []) {
  return `<ul class="reglement-list text-justify">${renderListItems(items)}</ul>`;
}

function renderTable(block) {
  const headers = Array.isArray(block.headers) ? block.headers : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const thead = headers.length
    ? `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`
    : "";
  const tbody = rows.length
    ? `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : "";
  return `<table class="reglement-table">${thead}${tbody}</table>`;
}

function renderNotice(block) {
  const variantClass = block.variant === "note" ? " notice-note" : "";
  return `<div class="notice text-justify${variantClass}">${escapeHtml(block.text || "")}</div>`;
}

function renderSignatureFields(block) {
  const fields = Array.isArray(block.fields) ? block.fields : [];
  return `<div class="signature-fields">${fields.map((field) => `<div class="signature-field text-left">${escapeHtml(field)}</div>`).join("")}</div>`;
}

function renderBlock(block) {
  if (!block || typeof block !== "object") return "";
  switch (block.type) {
    case "paragraph": return renderParagraph(block.text || "");
    case "list": return renderList(block.items || []);
    case "table": return renderTable(block);
    case "notice": return renderNotice(block);
    case "signature_fields": return renderSignatureFields(block);
    default: return "";
  }
}

function hasRenderableContent(section) {
  if (!section) return false;
  const hasBlocks = Array.isArray(section.blocks) && section.blocks.some((block) => renderBlock(block).trim());
  const hasSubsections = Array.isArray(section.subsections) && section.subsections.some((subsection) => hasRenderableContent(subsection));
  return hasBlocks || hasSubsections;
}

function subsectionAnchorId(sectionId, subsectionId) {
  if (subsectionId === "partie-3-objets") return "objets-interdits";
  if (subsectionId === "partie-3-telephones") return "telephones";
  return subsectionId || sectionId;
}

function renderSectionBody(section) {
  const wrapper = createElement("div", "section-body");

  if (Array.isArray(section.blocks)) {
    wrapper.innerHTML = section.blocks.map(renderBlock).join("");
  }

  const appendBackTop = (container) => {
    const backTop = document.createElement("a");
    backTop.href = "#top";
    backTop.className = "back-to-top";
    backTop.textContent = "↑ Haut de page";
    container.append(backTop);
  };

  if (Array.isArray(section.subsections)) {
    section.subsections.forEach((subsection) => {
      if (!hasRenderableContent(subsection)) return;
      const details = document.createElement("details");
      details.className = "subsection";
      details.open = true;
      details.id = subsectionAnchorId(section.id, subsection.id);

      const summary = document.createElement("summary");
      summary.textContent = subsection.title || "Sous-partie";
      summary.dataset.spyId = details.id;

      const body = createElement("div", "subsection-body", (subsection.blocks || []).map(renderBlock).join(""));
      appendBackTop(body);
      details.append(summary, body);
      wrapper.append(details);
    });
  } else {
    appendBackTop(wrapper);
  }

  if (!wrapper.innerHTML.trim()) {
    wrapper.append(createElement("div", "empty-state text-left", "Cette section n’est pas encore intégrée dans cette version de travail."));
  }

  return wrapper;
}

function buildSection(section) {
  const element = createElement("section", "reglement-section");
  element.id = section.id;
  const title = createElement("h2");
  title.textContent = section.number ? `${section.number}. ${section.title}` : section.title;
  title.dataset.spyId = section.id;

  element.append(title, renderSectionBody(section));
  return element;
}

function buildToc(sections) {
  const tocList = document.getElementById("toc-list");
  tocList.innerHTML = "";

  sections.forEach((section) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = section.number ? `${section.number}. ${section.title}` : section.title;
    li.append(link);

    if (Array.isArray(section.subsections)) {
      const visibleSubs = section.subsections.filter((subsection) => hasRenderableContent(subsection));
      if (visibleSubs.length) {
        const subList = document.createElement("ul");
        visibleSubs.forEach((subsection) => {
          const subLi = document.createElement("li");
          const subLink = document.createElement("a");
          subLink.href = `#${subsectionAnchorId(section.id, subsection.id)}`;
          subLink.textContent = subsection.title || "Sous-partie";
          subLi.append(subLink);
          subList.append(subLi);
        });
        li.append(subList);
      }
    }

    tocList.append(li);
  });
}

function clearSearchHighlights() {
  document.querySelectorAll("mark[data-search-mark]").forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent));
  });
  document.querySelectorAll(".search-hidden").forEach((node) => node.classList.remove("search-hidden"));
  document.querySelectorAll(".subsection, .reglement-section").forEach((node) => { node.hidden = false; });
  const banner = document.getElementById("status-banner");
  if (banner) {
    banner.hidden = true;
    banner.textContent = "";
  }
  document.body.classList.remove("search-active");
  searchMarks = [];
  activeSearchIndex = -1;
  updateSearchCounter();
}

function updateSearchCounter() {
  const counter = document.getElementById("search-counter");
  if (!counter) return;

  if (!searchMarks.length || activeSearchIndex < 0) {
    counter.textContent = "0 / 0";
    return;
  }

  counter.textContent = `${activeSearchIndex + 1} / ${searchMarks.length}`;
}

function setActiveSearchResult(index) {
  if (!searchMarks.length) {
    activeSearchIndex = -1;
    updateSearchCounter();
    return;
  }

  if (index < 0) index = searchMarks.length - 1;
  if (index >= searchMarks.length) index = 0;

  searchMarks.forEach((mark) => mark.classList.remove("is-active-search-result"));

  activeSearchIndex = index;
  const activeMark = searchMarks[activeSearchIndex];
  activeMark.classList.add("is-active-search-result");

  const parentSubsection = activeMark.closest(".subsection");
  if (parentSubsection) {
    parentSubsection.hidden = false;
    parentSubsection.open = true;
  }

  const parentSection = activeMark.closest(".reglement-section");
  if (parentSection) {
    parentSection.hidden = false;
  }

  activeMark.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  updateSearchCounter();
}

function collectSearchMarks() {
  searchMarks = Array.from(document.querySelectorAll("mark[data-search-mark]"));
  activeSearchIndex = searchMarks.length ? 0 : -1;
  updateSearchCounter();

  if (searchMarks.length) {
    setActiveSearchResult(0);
  }
}

function escapeRegExp(value) {
  const specials = new Set(["\\", ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
  let result = "";

  for (const char of value) {
    result += specials.has(char) ? "\\" + char : char;
  }

  return result;
}

function applySearch(query) {
  clearSearchHighlights();
  const trimmed = query.trim();
  const searchClear = document.getElementById("search-clear");
  if (searchClear) {
    searchClear.hidden = !trimmed;
  }
  if (!trimmed) return;

  const normalizedQuery = normalizeText(trimmed);
  const regexp = new RegExp(`(${escapeRegExp(trimmed)})`, "gi");
  let matches = 0;

  const searchableNodes = document.querySelectorAll(
     ".reglement-section h2, .subsection summary, .section-body p, .subsection-body p, .section-body li, .subsection-body li, .section-body td, .subsection-body td, .section-body th, .subsection-body th"
  );

  searchableNodes.forEach((node) => {
    const text = node.textContent || "";
    const normalizedText = normalizeText(text);
    const occurrences = normalizedText.match(new RegExp(escapeRegExp(normalizedQuery), "g"));

    if (!occurrences) {
      return;
    }

    matches += occurrences.length;
    regexp.lastIndex = 0;
    node.innerHTML = escapeHtml(text).replace(regexp, '<mark data-search-mark="true">$1</mark>');
  });

  const matchingSubsections = new Set();
  const matchingSections = new Set();

  document.querySelectorAll(".subsection").forEach((details) => {
    const hasMatch = details.querySelector("mark[data-search-mark]");
    if (hasMatch) {
      matchingSubsections.add(details);
      details.hidden = false;
      details.open = true;
      const parentSection = details.closest(".reglement-section");
      if (parentSection) matchingSections.add(parentSection);
    } else {
      details.hidden = true;
    }
  });

  document.querySelectorAll(".reglement-section").forEach((section) => {
    const body = section.querySelector(":scope > .section-body");
    const directMatchOutsideSubsection = body
      ? Array.from(body.children)
          .filter((node) => !node.classList.contains("subsection"))
          .some((node) => node.querySelector && node.querySelector("mark[data-search-mark]"))
      : false;

    const hasMatchingSubsection = matchingSections.has(section);

    if (directMatchOutsideSubsection || hasMatchingSubsection) {
      section.hidden = false;
      matchingSections.add(section);
    } else {
      section.hidden = true;
    }
  });

  const banner = document.getElementById("status-banner");
  if (banner) {
    banner.hidden = false;
    banner.textContent =
      matches > 0
        ? `${matches} occurrence${matches > 1 ? "s" : ""} trouvée${matches > 1 ? "s" : ""}.`
        : "Aucun résultat trouvé pour cette recherche.";
  }

  document.body.classList.add("search-active");
  collectSearchMarks();
}



function getScrollOffset() {
  const toolsBar = document.querySelector(".tools-bar");
  const toolsBarHeight = toolsBar ? toolsBar.getBoundingClientRect().height : 0;
  return toolsBarHeight + 16;
}

function getAnchorTarget(id) {
  const element = document.getElementById(id);
  if (!element) return null;

  if (element.matches(".reglement-section")) {
    return element.querySelector("h2") || element;
  }

  if (element.matches(".subsection")) {
    return element.querySelector("summary") || element;
  }

  return element;
}

function scrollToAnchorId(id, behavior = "auto") {
  const target = getAnchorTarget(id);
  if (!target) return;

  const top = window.scrollY + target.getBoundingClientRect().top - getScrollOffset();

  window.scrollTo({
    top,
    behavior
  });
}

function setupTools() {
  const expandAll = document.getElementById("expand-all");
  const collapseAll = document.getElementById("collapse-all");
  const searchInput = document.getElementById("search-input");
  const searchPrev = document.getElementById("search-prev");
  const searchNext = document.getElementById("search-next");
  const searchClear = document.getElementById("search-clear");
  const tocToggle = document.getElementById("toc-toggle");
  const tocList = document.getElementById("toc-list");

  expandAll?.addEventListener("click", () => {
    document.querySelectorAll(".subsection").forEach((details) => { details.open = true; });
  });
  collapseAll?.addEventListener("click", () => {
    document.querySelectorAll(".subsection").forEach((details) => { details.open = false; });
  });
  searchInput?.addEventListener("input", (event) => applySearch(event.target.value || ""));
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (searchMarks.length) {
        setActiveSearchResult(activeSearchIndex + 1);
      } else if (searchInput.value.trim()) {
        applySearch(searchInput.value || "");
      }
    }
  });
  searchPrev?.addEventListener("click", () => {
    if (!searchMarks.length) return;
    setActiveSearchResult(activeSearchIndex - 1);
  });
  searchNext?.addEventListener("click", () => {
    if (!searchMarks.length) return;
    setActiveSearchResult(activeSearchIndex + 1);
  });
  searchClear?.addEventListener("click", () => {
    if (!searchInput) return;
    searchInput.value = "";
    clearSearchHighlights();
    searchClear.hidden = true;
    searchInput.focus();
  });
  if (searchClear) {
    searchClear.hidden = !(searchInput && searchInput.value.trim());
  }
  tocToggle?.addEventListener("click", () => {
    const expanded = tocToggle.getAttribute("aria-expanded") === "true";
    tocToggle.setAttribute("aria-expanded", String(!expanded));
    tocToggle.textContent = expanded ? "Afficher" : "Masquer";
    tocList.classList.toggle("hidden", expanded);
  });
  document.querySelectorAll("#toc-list a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) return;

      event.preventDefault();

      const id = decodeURIComponent(href).replace(/^#/, "");
      history.replaceState(null, "", `#${id}`);

      if (setActiveTocLink) {
        setActiveTocLink(id);
      }

      suspendSpyUntil = performance.now() + 900;
      scrollToAnchorId(id, "auto");
    });
  });

}

function setupSpy() {
  const tocLinks = Array.from(document.querySelectorAll("#toc-list a"));
  const tocList = document.getElementById("toc-list");
  if (!("IntersectionObserver" in window) || tocLinks.length === 0 || !tocList) return;

  const linkMap = new Map(tocLinks.map((link) => [decodeURIComponent(link.getAttribute("href")), link]));
  let activeId = null;

  const setActive = (id) => {
    const link = linkMap.get(`#${id}`);
    if (!link || activeId === id) return;
    activeId = id;
    tocLinks.forEach((item) => item.classList.remove("is-current"));
    link.classList.add("is-current");
    link.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  setActiveTocLink = setActive;

  const observer = new IntersectionObserver((entries) => {
    if (performance.now() < suspendSpyUntil) return;

    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => {
        const topDiff = Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
        if (topDiff !== 0) return topDiff;
        return b.intersectionRatio - a.intersectionRatio;
      });

    if (!visible.length) return;

    const target = visible[0].target;
    const id = target.dataset.spyId || target.id;
    if (id) setActive(id);
  }, { rootMargin: "-12% 0px -78% 0px", threshold: [0, 0.1, 0.25, 0.5, 1] });

  document.querySelectorAll(".reglement-section h2[data-spy-id], .subsection summary[data-spy-id]").forEach((node) => {
    observer.observe(node);
  });

  const hash = decodeURIComponent(window.location.hash || "");
  if (hash) {
    const id = hash.replace(/^#/, "");
    setActive(id);
  }
}

async function loadReglement() {
  if (!root) return;
  try {
    const response = await fetch("data/reglement.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const sections = Array.isArray(data.sections) ? data.sections : [];
    if (data.meta?.title) {
      document.title = defaultDocumentTitle;
    }
    const visibleSections = sections.filter((section) => hasRenderableContent(section));
    root.innerHTML = "";
    visibleSections.forEach((section) => root.append(buildSection(section)));
    buildToc(visibleSections);
    setupTools();
    setupSpy();

    const hash = decodeURIComponent(window.location.hash || "");
    if (hash) {
      const id = hash.replace(/^#/, "");
      if (setActiveTocLink) {
        setActiveTocLink(id);
      }
      suspendSpyUntil = performance.now() + 900;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollToAnchorId(id, "auto");
        });
      });
    }

    if (visibleSections.length === 0) {
      root.append(createElement("div", "empty-state text-left", "Aucune section exploitable n’a été trouvée dans le fichier reglement.json."));
    }
  } catch (error) {
    console.error(error);
    const banner = document.getElementById("status-banner");
    if (banner) {
      banner.hidden = false;
      banner.textContent = "Impossible de charger le fichier data/reglement.json. Vérifie le chemin du fichier et lance la page via un petit serveur local.";
    }
  }
}

document.addEventListener("DOMContentLoaded", loadReglement);
