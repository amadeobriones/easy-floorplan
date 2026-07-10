import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as TJS from "typescript-json-schema";
import { validateConfig } from "./validate";
import example from "../schema/example.json";

const schemaPath = fileURLToPath(new URL("../schema/floorplan-card.schema.json", import.meta.url));
const tsconfigPath = fileURLToPath(new URL("../tsconfig.json", import.meta.url));

describe("schema", () => {
  it("the committed schema matches the current types (run `npm run schema` if this fails)", () => {
    // Use the SAME config-driven program the `npm run schema` CLI uses, so the
    // in-test generation and the committed file can't diverge on compiler opts.
    const program = TJS.programFromConfig(tsconfigPath);
    const generated = TJS.generateSchema(program, "FloorplanCardConfig", { required: true });
    const committed = JSON.parse(readFileSync(schemaPath, "utf8"));
    expect(generated).toEqual(committed);
  });

  it("the worked example validates", () => {
    expect(validateConfig(example).ok).toBe(true);
  });
});
