import type { ToolType } from "../types";
import type { Tool } from "./Tool";
import { SelectionTool } from "./SelectionTool";
import { ShapeTool } from "./ShapeTool";
import { LineArrowTool } from "./LineArrowTool";
import { PencilTool } from "./PencilTool";
import { TextTool } from "./TextTool";
import { StickyTool } from "./StickyTool";
import { EraserTool } from "./EraserTool";
import { HandTool } from "./HandTool";
import { ImageTool } from "./ImageTool";

const toolMap = new Map<ToolType, Tool>();
const register = (t: Tool) => toolMap.set(t.id, t);

register(new SelectionTool());
register(new ShapeTool("rectangle"));
register(new ShapeTool("roundedRectangle"));
register(new ShapeTool("ellipse"));
register(new ShapeTool("diamond"));
register(new LineArrowTool("line"));
register(new LineArrowTool("arrow"));
register(new PencilTool());
register(new TextTool());
register(new StickyTool());
register(new ImageTool());
register(new EraserTool());
register(new HandTool());

export const tools: ReadonlyMap<ToolType, Tool> = toolMap;

export const toolDefinitions: Array<{
  id: ToolType;
  label: string;
  icon: string;
  shortcut: string;
}> = [
  { id: "selection", label: "Selection", icon: "cursor", shortcut: "V" },
  { id: "rectangle", label: "Rectangle", icon: "rect", shortcut: "R" },
  { id: "roundedRectangle", label: "Rounded rectangle", icon: "rounded-rect", shortcut: "R" },
  { id: "ellipse", label: "Ellipse", icon: "ellipse", shortcut: "E" },
  { id: "diamond", label: "Diamond", icon: "diamond", shortcut: "D" },
  { id: "line", label: "Line", icon: "line", shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: "arrow", shortcut: "A" },
  { id: "pencil", label: "Pencil", icon: "pencil", shortcut: "P" },
  { id: "text", label: "Text", icon: "text", shortcut: "T" },
  { id: "sticky", label: "Sticky note", icon: "sticky", shortcut: "S" },
  { id: "image", label: "Image", icon: "image", shortcut: "" },
  { id: "eraser", label: "Eraser", icon: "eraser", shortcut: "" },
  { id: "hand", label: "Hand", icon: "hand", shortcut: "H" },
];