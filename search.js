const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const PUBLIC_DIR = path.join(__dirname, 'public');

let cache = {};

const loadCache = async () => {
  try {
    const dirs = await fs.promises.readdir(path.join(PUBLIC_DIR, 'audio'));

    for (const dir of dirs) {
      const dirPath = path.join(PUBLIC_DIR, 'transcriptions', dir);
      const files = await fs.promises.readdir(dirPath);

      for (const fileName of files) {
        const filePath = path.join(dirPath, fileName);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const parts = filePath.split('/');
        const dirName = parts[parts.length - 2];
        cache[filePath] = {
          content: content,
          dir: dirName,
          file: fileName
        };
      }
    }
  } catch (error) {
    console.error("Error loading cache:", error);
  }
};

async function searchTranscriptions(query) {
  if (!cache) {
    console.error("Cache is not initialized");
    return [];
  }

  const results = [];
  const lowerQuery = query.toLowerCase();

  for (const { content, dir, file } of Object.values(cache)) {
    if (content.toLowerCase().includes(lowerQuery)) {
      results.push({
        dir,
        file,
        content
      });
    }
  }

  // Sort results by filename in descending order
  results.sort((a, b) => b.file.localeCompare(a.file));
  // console.log("Cache:", cache);
  // console.log("Results:", results);
  return results;
};

const updateCacheForDirectory = async (dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    for (const fileName of files) {
      const filePath = path.join(dirPath, fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const parts = filePath.split('/');
      const dirName = parts[parts.length - 2];
      cache[filePath] = {
        content: content,
        dir: dirName,
        file: fileName
      };
    }
  } catch (error) {
    console.error(`Error updating cache for directory ${dirPath}:`, error);
  }
};

const watchDirectories = () => {
  const watcher = chokidar.watch(path.join(PUBLIC_DIR, 'transcriptions'), {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('addDir', async dirPath => {
    await updateCacheForDirectory(dirPath);
  });

  watcher.on('unlinkDir', dirPath => {
    // Remove all cache entries for this directory
    for (const [filePath, fileData] of Object.entries(cache)) {
      if (fileData.dir === path.basename(dirPath)) {
        delete cache[filePath];
      }
    }
  });

  watcher.on('change', async changedPath => {
    const stats = await fs.promises.stat(changedPath);
    
    if (stats.isDirectory()) {
      await updateCacheForDirectory(changedPath);
    } else if (stats.isFile()) {
      await updateCacheForFile(changedPath);
    }
  });

  watcher.on('add', async filePath => {
    await updateCacheForFile(filePath);
  });

  watcher.on('unlink', filePath => {
    delete cache[filePath];
  });

  const updateCacheForFile = async (filePath) => {
    const dirName = path.dirname(filePath).split('/').pop();
    const fileName = path.basename(filePath);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    cache[filePath] = {
      content: content,
      dir: dirName,
      file: fileName
    };
  };
};

// Initialize cache and set up file watchers
watchDirectories();

module.exports = {
  searchTranscriptions,
  loadCache
};