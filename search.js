const fs = require('fs');
const path = require('path');
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

module.exports = async function searchTranscriptions(query) {
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

const watchDirectories = async () => {
  try {
    const dirs = await fs.promises.readdir(path.join(PUBLIC_DIR, 'audio'));

    for (const dir of dirs) {
      const dirPath = path.join(PUBLIC_DIR, 'transcriptions', dir);

      fs.watch(dirPath, async (eventType, fileName) => {
        if (fileName && eventType === 'change') {
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
      });
    }
  } catch (error) {
    console.error("Error setting up file watchers:", error);
  }
};


// Initialize cache and set up file watchers
loadCache().then(watchDirectories);