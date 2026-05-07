import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

// 自动化生成侧边栏的函数
function getSidebar() {
  const docsPath = path.resolve(process.cwd(), 'docs')
  const sidebar = []

  // 读取 docs 下的所有内容
  const items = fs.readdirSync(docsPath)

  // 1. 处理直接放在 docs 根目录下的 .md 文件 (排除 index.md)
  const rootFiles = items.filter(item => {
    const fullPath = path.join(docsPath, item)
    return fs.statSync(fullPath).isFile() && item.endsWith('.md') && item !== 'index.md'
  }).map(file => ({
    text: file.replace('.md', ''),
    link: `/${file.replace('.md', '')}`
  }))

  if (rootFiles.length > 0) {
    sidebar.push({
      text: '基础文档',
      items: rootFiles
    })
  }

  // 2. 处理 docs 下的子文件夹 (如 docs/eks/xxx.md)
  items.forEach(item => {
    const fullPath = path.join(docsPath, item)
    if (fs.statSync(fullPath).isDirectory() && !item.startsWith('.')) {
      const subItems = fs.readdirSync(fullPath)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
          text: f.replace('.md', ''),
          link: `/${item}/${f.replace('.md', '')}`
        }))

      if (subItems.length > 0) {
        sidebar.push({
          text: item.toUpperCase(), // 文件夹名作为分类标题
          collapsed: false,
          items: subItems
        })
      }
    }
  })

  return sidebar
}

export default defineConfig({
  title: "我的技术笔记",
  description: "自动化构建的 EKS & Java 学习站",
  
  // 解决你之前的报错：允许存在死链，直到你修复它们
  ignoreDeadLinks: true,

  themeConfig: {
    // 网站顶部的导航
    nav: [
      { text: '首页', link: '/' },
    ],

    // 调用上面定义的自动生成侧边栏函数
    sidebar: getSidebar(),

    // 右侧大纲标题级别
    outline: {
      level: [2, 6],
      label: '目录'
    },

    // 社交链接 (可选)
    socialLinks: [
      { icon: 'github', link: 'https://github.com/jackchen1941/my_site' }
    ],

    // 页脚 (可选)
    footer: {
      message: '基于 VitePress & Cloudflare Pages 构建',
      copyright: `Copyright © ${new Date().getFullYear()}`
    }
  }
})