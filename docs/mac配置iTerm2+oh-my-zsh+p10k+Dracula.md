本文介绍在mac中使用iTerm2+oh-my-zsh及各项插件，配置一个实用、美观的命令行工具。下图为安装好后的最终形态：
[图片]
安装内容涉及：
- brew
- iTerm2
- oh-my-zsh
- powerlevel10k
- Dracula
- zsh-autosuggestions
- zsh-syntax-highlighting
Brew
Brew全名Homebrew，是一种mac或linux上的开源包管理工具。
安装方式：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
对于mac m系列芯片，brew默认统一安装位置为/opt/homebrew 。
常用命令：
brew install xx       # 安装软件
brew uninstall xx     # 卸载软件
brew upgrade          # 更新所有软件
brew update           # 更新brew自身
brew list             # 列出brew所有已安装软件
iTerm2
iTerm2是mac中一个免费开源的终端模拟器，可作为自带的terminal的替代品。
安装方式：
brew install --cask iterm2
常用操作：
⌘+D（垂直分屏）
⌘+Shift+D（水平分屏）
⌘+Enter （切换全屏）
⌘+n （新建窗口）
⌘+t （新建标签页）
⌘+w （关闭标签页或窗口）
⌘+数字（如1、2等）或左右键 （标签页切换）
⌘+;  （自动补全）
⌘+k  （清屏）
ctrl+a  （移动到行首）
ctrl+e  （移动到行尾）
oh-my-zsh
oh-my-zsh是Zsh的配置管理框架，能自动管理.zshrc文件，并提供丰富的插件和主题。
安装方式：
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
powerlevel10k（p10k）主题
p10k是oh-my-zsh中一个比较流行且实用的主题。
安装方式：
brew install romkatv/powerlevel10k/powerlevel10k
echo "source $(brew --prefix)/opt/powerlevel10k/share/powerlevel10k/powerlevel10k.zsh-theme" >>~/.zshrc
可以手动通过如下命令重新定制化p10k主题：
p10k configure
Dracula配色
Dracula是一种iTerm2的配色方案（官网：https://draculatheme.com/powerlevel10k）：
安装步骤：
1. 克隆代码仓库
git clone https://github.com/dracula/powerlevel10k.git
1. 执行如下配置修改：注意，由于进行了配置文件的覆盖，因此建议在此操作前备份好原始的.zshrc和.p10k.zsh文件，后续需要根据实际情况对.zshrc文件进行手动调整。
cd powerlevel10k.git
cp ./files/.zshrc ~/.zshrc
cp ./files/.p10k.zsh ~/.p10k.zsh
1. 通常，.zshrc文件中需要修改的内容包括：
export ZSH="/Users/你的用户名/.oh-my-zsh"
source $ZSH/oh-my-zsh.sh
eval "$(/opt/homebrew/bin/brew shellenv)"
source /opt/homebrew/opt/powerlevel10k/share/powerlevel10k/powerlevel10k.zsh-theme
oh-my-zsh实用插件安装
zsh-autosuggestions
zsh-autosuggestions能根据历史命令自动给出命令行补全建议。
安装流程：
brew install zsh-autosuggestions
echo "source $(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh" >> ~/.zshrc
source ~/.zshrc
zsh-syntax-highlighting
zsh-syntax-highlighting能根据shell语法对错误语法进行红色高亮显示。
安装流程：
brew install zsh-syntax-highlighting
echo "source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" >> ~/.zshrc
source ~/.zshrc
上述流程均安装完成后，便可实现展示图中效果。