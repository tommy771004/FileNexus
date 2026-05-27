import { app as o, BrowserWindow as i, shell as l } from "electron";
import n from "node:path";
import { fileURLToPath as d } from "node:url";
const r = n.dirname(d(import.meta.url));
process.env.DIST = n.join(r, "../dist");
process.env.VITE_PUBLIC = o.isPackaged ? process.env.DIST : n.join(process.env.DIST, "../public");
let e;
const t = process.env.VITE_DEV_SERVER_URL;
function a() {
  e = new i({
    width: 1200,
    height: 800,
    icon: n.join(process.env.VITE_PUBLIC, "logo.svg"),
    webPreferences: {
      preload: n.join(r, "preload.js")
      // For security, you might want contextIsolation and no nodeIntegration
      // nodeIntegration: false,
      // contextIsolation: true,
    }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), t ? e.loadURL(t) : e.loadFile(n.join(process.env.DIST, "index.html")), e.webContents.setWindowOpenHandler(({ url: s }) => (s.startsWith("https:") && l.openExternal(s), { action: "deny" }));
}
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), e = null);
});
o.on("activate", () => {
  i.getAllWindows().length === 0 && a();
});
o.whenReady().then(a);
