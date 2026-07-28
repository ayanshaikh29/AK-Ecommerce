import fs from 'fs'
import path from 'path'

function searchDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      searchDir(fullPath)
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8')
        if (content.includes('http://') || content.includes('https://')) {
          const lines = content.split('\n')
          lines.forEach((line, idx) => {
            if ((line.includes('http://') || line.includes('https://')) && (line.includes('.jpg') || line.includes('.png') || line.includes('.jpeg') || line.includes('.webp') || line.includes('image'))) {
              console.log(`${fullPath}:${idx + 1}: ${line.trim()}`)
            }
          })
        }
      } catch (e) {}
    }
  }
}

searchDir('.')
