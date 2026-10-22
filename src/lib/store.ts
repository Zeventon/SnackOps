import "server-only";
import path from "node:path";
import { JsonStore } from "./json-store";
import { schemas } from "./schemas";

export const dataDirectory = path.resolve(/* turbopackIgnore: true */ process.env.SNACKOPS_DATA_DIR || path.join(process.cwd(), "data"));
export const store = new JsonStore(dataDirectory, schemas);
