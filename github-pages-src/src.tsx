const protectedSite = "https://shancheng-photo-atlas.ahaclassmate.chatgpt.site";
window.location.replace(protectedSite);

document.getElementById("root")!.innerHTML = `<main style="font-family:system-ui,sans-serif;max-width:34rem;margin:18vh auto;padding:2rem;color:#27231f"><h1>正在进入山城取景簿…</h1><p>如果页面没有自动跳转，<a href="${protectedSite}">请点击这里</a>。</p></main>`;
