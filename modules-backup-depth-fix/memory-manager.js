const fs = require('fs').promises;
const path = require('path');

class MemoryManager {
  constructor() {
    this.memoryDir = path.join(__dirname, '..', 'memory');
    this.memories = {};
    this.memoryFiles = [
      'aurora-core.json',
      'aurora-core-memories.json',
      'aurora-relationships.json',
      'aurora-finances.json',
      'aurora-art.json',
      'aurora-studies.json',
      'aurora-unresolved.json'
    ];
  }

  async loadAll() {
    for (const file of this.memoryFiles) {
      const key = file.replace('aurora-', '').replace('.json', '');
      try {
        const filepath = path.join(this.memoryDir, file);
        const data = await fs.readFile(filepath, 'utf8');
        this.memories[key] = JSON.parse(data);
      } catch (error) {
        console.error('Failed to load ' + file + ': ' + error.message);
      }
    }
  }

  get(key) {
    return this.memories[key];
  }

  async save(key) {
    const filename = 'aurora-' + key + '.json';
    const filepath = path.join(this.memoryDir, filename);
    try {
      await fs.writeFile(filepath, JSON.stringify(this.memories[key], null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save ' + filename + ': ' + error.message);
      return false;
    }
  }
}

module.exports = MemoryManager;
