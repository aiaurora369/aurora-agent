class TaskTracker {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
  }

  async logUnresolved(task) {
    const unresolved = this.memoryManager.get('unresolved');
    
    const taskEntry = {
      id: `task-${Date.now()}`,
      timestamp: new Date().toISOString(),
      description: task.description,
      category: task.category || 'general',
      error: task.error || null,
      context: task.context || {},
      status: 'unresolved'
    };

    unresolved.tasks.push(taskEntry);
    unresolved.last_updated = new Date().toISOString();
    
    await this.memoryManager.save('unresolved');
    
    console.log(`📝 Logged unresolved task: ${task.description}`);
    return taskEntry;
  }

  getUnresolvedTasks() {
    const unresolved = this.memoryManager.get('unresolved');
    return unresolved.tasks.filter(t => t.status === 'unresolved');
  }
}

module.exports = TaskTracker;
