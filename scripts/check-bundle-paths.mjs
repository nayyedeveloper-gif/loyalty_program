import fs from 'fs'
import path from 'path'

const file = process.argv[2] || 'frontend/dist/assets/index-CH5uIE5n.js'
const s = fs.readFileSync(path.resolve(file), 'utf8')
const hits = [...new Set(s.match(/\/app\/[a-z-]+/g) || [])].sort()
console.log(hits.join('\n'))