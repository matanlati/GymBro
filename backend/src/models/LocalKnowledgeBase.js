const fs = require('fs')
const path = require('path')

class LocalKnowledgeBase {
  constructor() {
    this.knowledgeFile = path.join(__dirname, '../../../knowledge-base/training-knowledge.json')
  }

  getKnowledge() {
    try {
      const data = fs.readFileSync(this.knowledgeFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error loading knowledge base:', error)
      return {}
    }
  }
}

module.exports = new LocalKnowledgeBase()