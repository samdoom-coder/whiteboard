import { useEffect } from "react";
import { useStore } from "./core/store";
import { CanvasHost } from "./components/CanvasHost";
import { Toolbar, MobileToolbar } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { StylePanel } from "./components/StylePanel";
import { AIPanel } from "./components/AIPanel";
import { CommandPalette } from "./components/CommandPalette";
import { ShortcutsDialog, ZoomControls } from "./components/ShortcutsDialog";
import { ExportDialog } from "./components/ExportDialog";
import { ContextMenu } from "./components/ContextMenu";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function App() {
  const theme = useStore((s) => s.theme);
  const popoverOpen = useStore((s) => s.popoverOpen);
  const hasSelection = useStore((s) => s.selectedIds.length > 0);
  const ui = useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <TopBar />
      <CanvasHost />
      <Toolbar />
      <MobileToolbar />
      {hasSelection && !popoverOpen && <StylePanel />}
      <ZoomControls />
      <ContextMenu />
      <AIPanel open={ui.aiOpen} onClose={() => ui.setAiOpen(false)} />
      <CommandPalette open={ui.palette} onClose={() => ui.setPalette(false)} />
      <ShortcutsDialog open={ui.shortcuts} onClose={() => ui.setShortcuts(false)} />
      <ExportDialog open={ui.exportOpen} onClose={() => ui.setExportOpen(false)} />
    </div>
  );
}