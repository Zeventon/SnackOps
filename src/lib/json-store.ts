import "server-only";
import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { z } from "zod";

// Global registry survives development HMR and is shared by all store instances.
const globalStore = globalThis as typeof globalThis & { snackopsLocks?: Map<string, Promise<void>> };
const locks = globalStore.snackopsLocks ??= new Map();
type FileIO = Pick<typeof fs, "readFile" | "mkdir" | "open" | "rename" | "unlink" | "realpath">;

async function locked<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(file) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  locks.set(file, current);
  await previous;
  try { return await operation(); }
  finally { release(); if (locks.get(file) === current) locks.delete(file); }
}

export class JsonStore<S extends Record<string, z.ZodType>> {
  constructor(private directory: string, private schemas: S, private io: FileIO = fs) {}

  private async file(name: keyof S & string) {
    if (!Object.hasOwn(this.schemas, name) || !/^[a-z0-9_-]+$/.test(name)) throw new Error("Unknown data collection");
    await this.io.mkdir(this.directory, { recursive: true });
    const canonicalRoot = await this.io.realpath(path.resolve(this.directory));
    return path.join(canonicalRoot, `${name}.json`);
  }

  private async readFile<K extends keyof S & string>(name: K, file: string): Promise<z.infer<S[K]>> {
    const raw = await this.io.readFile(file, "utf8");
    return this.schemas[name].parse(JSON.parse(raw)) as z.infer<S[K]>;
  }

  async read<K extends keyof S & string>(name: K): Promise<z.infer<S[K]>> {
    const file = await this.file(name);
    return locked(file, () => this.readFile(name, file));
  }

  private async commit<K extends keyof S & string>(name: K, file: string, data: z.infer<S[K]>) {
    const valid = this.schemas[name].parse(data) as z.infer<S[K]>;
    const serialized = JSON.stringify(valid, null, 2) + "\n";
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await this.io.open(temporary, "wx", 0o600);
      try { await handle.writeFile(serialized, "utf8"); await handle.sync(); }
      finally { await handle.close(); }
      // Never truncate/unlink the destination. A failed rename preserves its contents.
      for (let attempt = 0; ; attempt++) {
        try { await this.io.rename(temporary, file); break; }
        catch (error) {
          // Windows readers / antivirus can briefly deny replacement; retry the
          // same atomic rename while retaining the lock and original file.
          const code = (error as NodeJS.ErrnoException).code;
          if (process.platform !== "win32" || !["EPERM", "EACCES", "EBUSY"].includes(code || "") || attempt >= 7) throw error;
          await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
        }
      }
    } finally {
      await this.io.unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") console.error("Temporary file cleanup failed", error.code); });
    }
    return valid;
  }

  async write<K extends keyof S & string>(name: K, data: z.infer<S[K]>): Promise<z.infer<S[K]>> {
    const file = await this.file(name);
    return locked(file, () => this.commit(name, file, data));
  }

  async update<K extends keyof S & string>(name: K, update: (current: z.infer<S[K]>) => z.infer<S[K]> | Promise<z.infer<S[K]>>): Promise<z.infer<S[K]>> {
    const file = await this.file(name);
    // Lock the complete read-modify-write transaction, not only the final write.
    return locked(file, async () => this.commit(name, file, await update(await this.readFile(name, file))));
  }
}
