import { randomUUID } from "node:crypto";
import { readFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RemoteThreadListAdapter } from "@assistant-ui/core";
import {
  createLocalStorageAdapter,
  type AsyncStorageLike,
} from "@assistant-ui/core/react";
import type { TitleGenerationAdapter } from "@assistant-ui/core/react/adapters/TitleGenerationAdapter";

export type { AsyncStorageLike } from "@assistant-ui/core/react";

export type FileStorageOptions = {
  dir: string;
};

export type CreateFileStorageAdapterOptions = {
  dir: string;
  prefix?: string | undefined;
  titleGenerator?: TitleGenerationAdapter | undefined;
};

export class FileStorage implements AsyncStorageLike {
  private dir: string;

  public constructor(options: FileStorageOptions) {
    this.dir = options.dir;
  }

  private getFilePath(key: string) {
    return join(this.dir, `${encodeURIComponent(key)}.json`);
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await readFile(this.getFilePath(key), "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw error;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });

    const targetPath = this.getFilePath(key);
    const tempPath = `${targetPath}.${randomUUID()}.tmp`;

    try {
      await writeFile(tempPath, value, "utf8");
      await rename(tempPath, targetPath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await rm(this.getFilePath(key));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }
  }
}

export const createFileStorageAdapter = (
  options: CreateFileStorageAdapterOptions,
): RemoteThreadListAdapter => {
  const { dir, prefix, titleGenerator } = options;

  return createLocalStorageAdapter({
    storage: new FileStorage({ dir }),
    prefix,
    titleGenerator,
  });
};
