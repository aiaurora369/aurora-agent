const fs = require('fs').promises;
const path = require('path');

class SkillReader {
  constructor(skillsPath = null) {
    this.skillsPath = skillsPath || path.join(__dirname, '../openclaw-skills');
  }

  async loadAllSkills() {
    try {
      const skills = {};
      
      try {
        await fs.access(this.skillsPath);
      } catch {
        console.log('⚠️ Skills directory not found, skipping skill loading');
        return skills;
      }

      const entries = await fs.readdir(this.skillsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillName = entry.name;
          const skillMdPath = path.join(this.skillsPath, skillName, 'SKILL.md');
          
          try {
            const content = await fs.readFile(skillMdPath, 'utf8');
            skills[skillName] = {
              name: skillName,
              content: content,
              loaded_at: new Date().toISOString()
            };
            console.log(`📚 Loaded skill: ${skillName}`);
          } catch (error) {
            console.log(`⚠️ Could not load skill ${skillName}`);
          }
        }
      }

      console.log(`✅ Loaded ${Object.keys(skills).length} skills`);
      return skills;
    } catch (error) {
      console.error('❌ Failed to load skills:', error.message);
      return {};
    }
  }
}

module.exports = SkillReader;
