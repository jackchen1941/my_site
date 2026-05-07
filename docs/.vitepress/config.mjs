import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

// 自动生成侧边栏的函数
function getSidebar() {
  const docsPath = path.resolve(__dirname, '../') // 定位到 docs 目录
  const sidebar = []

  // 读取 docs 下的所有目录和文件
  const files = fs.readdirSync(docsPath)

  files.forEach(file => {
    const filePath = path.join(docsPath, file)
    const stat = fs.statSync(filePath)

    // 如果是目录，且不是以 . 开头的隐藏目录
    if (stat.isDirectory() && !file.startsWith('.')) {
      const items = fs.readdirSync(filePath)
        .filter(f => f.endsWith('.md')) // 只找 .md 文件
        .map(f => ({
          text: f.replace('.md', ''), // 菜单显示的文件名
          link: `/${file}/${f.replace('.md', '')}` // 链接路径
        }))

      if (items.length > 0) {
        sidebar.push({
          text: file.toUpperCase(), // 文件夹名作为分类标题
          items: items
        })
      }
    }
  })

  return sidebar
}

export default defineConfig({
  title: "我的自动化笔记",
  ignoreDeadLinks: true, // 添加这一行，允许存在死链
  themeConfig: {
    sidebar: getSidebar() // 调用自动生成函数
  }
})