
globalThis.window={scrollTo(arg){globalThis.scrolled=arg;}};
let currentPage=1,currentPages=3,currentTab="movies",lastSearchResults=[];
let loaded=[], renderedHome=false, activeTab=null;
const elements={sortFilter:{value:"smart", addEventListener(type,fn,capture){globalThis.sortChange=fn}},searchInput:{value:"x",blur(){this.blurred=true}},typeFilter:{value:"Аниме"},genreFilter:{value:"Драма"},yearFilter:{value:"2024"},ratingFilter:{value:"8"}};
function $(id){return elements[id]||null}
function setActiveTab(t){activeTab=t; currentTab=t;}
async function loadPage(t,p){loaded.push([t,p]); currentTab=t; currentPage=p;}
function renderHome(){renderedHome=true}
async function renderFavorites(){}
async function renderHistory(){}
async function renderRandom(){}
function renderSearchPage(p){globalThis.searchPage=p}
function currentSearchActive(){return false}
let clickHandlers=[];
globalThis.document={
  documentElement:{dataset:{}},
  readyState:"complete",
  addEventListener(type,fn,capture){if(type==="click") clickHandlers.push(fn);}
};
function ev(kind){
 return {target:{closest(sel){
   if(kind==="tab"&&sel===".tab[data-tab]") return {dataset:{tab:"movies"}};
   if(kind==="next"&&sel==="#nextBtn") return {};
   return null;
 }},preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};
}
/* === GKM V72 HARD PAGER + STRICT TABS OVERRIDE === */
(function () {
  const DEPARTMENT_TABS_V72 = new Set(["movies", "series", "cartoons", "anime", "top", "new", "popular"]);
  const SPECIAL_TABS_V72 = new Set(["fav", "history", "random"]);

  function gkmScrollPageTopV72() {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  function gkmClearControlsForDepartmentV72() {
    const search = $("searchInput");
    if (search) {
      search.value = "";
      search.blur();
    }

    ["typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
      const el = $(id);
      if (el) el.value = id === "ratingFilter" ? "0" : "";
    });

    const sort = $("sortFilter");
    if (sort) sort.value = "votes";
  }

  async function gkmOpenDepartmentHardV72(tabName, page = 1) {
    tabName = tabName || "all";
    gkmClearControlsForDepartmentV72();
    lastSearchResults = [];
    currentPage = Math.max(1, Number(page || 1));
    setActiveTab(tabName);

    if (tabName === "all") {
      currentTab = "all";
      renderHome();
      gkmScrollPageTopV72();
      return;
    }

    if (tabName === "fav") {
      await renderFavorites();
      gkmScrollPageTopV72();
      return;
    }

    if (tabName === "history") {
      await renderHistory();
      gkmScrollPageTopV72();
      return;
    }

    if (tabName === "random") {
      await renderRandom();
      gkmScrollPageTopV72();
      return;
    }

    await loadPage(tabName, currentPage);
    gkmScrollPageTopV72();
  }

  async function gkmGoPageHardV72(delta) {
    const next = currentPage + delta;
    if (next < 1 || next > currentPages) return;

    if (SPECIAL_TABS_V72.has(currentTab)) {
      renderSearchPage(next);
      gkmScrollPageTopV72();
      return;
    }

    if (currentSearchActive() && !DEPARTMENT_TABS_V72.has(currentTab)) {
      renderSearchPage(next);
      gkmScrollPageTopV72();
      return;
    }

    await loadPage(currentTab || "all", next);
    gkmScrollPageTopV72();
  }

  function bindHardV72() {
    if (document.documentElement.dataset.gkmHardPagerTabsV72 === "1") return;
    document.documentElement.dataset.gkmHardPagerTabsV72 = "1";

    document.addEventListener("click", function(e) {
      const tabBtn = e.target && e.target.closest ? e.target.closest(".tab[data-tab]") : null;
      if (tabBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        gkmOpenDepartmentHardV72(tabBtn.dataset.tab || "all", 1);
        return;
      }

      const moreBtn = e.target && e.target.closest ? e.target.closest("[data-open-tab], .home-more-btn") : null;
      if (moreBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        gkmOpenDepartmentHardV72(moreBtn.getAttribute("data-open-tab") || moreBtn.dataset.openTab || "all", 1);
        return;
      }

      const prev = e.target && e.target.closest ? e.target.closest("#prevBtn") : null;
      if (prev) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        gkmGoPageHardV72(-1);
        return;
      }

      const next = e.target && e.target.closest ? e.target.closest("#nextBtn") : null;
      if (next) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        gkmGoPageHardV72(1);
        return;
      }
    }, true);

    // V72: смена сортировки больше не запускает поиск на текущем разделе.
    ["sortFilter"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        if (DEPARTMENT_TABS_V72.has(currentTab)) loadPage(currentTab, 1).then(gkmScrollPageTopV72);
        else if (currentTab === "all") renderHome();
      }, true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindHardV72);
  else bindHardV72();

  window.GKM_HARD_PAGER_TABS_VERSION = "v72-hard-pager-tabs-tested-2026-06-13";
  window.GKM_PAGE_SCROLL_TOP_VERSION = "v72-hard-pager-tabs-tested-2026-06-13";
})();
/* === /GKM V72 HARD PAGER + STRICT TABS OVERRIDE === */
(async()=>{
  await clickHandlers[0](ev("tab"));
  const afterTab={activeTab,currentTab,loaded:[...loaded],search:elements.searchInput.value,type:elements.typeFilter.value,sort:elements.sortFilter.value};
  await clickHandlers[0](ev("next"));
  const afterNext={currentPage,loaded:[...loaded],scrolled:!!globalThis.scrolled};
  console.log(JSON.stringify({afterTab,afterNext,version:window.GKM_HARD_PAGER_TABS_VERSION}));
  if(afterTab.activeTab!=="movies") process.exit(2);
  if(afterTab.search!=="" || afterTab.type!=="" || afterTab.sort!=="votes") process.exit(3);
  if(!loaded.some(x=>x[0]==="movies"&&x[1]===2)) process.exit(4);
  if(!globalThis.scrolled) process.exit(5);
})();
