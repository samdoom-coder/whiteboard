export type Theme = "light" | "dark";
export type BackgroundStyle = "none" | "grid" | "dots";
export type ToolType =
  | "selection"
  | "rectangle"
  | "roundedRectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "pencil"
  | "text"
  | "image"
  | "eraser"
  | "hand";

export type ElementType =
  | "rectangle"
  | "roundedRectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "pencil"
  | "text"
  | "image";

export type FillStyle = "solid" | "hachure" | "crosshatch";
export type StrokeStyle = "solid" | "dashed" | "dotted";

export interface Point {
  x: number;
  y: number;
}

/** What a connector sticks to on another element. */
export interface ElementBinding {
  elementId: string;
  /** which endpoint of the connector this binding belongs to (0 = start, 1 = end) */
  end: number;
}

export interface ElementStyle {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  roughness: number; // 0..1
  roundness: number; // 0..1
}

export interface BaseElement extends ElementStyle {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // radians
  seed: number;
  isDeleted?: boolean;
}

export interface ShapeElement extends BaseElement {
  type:
    | "rectangle"
    | "roundedRectangle"
    | "ellipse"
    | "diamond"
    | "text"
    | "image";
}

export interface LineElement extends BaseElement {
  type: "line" | "arrow";
  points: Point[]; // world-space, relative to x,y (local coords)
  startBinding?: ElementBinding | null;
  endBinding?: ElementBinding | null;
}

export interface PencilElement extends BaseElement {
  type: "pencil";
  points: Point[]; // local coords
}

export interface TextElement extends ShapeElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  textAlign: "left" | "center" | "right";
  textBold: boolean;
}

export interface ImageElement extends ShapeElement {
  type: "image";
  dataURL: string;
  /** natural dimensions */
  naturalWidth: number;
  naturalHeight: number;
}

export type Element =
  | ShapeElement
  | LineElement
  | PencilElement
  | TextElement
  | ImageElement;

export interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface Scene {
  name: string;
  background: BackgroundStyle;
  backgroundColor: string;
  view: ViewState;
  version: number;
}

export interface Document {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  scene: Scene;
  elements: Element[];
  /** reserved for future realtime collaboration */
  version: number;
}

export interface AppState {
  tool: ToolType;
  selectedElementIds: Set<string>;
  editingTextId: string | null;
  activeGroupId: string | null;
}

export interface ToolDefinition {
  type: ToolType;
  label: string;
  icon: string;
  shortcut: string;
}

export interface ExportSettings {
  scale: number;
  transparentBackground: boolean;
  background: string;
  onlySelected: boolean;
}