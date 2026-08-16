import { BaseTool } from "./Tool";

export class HandTool extends BaseTool {
  readonly id = "hand" as const;
  cursor() {
    return "grab";
  }
}