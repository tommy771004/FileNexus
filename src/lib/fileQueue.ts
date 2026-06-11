/**
 * Core File Processing Queue
 * Uses non-blocking asynchronous generators to handle large directory structures without freezing the UI thread.
 */

export interface ProcessedFile extends File {
  customPath?: string;
}

export async function* walkDataTransferItems(items: DataTransferItemList): AsyncGenerator<ProcessedFile, void, unknown> {
  // A queue to store directory entries or files
  const queue: { entry: FileSystemEntry, path: string }[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        queue.push({ entry, path: '' });
      } else {
        const file = item.getAsFile();
        if (file) yield file;
      }
    }
  }

  while (queue.length > 0) {
    const { entry, path } = queue.shift()!;
    
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file: File = await new Promise((resolve) => fileEntry.file(resolve));
      
      const processedFile = file as ProcessedFile;
      Object.defineProperty(processedFile, 'customPath', {
        value: `${path}${file.name}`,
        writable: false,
        enumerable: true
      });
      yield processedFile;
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      let entries: FileSystemEntry[] = [];
      
      let hasMore = true;
      while (hasMore) {
        const batch = await new Promise<FileSystemEntry[]>((resolve) => dirReader.readEntries(resolve));
        if (batch.length === 0) {
          hasMore = false;
        } else {
          entries = entries.concat(batch);
        }
      }
      
      for (const childEntry of entries) {
        queue.push({ entry: childEntry, path: `${path}${entry.name}/` });
      }
    }
    
    // Yield back to the event loop every 10 items or just on each iteration to prevent UI freeze
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
