import fs from 'fs'
import path from 'path'

function searchDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      searchDir(fullPath)
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8')
        if (content.includes('1568871391150') || content.includes('unsplash')) {
          console.log(`Found in file: ${fullPath}`)
          const lines = content.split('\n')
          lines.forEach((line, idx) => {
            if (line.includes('1568871391150') || line.includes('unsplash')) {
              console.log(`  Line ${idx + 1}: ${line.trim()}`)
            }
          })
        }
      } catch (e) {}
    }
  }
}

searchDir('.')
