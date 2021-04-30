
const fs = require('fs-extra');
const inquirer = require('inquirer');
const handlebars = require('handlebars');
const ora = require('ora');
const chalk = require('chalk');
const symbols = require('log-symbols');
const { spawn } = require('child_process');
const path = require('path');

const now = new Date();

// 交互式获取用户 的需求
inquirer.prompt([
  {
    type: 'input',
    name: 'year',
    message: '请输入项目年份，比如2019(插件请输入"plugins")',
    default: now.getFullYear(),
  }, {
    type: 'input',
    name: 'name',
    message: '请输入项目名称，比如0702projectname(注意不要使用过长的文件名，CMS会报错)',
    default: `${String(now.getMonth() + 1).padStart(2, '00')}${now.getDate()}-projectName`,
  }, {
    type: 'list',
    name: 'platform',
    message: 'PC端项目还是wap端项目？',
    choices: ['pc', 'wap'],
    default: 0,
  }, {
    type: 'input',
    name: 'author',
    message: '请输入作者名称',
    default: 'author_name',
  }, {
    type: 'input',
    name: 'ztType',
    message: '请输入专题类型(kaoyan):',
    default: 'kaoyan',
  }, {
    type: 'confirm',
    name: 'autoInitialize',
    message: '是否自动安装依赖？',
  }, {
    type: 'list',
    name: 'packageManager',
    message: '使用哪种包管理工具？',
    choices: ['npm', 'yarn'],
    default: 0,
  },
]).then((answers) => {
  const { year, name } = answers;
  // 创建 专题  还是  插件
  const projectBasePath = year == 'plugins' ? 'project/plugins' : `project/zt/${year}/${name}`;
  
  answers.outputFolder = 'pro-dist';

  // 项目已存在则退出
  if (fs.existsSync(projectBasePath)) {
    return console.log(symbols.error, chalk.red('项目已存在'));
  }

  // 拷贝模板
  downloadTemplate(projectBasePath, answers);
  return true;
});

// 拷贝模板
function downloadTemplate (projectBasePath, answers) {
  let templatePath = path.join(__dirname, '../', 'template', 'base');
  // 把 基础模板 拷贝 到用户 输入后的新位置
  fs.copySync(templatePath, projectBasePath);

  // 处理wap的差异
  if (answers.platform === 'wap') {
    handlePlatform(projectBasePath);
  }

  // 处理package.json文件
  updatePackageJson(answers, projectBasePath);

  console.log(symbols.success, chalk.green('项目初始化成功'));

  // 如果开始交互式 有选择 默认安装依赖，则安装依赖
  answers.autoInitialize && yarnInstall(projectBasePath, answers.packageManager);
}

// 处理pc 和 wap的差异
function handlePlatform (projectBasePath) {
  // html模板引用文件
  const indexHtmlFileName = `${projectBasePath}/src/index.ejs`;
  // 读取 页面内容  把 引入的 pc转换为 wap 的（wap会做rem处理）
  const htmlFile = fs.readFileSync(indexHtmlFileName)
    .toString()
    .replace('./ejstpls/public-pc.ejs', './ejstpls/public-wap.ejs');

  // 处理之后把 模板 页面替换
  fs.writeFileSync(indexHtmlFileName, htmlFile);
}

// 合并选项到package.json
function updatePackageJson (answers, projectBasePath) {
  const meta = { ...answers };
  console.log(symbols.success, chalk.green(`你的配置是：\n${JSON.stringify(meta)}`));

  // 获取创建后 新的package.json
  const fileName = `${projectBasePath}/package.json`;

  // 获取里面 的内容
  const content = fs.readFileSync(fileName).toString();

  // 用模板引擎 修改  {{}} 的内容
  const result = handlebars.compile(content)(meta);

  // 重新 package.json
  fs.writeFileSync(fileName, result);
}

// 安装依赖
function yarnInstall (dir, pm) {
  // 提示用户安装中
  const spinner = ora('正在安装依赖……').start();
  // pm 是用选择的 npm 或者yarn  开始安装package.json 中的依赖
  const sp = spawn(pm, ['install'], {
    cwd: path.join(process.cwd(), `./${dir}`),
    // cwd: path.resolve(__dirname, `../${dir}`),
    shell: /^win/.test(process.platform),
  });

  // 这里仅仅是输出 查看，其实可以去掉
  sp.on('message', (msg) => {
    console.log(msg.toString());
  });
  sp.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  sp.on('close', (code) => {
    // 安装依赖失败
    if (code !== 0) {
      spinner.fail();
      return console.log(chalk.red(`安装失败，退出码 ${code}`));
    }
    // 安装依赖成功
    spinner.succeed();
    console.log(chalk.green(`下载依赖成功~请执行cd ${dir}`));
    return true;
  });
}
