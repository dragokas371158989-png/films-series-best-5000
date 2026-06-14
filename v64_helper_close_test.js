
let closeCalled=0, showCalled=0, prevented=0, stopped=0, immediate=0;
const dialog={
  open:true, attrs:{open:""}, style:{display:""},
  close(){ closeCalled++; this.open=false; },
  showModal(){ showCalled++; this.open=true; },
  removeAttribute(k){ delete this.attrs[k]; if(k==="open") this.open=false; },
  setAttribute(k,v){ this.attrs[k]=v; if(k==="open") this.open=true; }
};
globalThis.window={};
globalThis.document={
  documentElement:{dataset:{}},
  body:{classList:{add(){},remove(){}}},
  readyState:"complete",
  getElementById(id){ return id==="gkmAiDialog" ? dialog : null; },
  addEventListener(type,fn,capture){ if(type==="click") globalThis.clickHandler=fn; if(type==="keydown") globalThis.keyHandler=fn; }
};
function ev(kind){ return { key:kind==="esc"?"Escape":"", target:{closest(sel){ if(kind==="close"&&sel.includes("#gkmAiCloseBtn")) return {}; if(kind==="open"&&sel.includes("#gkmAiFloatBtn")) return {}; return null;}}, preventDefault(){prevented++;}, stopPropagation(){stopped++;}, stopImmediatePropagation(){immediate++;} }; }
/* === GKM V64 HELPER CLOSE HARD FIX === */
(function () {
  function closeAiDialogV64() {
    const dialog = document.getElementById("gkmAiDialog");
    if (!dialog) return false;
    try {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
    } catch {}
    dialog.removeAttribute("open");
    dialog.style.display = "none";
    document.body.classList.remove("ai-open", "gkm-ai-open");
    return true;
  }

  function openAiDialogV64() {
    const dialog = document.getElementById("gkmAiDialog");
    if (!dialog) return false;
    dialog.style.display = "";
    try {
      if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch {
      dialog.setAttribute("open", "");
    }
    document.body.classList.add("gkm-ai-open");
    return true;
  }

  function bindAiCloseV64() {
    if (document.documentElement.dataset.gkmAiCloseV64 === "1") return;
    document.documentElement.dataset.gkmAiCloseV64 = "1";

    document.addEventListener("click", function (e) {
      const closeBtn = e.target && e.target.closest ? e.target.closest("#gkmAiCloseBtn, .ai-close") : null;
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        closeAiDialogV64();
        return;
      }

      const openBtn = e.target && e.target.closest ? e.target.closest("#gkmAiFloatBtn, #gkmAiTopBtn, .ai-float-btn, .ai-top-btn") : null;
      if (openBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        openAiDialogV64();
        return;
      }
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAiDialogV64();
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindAiCloseV64);
  else bindAiCloseV64();

  window.GKM_HELPER_CLOSE_FIX_VERSION = "v64-helper-close-fix-2026-06-13";
})();

clickHandler(ev("close"));
const closed=!dialog.open && dialog.style.display==="none" && closeCalled===1;
clickHandler(ev("open"));
const opened=dialog.open && dialog.style.display==="" && showCalled===1;
keyHandler(ev("esc"));
const escClosed=!dialog.open;
console.log(JSON.stringify({closed,opened,escClosed,version:window.GKM_HELPER_CLOSE_FIX_VERSION}));
if(!closed) process.exit(2);
if(!opened) process.exit(3);
if(!escClosed) process.exit(4);
if(window.GKM_HELPER_CLOSE_FIX_VERSION!=="v64-helper-close-fix-2026-06-13") process.exit(5);
